create or replace function public.normalize_auth_credential(value text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(coalesce(value, ''), '[^0-9A-Za-z]', '', 'g'));
$$;

create or replace function public.authenticate_manager_portal(login_phone text, login_password text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_settings
    where public.normalize_auth_credential(manager_phone) = public.normalize_auth_credential(login_phone)
      and public.normalize_auth_credential(manager_password) = public.normalize_auth_credential(login_password)
  );
$$;

create or replace function public.authenticate_employee_portal(login_phone text, login_password text)
returns table (
  id bigint,
  employee_code text,
  name text,
  role text,
  avatar text,
  phone text,
  active boolean,
  availability_status text,
  skills text[]
)
language sql
security definer
set search_path = public
as $$
  select
    employees.id,
    employees.employee_code,
    employees.name,
    employees.role,
    employees.avatar,
    employees.phone,
    employees.active,
    employees.availability_status,
    employees.skills
  from public.employees
  where employees.active = true
    and public.normalize_auth_credential(employees.phone) = public.normalize_auth_credential(login_phone)
    and public.normalize_auth_credential(employees.password) = public.normalize_auth_credential(login_password)
  limit 1;
$$;

revoke all on function public.authenticate_manager_portal(text, text) from public;
revoke all on function public.authenticate_employee_portal(text, text) from public;

grant execute on function public.authenticate_manager_portal(text, text) to anon, authenticated;
grant execute on function public.authenticate_employee_portal(text, text) to anon, authenticated;