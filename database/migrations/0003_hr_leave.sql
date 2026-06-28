begin;

create extension if not exists btree_gist;

insert into public.document_sequences(entity_type, prefix, padding) values
  ('leave_application', 'LV', 5),
  ('leave_approval', 'LVA', 4)
on conflict(entity_type) do update set prefix = excluded.prefix, padding = excluded.padding;

create table public.employee_leave_balances (
  employee_id uuid not null references public.employees(id) on delete cascade,
  leave_type text not null,
  balance_days numeric(8,2) not null default 0 check (balance_days >= 0),
  updated_at timestamptz not null default now(),
  primary key(employee_id, leave_type)
);

create table public.leave_applications (
  id uuid primary key default gen_random_uuid(),
  request_no text not null unique default public.next_document_number('leave_application'),
  employee_id uuid not null references public.employees(id),
  employee_code text not null,
  employee_name text not null,
  department text,
  designation text,
  leave_type text not null,
  start_date date not null,
  end_date date not null,
  calendar_days numeric(8,2) not null check (calendar_days > 0),
  working_days numeric(8,2) not null check (working_days > 0),
  balance_before numeric(8,2) not null default 0,
  balance_after numeric(8,2) not null default 0,
  purpose text,
  destination text,
  travel_from date,
  travel_to date,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_email citext,
  handover_to_employee_id uuid references public.employees(id),
  handover_to_employee_code text,
  handover_to_name text,
  status text not null default 'draft' check (status in ('draft','submitted','pending_approval','approved','rejected','cancelled')),
  pdf_url text,
  created_by uuid references public.profiles(id),
  balance_deducted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leave_applications_date_order check (end_date >= start_date),
  constraint leave_applications_travel_order check (travel_from is null or travel_to is null or travel_to >= travel_from)
);

create table public.leave_approvals (
  id uuid primary key default gen_random_uuid(),
  decision_no text not null unique default public.next_document_number('leave_approval'),
  leave_application_id uuid not null references public.leave_applications(id) on delete cascade,
  request_no text not null,
  employee_id uuid not null references public.employees(id),
  employee_code text not null,
  employee_name text not null,
  approved_from date not null,
  approved_to date not null,
  days numeric(8,2) not null check (days > 0),
  approver_id uuid references public.profiles(id),
  approver_name text,
  decision text not null default 'pending' check (decision in ('pending','approved','rejected')),
  decision_date timestamptz,
  approval_notes text,
  pdf_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leave_approvals_one_per_application unique(leave_application_id),
  constraint leave_approvals_date_order check (approved_to >= approved_from)
);

create index leave_applications_employee_status_idx on public.leave_applications(employee_id, status, start_date, end_date);
create index leave_applications_search_idx on public.leave_applications using gin (to_tsvector('simple', employee_code || ' ' || employee_name || ' ' || request_no || ' ' || coalesce(department,'') || ' ' || leave_type || ' ' || status));
create index leave_approvals_employee_decision_idx on public.leave_approvals(employee_id, decision, approved_from, approved_to);
create index leave_approvals_search_idx on public.leave_approvals using gin (to_tsvector('simple', employee_code || ' ' || employee_name || ' ' || request_no || ' ' || decision_no || ' ' || coalesce(approver_name,'') || ' ' || decision));

create trigger employee_leave_balances_updated_at
before update on public.employee_leave_balances
for each row execute function public.set_updated_at();

create trigger leave_applications_updated_at
before update on public.leave_applications
for each row execute function public.set_updated_at();

create trigger leave_approvals_updated_at
before update on public.leave_approvals
for each row execute function public.set_updated_at();

create or replace function public.validate_leave_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('submitted','pending_approval','approved') and exists (
    select 1
    from public.leave_applications existing
    where existing.employee_id = new.employee_id
      and existing.id <> new.id
      and existing.status in ('submitted','pending_approval','approved')
      and daterange(existing.start_date, existing.end_date, '[]') && daterange(new.start_date, new.end_date, '[]')
  ) then
    raise exception 'This employee already has an overlapping submitted, pending, or approved leave request.';
  end if;

  if new.handover_to_employee_id is not null and new.handover_to_employee_id = new.employee_id then
    raise exception 'Handover employee must be different from the leave applicant.';
  end if;

  if new.status in ('rejected','cancelled') then
    new.balance_after := new.balance_before;
    new.balance_deducted := false;
  end if;

  return new;
end;
$$;

create trigger validate_leave_application_before_write
before insert or update on public.leave_applications
for each row execute function public.validate_leave_application();

create or replace function public.resolve_leave_approver(p_employee_id uuid, p_created_by uuid)
returns table(approver_id uuid, approver_name text)
language sql
stable
security definer
set search_path = public
as $$
  with manager_profile as (
    select manager.profile_id as id, profile.full_name
    from public.employees employee
    join public.employees manager on manager.id = employee.manager_id
    join public.profiles profile on profile.id = manager.profile_id
    where employee.id = p_employee_id and manager.profile_id is not null
    limit 1
  ),
  hr_profile as (
    select profile.id, profile.full_name
    from public.profiles profile
    join public.user_roles user_role on user_role.user_id = profile.id
    join public.roles role on role.id = user_role.role_id
    where role.code in ('hr_manager','management','super_admin') and profile.is_active
    order by case role.code when 'hr_manager' then 1 when 'management' then 2 else 3 end, profile.full_name
    limit 1
  ),
  creator_profile as (
    select profile.id, profile.full_name
    from public.profiles profile
    where profile.id = p_created_by
    limit 1
  )
  select id, full_name from manager_profile
  union all select id, full_name from hr_profile where not exists (select 1 from manager_profile)
  union all select id, full_name from creator_profile where not exists (select 1 from manager_profile) and not exists (select 1 from hr_profile)
  limit 1;
$$;

create or replace function public.sync_leave_approval_from_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_approver_id uuid;
  target_approver_name text;
begin
  if new.status = 'submitted' then
    select approver_id, approver_name
    into target_approver_id, target_approver_name
    from public.resolve_leave_approver(new.employee_id, new.created_by);

    insert into public.leave_approvals (
      leave_application_id, request_no, employee_id, employee_code, employee_name,
      approved_from, approved_to, days, approver_id, approver_name, decision
    )
    values (
      new.id, new.request_no, new.employee_id, new.employee_code, new.employee_name,
      new.start_date, new.end_date, new.working_days, target_approver_id, target_approver_name, 'pending'
    )
    on conflict (leave_application_id) do update set
      request_no = excluded.request_no,
      employee_id = excluded.employee_id,
      employee_code = excluded.employee_code,
      employee_name = excluded.employee_name,
      approved_from = excluded.approved_from,
      approved_to = excluded.approved_to,
      days = excluded.days,
      approver_id = coalesce(public.leave_approvals.approver_id, excluded.approver_id),
      approver_name = coalesce(public.leave_approvals.approver_name, excluded.approver_name),
      updated_at = now()
    where public.leave_approvals.decision = 'pending';

    update public.leave_applications
    set status = 'pending_approval', updated_at = now()
    where id = new.id and status = 'submitted';
  elsif new.status = 'cancelled' then
    update public.leave_approvals
    set approval_notes = concat_ws(E'\n', nullif(approval_notes, ''), 'Application cancelled before decision.'),
        updated_at = now()
    where leave_application_id = new.id and decision = 'pending';
  end if;

  return new;
end;
$$;

create trigger sync_leave_approval_after_application_write
after insert or update of status, employee_id, employee_code, employee_name, start_date, end_date, working_days on public.leave_applications
for each row execute function public.sync_leave_approval_from_application();

create or replace function public.apply_leave_approval_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  application record;
  current_balance numeric(8,2);
  new_balance numeric(8,2);
begin
  if new.decision = old.decision then
    return new;
  end if;

  if old.decision <> 'pending' then
    raise exception 'Leave approval decision has already been finalized.';
  end if;

  select * into application
  from public.leave_applications
  where id = new.leave_application_id
  for update;

  if not found then
    raise exception 'Linked leave application was not found.';
  end if;

  if new.decision = 'approved' then
    insert into public.employee_leave_balances(employee_id, leave_type, balance_days)
    values(application.employee_id, application.leave_type, greatest(application.balance_before, 0))
    on conflict (employee_id, leave_type) do nothing;

    select balance_days into current_balance
    from public.employee_leave_balances
    where employee_id = application.employee_id and leave_type = application.leave_type
    for update;

    if application.balance_deducted then
      new_balance := application.balance_after;
    else
      if current_balance < application.working_days then
        raise exception 'Insufficient leave balance for approval.';
      end if;

      new_balance := current_balance - application.working_days;

      update public.employee_leave_balances
      set balance_days = new_balance, updated_at = now()
      where employee_id = application.employee_id and leave_type = application.leave_type;
    end if;

    update public.leave_applications
    set status = 'approved',
        balance_before = current_balance,
        balance_after = new_balance,
        balance_deducted = true,
        updated_at = now()
    where id = application.id;
  elsif new.decision = 'rejected' then
    update public.leave_applications
    set status = 'rejected',
        balance_after = balance_before,
        balance_deducted = false,
        updated_at = now()
    where id = application.id;
  end if;

  return new;
end;
$$;

create trigger apply_leave_approval_decision_after_update
after update of decision on public.leave_approvals
for each row execute function public.apply_leave_approval_decision();

commit;

begin;

create table public.leave_handovers (
  id uuid primary key default gen_random_uuid(),
  leave_application_id uuid not null references public.leave_applications(id) on delete cascade,
  request_no text not null,
  employee_id uuid not null references public.employees(id),
  employee_code text not null,
  employee_name text not null,
  leave_start_date date not null,
  leave_end_date date not null,
  handover_to_employee_id uuid not null references public.employees(id),
  handover_to_employee_code text not null,
  handover_to_name text not null,
  tasks_notes text check (tasks_notes is null or char_length(tasks_notes) <= 4000),
  attachment_url text,
  status text not null default 'pending' check (status in ('pending','accepted','cancelled')),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leave_handovers_one_per_application unique(leave_application_id),
  constraint leave_handovers_not_self check (employee_id <> handover_to_employee_id),
  constraint leave_handovers_date_order check (leave_end_date >= leave_start_date),
  constraint leave_handovers_acceptance_consistent check (
    (status = 'accepted' and accepted_at is not null)
    or (status <> 'accepted')
  )
);

create index leave_handovers_employee_idx on public.leave_handovers(employee_id, status, leave_start_date, leave_end_date);
create index leave_handovers_handover_to_idx on public.leave_handovers(handover_to_employee_id, status);
create index leave_handovers_search_idx on public.leave_handovers using gin (
  to_tsvector(
    'simple',
    employee_code || ' ' || employee_name || ' ' || request_no || ' ' ||
    handover_to_employee_code || ' ' || handover_to_name || ' ' || status
  )
);

create trigger leave_handovers_updated_at
before update on public.leave_handovers
for each row execute function public.set_updated_at();

create or replace function public.sync_leave_handover_from_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  handover_changed boolean := false;
  target_handover_code text;
  target_handover_name text;
begin
  if tg_op = 'UPDATE' then
    handover_changed := new.handover_to_employee_id is distinct from old.handover_to_employee_id;
  end if;

  if new.handover_to_employee_id is null then
    if tg_op = 'UPDATE' then
      update public.leave_handovers
      set status = 'cancelled',
          accepted_at = null,
          updated_at = now()
      where leave_application_id = new.id
        and status <> 'cancelled';
    end if;
    return new;
  end if;

  if new.status in ('submitted','pending_approval','approved','rejected','cancelled') then
    select
      coalesce(new.handover_to_employee_code, employee.employee_number),
      coalesce(new.handover_to_name, employee.full_name)
    into target_handover_code, target_handover_name
    from public.employees employee
    where employee.id = new.handover_to_employee_id;

    if target_handover_code is null or target_handover_name is null then
      raise exception 'Linked handover employee was not found.';
    end if;

    insert into public.leave_handovers (
      leave_application_id,
      request_no,
      employee_id,
      employee_code,
      employee_name,
      leave_start_date,
      leave_end_date,
      handover_to_employee_id,
      handover_to_employee_code,
      handover_to_name,
      status,
      accepted_at
    )
    values (
      new.id,
      new.request_no,
      new.employee_id,
      new.employee_code,
      new.employee_name,
      new.start_date,
      new.end_date,
      new.handover_to_employee_id,
      target_handover_code,
      target_handover_name,
      case when new.status in ('rejected','cancelled') then 'cancelled' else 'pending' end,
      null
    )
    on conflict (leave_application_id) do update set
      request_no = excluded.request_no,
      employee_id = excluded.employee_id,
      employee_code = excluded.employee_code,
      employee_name = excluded.employee_name,
      leave_start_date = excluded.leave_start_date,
      leave_end_date = excluded.leave_end_date,
      handover_to_employee_id = excluded.handover_to_employee_id,
      handover_to_employee_code = excluded.handover_to_employee_code,
      handover_to_name = excluded.handover_to_name,
      status = case
        when new.status in ('rejected','cancelled') then 'cancelled'
        when handover_changed then 'pending'
        else public.leave_handovers.status
      end,
      accepted_at = case
        when new.status in ('rejected','cancelled') or handover_changed then null
        else public.leave_handovers.accepted_at
      end,
      updated_at = now();
  end if;

  return new;
end;
$$;

create trigger sync_leave_handover_after_application_write
after insert or update of status, employee_id, employee_code, employee_name, start_date, end_date, handover_to_employee_id, handover_to_employee_code, handover_to_name
on public.leave_applications
for each row execute function public.sync_leave_handover_from_application();

insert into public.leave_handovers (
  leave_application_id,
  request_no,
  employee_id,
  employee_code,
  employee_name,
  leave_start_date,
  leave_end_date,
  handover_to_employee_id,
  handover_to_employee_code,
  handover_to_name,
  status
)
select
  application.id,
  application.request_no,
  application.employee_id,
  application.employee_code,
  application.employee_name,
  application.start_date,
  application.end_date,
  application.handover_to_employee_id,
  application.handover_to_employee_code,
  application.handover_to_name,
  case when application.status in ('rejected','cancelled') then 'cancelled' else 'pending' end
from public.leave_applications application
where application.handover_to_employee_id is not null
  and application.status in ('submitted','pending_approval','approved','rejected','cancelled')
on conflict (leave_application_id) do nothing;

commit;

begin;

create table public.leave_clearances (
  id uuid primary key default gen_random_uuid(),
  leave_application_id uuid not null references public.leave_applications(id) on delete cascade,
  request_no text not null,
  employee_id uuid not null references public.employees(id),
  employee_code text not null,
  employee_name text not null,
  department text,
  leave_start_date date not null,
  leave_end_date date not null,
  clearance_items text[] not null default array[]::text[],
  responsible_person text,
  status text not null default 'pending' check (status in ('not_required','pending','in_progress','cleared','blocked')),
  comments text check (comments is null or char_length(comments) <= 4000),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leave_clearances_one_per_application unique(leave_application_id),
  constraint leave_clearances_date_order check (leave_end_date >= leave_start_date),
  constraint leave_clearances_completed_consistent check (
    (status = 'cleared' and completed_at is not null)
    or (status <> 'cleared')
  )
);

create index leave_clearances_employee_idx on public.leave_clearances(employee_id, status, leave_start_date, leave_end_date);
create index leave_clearances_department_status_idx on public.leave_clearances(department, status);
create index leave_clearances_search_idx on public.leave_clearances using gin (
  to_tsvector(
    'simple',
    employee_code || ' ' || employee_name || ' ' || request_no || ' ' || coalesce(department, '') || ' ' || status
  )
);

create trigger leave_clearances_updated_at
before update on public.leave_clearances
for each row execute function public.set_updated_at();

create or replace function public.sync_leave_clearance_from_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' then
    insert into public.leave_clearances (
      leave_application_id,
      request_no,
      employee_id,
      employee_code,
      employee_name,
      department,
      leave_start_date,
      leave_end_date,
      clearance_items,
      status
    )
    values (
      new.id,
      new.request_no,
      new.employee_id,
      new.employee_code,
      new.employee_name,
      new.department,
      new.start_date,
      new.end_date,
      array['Company assets returned', 'Access and responsibilities reviewed', 'Pending work closed or assigned'],
      'pending'
    )
    on conflict (leave_application_id) do update set
      request_no = excluded.request_no,
      employee_id = excluded.employee_id,
      employee_code = excluded.employee_code,
      employee_name = excluded.employee_name,
      department = excluded.department,
      leave_start_date = excluded.leave_start_date,
      leave_end_date = excluded.leave_end_date,
      updated_at = now();
  end if;

  return new;
end;
$$;

create trigger sync_leave_clearance_after_application_write
after insert or update of status, employee_id, employee_code, employee_name, department, start_date, end_date
on public.leave_applications
for each row execute function public.sync_leave_clearance_from_application();

insert into public.leave_clearances (
  leave_application_id,
  request_no,
  employee_id,
  employee_code,
  employee_name,
  department,
  leave_start_date,
  leave_end_date,
  clearance_items,
  status
)
select
  application.id,
  application.request_no,
  application.employee_id,
  application.employee_code,
  application.employee_name,
  application.department,
  application.start_date,
  application.end_date,
  array['Company assets returned', 'Access and responsibilities reviewed', 'Pending work closed or assigned'],
  'pending'
from public.leave_applications application
where application.status = 'approved'
on conflict (leave_application_id) do nothing;

commit;

begin;

create table public.leave_rejoins (
  id uuid primary key default gen_random_uuid(),
  leave_application_id uuid not null references public.leave_applications(id) on delete cascade,
  request_no text not null,
  employee_id uuid not null references public.employees(id),
  employee_code text not null,
  employee_name text not null,
  original_return_date date not null,
  actual_rejoin_date date,
  delay_days integer not null default 0 check (delay_days >= 0),
  reason_for_delay text check (reason_for_delay is null or char_length(reason_for_delay) <= 4000),
  medical_or_supporting_attachment text,
  status text not null default 'pending_rejoin' check (status in ('pending_rejoin','rejoined_on_time','delayed_rejoin','no_show','verified')),
  hr_verified_by text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leave_rejoins_one_per_application unique(leave_application_id),
  constraint leave_rejoins_actual_requires_recorded_status check (
    status in ('pending_rejoin','no_show') or actual_rejoin_date is not null
  ),
  constraint leave_rejoins_verified_consistent check (
    (status = 'verified' and actual_rejoin_date is not null and hr_verified_by is not null and verified_at is not null)
    or (status <> 'verified')
  )
);

create index leave_rejoins_employee_idx on public.leave_rejoins(employee_id, status, original_return_date, actual_rejoin_date);
create index leave_rejoins_return_date_idx on public.leave_rejoins(original_return_date, actual_rejoin_date);
create index leave_rejoins_search_idx on public.leave_rejoins using gin (
  to_tsvector(
    'simple',
    employee_code || ' ' || employee_name || ' ' || request_no || ' ' || status
  )
);

create trigger leave_rejoins_updated_at
before update on public.leave_rejoins
for each row execute function public.set_updated_at();

create or replace function public.normalize_leave_rejoin()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.actual_rejoin_date is null then
    new.delay_days := 0;
  else
    new.delay_days := greatest((new.actual_rejoin_date - new.original_return_date), 0);
  end if;

  if new.status = 'verified' and new.verified_at is null then
    new.verified_at := now();
  end if;

  if new.status <> 'verified' then
    new.verified_at := null;
    new.hr_verified_by := null;
  end if;

  return new;
end;
$$;

create trigger normalize_leave_rejoin_before_write
before insert or update on public.leave_rejoins
for each row execute function public.normalize_leave_rejoin();

create or replace function public.sync_leave_rejoin_from_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' then
    insert into public.leave_rejoins (
      leave_application_id,
      request_no,
      employee_id,
      employee_code,
      employee_name,
      original_return_date,
      status
    )
    values (
      new.id,
      new.request_no,
      new.employee_id,
      new.employee_code,
      new.employee_name,
      new.end_date + 1,
      'pending_rejoin'
    )
    on conflict (leave_application_id) do update set
      request_no = excluded.request_no,
      employee_id = excluded.employee_id,
      employee_code = excluded.employee_code,
      employee_name = excluded.employee_name,
      original_return_date = excluded.original_return_date,
      updated_at = now();
  end if;

  return new;
end;
$$;

create trigger sync_leave_rejoin_after_application_write
after insert or update of status, employee_id, employee_code, employee_name, end_date
on public.leave_applications
for each row execute function public.sync_leave_rejoin_from_application();

insert into public.leave_rejoins (
  leave_application_id,
  request_no,
  employee_id,
  employee_code,
  employee_name,
  original_return_date,
  status
)
select
  application.id,
  application.request_no,
  application.employee_id,
  application.employee_code,
  application.employee_name,
  application.end_date + 1,
  'pending_rejoin'
from public.leave_applications application
where application.status = 'approved'
on conflict (leave_application_id) do nothing;

commit;
