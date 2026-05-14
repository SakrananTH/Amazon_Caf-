alter table public.app_settings
  add column if not exists employee_portal_password text;

alter table public.schedule_blocks
  add column if not exists start_time text,
  add column if not exists end_time text,
  add column if not exists round_preset_key text,
  add column if not exists round_label text;

alter table public.employees
  drop constraint if exists employees_phone_key;