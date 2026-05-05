import { requireSupabase } from './client.js';

function unwrapResult(result, label) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }

  return result.data;
}

async function runQuery(query, label) {
  const result = await query;
  return unwrapResult(result, label);
}

function formatDateKeyValue(value) {
  const normalizedValue = String(value ?? '').trim();
  if (!normalizedValue) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    return normalizedValue;
  }

  const date = new Date(normalizedValue);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function formatTimestampValue(value) {
  const normalizedValue = String(value ?? '').trim();
  if (!normalizedValue) {
    return null;
  }

  const displayMatch = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/.exec(normalizedValue);
  if (displayMatch) {
    const [, day, month, year, hours = '00', minutes = '00'] = displayMatch;
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes), 0, 0).toISOString();
  }

  const date = new Date(normalizedValue);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function serializeAppSettings(state = {}) {
  const settings = state.settings ?? {};
  return {
    id: true,
    state_version: Number.isFinite(Number(state.version)) ? Number(state.version) : 8,
    store_name: String(settings.storeName ?? 'Amazon Cafe').trim() || 'Amazon Cafe',
    manager_name: String(settings.managerName ?? 'ผู้จัดการร้าน').trim() || 'ผู้จัดการร้าน',
    manager_phone: String(settings.managerPhone ?? '').trim(),
    manager_password: String(settings.managerPassword ?? '').trim(),
    preferred_view: 'desktop',
    shortage_threshold: String(settings.shortageThreshold ?? '1'),
    notifications_enabled: Boolean(settings.notificationsEnabled),
    auto_close_resolved_requests: Boolean(settings.autoCloseResolvedRequests),
    last_saved_at: String(settings.lastSavedAt ?? '').trim() || null,
    employee_attendance_windows: state.employeeAttendanceWindows ?? {},
  };
}

function serializeEmployees(employees = []) {
  return employees.map((employee, index) => ({
    id: Number(employee.id ?? index + 1),
    employee_code: String(employee.employeeCode ?? `AMZ${String(index + 1).padStart(4, '0')}`).trim().toUpperCase(),
    name: String(employee.name ?? '').trim(),
    role: String(employee.role ?? '').trim(),
    avatar: String(employee.avatar ?? '').trim() || null,
    phone: String(employee.phone ?? '').trim(),
    password: String(employee.password ?? '').trim(),
    active: employee.active !== false,
    availability_status: String(employee.availabilityStatus ?? 'ready').trim() || 'ready',
    skills: Array.isArray(employee.skills) ? employee.skills.filter(Boolean).map((skill) => String(skill)) : [],
  }));
}

function serializeEmployeeAvailability(calendar = {}) {
  return Object.entries(calendar).flatMap(([employeeId, dateMap]) => {
    return Object.entries(dateMap ?? {}).map(([dateKey, status]) => ({
      employee_id: Number(employeeId),
      date_key: formatDateKeyValue(dateKey),
      status: String(status ?? 'ready').trim() || 'ready',
    }));
  }).filter((row) => Number.isFinite(row.employee_id) && row.date_key);
}

function serializeCalendarDaySettings(settings = {}) {
  return Object.entries(settings).map(([dateKey, value]) => ({
    date_key: formatDateKeyValue(dateKey),
    leave_locked: Boolean(value?.leaveLocked),
    double_pay: Boolean(value?.doublePay),
  })).filter((row) => row.date_key);
}

function serializeTimeBlocks(timeBlocks = []) {
  const scheduleBlocks = [];
  const scheduleAssignments = [];

  timeBlocks.forEach((block, index) => {
    const blockId = Number(block.id ?? index + 1);
    const dateKey = formatDateKeyValue(block.dateKey);
    if (!Number.isFinite(blockId) || !dateKey) {
      return;
    }

    scheduleBlocks.push({
      id: blockId,
      date_key: dateKey,
      time_label: String(block.time ?? '').trim(),
      title: String(block.title ?? '').trim(),
      required: Math.max(1, Number(block.required ?? 1)),
      status: String(block.status ?? 'ok').trim() || 'ok',
      tasks: Array.isArray(block.tasks) ? block.tasks.filter(Boolean).map((task) => String(task)) : [],
      template_id: block.templateId ? String(block.templateId) : null,
    });

    const employeeIds = Array.isArray(block.employeeIds) ? [...new Set(block.employeeIds.map((employeeId) => Number(employeeId)).filter(Number.isFinite))] : [];
    employeeIds.forEach((employeeId) => {
      scheduleAssignments.push({
        block_id: blockId,
        employee_id: employeeId,
      });
    });
  });

  return {
    scheduleBlocks,
    scheduleAssignments,
  };
}

function serializeRequests(requests = []) {
  return requests.map((request, index) => ({
    id: Number(request.id ?? index + 1),
    title: String(request.title ?? '').trim(),
    request_type: String(request.type ?? '').trim() || null,
    detail: String(request.detail ?? '').trim() || null,
    attachment_name: String(request.attachmentName ?? '').trim() || null,
    status: String(request.status ?? 'รอดำเนินการ').trim() || 'รอดำเนินการ',
    created_at: formatTimestampValue(request.date) ?? new Date().toISOString(),
  })).filter((row) => Number.isFinite(row.id) && row.title);
}

function serializeInventoryItems(items = []) {
  return items.map((item, index) => ({
    id: Number(item.id ?? index + 1),
    name: String(item.name ?? '').trim(),
    category: String(item.category ?? '').trim() || 'อื่นๆ',
    quantity: Math.max(0, Number(item.quantity ?? 0)),
    unit: String(item.unit ?? 'ชิ้น').trim() || 'ชิ้น',
    threshold: Math.max(0, Number(item.threshold ?? 0)),
    expires_on: item.noExpiry ? null : formatDateKeyValue(item.expiresOn),
    no_expiry: Boolean(item.noExpiry),
    checked_at: formatTimestampValue(item.checkedAt),
    checked_by: String(item.checkedBy ?? '').trim() || null,
    received_today: Math.max(0, Number(item.receivedToday ?? 0)),
    sold_today: Math.max(0, Number(item.soldToday ?? 0)),
    use_today: Boolean(item.useToday),
    base_quantity: Math.max(0, Number(item.baseQuantity ?? 0)),
  })).filter((row) => Number.isFinite(row.id) && row.name);
}

function serializeInventoryHistory(entries = []) {
  return entries.map((entry, index) => ({
    id: Number(entry.id ?? index + 1),
    item_id: Number(entry.itemId ?? 0),
    action_type: String(entry.action ?? entry.actionType ?? '').trim() || null,
    label: String(entry.label ?? 'อัปเดตรายการ').trim() || 'อัปเดตรายการ',
    detail: String(entry.detail ?? '').trim(),
    actor_name: String(entry.actorName ?? '').trim() || null,
    logged_at: formatTimestampValue(entry.at) ?? new Date().toISOString(),
  })).filter((row) => Number.isFinite(row.id) && Number.isFinite(row.item_id) && row.item_id > 0 && row.detail);
}

function serializeIssueReports(issues = []) {
  return issues.map((issue, index) => ({
    id: Number(issue.id ?? index + 1),
    title: String(issue.title ?? '').trim(),
    detail: String(issue.detail ?? '').trim(),
    severity: String(issue.severity ?? 'กลาง').trim() || 'กลาง',
    status: String(issue.status ?? 'รอดำเนินการ').trim() || 'รอดำเนินการ',
    created_at: formatTimestampValue(issue.date) ?? new Date().toISOString(),
  })).filter((row) => Number.isFinite(row.id) && row.title && row.detail);
}

function clearTableRows(client, table, clearFilter) {
  const clearQuery = client.from(table).delete();
  const deletePromise = clearFilter.type === 'gte'
    ? clearQuery.gte(clearFilter.column, clearFilter.value)
    : clearQuery.not(clearFilter.column, 'is', null);

  return runQuery(deletePromise, `delete ${table}`);
}

function insertTableRows(client, table, rows) {
  if (!rows.length) {
    return Promise.resolve(null);
  }

  return runQuery(client.from(table).insert(rows), `insert ${table}`);
}

export function createPersistedStatePayload(state) {
  const { scheduleAssignments, scheduleBlocks } = serializeTimeBlocks(state.timeBlocks);

  return {
    appSettings: serializeAppSettings(state),
    employees: serializeEmployees(state.employees),
    employeeAvailability: serializeEmployeeAvailability(state.employeeAvailabilityCalendar),
    calendarDaySettings: serializeCalendarDaySettings(state.calendarDaySettings),
    scheduleBlocks,
    scheduleAssignments,
    requests: serializeRequests(state.requests),
    inventoryItems: serializeInventoryItems(state.inventoryItems),
    inventoryHistory: serializeInventoryHistory(state.inventoryHistory),
    issueReports: serializeIssueReports(state.issueReports),
  };
}

export async function saveAppStateToSupabase(state) {
  const client = requireSupabase();
  const payload = createPersistedStatePayload(state);

  await clearTableRows(client, 'employee_availability', { type: 'gte', column: 'employee_id', value: 0 });
  await clearTableRows(client, 'schedule_block_assignments', { type: 'gte', column: 'block_id', value: 0 });
  await clearTableRows(client, 'inventory_history', { type: 'gte', column: 'id', value: 0 });
  await clearTableRows(client, 'schedule_blocks', { type: 'gte', column: 'id', value: 0 });
  await clearTableRows(client, 'requests', { type: 'gte', column: 'id', value: 0 });
  await clearTableRows(client, 'issue_reports', { type: 'gte', column: 'id', value: 0 });
  await clearTableRows(client, 'inventory_items', { type: 'gte', column: 'id', value: 0 });
  await clearTableRows(client, 'employees', { type: 'gte', column: 'id', value: 0 });
  await clearTableRows(client, 'calendar_day_settings', { type: 'gte', column: 'date_key', value: '0001-01-01' });

  await runQuery(
    client.from('app_settings').upsert(payload.appSettings, { onConflict: 'id' }),
    'upsert app_settings',
  );

  await insertTableRows(client, 'employees', payload.employees);
  await insertTableRows(client, 'calendar_day_settings', payload.calendarDaySettings);
  await insertTableRows(client, 'employee_availability', payload.employeeAvailability);
  await insertTableRows(client, 'schedule_blocks', payload.scheduleBlocks);
  await insertTableRows(client, 'schedule_block_assignments', payload.scheduleAssignments);
  await insertTableRows(client, 'requests', payload.requests);
  await insertTableRows(client, 'inventory_items', payload.inventoryItems);
  await insertTableRows(client, 'inventory_history', payload.inventoryHistory);
  await insertTableRows(client, 'issue_reports', payload.issueReports);
}