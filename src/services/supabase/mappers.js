function formatDateKey(dateInput = new Date()) {
  const date = new Date(dateInput);
  date.setHours(0, 0, 0, 0);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateTimeDisplay(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date).replace(',', '');
}

function normalizeTextArray(value) {
  return Array.isArray(value) ? value.filter(Boolean).map((item) => String(item)) : [];
}

function normalizeAttendanceWindows(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce((dateAccumulator, [dateKey, windows]) => {
    if (!windows || typeof windows !== 'object' || Array.isArray(windows)) {
      return dateAccumulator;
    }

    const normalizedWindows = Object.entries(windows).reduce((windowAccumulator, [windowKey, windowValue]) => {
      if (!windowValue || typeof windowValue !== 'object') {
        return windowAccumulator;
      }

      const employeeIds = [...new Set((windowValue.employeeIds ?? []).map((employeeId) => Number(employeeId)).filter(Number.isFinite))];
      windowAccumulator[String(windowKey)] = {
        key: String(windowValue.key ?? windowKey),
        startTime: String(windowValue.startTime ?? '').trim(),
        endTime: String(windowValue.endTime ?? '').trim(),
        time: String(windowValue.time ?? '').trim(),
        employeeIds,
      };
      return windowAccumulator;
    }, {});

    if (Object.keys(normalizedWindows).length) {
      dateAccumulator[formatDateKey(dateKey)] = normalizedWindows;
    }

    return dateAccumulator;
  }, {});
}

export function mapEmployeeRow(row) {
  return {
    id: Number(row.id),
    name: row.name,
    role: row.role,
    avatar: row.avatar ?? '👨🏻',
    phone: row.phone ?? '',
    password: row.password ?? row.employee_code ?? '',
    employeeCode: row.employee_code ?? `EMP${row.id}`,
    availabilityStatus: row.availability_status ?? 'ready',
    skills: normalizeTextArray(row.skills),
    active: row.active !== false,
  };
}

export function mapEmployeeAvailabilityRows(rows) {
  return rows.reduce((calendar, row) => {
    const employeeId = Number(row.employee_id);
    const dateKey = formatDateKey(row.date_key);
    if (!calendar[employeeId]) {
      calendar[employeeId] = {};
    }

    calendar[employeeId][dateKey] = row.status;
    return calendar;
  }, {});
}

export function mapCalendarDaySettingsRows(rows) {
  return rows.reduce((settings, row) => {
    settings[formatDateKey(row.date_key)] = {
      leaveLocked: Boolean(row.leave_locked),
      doublePay: Boolean(row.double_pay),
    };
    return settings;
  }, {});
}

export function mapScheduleRows(blockRows, assignmentRows) {
  const assignmentsByBlockId = assignmentRows.reduce((map, row) => {
    const blockId = Number(row.block_id);
    if (!map.has(blockId)) {
      map.set(blockId, []);
    }

    map.get(blockId).push(Number(row.employee_id));
    return map;
  }, new Map());

  return blockRows.map((row) => ({
    id: Number(row.id),
    dateKey: formatDateKey(row.date_key),
    time: row.time_label,
    title: row.title,
    required: Number(row.required),
    status: row.status ?? 'ok',
    tasks: normalizeTextArray(row.tasks),
    employeeIds: assignmentsByBlockId.get(Number(row.id)) ?? [],
    templateId: row.template_id ?? null,
  }));
}

export function mapRequestRows(rows) {
  return rows.map((row) => ({
    id: Number(row.id),
    title: row.title,
    type: row.request_type,
    detail: row.detail ?? '',
    attachmentName: row.attachment_name ?? '',
    status: row.status,
    date: formatDateTimeDisplay(row.created_at),
  }));
}

export function mapInventoryItemRows(rows) {
  return rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
    category: row.category,
    quantity: Number(row.quantity ?? 0),
    unit: row.unit,
    threshold: Number(row.threshold ?? 0),
    expiresOn: row.expires_on ? formatDateKey(row.expires_on) : '',
    noExpiry: Boolean(row.no_expiry),
    checkedAt: formatDateTimeDisplay(row.checked_at ?? row.updated_at),
    checkedBy: row.checked_by ?? '',
    receivedToday: Number(row.received_today ?? 0),
    soldToday: Number(row.sold_today ?? 0),
    useToday: Boolean(row.use_today),
    baseQuantity: Number(row.base_quantity ?? 0),
  }));
}

export function mapInventoryHistoryRows(rows) {
  return rows.map((row) => ({
    id: Number(row.id),
    itemId: Number(row.item_id),
    itemName: '',
    label: row.label,
    detail: row.detail,
    actorName: row.actor_name ?? '',
    at: formatDateTimeDisplay(row.logged_at),
    action: row.action_type ?? '',
    actionType: row.action_type ?? '',
  }));
}

export function mapIssueRows(rows) {
  return rows.map((row) => ({
    id: Number(row.id),
    title: row.title,
    detail: row.detail,
    severity: row.severity,
    date: formatDateTimeDisplay(row.created_at),
    status: row.status,
  }));
}

export function mapSettingsRow(row) {
  return {
    version: Number.isFinite(Number(row?.state_version)) ? Number(row.state_version) : null,
    employeeAttendanceWindows: normalizeAttendanceWindows(row?.employee_attendance_windows),
    settings: {
      storeName: row?.store_name ?? 'Amazon Cafe',
      managerName: row?.manager_name ?? 'ผู้จัดการร้าน',
      managerPhone: row?.manager_phone ?? '',
      managerPassword: row?.manager_password ?? '',
      preferredView: row?.preferred_view ?? 'desktop',
      shortageThreshold: row?.shortage_threshold ?? '1',
      notificationsEnabled: row?.notifications_enabled ?? true,
      autoCloseResolvedRequests: row?.auto_close_resolved_requests ?? false,
      lastSavedAt: row?.last_saved_at ?? '',
    },
  };
}
