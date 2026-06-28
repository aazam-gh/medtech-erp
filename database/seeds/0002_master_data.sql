insert into public.departments(code, name, cost_center) values
('EXEC','Executive Management','CC-100'),('FIN','Finance','CC-200'),('HR','Human Resources','CC-300'),
('SAL','Sales & Marketing','CC-400'),('PRC','Procurement','CC-500'),('WHS','Warehouse','CC-600'),
('LOG','Shipping & Logistics','CC-700'),('SRV','Service & Support','CC-800'),('PRJ','Projects','CC-900')
on conflict(code) do nothing;

insert into public.company_settings(legal_name, trade_name, address_line_1, email, phone, website)
select 'MedTech Corporation Trading W.L.L.','MedTech','Doha, State of Qatar','info@medtech.qa','+974 4400 0000','https://medtech.qa'
where not exists (select 1 from public.company_settings);

insert into public.categories(name, description) values
('Surgical Devices','Instruments and devices for surgical care'),('Consumables','Single-use and routine clinical supplies'),
('Diagnostics','Diagnostic equipment and systems'),('Life Sciences','Research and life science products'),
('Reagents','Laboratory reagents and kits'),('Equipment','Capital medical equipment'),('Spare Parts','Service and replacement components')
on conflict(name) do nothing;

insert into public.stock_locations(code, name, type) values
('WH-MAIN','Main Doha Warehouse','internal'),('WH-QA','Quality Inspection','internal'),('WH-RET','Returns & Damaged','internal'),('TRANSIT','Goods in Transit','transit')
on conflict(code) do nothing;

insert into public.chart_of_accounts(code,name,account_type) values
('1000','Assets','asset'),('1100','Cash and Bank','asset'),('1200','Accounts Receivable','asset'),('1300','Inventory','asset'),
('2000','Liabilities','liability'),('2100','Accounts Payable','liability'),('3000','Equity','equity'),
('4000','Sales Revenue','revenue'),('4100','Service Revenue','revenue'),('5000','Cost of Goods Sold','expense'),('6000','Operating Expenses','expense')
on conflict(code) do nothing;

insert into public.profiles(identity_provider, identity_subject, full_name, email, job_title, is_active)
values ('local', 'local-super-admin', 'Local Super Admin', 'admin@medtech.local', 'System Administrator', true)
on conflict(identity_subject) do update set
  full_name = excluded.full_name,
  email = excluded.email,
  job_title = excluded.job_title,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.user_roles(user_id, role_id)
select profile.id, role.id
from public.profiles profile
join public.roles role on role.code = 'super_admin'
where profile.identity_subject = 'local-super-admin'
on conflict do nothing;
