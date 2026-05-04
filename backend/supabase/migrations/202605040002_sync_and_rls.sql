alter table public.app_settings
  add column if not exists manager_name text not null default 'ผู้จัดการร้าน',
  add column if not exists shortage_threshold text not null default '1',
  add column if not exists notifications_enabled boolean not null default true,
  add column if not exists auto_close_resolved_requests boolean not null default false,
  add column if not exists last_saved_at text;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

alter table public.app_settings enable row level security;
alter table public.employees enable row level security;
alter table public.employee_availability enable row level security;
alter table public.calendar_day_settings enable row level security;
alter table public.schedule_blocks enable row level security;
alter table public.schedule_block_assignments enable row level security;
alter table public.requests enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_history enable row level security;
alter table public.issue_reports enable row level security;

drop policy if exists app_settings_full_access on public.app_settings;
create policy app_settings_full_access on public.app_settings for all to anon, authenticated using (true) with check (true);

drop policy if exists employees_full_access on public.employees;
create policy employees_full_access on public.employees for all to anon, authenticated using (true) with check (true);

drop policy if exists employee_availability_full_access on public.employee_availability;
create policy employee_availability_full_access on public.employee_availability for all to anon, authenticated using (true) with check (true);

drop policy if exists calendar_day_settings_full_access on public.calendar_day_settings;
create policy calendar_day_settings_full_access on public.calendar_day_settings for all to anon, authenticated using (true) with check (true);

drop policy if exists schedule_blocks_full_access on public.schedule_blocks;
create policy schedule_blocks_full_access on public.schedule_blocks for all to anon, authenticated using (true) with check (true);

drop policy if exists schedule_block_assignments_full_access on public.schedule_block_assignments;
create policy schedule_block_assignments_full_access on public.schedule_block_assignments for all to anon, authenticated using (true) with check (true);

drop policy if exists requests_full_access on public.requests;
create policy requests_full_access on public.requests for all to anon, authenticated using (true) with check (true);

drop policy if exists inventory_items_full_access on public.inventory_items;
create policy inventory_items_full_access on public.inventory_items for all to anon, authenticated using (true) with check (true);

drop policy if exists inventory_history_full_access on public.inventory_history;
create policy inventory_history_full_access on public.inventory_history for all to anon, authenticated using (true) with check (true);

drop policy if exists issue_reports_full_access on public.issue_reports;
create policy issue_reports_full_access on public.issue_reports for all to anon, authenticated using (true) with check (true);