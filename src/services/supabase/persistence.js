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

function upsertTableRows(client, table, rows, onConflict) {
  if (!rows.length) {
    return Promise.resolve(null);
  }

  return runQuery(client.from(table).upsert(rows, { onConflict }), `upsert ${table}`);
}

function selectTableRows(client, table, columns) {
  return runQuery(client.from(table).select(columns.join(', ')), `select ${table}`);
}

function normalizeDateKey(value) {
  const normalizedValue = formatDateKeyValue(value);
  return normalizedValue ? String(normalizedValue) : null;
}

async function deleteRowsByColumnValues(client, table, column, values) {
  if (!values.length) {
    return null;
  }

  return runQuery(client.from(table).delete().in(column, values), `delete stale ${table}`);
}

async function deleteStaleIdRows(client, table, desiredIds = []) {
  const existingRows = await selectTableRows(client, table, ['id']);
  const desiredIdSet = new Set(desiredIds.map((value) => Number(value)).filter(Number.isFinite));
  const staleIds = existingRows
    .map((row) => Number(row.id))
    .filter(Number.isFinite)
    .filter((id) => !desiredIdSet.has(id));

  return deleteRowsByColumnValues(client, table, 'id', staleIds);
}

async function deleteStaleDateKeyRows(client, table, desiredDateKeys = []) {
  const existingRows = await selectTableRows(client, table, ['date_key']);
  const desiredDateKeySet = new Set(desiredDateKeys.map((value) => normalizeDateKey(value)).filter(Boolean));
  const staleDateKeys = existingRows
    .map((row) => normalizeDateKey(row.date_key))
    .filter(Boolean)
    .filter((dateKey) => !desiredDateKeySet.has(dateKey));

  return deleteRowsByColumnValues(client, table, 'date_key', staleDateKeys);
}

function groupCompositeValues(rows = [], ownerColumn, valueColumn, normalizeValue = (value) => value) {
  return rows.reduce((groups, row) => {
    const ownerValue = Number(row[ownerColumn]);
    const normalizedValue = normalizeValue(row[valueColumn]);

    if (!Number.isFinite(ownerValue) || normalizedValue == null || normalizedValue === '') {
      return groups;
    }

    if (!groups.has(ownerValue)) {
      groups.set(ownerValue, new Set());
    }

    groups.get(ownerValue).add(normalizedValue);
    return groups;
  }, new Map());
}

async function deleteStaleCompositeRows(client, table, {
  ownerColumn,
  valueColumn,
  desiredRows = [],
  ownerIds = [],
  normalizeValue = (value) => value,
}) {
  const normalizedOwnerIds = [...new Set(ownerIds.map((value) => Number(value)).filter(Number.isFinite))];
  if (!normalizedOwnerIds.length) {
    return null;
  }

  const existingRows = await selectTableRows(client, table, [ownerColumn, valueColumn]);
  const existingByOwner = groupCompositeValues(existingRows, ownerColumn, valueColumn, normalizeValue);
  const desiredByOwner = groupCompositeValues(desiredRows, ownerColumn, valueColumn, normalizeValue);

  const deletions = normalizedOwnerIds.map((ownerId) => {
    const existingValues = existingByOwner.get(ownerId);
    if (!existingValues?.size) {
      return null;
    }

    const desiredValues = desiredByOwner.get(ownerId) ?? new Set();
    const staleValues = [...existingValues].filter((value) => !desiredValues.has(value));
    if (!staleValues.length) {
      return null;
    }

    return runQuery(
      client.from(table).delete().eq(ownerColumn, ownerId).in(valueColumn, staleValues),
      `delete stale ${table}`,
    );
  }).filter(Boolean);

  await Promise.all(deletions);
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

  await runQuery(
    client.from('app_settings').upsert(payload.appSettings, { onConflict: 'id' }),
    'upsert app_settings',
  );

  await upsertTableRows(client, 'employees', payload.employees, 'id');
  await upsertTableRows(client, 'calendar_day_settings', payload.calendarDaySettings, 'date_key');
  await upsertTableRows(client, 'employee_availability', payload.employeeAvailability, 'employee_id,date_key');
  await upsertTableRows(client, 'schedule_blocks', payload.scheduleBlocks, 'id');
  await upsertTableRows(client, 'schedule_block_assignments', payload.scheduleAssignments, 'block_id,employee_id');
  await upsertTableRows(client, 'requests', payload.requests, 'id');
  await upsertTableRows(client, 'inventory_items', payload.inventoryItems, 'id');
  await upsertTableRows(client, 'inventory_history', payload.inventoryHistory, 'id');
  await upsertTableRows(client, 'issue_reports', payload.issueReports, 'id');

  await deleteStaleIdRows(client, 'issue_reports', payload.issueReports.map((row) => row.id));
  await deleteStaleIdRows(client, 'requests', payload.requests.map((row) => row.id));
  await deleteStaleIdRows(client, 'inventory_history', payload.inventoryHistory.map((row) => row.id));
  await deleteStaleCompositeRows(client, 'schedule_block_assignments', {
    ownerColumn: 'block_id',
    valueColumn: 'employee_id',
    desiredRows: payload.scheduleAssignments,
    ownerIds: payload.scheduleBlocks.map((row) => row.id),
    normalizeValue: (value) => Number(value),
  });
  await deleteStaleCompositeRows(client, 'employee_availability', {
    ownerColumn: 'employee_id',
    valueColumn: 'date_key',
    desiredRows: payload.employeeAvailability,
    ownerIds: payload.employees.map((row) => row.id),
    normalizeValue: normalizeDateKey,
  });
  await deleteStaleDateKeyRows(client, 'calendar_day_settings', payload.calendarDaySettings.map((row) => row.date_key));
  await deleteStaleIdRows(client, 'schedule_blocks', payload.scheduleBlocks.map((row) => row.id));
  await deleteStaleIdRows(client, 'inventory_items', payload.inventoryItems.map((row) => row.id));
  await deleteStaleIdRows(client, 'employees', payload.employees.map((row) => row.id));
}