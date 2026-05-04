insert into public.app_settings (id, store_name, manager_phone, manager_password, preferred_view)
values (true, 'Amazon Cafe สาขา CW Tower', '0800000004', 'AMZ0004', 'desktop')
on conflict (id) do update
set store_name = excluded.store_name,
    manager_phone = excluded.manager_phone,
    manager_password = excluded.manager_password,
    preferred_view = excluded.preferred_view;

insert into public.employees (id, employee_code, name, role, avatar, phone, password, active, availability_status, skills)
values
  (1, 'AMZ0001', 'สมชาย', 'บาริสต้า', '👨🏻', '0800000001', 'AMZ0001', true, 'ready', '{}'),
  (2, 'AMZ0002', 'สมหญิง', 'บาริสต้า', '👩🏻', '0800000002', 'AMZ0002', true, 'ready', '{}'),
  (3, 'AMZ0003', 'อนันต์', 'พนักงานบริการ', '👨🏽', '0800000003', 'AMZ0003', true, 'ready', '{}'),
  (4, 'AMZ0004', 'มานพ', 'ผู้จัดการร้าน', '🧑🏻', '0800000004', 'AMZ0004', true, 'ready', '{}'),
  (5, 'AMZ0005', 'พลอย', 'พาทไทม์', '👩🏽', '0800000005', 'AMZ0005', true, 'ready', '{}')
on conflict (id) do update
set employee_code = excluded.employee_code,
    name = excluded.name,
    role = excluded.role,
    avatar = excluded.avatar,
    phone = excluded.phone,
    password = excluded.password,
    active = excluded.active,
    availability_status = excluded.availability_status,
    skills = excluded.skills;

insert into public.employee_availability (employee_id, date_key, status)
values
  (2, current_date, 'annual_leave'),
  (2, current_date + interval '1 day', 'annual_leave'),
  (2, current_date + interval '7 day', 'personal_leave'),
  (2, current_date + interval '8 day', 'personal_leave'),
  (3, current_date, 'absent'),
  (3, current_date + interval '5 day', 'sick_leave')
on conflict (employee_id, date_key) do update
set status = excluded.status;

insert into public.calendar_day_settings (date_key, leave_locked, double_pay)
values
  (current_date + interval '2 day', true, false),
  (current_date + interval '6 day', false, true)
on conflict (date_key) do update
set leave_locked = excluded.leave_locked,
    double_pay = excluded.double_pay;

insert into public.schedule_blocks (id, date_key, time_label, title, required, status, tasks, template_id)
values
  (1, current_date, '06:30 - 09:30', 'เปิดร้าน', 2, 'ok', array['เปิดร้าน', 'เปิดเครื่องกาแฟ', 'เตรียมวัตถุดิบ', 'ส่งงานมาตรฐาน'], null),
  (2, current_date, '10:00', 'เช็ดโต๊ะ', 1, 'ok', array['เช็ดโต๊ะ', 'กวาดร้าน'], null),
  (3, current_date, '13:00', 'เติมน้ำแข็ง', 1, 'ok', array['เติมน้ำแข็ง', 'เช็ดโต๊ะ', 'ดูร้าน'], null),
  (4, current_date, '14:00 - 16:00', 'เติมนม', 1, 'ok', array['เติมนม', 'เช็คสต็อก', 'เตรียมวัตถุดิบ'], null),
  (5, current_date, '17:00 - 17:30', 'เช็คปิดร้าน', 2, 'ok', array['ทำความสะอาดเครื่อง', 'เช็คสต็อก', 'เช็คปิดร้าน'], null)
on conflict (id) do update
set date_key = excluded.date_key,
    time_label = excluded.time_label,
    title = excluded.title,
    required = excluded.required,
    status = excluded.status,
    tasks = excluded.tasks,
    template_id = excluded.template_id;

delete from public.schedule_block_assignments where block_id in (1, 2, 3, 4, 5);

insert into public.schedule_block_assignments (block_id, employee_id)
values
  (1, 1),
  (1, 4),
  (2, 3),
  (2, 5),
  (3, 2),
  (3, 5),
  (4, 3),
  (5, 1),
  (5, 2),
  (5, 4)
on conflict (block_id, employee_id) do nothing;

insert into public.requests (id, title, request_type, detail, status, created_at)
values
  (1, 'ขอรับพนักงานเพิ่ม', 'ขอพนักงานเพิ่ม', null, 'รอดำเนินการ', '2026-05-02T08:30:00+07:00'),
  (2, 'แจ้งพนักงานลาออก', null, null, 'ดำเนินการแล้ว', '2026-05-01T17:45:00+07:00'),
  (3, 'แจ้งคนขาดกะ', null, null, 'ดำเนินการแล้ว', '2026-05-01T10:15:00+07:00'),
  (4, 'ขอเปลี่ยนกะ', 'ขอเปลี่ยนกะ', null, 'รอดำเนินการ', '2026-04-30T09:20:00+07:00')
on conflict (id) do update
set title = excluded.title,
    request_type = excluded.request_type,
    detail = excluded.detail,
    status = excluded.status,
    created_at = excluded.created_at;

insert into public.inventory_items (id, name, category, quantity, unit, threshold, expires_on, no_expiry, checked_at, checked_by, received_today, sold_today, use_today, base_quantity)
values
  (101, 'เมล็ดกาแฟ House Blend', 'วัตถุดิบ', 3, 'ถุง', 2, '2026-05-18', false, '2026-05-03T07:40:00+07:00', 'สมชาย', 1, 42, false, 0),
  (102, 'นมสดพาสเจอร์ไรส์', 'นม', 8, 'ขวด', 5, '2026-05-06', false, '2026-05-03T08:10:00+07:00', 'สมหญิง', 4, 18, true, 0),
  (103, 'ไซรัปวานิลลา', 'เครื่องดื่ม', 2, 'ขวด', 2, '2026-06-20', false, '2026-05-03T09:00:00+07:00', 'อนันต์', 0, 12, false, 0),
  (104, 'ครัวซองต์เนยสด', 'ขนม', 9, 'ชิ้น', 6, '2026-05-04', false, '2026-05-03T06:50:00+07:00', 'พลอย', 6, 15, true, 0),
  (105, 'แก้วเย็น 16 oz', 'อุปกรณ์', 54, 'ใบ', 20, null, true, '2026-05-03T10:00:00+07:00', 'มานพ', 12, 37, false, 0)
on conflict (id) do update
set name = excluded.name,
    category = excluded.category,
    quantity = excluded.quantity,
    unit = excluded.unit,
    threshold = excluded.threshold,
    expires_on = excluded.expires_on,
    no_expiry = excluded.no_expiry,
    checked_at = excluded.checked_at,
    checked_by = excluded.checked_by,
    received_today = excluded.received_today,
    sold_today = excluded.sold_today,
    use_today = excluded.use_today,
    base_quantity = excluded.base_quantity;

insert into public.issue_reports (id, title, detail, severity, status, created_at)
values
  (201, 'ตู้แช่นมเย็นไม่คงที่', 'อุณหภูมิขึ้นลงช่วงเช้า ควรให้ช่างเข้าตรวจสอบ', 'สูง', 'รอดำเนินการ', '2026-05-03T09:20:00+07:00'),
  (202, 'ฝาถังขยะหลังบาร์หลวม', 'เปิดปิดไม่สนิท เวลาช่วงเร่งด่วนใช้งานไม่สะดวก', 'กลาง', 'กำลังตรวจสอบ', '2026-05-02T18:15:00+07:00')
on conflict (id) do update
set title = excluded.title,
    detail = excluded.detail,
    severity = excluded.severity,
    status = excluded.status,
    created_at = excluded.created_at;

select setval(pg_get_serial_sequence('public.employees', 'id'), greatest((select max(id) from public.employees), 1), true);
select setval(pg_get_serial_sequence('public.requests', 'id'), greatest((select max(id) from public.requests), 1), true);
select setval(pg_get_serial_sequence('public.inventory_items', 'id'), greatest((select max(id) from public.inventory_items), 1), true);
select setval(pg_get_serial_sequence('public.issue_reports', 'id'), greatest((select max(id) from public.issue_reports), 1), true);
