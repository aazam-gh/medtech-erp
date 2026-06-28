insert into public.roles(code, name, description) values
('super_admin','Super Admin','Full system administration'),
('management','Management','Executive access across all modules'),
('finance_manager','Finance Manager','Finance operations and approvals'),
('hr_manager','HR Manager','People, payroll and employee records'),
('sales_manager','Sales Manager','Commercial pipeline and discount approvals'),
('sales_executive','Sales Executive','Assigned sales records and quotations'),
('shipping_team','Shipping Team','Shipment and delivery operations'),
('warehouse_team','Warehouse Team','Inventory and warehouse operations'),
('procurement_team','Procurement Team','Supplier sourcing and purchasing'),
('service_engineer','Service Engineer','Assigned service and maintenance work'),
('project_manager','Project Manager','Project planning and delivery'),
('auditor','Read-only Auditor','Read-only access with audit trail visibility')
on conflict(code) do update set name = excluded.name, description = excluded.description;

insert into public.permissions(code, module, action, description)
select module || '.' || action, module, action, initcap(action) || ' ' || module
from unnest(array['admin','finance','hr','sales','shipping','inventory','procurement','service','projects','documents','approvals','reports']) module
cross join unnest(array['view','create','update','delete','approve','export','admin']) action
on conflict(code) do nothing;

-- Super Admin receives every permission; Management receives view/export/approve.
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p where r.code = 'super_admin'
on conflict do nothing;
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p where r.code = 'management' and p.action in ('view','export','approve')
on conflict do nothing;

-- Module roles receive normal CRUD/export for their area.
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.module = case r.code
  when 'finance_manager' then 'finance' when 'hr_manager' then 'hr' when 'sales_manager' then 'sales'
  when 'sales_executive' then 'sales' when 'shipping_team' then 'shipping' when 'warehouse_team' then 'inventory'
  when 'procurement_team' then 'procurement' when 'service_engineer' then 'service' when 'project_manager' then 'projects' end
where r.code in ('finance_manager','hr_manager','sales_manager','sales_executive','shipping_team','warehouse_team','procurement_team','service_engineer','project_manager')
  and p.action in ('view','create','update','export')
on conflict do nothing;

-- Managers may approve within their functional area.
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.module = case r.code when 'finance_manager' then 'finance' when 'hr_manager' then 'hr' when 'sales_manager' then 'sales' end and p.action = 'approve'
where r.code in ('finance_manager','hr_manager','sales_manager') on conflict do nothing;

insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p where r.code = 'auditor' and p.action in ('view','export') on conflict do nothing;

insert into public.document_sequences(entity_type, prefix, padding) values
('stock_movement','MOV',6),('document','DOC',6),('lead','LEAD',5),('opportunity','OPP',5),
('quotation','QTN',5),('sales_order','SO',5),('invoice','INV',5),('payment','PAY',5),('expense','EXP',5),
('purchase_request','PR',5),('rfq','RFQ',5),('purchase_order','PO',5),('goods_receipt','GRN',5),
('shipment','SHP',5),('delivery_note','DN',5),('service_ticket','SRV',5),('installation','INS',5),
('project','PRJ',5),('leave_request','LV',5)
on conflict(entity_type) do nothing;
