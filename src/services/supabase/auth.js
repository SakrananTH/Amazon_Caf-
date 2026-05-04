import { requireSupabase } from './client.js';
import { mapEmployeeRow, mapSettingsRow } from './mappers.js';

function normalizeCredential(value) {
  return String(value ?? '').replace(/[^0-9A-Za-z]/g, '').toLowerCase();
}

export async function loginEmployeePortal(phone, password) {
  const client = requireSupabase();
  const normalizedPhone = normalizeCredential(phone);
  const normalizedPassword = normalizeCredential(password);

  const result = await client
    .from('employees')
    .select('*')
    .eq('active', true);

  if (result.error) {
    throw result.error;
  }

  const matchedEmployee = result.data.find((employee) => {
    return normalizeCredential(employee.phone) === normalizedPhone
      && normalizeCredential(employee.password) === normalizedPassword;
  });

  return matchedEmployee ? mapEmployeeRow(matchedEmployee) : null;
}

export async function loginManagerPortal(phone, password) {
  const client = requireSupabase();
  const normalizedPhone = normalizeCredential(phone);
  const normalizedPassword = normalizeCredential(password);

  const result = await client.from('app_settings').select('*').limit(1).maybeSingle();
  if (result.error) {
    throw result.error;
  }

  const settings = mapSettingsRow(result.data);
  return normalizeCredential(settings.managerPhone) === normalizedPhone
    && normalizeCredential(settings.managerPassword) === normalizedPassword;
}
