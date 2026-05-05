alter table public.app_settings
  add column if not exists state_version integer not null default 8,
  add column if not exists employee_attendance_windows jsonb not null default '{}'::jsonb;