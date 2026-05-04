import { requireSupabase } from './client.js';
import { mapEmployeeRow } from './mappers.js';

export async function loginEmployeePortal(phone, password) {
  const client = requireSupabase();
  const result = await client.rpc('authenticate_employee_portal', {
    login_phone: String(phone ?? ''),
    login_password: String(password ?? ''),
  });

  if (result.error) {
    throw result.error;
  }

  const matchedEmployee = Array.isArray(result.data) ? result.data[0] : null;

  return matchedEmployee ? mapEmployeeRow(matchedEmployee) : null;
}

export async function loginManagerPortal(phone, password) {
  const client = requireSupabase();
  const result = await client.rpc('authenticate_manager_portal', {
    login_phone: String(phone ?? ''),
    login_password: String(password ?? ''),
  });

  if (result.error) {
    throw result.error;
  }

  return result.data === true;
}
