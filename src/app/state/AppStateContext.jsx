import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { calendarDaySettings as seedCalendarDaySettings, employeeAvailabilityCalendar as seedEmployeeAvailabilityCalendar, employees as seedEmployees, inventoryItems as seedInventoryItems, issueReports as seedIssueReports, requests as seedRequests, timeBlocks as seedTimeBlocks } from '../../mocks/mockData.js';
import { isSupabaseConfigured, loadAppStateFromSupabase, loginEmployeePortal, loginManagerPortal, saveAppStateToSupabase, useSupabaseBackend } from '../../services/supabase/index.js';

const AppStateContext = createContext(null);
const STORAGE_KEY = 'amazon-schedule-ui/state';
const MANAGER_SESSION_STORAGE_KEY = 'amazon-schedule-ui/session/manager';
const EMPLOYEE_SESSION_STORAGE_KEY = 'amazon-schedule-ui/session/employee';
const STATE_VERSION = 8;
export const MAX_EMPLOYEES = 5;
const SCHEDULE_LOOKAHEAD_DAYS = 28;
const MAX_INVENTORY_HISTORY_ITEMS = 80;

function readManagerSessionActive(fallbackValue = false) {
  if (typeof window === 'undefined') {
    return fallbackValue;
  }

  const storedValue = window.localStorage.getItem(MANAGER_SESSION_STORAGE_KEY);
  if (storedValue === '1') {
    return true;
  }
  if (storedValue === '0') {
    return false;
  }

  return fallbackValue;
}

function readEmployeePortalSessionId(fallbackValue = null) {
  if (typeof window === 'undefined') {
    return fallbackValue;
  }

  const storedValue = window.localStorage.getItem(EMPLOYEE_SESSION_STORAGE_KEY);
  const parsedValue = Number(storedValue);
  if (Number.isFinite(parsedValue)) {
    return parsedValue;
  }

  return fallbackValue;
}

export const employeeAvailabilityOptions = [
  { value: 'ready', label: 'พร้อมลงกะ', shortLabel: 'พร้อม', tone: 'ok', assignable: true, hint: 'นับเป็นกำลังคนจริง' },
  { value: 'annual_leave', label: 'ลา', shortLabel: 'ลา', tone: 'warning', assignable: false, hint: 'ลาและไม่นับเป็นกำลังคน' },
  { value: 'personal_leave', label: 'ลากิจ', shortLabel: 'กิจ', tone: 'warning', assignable: false, hint: 'ลากิจและไม่นับเป็นกำลังคน' },
  { value: 'sick_leave', label: 'ลาป่วย', shortLabel: 'ป่วย', tone: 'warning', assignable: false, hint: 'ลาป่วยและไม่นับเป็นกำลังคน' },
  { value: 'absent', label: 'ขาด', shortLabel: 'ขาด', tone: 'danger', assignable: false, hint: 'ถือว่าขาดงานและไม่นับเป็นกำลังคน' },
];

const normalizedAvailabilityValueMap = {
  leave: 'personal_leave',
  annual_leave: 'annual_leave',
  personal_leave: 'personal_leave',
  sick_leave: 'sick_leave',
  absent: 'absent',
};

export function formatDateKey(dateInput = new Date()) {
  const date = new Date(dateInput);
  date.setHours(0, 0, 0, 0);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeCalendarDaySettings(settings) {
  const sourceSettings = settings && typeof settings === 'object' ? settings : {};

  return Object.entries(sourceSettings).reduce((accumulator, [dateKey, value]) => {
    const leaveLocked = Boolean(value?.leaveLocked);
    const doublePay = Boolean(value?.doublePay);

    if (!leaveLocked && !doublePay) {
      return accumulator;
    }

    accumulator[dateKey] = {
      leaveLocked,
      doublePay,
    };
    return accumulator;
  }, {});
}

function getNormalizedCalendarDaySettings(dateKey, calendarDaySettings = null) {
  const value = calendarDaySettings?.[dateKey] ?? {};
  return {
    leaveLocked: Boolean(value.leaveLocked),
    doublePay: Boolean(value.doublePay),
  };
}

export function getCalendarDayMeta(dateKey, calendarDaySettings = null) {
  const normalizedSettings = getNormalizedCalendarDaySettings(dateKey, calendarDaySettings);
  const labels = [];

  if (normalizedSettings.leaveLocked) {
    labels.push('หยุดไม่ได้');
  }

  if (normalizedSettings.doublePay) {
    labels.push('2 แรง');
  }

  return {
    ...normalizedSettings,
    labels,
    tone: normalizedSettings.leaveLocked ? 'danger' : normalizedSettings.doublePay ? 'warning' : 'ok',
  };
}

function addDays(dateInput, amount = 0) {
  const date = new Date(dateInput);
  date.setDate(date.getDate() + amount);
  return date;
}

function isLeaveAvailabilityStatus(status) {
  return status === 'annual_leave' || status === 'personal_leave' || status === 'sick_leave';
}

function getWeekDateKeys(dateKey) {
  const [year, month, day] = String(dateKey).split('-').map(Number);
  const baseDate = new Date(year, (month ?? 1) - 1, day ?? 1);
  baseDate.setHours(0, 0, 0, 0);
  const mondayOffset = (baseDate.getDay() + 6) % 7;
  const startDate = addDays(baseDate, -mondayOffset);
  return Array.from({ length: 7 }, (_, index) => formatDateKey(addDays(startDate, index)));
}

function parseDateKeyValue(dateKey) {
  const [year, month, day] = String(dateKey).split('-').map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function normalizeAvailabilityCalendarValue(value) {
  return normalizedAvailabilityValueMap[value] ?? null;
}

function normalizeAvailabilityCalendar(calendar, allowedEmployeeIds = null, employees = []) {
  const normalizedCalendar = {};

  const sourceCalendar = calendar && typeof calendar === 'object' ? calendar : {};
  Object.entries(sourceCalendar).forEach(([employeeIdKey, dateMap]) => {
    const employeeId = Number(employeeIdKey);
    if (!Number.isFinite(employeeId) || (allowedEmployeeIds && !allowedEmployeeIds.has(employeeId))) {
      return;
    }

    const normalizedDateMap = Object.entries(dateMap ?? {}).reduce((accumulator, [dateKey, status]) => {
      const normalizedStatus = normalizeAvailabilityCalendarValue(status);
      if (normalizedStatus) {
        accumulator[dateKey] = normalizedStatus;
      }
      return accumulator;
    }, {});

    if (Object.keys(normalizedDateMap).length) {
      normalizedCalendar[employeeId] = normalizedDateMap;
    }
  });

  const todayDateKey = formatDateKey();
  employees.forEach((employee) => {
    const legacyStatus = normalizeAvailabilityCalendarValue(employee.availabilityStatus);
    if (!legacyStatus) {
      return;
    }

    if (!normalizedCalendar[employee.id]) {
      normalizedCalendar[employee.id] = { [todayDateKey]: legacyStatus };
      return;
    }

    if (!normalizedCalendar[employee.id][todayDateKey]) {
      normalizedCalendar[employee.id][todayDateKey] = legacyStatus;
    }
  });

  return normalizedCalendar;
}

export function normalizeEmployeeAvailabilityStatus(value = 'ready') {
  return normalizedAvailabilityValueMap[value] ?? 'ready';
}

export function getEmployeeAvailabilityStatus(employee, dateKey = null, availabilityCalendar = null) {
  if (!employee) {
    return 'inactive';
  }

  if (employee.active === false) {
    return 'inactive';
  }

  if (dateKey && availabilityCalendar?.[employee.id]?.[dateKey]) {
    return normalizeEmployeeAvailabilityStatus(availabilityCalendar[employee.id][dateKey]);
  }

  if (dateKey && availabilityCalendar) {
    return 'ready';
  }

  return normalizeEmployeeAvailabilityStatus(employee.availabilityStatus);
}

export function getEmployeeAvailabilityMeta(employee, dateKey = null, availabilityCalendar = null) {
  const status = getEmployeeAvailabilityStatus(employee, dateKey, availabilityCalendar);

  if (status === 'annual_leave') {
    return { value: 'annual_leave', label: 'ลา', shortLabel: 'ลา', tone: 'warning', assignable: false };
  }

  if (status === 'personal_leave') {
    return { value: 'personal_leave', label: 'ลากิจ', shortLabel: 'กิจ', tone: 'warning', assignable: false };
  }

  if (status === 'sick_leave') {
    return { value: 'sick_leave', label: 'ลาป่วย', shortLabel: 'ป่วย', tone: 'warning', assignable: false };
  }

  if (status === 'absent') {
    return { value: 'absent', label: 'ขาด', shortLabel: 'ขาด', tone: 'danger', assignable: false };
  }

  if (status === 'inactive') {
    return { value: 'inactive', label: 'พักงาน', shortLabel: 'พัก', tone: 'warning', assignable: false };
  }

  return { value: 'ready', label: 'พร้อมลงกะ', shortLabel: 'พร้อม', tone: 'ok', assignable: true };
}

export function isEmployeeAssignable(employee, dateKey = null, availabilityCalendar = null) {
  return getEmployeeAvailabilityMeta(employee, dateKey, availabilityCalendar).assignable;
}

export function isManagerRole(role = '') {
  return String(role).trim().includes('ผู้จัดการ');
}

export function isEmployeeScheduleEligible(employee, dateKey = null, availabilityCalendar = null) {
  if (!employee || isManagerRole(employee.role)) {
    return false;
  }

  return isEmployeeAssignable(employee, dateKey, availabilityCalendar);
}

function buildEmployeesById(employees = []) {
  return new Map(employees.map((employee) => [employee.id, employee]));
}

function createStableNumericId(seedInput, fallbackValue = 1) {
  const normalizedSeed = String(seedInput ?? fallbackValue);
  let hash = 0;

  for (const character of normalizedSeed) {
    hash = (hash * 33 + character.charCodeAt(0)) % 1000000;
  }

  return hash || fallbackValue;
}

function createDateScopedBlockId(dateKey, blockId, index = 0) {
  const normalizedDateSeed = String(dateKey ?? formatDateKey()).replace(/\D/g, '').slice(-8) || formatDateKey().replace(/\D/g, '');
  const blockSeed = String(blockId ?? index + 1);
  const numericSeed = createStableNumericId(blockSeed, index + 1);
  return Number(`${normalizedDateSeed}${String(numericSeed).padStart(6, '0')}`);
}

function rotateBlockEmployeeIds(employeeIds = [], rosterIds = [], shiftAmount = 0) {
  const desiredCount = employeeIds.length;
  if (!desiredCount) {
    return [];
  }

  const activeRoster = rosterIds.length ? rosterIds : employeeIds;
  const rotatedIds = [];

  employeeIds.forEach((employeeId, index) => {
    const rosterIndex = activeRoster.indexOf(employeeId);
    const baseIndex = rosterIndex >= 0 ? rosterIndex : index;
    const candidateId = activeRoster[(baseIndex + shiftAmount + index) % activeRoster.length];
    if (!rotatedIds.includes(candidateId)) {
      rotatedIds.push(candidateId);
    }
  });

  for (let index = 0; rotatedIds.length < desiredCount && index < activeRoster.length; index += 1) {
    const candidateId = activeRoster[(shiftAmount + index) % activeRoster.length];
    if (!rotatedIds.includes(candidateId)) {
      rotatedIds.push(candidateId);
    }
  }

  return rotatedIds;
}

function countAssignableEmployees(employeeIds = [], employeesById = new Map()) {
  if (!employeesById.size) {
    return employeeIds.length;
  }

  return employeeIds.reduce((count, employeeId) => {
    const employee = employeesById.get(employeeId);
    return count + (isEmployeeScheduleEligible(employee) ? 1 : 0);
  }, 0);
}

const initialSettings = {
  storeName: 'Amazon Cafe สาขา CW Tower',
  managerName: 'ผู้จัดการร้าน',
  managerPhone: '0800000004',
  managerPassword: 'AMZ0004',
  preferredView: 'desktop',
  shortageThreshold: '1',
  notificationsEnabled: true,
  autoCloseResolvedRequests: false,
  lastSavedAt: '',
};

function formatDateTime(date = new Date()) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function normalizeSearchValue(value = '') {
  return String(value).trim().toLowerCase();
}

function normalizeEmployeeCredential(value = '') {
  return String(value).trim().toLowerCase();
}

function countMatches(searchText, items = []) {
  return items.reduce((score, item) => {
    const normalizedItem = normalizeSearchValue(item);
    return normalizedItem && searchText.includes(normalizedItem) ? score + 1 : score;
  }, 0);
}

function scoreEmployeeForBlock(employee, block) {
  const employeeProfile = normalizeSearchValue([employee.role, ...(employee.skills ?? [])].join(' '));
  const blockTitle = normalizeSearchValue(block.title);
  const blockTasks = block.tasks.map((task) => normalizeSearchValue(task));

  return countMatches(employeeProfile, [blockTitle]) * 4 + countMatches(employeeProfile, blockTasks) * 2;
}

function buildEmployeeCode(employeeId, index = 0) {
  const numericSeed = Number(employeeId);
  if (Number.isFinite(numericSeed)) {
    return `AMZ${String(Math.abs(numericSeed)).slice(-4).padStart(4, '0')}`;
  }

  return `AMZ${String(index + 1).padStart(4, '0')}`;
}

function buildEmployeePassword(employeeId, index = 0) {
  const numericSeed = Number(employeeId);
  if (Number.isFinite(numericSeed)) {
    return `Cafe${String(Math.abs(numericSeed)).slice(-4).padStart(4, '0')}`;
  }

  return `Cafe${String(index + 1).padStart(4, '0')}`;
}

function createResetEmployeeCode(existingEmployees = [], employeeId, currentCode = '') {
  const reservedCodes = new Set(existingEmployees.filter((employee) => employee.id !== employeeId).map((employee) => String(employee.employeeCode ?? '').trim().toUpperCase()).filter(Boolean));
  const currentCodeText = String(currentCode).trim().toUpperCase();
  const baseSeed = Math.abs(Number(employeeId) || Date.now());

  for (let offset = 0; offset < 10000; offset += 1) {
    const candidate = `AMZ${String((baseSeed + offset) % 10000).padStart(4, '0')}`;
    if (!reservedCodes.has(candidate) && candidate !== currentCodeText) {
      return candidate;
    }
  }

  return `AMZ${String(Date.now()).slice(-4)}`;
}

function createResetEmployeePassword(existingEmployees = [], employeeId, currentPassword = '') {
  const reservedPasswords = new Set(existingEmployees.filter((employee) => employee.id !== employeeId).map((employee) => String(employee.password ?? '').trim()).filter(Boolean));
  const currentPasswordText = String(currentPassword).trim();
  const baseSeed = Math.abs(Number(employeeId) || Date.now());

  for (let offset = 0; offset < 10000; offset += 1) {
    const candidate = `Cafe${String((baseSeed + offset) % 10000).padStart(4, '0')}`;
    if (!reservedPasswords.has(candidate) && candidate !== currentPasswordText) {
      return candidate;
    }
  }

  return `Cafe${String(Date.now()).slice(-4)}`;
}

function enrichEmployee(employee, index = 0) {
  const active = employee.active ?? true;
  const normalizedEmployeeCode = String(employee.employeeCode ?? '').trim().toUpperCase();
  const nextEmployeeCode = normalizedEmployeeCode || buildEmployeeCode(employee.id, index);
  const normalizedPassword = String(employee.password ?? '').trim();
  return {
    ...employee,
    active,
    employeeCode: nextEmployeeCode,
    password: normalizedPassword || nextEmployeeCode || buildEmployeePassword(employee.id, index),
    phone: employee.phone ?? `08${String(index + 1).padStart(8, '0')}`,
    skills: employee.skills ?? [employee.role],
    availabilityStatus: normalizeEmployeeAvailabilityStatus(employee.availabilityStatus),
  };
}

export function computeBlockStatus(required, assigned) {
  if (assigned >= required) {
    return 'ok';
  }

  if (required >= 3 || required - assigned >= 2) {
    return 'danger';
  }

  return 'warning';
}

export const scheduleShiftPresets = [
  {
    key: 'morning',
    label: 'กะเช้า',
    startTime: '06:30',
    endTime: '16:30',
    defaultTitle: 'หน้าที่ในกะเช้า',
    defaultTasks: ['เปิดร้าน', 'เตรียมวัตถุดิบ', 'ดูแลหน้าร้าน'],
  },
  {
    key: 'late',
    label: 'กะสาย',
    startTime: '07:30',
    endTime: '17:30',
    defaultTitle: 'หน้าที่ในกะสาย',
    defaultTasks: ['ดูแลหน้าร้าน', 'เช็กสต็อก', 'ปิดร้าน'],
  },
];

function getScheduleShiftPreset(presetKey = 'morning') {
  return scheduleShiftPresets.find((preset) => preset.key === presetKey) ?? scheduleShiftPresets[0];
}

function getScheduleShiftPresetKey(startTime = '', roundLabel = '') {
  const normalizedRoundLabel = normalizeSearchValue(roundLabel);
  if (normalizedRoundLabel.includes('กะเช้า') || normalizedRoundLabel.includes('รอบเช้า')) {
    return 'morning';
  }
  if (normalizedRoundLabel.includes('กะสาย') || normalizedRoundLabel.includes('รอบสาย') || normalizedRoundLabel.includes('กะเย็น') || normalizedRoundLabel.includes('รอบเย็น')) {
    return 'late';
  }

  const normalizedStartTime = normalizeClockValue(startTime);
  if (!normalizedStartTime) {
    return 'custom';
  }

  const [hoursText = '0', minutesText = '0'] = normalizedStartTime.split(':');
  const totalMinutes = (Number(hoursText) * 60) + Number(minutesText);
  if (totalMinutes <= 390) {
    return 'morning';
  }
  if (totalMinutes >= 990) {
    return 'late';
  }

  return 'custom';
}

function getAttendanceWindowKey(window = {}) {
  const presetKey = String(window?.roundPresetKey ?? '').trim();
  if (presetKey && presetKey !== 'custom') {
    return presetKey;
  }

  const derivedPresetKey = getScheduleShiftPresetKey(getBlockStartLabel(window), window?.roundLabel ?? window?.title ?? '');
  if (derivedPresetKey === 'morning' || derivedPresetKey === 'late') {
    return derivedPresetKey;
  }

  return buildBlockTimeLabel(getBlockStartLabel(window), getBlockEndLabel(window)) || String(window?.key ?? '').trim() || 'custom';
}

function buildAttendanceWindowEntry(window = {}, fallbackKey = '') {
  const normalizedKey = String(window?.key ?? fallbackKey ?? getAttendanceWindowKey(window)).trim() || getAttendanceWindowKey(window);
  const preset = scheduleShiftPresets.find((entry) => entry.key === normalizedKey) ?? null;
  const startTime = preset?.startTime ?? getBlockStartLabel(window);
  const endTime = preset?.endTime ?? getBlockEndLabel(window);
  return {
    key: normalizedKey,
    startTime,
    endTime,
    time: buildBlockTimeLabel(startTime, endTime),
    employeeIds: [...new Set((window?.employeeIds ?? []).filter((employeeId) => Number.isFinite(Number(employeeId))).map(Number))],
  };
}

function buildAttendanceWindowsFromBlocks(blocks = [], allowedEmployeeIds = null) {
  return blocks.reduce((attendanceWindows, block) => {
    const dateKey = String(block?.dateKey ?? formatDateKey());
    const windowKey = getAttendanceWindowKey(block);
    const currentDateWindows = attendanceWindows[dateKey] ?? {};
    const existingWindow = currentDateWindows[windowKey] ?? buildAttendanceWindowEntry(block, windowKey);
    const nextEmployeeIds = [...new Set([
      ...existingWindow.employeeIds,
      ...((block?.employeeIds ?? []).filter((employeeId) => !allowedEmployeeIds || allowedEmployeeIds.has(employeeId)).map(Number)),
    ])];
    const startTimeCandidates = [existingWindow.startTime, getBlockStartLabel(block)].filter(Boolean).sort();
    const endTimeCandidates = [existingWindow.endTime, getBlockEndLabel(block)].filter(Boolean).sort();

    attendanceWindows[dateKey] = {
      ...currentDateWindows,
      [windowKey]: {
        ...existingWindow,
        startTime: startTimeCandidates[0] ?? existingWindow.startTime,
        endTime: endTimeCandidates.at(-1) ?? existingWindow.endTime,
        time: buildBlockTimeLabel(startTimeCandidates[0] ?? existingWindow.startTime, endTimeCandidates.at(-1) ?? existingWindow.endTime),
        employeeIds: nextEmployeeIds,
      },
    };

    return attendanceWindows;
  }, {});
}

function normalizeEmployeeAttendanceWindows(attendanceWindows, allowedEmployeeIds = null, employeesById = new Map(), availabilityCalendar = null) {
  const sourceWindows = attendanceWindows && typeof attendanceWindows === 'object' ? attendanceWindows : {};

  return Object.entries(sourceWindows).reduce((normalizedWindows, [dateKey, dateWindows]) => {
    const normalizedDateWindows = Object.entries(dateWindows ?? {}).reduce((windowAccumulator, [windowKey, windowValue]) => {
      const normalizedWindow = buildAttendanceWindowEntry(windowValue, windowKey);
      const safeEmployeeIds = normalizedWindow.employeeIds.filter((employeeId) => {
        if (allowedEmployeeIds && !allowedEmployeeIds.has(employeeId)) {
          return false;
        }

        const employee = employeesById.get(employeeId);
        return isEmployeeScheduleEligible(employee, dateKey, availabilityCalendar);
      });

      if (!safeEmployeeIds.length) {
        return windowAccumulator;
      }

      windowAccumulator[normalizedWindow.key] = {
        ...normalizedWindow,
        employeeIds: safeEmployeeIds,
      };
      return windowAccumulator;
    }, {});

    if (Object.keys(normalizedDateWindows).length) {
      normalizedWindows[dateKey] = normalizedDateWindows;
    }

    return normalizedWindows;
  }, {});
}

function getEmployeeAttendanceWindow(employeeId, dateKey, attendanceWindows = {}) {
  const normalizedEmployeeId = Number(employeeId);
  return Object.values(attendanceWindows?.[dateKey] ?? {}).find((window) => window.employeeIds.includes(normalizedEmployeeId)) ?? null;
}

export function isEmployeeEligibleForAttendanceWindow(employee, targetWindow, attendanceWindows = {}, availabilityCalendar = null) {
  if (!employee || !targetWindow) {
    return false;
  }

  if (!isEmployeeScheduleEligible(employee, targetWindow.dateKey, availabilityCalendar)) {
    return false;
  }

  const currentWindow = getEmployeeAttendanceWindow(employee.id, targetWindow.dateKey, attendanceWindows);
  return !currentWindow;
}

export function isEmployeeEligibleForScheduleBlock(employee, targetBlock, attendanceWindows = {}, availabilityCalendar = null) {
  if (!employee || !targetBlock) {
    return false;
  }

  if (!isEmployeeScheduleEligible(employee, targetBlock.dateKey, availabilityCalendar)) {
    return false;
  }

  const attendanceWindow = getEmployeeAttendanceWindow(employee.id, targetBlock.dateKey, attendanceWindows);
  if (!attendanceWindow) {
    return false;
  }

  const attendanceEndTime = normalizeClockValue(attendanceWindow.endTime);
  const blockEndTime = getBlockEndLabel(targetBlock);
  if (attendanceEndTime && blockEndTime && attendanceEndTime < blockEndTime) {
    return false;
  }

  return true;
}

function getBlockAssignmentGroupKey(block = {}) {
  const presetKey = String(block?.roundPresetKey ?? '').trim();
  if (presetKey && presetKey !== 'custom') {
    return presetKey;
  }

  const derivedPresetKey = getScheduleShiftPresetKey(getBlockStartLabel(block), block?.roundLabel ?? block?.title ?? '');
  if (derivedPresetKey === 'morning' || derivedPresetKey === 'late') {
    return derivedPresetKey;
  }

  const explicitRoundLabel = String(block?.roundLabel ?? '').trim();
  if (explicitRoundLabel) {
    return normalizeSearchValue(explicitRoundLabel);
  }

  return normalizeSearchValue(getBlockRoundLabel(block));
}

function isEmployeeCompatibleWithBlock(employeeId, targetBlock, blocks = []) {
  if (!targetBlock) {
    return false;
  }

  const targetGroupKey = getBlockAssignmentGroupKey(targetBlock);
  return blocks
    .filter((block) => block.dateKey === targetBlock.dateKey && block.id !== targetBlock.id && block.employeeIds.includes(employeeId))
    .every((block) => getBlockAssignmentGroupKey(block) === targetGroupKey);
}

export function isEmployeeEligibleForBlockAssignment(employee, targetBlock, blocks = [], availabilityCalendar = null) {
  if (!employee || !targetBlock) {
    return false;
  }

  if (!isEmployeeScheduleEligible(employee, targetBlock.dateKey, availabilityCalendar)) {
    return false;
  }

  return isEmployeeCompatibleWithBlock(employee.id, targetBlock, blocks);
}

function isCollapsedPrimaryShiftBlock(block = {}) {
  const normalizedTitle = normalizeSearchValue(block.title);
  const normalizedRoundLabel = normalizeSearchValue(block.roundLabel);
  const tasksCount = Array.isArray(block.tasks) ? block.tasks.length : 0;
  return normalizedTitle.includes('หน้าที่ในกะเช้า')
    || normalizedTitle.includes('หน้าที่ในกะสาย')
    || normalizedRoundLabel.includes('กะเช้า')
    || normalizedRoundLabel.includes('กะสาย')
    || normalizedRoundLabel.includes('รอบเช้า')
    || normalizedRoundLabel.includes('รอบสาย')
    || ((block.roundPresetKey === 'morning' || block.roundPresetKey === 'late' || block.roundPresetKey === 'custom') && tasksCount >= 6);
}

function expandCollapsedShiftBlocks(blocks = [], employeesById = new Map()) {
  const blocksByDate = new Map();

  blocks.forEach((block) => {
    const dateKey = String(block.dateKey ?? formatDateKey());
    if (!blocksByDate.has(dateKey)) {
      blocksByDate.set(dateKey, []);
    }
    blocksByDate.get(dateKey).push(block);
  });

  return [...blocksByDate.entries()].flatMap(([dateKey, dateBlocks]) => {
    const shouldExpand = dateBlocks.length <= 2 && dateBlocks.every(isCollapsedPrimaryShiftBlock);
    if (!shouldExpand) {
      return dateBlocks;
    }

    const collapsedBlocksByGroup = new Map(dateBlocks.map((block) => [getBlockAssignmentGroupKey(block), block]));

    return seedTimeBlocks.map((templateBlock, index) => {
      const assignmentSource = collapsedBlocksByGroup.get(getBlockAssignmentGroupKey(templateBlock));
      return normalizeBlock({
        ...templateBlock,
        id: createDateScopedBlockId(dateKey, templateBlock.templateId ?? templateBlock.id, index),
        templateId: templateBlock.templateId ?? templateBlock.id,
        dateKey,
        employeeIds: assignmentSource?.employeeIds ?? [],
      }, employeesById, dateKey);
    });
  });
}

export function normalizeClockValue(value = '') {
  const trimmedValue = String(value ?? '').trim();
  const matchedParts = trimmedValue.match(/^(\d{1,2}):(\d{2})$/);
  if (!matchedParts) {
    return '';
  }

  const hours = Number(matchedParts[1]);
  const minutes = Number(matchedParts[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return '';
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function parseBlockTimeRange(timeLabel = '') {
  const [rawStartTime = '', rawEndTime = ''] = String(timeLabel ?? '').split('-').map((segment) => segment.trim());
  return {
    startTime: normalizeClockValue(rawStartTime),
    endTime: normalizeClockValue(rawEndTime),
  };
}

export function buildBlockTimeLabel(startTime = '', endTime = '') {
  const normalizedStartTime = normalizeClockValue(startTime);
  const normalizedEndTime = normalizeClockValue(endTime);

  if (normalizedStartTime && normalizedEndTime) {
    return `${normalizedStartTime} - ${normalizedEndTime}`;
  }

  return normalizedStartTime || normalizedEndTime || '';
}

function inferRoundLabelFromStartTime(startTime = '') {
  const presetKey = getScheduleShiftPresetKey(startTime);
  if (presetKey === 'morning' || presetKey === 'late') {
    return getScheduleShiftPreset(presetKey).label;
  }

  const normalizedStartTime = normalizeClockValue(startTime);
  if (!normalizedStartTime) {
    return 'รอบงาน';
  }

  const [hoursText = '0', minutesText = '0'] = normalizedStartTime.split(':');
  const totalMinutes = (Number(hoursText) * 60) + Number(minutesText);
  if (totalMinutes < 720) {
    return 'รอบเช้า';
  }
  if (totalMinutes < 960) {
    return 'รอบบ่าย';
  }
  return 'รอบเย็น';
}

export function getBlockRoundLabel(block = {}) {
  const explicitRoundLabel = String(block?.roundLabel ?? block?.shiftLabel ?? '').trim();
  if (explicitRoundLabel) {
    return explicitRoundLabel;
  }

  const { startTime } = parseBlockTimeRange(block?.time ?? '');
  return inferRoundLabelFromStartTime(block?.startTime ?? startTime);
}

export function getBlockEndLabel(block = {}) {
  const { endTime } = parseBlockTimeRange(block?.time ?? '');
  return normalizeClockValue(block?.endTime ?? endTime);
}

export function getBlockStartLabel(block = {}) {
  const { startTime } = parseBlockTimeRange(block?.time ?? '');
  return normalizeClockValue(block?.startTime ?? startTime);
}

function normalizeBlock(block, employeesById = new Map(), fallbackDateKey = formatDateKey()) {
  const parsedTimeRange = parseBlockTimeRange(block.time ?? '');
  const startTime = normalizeClockValue(block.startTime ?? parsedTimeRange.startTime);
  const endTime = normalizeClockValue(block.endTime ?? parsedTimeRange.endTime);
  const timeLabel = buildBlockTimeLabel(startTime, endTime) || String(block.time ?? '').trim();
  const derivedPresetKey = getScheduleShiftPresetKey(startTime, block.roundLabel);

  return {
    ...block,
    dateKey: String(block.dateKey ?? fallbackDateKey),
    templateId: block.templateId ?? block.id,
    time: timeLabel,
    startTime,
    endTime,
    roundPresetKey: String(block.roundPresetKey ?? derivedPresetKey),
    roundLabel: String(block.roundLabel ?? '').trim() || getBlockRoundLabel({ ...block, startTime, time: timeLabel }),
    title: String(block.title ?? '').trim(),
    tasks: [...(block.tasks ?? [])],
    employeeIds: [...new Set(block.employeeIds)],
    status: computeBlockStatus(block.required, countAssignableEmployees(block.employeeIds, employeesById)),
  };
}

function normalizeEmployees(employees) {
  return employees.slice(0, MAX_EMPLOYEES).map(enrichEmployee);
}

function mergeSeedEmployees(existingEmployees = []) {
  const existingIds = new Set(existingEmployees.map((employee) => employee.id));
  const missingSeedEmployees = seedEmployees.filter((employee) => !existingIds.has(employee.id));
  return [...existingEmployees, ...missingSeedEmployees].slice(0, MAX_EMPLOYEES);
}

function buildSeedScheduleBlocks(baseBlocks = [], employeesById = new Map(), startDate = new Date(), totalDays = SCHEDULE_LOOKAHEAD_DAYS) {
  const rosterIds = Array.from(employeesById.values()).filter((employee) => !isManagerRole(employee.role)).map((employee) => employee.id);
  const firstDate = new Date(startDate);
  firstDate.setHours(0, 0, 0, 0);

  return Array.from({ length: totalDays }, (_, dayOffset) => {
    const dateKey = formatDateKey(addDays(firstDate, dayOffset));
    return baseBlocks.map((block, blockIndex) => normalizeBlock({
      ...block,
      id: createDateScopedBlockId(dateKey, block.templateId ?? block.id, blockIndex),
      templateId: block.templateId ?? block.id,
      dateKey,
      employeeIds: rotateBlockEmployeeIds(block.employeeIds.filter((employeeId) => rosterIds.includes(employeeId)), rosterIds, dayOffset + blockIndex),
    }, employeesById, dateKey));
  }).flat();
}

function sanitizeTimeBlocks(blocks, allowedEmployeeIds, employeesById = new Map()) {
  const hasDateScopedBlocks = blocks.some((block) => Boolean(block?.dateKey));
  const sanitizedBlocks = blocks.map((block) => normalizeBlock({
    ...block,
    employeeIds: block.employeeIds.filter((employeeId) => allowedEmployeeIds.has(employeeId) && isEmployeeScheduleEligible(employeesById.get(employeeId))),
  }, employeesById, block.dateKey ?? formatDateKey()));
  const migratedBlocks = hasDateScopedBlocks ? expandCollapsedShiftBlocks(sanitizedBlocks, employeesById) : sanitizedBlocks;

  if (hasDateScopedBlocks) {
    return migratedBlocks;
  }

  return buildSeedScheduleBlocks(migratedBlocks, employeesById);
}

function cloneRequests() {
  return seedRequests.map((request) => ({ ...request }));
}

function normalizeInventoryItem(item) {
  const quantity = Math.max(0, Number(item?.quantity ?? 0));
  const receivedToday = Math.max(0, Number(item?.receivedToday ?? 0));
  const baseQuantity = Math.max(0, Number(item?.baseQuantity ?? (quantity - receivedToday)));
  const rawExpiry = String(item?.expiresOn ?? '').trim();
  const noExpiry = Boolean(item?.noExpiry) || !rawExpiry;

  return {
    ...item,
    name: String(item?.name ?? '').trim(),
    category: String(item?.category ?? '').trim(),
    quantity,
    unit: String(item?.unit ?? 'ชิ้น').trim() || 'ชิ้น',
    threshold: Math.max(0, Number(item?.threshold ?? 0)),
    expiresOn: noExpiry ? '' : rawExpiry,
    noExpiry,
    checkedAt: item?.checkedAt ?? '',
    checkedBy: item?.checkedBy ?? '',
    receivedToday,
    baseQuantity,
    soldToday: Math.max(0, Number(item?.soldToday ?? 0)),
    useToday: Boolean(item?.useToday),
  };
}

function cloneInventoryItems() {
  return seedInventoryItems.map((item) => normalizeInventoryItem(item));
}

function cloneIssueReports() {
  return seedIssueReports.map((issue) => ({ ...issue }));
}

function normalizeInventoryHistoryEntry(entry) {
  return {
    id: Number(entry?.id ?? Date.now()),
    itemId: Number(entry?.itemId ?? 0),
    itemName: String(entry?.itemName ?? '').trim(),
    action: String(entry?.action ?? 'update').trim() || 'update',
    label: String(entry?.label ?? 'อัปเดตรายการ').trim() || 'อัปเดตรายการ',
    detail: String(entry?.detail ?? '').trim(),
    actorName: String(entry?.actorName ?? '').trim() || 'ระบบ',
    at: String(entry?.at ?? formatDateTime()).trim() || formatDateTime(),
  };
}

function appendInventoryHistory(historyEntries = [], entryInput) {
  return [normalizeInventoryHistoryEntry(entryInput), ...historyEntries].slice(0, MAX_INVENTORY_HISTORY_ITEMS);
}

function describeExpiryChange(previousItem, nextItem) {
  if (Boolean(previousItem?.noExpiry) !== Boolean(nextItem?.noExpiry)) {
    return nextItem?.noExpiry ? 'ตั้งเป็นไม่มีวันหมดอายุ' : `กำหนดวันหมดอายุ ${nextItem?.expiresOn ?? ''}`;
  }

  if ((previousItem?.expiresOn ?? '') !== (nextItem?.expiresOn ?? '')) {
    return `เปลี่ยนวันหมดอายุเป็น ${nextItem?.expiresOn ?? ''}`;
  }

  return '';
}

function buildInventoryHistoryEntry(previousItem, nextItem, changes) {
  const actorName = String(changes?.checkedBy ?? nextItem?.checkedBy ?? previousItem?.checkedBy ?? 'ระบบ').trim() || 'ระบบ';
  const itemName = nextItem?.name ?? previousItem?.name ?? '';

  if (!previousItem && nextItem) {
    return {
      id: Date.now(),
      itemId: nextItem.id,
      itemName,
      action: 'create',
      label: 'เพิ่มรายการสินค้า',
      detail: `${itemName} • เริ่มต้น ${nextItem.quantity} ${nextItem.unit}`,
      actorName,
      at: nextItem.checkedAt || formatDateTime(),
    };
  }

  if (previousItem && !nextItem) {
    return {
      id: Date.now(),
      itemId: previousItem.id,
      itemName: previousItem.name,
      action: 'delete',
      label: 'ลบรายการสินค้า',
      detail: previousItem.name,
      actorName,
      at: formatDateTime(),
    };
  }

  if (!previousItem || !nextItem) {
    return null;
  }

  const changedFields = [];
  if (previousItem.name !== nextItem.name) {
    changedFields.push(`ชื่อ ${previousItem.name} -> ${nextItem.name}`);
  }
  if ((previousItem.category || '') !== (nextItem.category || '')) {
    changedFields.push(`หมวดหมู่ ${(previousItem.category || 'อื่นๆ')} -> ${(nextItem.category || 'อื่นๆ')}`);
  }
  if (previousItem.unit !== nextItem.unit) {
    changedFields.push(`หน่วย ${previousItem.unit} -> ${nextItem.unit}`);
  }
  if (previousItem.threshold !== nextItem.threshold) {
    changedFields.push(`จุดเตือน ${previousItem.threshold} -> ${nextItem.threshold}`);
  }

  const expiryChange = describeExpiryChange(previousItem, nextItem);
  if (expiryChange) {
    changedFields.push(expiryChange);
  }

  if (changedFields.length > 0) {
    return {
      id: Date.now(),
      itemId: nextItem.id,
      itemName,
      action: 'edit',
      label: 'แก้ข้อมูลสินค้า',
      detail: changedFields.join(' • '),
      actorName,
      at: nextItem.checkedAt || formatDateTime(),
    };
  }

  if (previousItem.useToday !== nextItem.useToday) {
    return {
      id: Date.now(),
      itemId: nextItem.id,
      itemName,
      action: 'priority',
      label: nextItem.useToday ? 'ทำเครื่องหมายใช้ก่อน' : 'ยกเลิกใช้ก่อน',
      detail: itemName,
      actorName,
      at: nextItem.checkedAt || formatDateTime(),
    };
  }

  if (nextItem.receivedToday > previousItem.receivedToday && nextItem.quantity >= previousItem.quantity) {
    const receivedAmount = nextItem.receivedToday - previousItem.receivedToday;
    return {
      id: Date.now(),
      itemId: nextItem.id,
      itemName,
      action: 'receive',
      label: 'บันทึกรับเข้า',
      detail: `${itemName} +${receivedAmount} ${nextItem.unit} • รวม ${nextItem.quantity} ${nextItem.unit}`,
      actorName,
      at: nextItem.checkedAt || formatDateTime(),
    };
  }

  if (previousItem.quantity !== nextItem.quantity) {
    return {
      id: Date.now(),
      itemId: nextItem.id,
      itemName,
      action: 'stock',
      label: 'บันทึกสต็อก',
      detail: `${itemName} • ${previousItem.quantity} -> ${nextItem.quantity} ${nextItem.unit}`,
      actorName,
      at: nextItem.checkedAt || formatDateTime(),
    };
  }

  return null;
}

function normalizeSettings(settings) {
  return {
    ...initialSettings,
    ...settings,
    managerName: String(settings?.managerName ?? initialSettings.managerName).trim() || initialSettings.managerName,
    managerPhone: String(settings?.managerPhone ?? initialSettings.managerPhone).trim() || initialSettings.managerPhone,
    managerPassword: String(settings?.managerPassword ?? initialSettings.managerPassword).trim() || initialSettings.managerPassword,
    preferredView: 'desktop',
  };
}

function buildDefaultState() {
  const normalizedEmployees = normalizeEmployees(seedEmployees);
  const allowedEmployeeIds = new Set(normalizedEmployees.map((employee) => employee.id));
  const employeesById = buildEmployeesById(normalizedEmployees);
  const employeeAvailabilityCalendar = normalizeAvailabilityCalendar(seedEmployeeAvailabilityCalendar, allowedEmployeeIds, normalizedEmployees);
  const timeBlocks = sanitizeTimeBlocks(seedTimeBlocks, allowedEmployeeIds, employeesById);
  return {
    version: STATE_VERSION,
    employees: normalizedEmployees,
    managerSessionActive: false,
    employeePortalSessionId: null,
    calendarDaySettings: normalizeCalendarDaySettings(seedCalendarDaySettings),
    employeeAvailabilityCalendar,
    employeeAttendanceWindows: normalizeEmployeeAttendanceWindows(buildAttendanceWindowsFromBlocks(timeBlocks, allowedEmployeeIds), allowedEmployeeIds, employeesById, employeeAvailabilityCalendar),
    timeBlocks,
    requests: cloneRequests(),
	inventoryItems: cloneInventoryItems(),
  inventoryHistory: [],
	issueReports: cloneIssueReports(),
	settings: normalizeSettings(initialSettings),
  };
}

function readInitialState() {
  const fallbackState = buildDefaultState();

  if (typeof window === 'undefined') {
    return fallbackState;
  }

  try {
    const storedValue = window.localStorage.getItem(STORAGE_KEY);
    if (!storedValue) {
      return {
        ...fallbackState,
        managerSessionActive: readManagerSessionActive(false),
        employeePortalSessionId: readEmployeePortalSessionId(null),
      };
    }

    const parsedValue = JSON.parse(storedValue);
    const persistedManagerSessionActive = readManagerSessionActive(Boolean(parsedValue.managerSessionActive));
    const persistedEmployeeSessionId = readEmployeePortalSessionId(Number.isFinite(parsedValue.employeePortalSessionId) ? parsedValue.employeePortalSessionId : null);
    if (parsedValue.version !== STATE_VERSION) {
      const migratedEmployees = Array.isArray(parsedValue.employees) ? mergeSeedEmployees(parsedValue.employees) : fallbackState.employees;
      const normalizedEmployees = normalizeEmployees(migratedEmployees);
      const allowedEmployeeIds = new Set(normalizedEmployees.map((employee) => employee.id));
      const employeesById = buildEmployeesById(normalizedEmployees);
      return {
        ...fallbackState,
        employees: normalizedEmployees,
        managerSessionActive: persistedManagerSessionActive,
        employeePortalSessionId: persistedEmployeeSessionId,
        calendarDaySettings: normalizeCalendarDaySettings(parsedValue.calendarDaySettings ?? fallbackState.calendarDaySettings),
        employeeAvailabilityCalendar: (() => {
          const normalizedCalendar = normalizeAvailabilityCalendar(parsedValue.employeeAvailabilityCalendar, allowedEmployeeIds, normalizedEmployees);
          return normalizedCalendar;
        })(),
        employeeAttendanceWindows: (() => {
          const normalizedCalendar = normalizeAvailabilityCalendar(parsedValue.employeeAvailabilityCalendar, allowedEmployeeIds, normalizedEmployees);
          const nextTimeBlocks = Array.isArray(parsedValue.timeBlocks)
            ? sanitizeTimeBlocks(parsedValue.timeBlocks, allowedEmployeeIds, employeesById)
            : fallbackState.timeBlocks;
          return normalizeEmployeeAttendanceWindows(buildAttendanceWindowsFromBlocks(nextTimeBlocks, allowedEmployeeIds), allowedEmployeeIds, employeesById, normalizedCalendar);
        })(),
        timeBlocks: Array.isArray(parsedValue.timeBlocks)
          ? sanitizeTimeBlocks(parsedValue.timeBlocks, allowedEmployeeIds, employeesById)
          : fallbackState.timeBlocks,
        requests: Array.isArray(parsedValue.requests) ? parsedValue.requests.map((request) => ({ ...request })) : fallbackState.requests,
    inventoryItems: Array.isArray(parsedValue.inventoryItems) ? parsedValue.inventoryItems.map((item) => normalizeInventoryItem(item)) : fallbackState.inventoryItems,
		inventoryHistory: Array.isArray(parsedValue.inventoryHistory) ? parsedValue.inventoryHistory.map((entry) => normalizeInventoryHistoryEntry(entry)) : fallbackState.inventoryHistory,
		issueReports: Array.isArray(parsedValue.issueReports) ? parsedValue.issueReports.map((issue) => ({ ...issue })) : fallbackState.issueReports,
		settings: normalizeSettings(parsedValue.settings ?? fallbackState.settings),
      };
    }

    const needsThreeEmployeeMigration = Array.isArray(parsedValue.employees) && parsedValue.employees.length > MAX_EMPLOYEES;
    const normalizedEmployees = Array.isArray(parsedValue.employees) ? normalizeEmployees(parsedValue.employees) : fallbackState.employees;
    const allowedEmployeeIds = new Set(normalizedEmployees.map((employee) => employee.id));
    const employeesById = buildEmployeesById(normalizedEmployees);
    const normalizedCalendar = normalizeAvailabilityCalendar(parsedValue.employeeAvailabilityCalendar, allowedEmployeeIds, normalizedEmployees);
    const nextTimeBlocks = needsThreeEmployeeMigration
      ? sanitizeTimeBlocks(seedTimeBlocks, allowedEmployeeIds, employeesById)
      : Array.isArray(parsedValue.timeBlocks)
        ? sanitizeTimeBlocks(parsedValue.timeBlocks, allowedEmployeeIds, employeesById)
        : fallbackState.timeBlocks;
    return {
      version: STATE_VERSION,
      employees: normalizedEmployees,
      managerSessionActive: persistedManagerSessionActive,
      employeePortalSessionId: persistedEmployeeSessionId,
      calendarDaySettings: normalizeCalendarDaySettings(parsedValue.calendarDaySettings ?? fallbackState.calendarDaySettings),
      employeeAvailabilityCalendar: normalizedCalendar,
      employeeAttendanceWindows: normalizeEmployeeAttendanceWindows(parsedValue.employeeAttendanceWindows ?? buildAttendanceWindowsFromBlocks(nextTimeBlocks, allowedEmployeeIds), allowedEmployeeIds, employeesById, normalizedCalendar),
      timeBlocks: nextTimeBlocks,
      requests: Array.isArray(parsedValue.requests) ? parsedValue.requests.map((request) => ({ ...request })) : fallbackState.requests,
    inventoryItems: Array.isArray(parsedValue.inventoryItems) ? parsedValue.inventoryItems.map((item) => normalizeInventoryItem(item)) : fallbackState.inventoryItems,
		inventoryHistory: Array.isArray(parsedValue.inventoryHistory) ? parsedValue.inventoryHistory.map((entry) => normalizeInventoryHistoryEntry(entry)) : fallbackState.inventoryHistory,
		issueReports: Array.isArray(parsedValue.issueReports) ? parsedValue.issueReports.map((issue) => ({ ...issue })) : fallbackState.issueReports,
		settings: normalizeSettings(parsedValue.settings ?? fallbackState.settings),
    };
  } catch {
    return fallbackState;
  }
}

function hydrateSupabaseState(remoteState, previousState) {
  const fallbackState = buildDefaultState();
  const remoteSnapshotLooksIncomplete = Boolean(previousState)
    && Array.isArray(remoteState?.employees) && remoteState.employees.length === 0
    && Array.isArray(remoteState?.timeBlocks) && remoteState.timeBlocks.length === 0
    && Array.isArray(remoteState?.inventoryItems) && remoteState.inventoryItems.length === 0
    && Array.isArray(remoteState?.requests) && remoteState.requests.length === 0
    && Array.isArray(remoteState?.issueReports) && remoteState.issueReports.length === 0;
  const sourceEmployees = remoteSnapshotLooksIncomplete
    ? previousState?.employees ?? fallbackState.employees
    : remoteState?.employees ?? fallbackState.employees;
  const normalizedEmployees = normalizeEmployees(sourceEmployees);
  const allowedEmployeeIds = new Set(normalizedEmployees.map((employee) => employee.id));
  const employeesById = buildEmployeesById(normalizedEmployees);
  const sourceAvailabilityCalendar = remoteSnapshotLooksIncomplete
    ? previousState?.employeeAvailabilityCalendar
    : remoteState?.employeeAvailabilityCalendar;
  const normalizedCalendar = normalizeAvailabilityCalendar(sourceAvailabilityCalendar, allowedEmployeeIds, normalizedEmployees);
  const mergeHydratedTimeBlocks = (remoteBlocks = [], localBlocks = []) => {
    const localBlocksById = new Map((localBlocks ?? []).map((block) => [String(block.id), block]));
    const mergedRemoteBlocks = remoteBlocks.map((block) => {
      const localBlock = localBlocksById.get(String(block.id));
      if (!localBlock) {
        return block;
      }

      return {
        ...localBlock,
        ...block,
        templateId: block.templateId ?? localBlock.templateId,
        startTime: block.startTime || localBlock.startTime,
        endTime: block.endTime || localBlock.endTime,
        roundPresetKey: block.roundPresetKey || localBlock.roundPresetKey,
        roundLabel: block.roundLabel || localBlock.roundLabel,
      };
    });

    const remoteBlockIds = new Set(mergedRemoteBlocks.map((block) => String(block.id)));
    const missingLocalBlocks = (localBlocks ?? []).filter((block) => !remoteBlockIds.has(String(block.id)));
    return [...mergedRemoteBlocks, ...missingLocalBlocks];
  };
  const mergeHydratedAttendanceWindows = (remoteWindows = {}, localWindows = {}) => {
    const mergedWindows = Object.fromEntries(Object.entries(remoteWindows ?? {}).map(([dateKey, dateWindows]) => [
      dateKey,
      Object.fromEntries(Object.entries(dateWindows ?? {}).map(([windowKey, windowValue]) => [windowKey, { ...windowValue }]))
    ]));

    Object.entries(localWindows ?? {}).forEach(([dateKey, dateWindows]) => {
      if (!mergedWindows[dateKey]) {
        mergedWindows[dateKey] = Object.fromEntries(Object.entries(dateWindows ?? {}).map(([windowKey, windowValue]) => [windowKey, { ...windowValue }]));
        return;
      }

      Object.entries(dateWindows ?? {}).forEach(([windowKey, windowValue]) => {
        if (!mergedWindows[dateKey][windowKey]) {
          mergedWindows[dateKey][windowKey] = { ...windowValue };
        }
      });
    });

    return mergedWindows;
  };
  const remoteTimeBlocks = Array.isArray(remoteState?.timeBlocks)
    ? sanitizeTimeBlocks(remoteState.timeBlocks, allowedEmployeeIds, employeesById)
    : fallbackState.timeBlocks;
  const nextTimeBlocks = sanitizeTimeBlocks(
    mergeHydratedTimeBlocks(remoteTimeBlocks, previousState?.timeBlocks ?? []),
    allowedEmployeeIds,
    employeesById,
  );
  const hasRemoteAttendanceWindows = Boolean(remoteState) && Object.prototype.hasOwnProperty.call(remoteState, 'employeeAttendanceWindows');
  const baseAttendanceWindows = hasRemoteAttendanceWindows
    ? remoteState?.employeeAttendanceWindows
    : previousState?.employeeAttendanceWindows;
  const nextAttendanceWindows = mergeHydratedAttendanceWindows(baseAttendanceWindows ?? buildAttendanceWindowsFromBlocks(remoteTimeBlocks, allowedEmployeeIds), previousState?.employeeAttendanceWindows);
  const persistedSessionId = Number.isFinite(previousState?.employeePortalSessionId) && allowedEmployeeIds.has(previousState.employeePortalSessionId)
    ? previousState.employeePortalSessionId
    : null;
  const sourceCalendarDaySettings = remoteSnapshotLooksIncomplete
    ? previousState?.calendarDaySettings
    : remoteState?.calendarDaySettings;
  const sourceRequests = remoteSnapshotLooksIncomplete
    ? previousState?.requests
    : remoteState?.requests;
  const sourceInventoryItems = remoteSnapshotLooksIncomplete
    ? previousState?.inventoryItems
    : remoteState?.inventoryItems;
  const sourceInventoryHistory = remoteSnapshotLooksIncomplete
    ? previousState?.inventoryHistory
    : remoteState?.inventoryHistory;
  const sourceIssueReports = remoteSnapshotLooksIncomplete
    ? previousState?.issueReports
    : remoteState?.issueReports;

  return {
    ...fallbackState,
    version: STATE_VERSION,
    employees: normalizedEmployees,
    managerSessionActive: Boolean(previousState?.managerSessionActive),
    employeePortalSessionId: persistedSessionId,
    calendarDaySettings: normalizeCalendarDaySettings(sourceCalendarDaySettings ?? fallbackState.calendarDaySettings),
    employeeAvailabilityCalendar: normalizedCalendar,
    employeeAttendanceWindows: normalizeEmployeeAttendanceWindows(nextAttendanceWindows, allowedEmployeeIds, employeesById, normalizedCalendar),
    timeBlocks: nextTimeBlocks,
    requests: Array.isArray(sourceRequests) ? sourceRequests.map((request) => ({ ...request })) : fallbackState.requests,
    inventoryItems: Array.isArray(sourceInventoryItems) ? sourceInventoryItems.map((item) => normalizeInventoryItem(item)) : fallbackState.inventoryItems,
    inventoryHistory: Array.isArray(sourceInventoryHistory) ? sourceInventoryHistory.map((entry) => normalizeInventoryHistoryEntry(entry)) : fallbackState.inventoryHistory,
    issueReports: Array.isArray(sourceIssueReports) ? sourceIssueReports.map((issue) => ({ ...issue })) : fallbackState.issueReports,
    settings: normalizeSettings(remoteState?.settings ?? fallbackState.settings),
  };
}

function buildSupabasePersistedState(state) {
  return {
    version: Number.isFinite(state?.version) ? state.version : STATE_VERSION,
    employees: state.employees,
    calendarDaySettings: state.calendarDaySettings,
    employeeAvailabilityCalendar: state.employeeAvailabilityCalendar,
    employeeAttendanceWindows: state.employeeAttendanceWindows,
    timeBlocks: state.timeBlocks,
    requests: state.requests,
    inventoryItems: state.inventoryItems,
    inventoryHistory: state.inventoryHistory,
    issueReports: state.issueReports,
    settings: state.settings,
  };
}

function buildPersistedStateSignature(state) {
  return JSON.stringify(buildSupabasePersistedState(state));
}

function mapRequestTitle(type) {
  const titles = {
    'ขอพนักงานเพิ่ม': 'ขอรับพนักงานเพิ่ม',
    'รายงานปัญหา': 'แจ้งปัญหาหน้างาน',
    'ขออุปกรณ์': 'ขออุปกรณ์เพิ่มเติม',
    'ขอเปลี่ยนกะ': 'ขอเปลี่ยนกะ',
  };
  return titles[type] ?? type;
}

export function AppStateProvider({ children }) {
  const [state, setState] = useState(readInitialState);
  const [isSupabaseSyncReady, setIsSupabaseSyncReady] = useState(!useSupabaseBackend || !isSupabaseConfigured);
  const lastSyncedSignatureRef = useRef(null);
  const syncTimeoutRef = useRef(null);
  const { calendarDaySettings, employeeAvailabilityCalendar, employeeAttendanceWindows, employeePortalSessionId, employees, inventoryHistory, inventoryItems, issueReports, managerSessionActive, requests, settings, timeBlocks } = state;

  useEffect(() => {
    if (!useSupabaseBackend || !isSupabaseConfigured) {
      return undefined;
    }

    let isActive = true;

    loadAppStateFromSupabase()
      .then((remoteState) => {
        if (!isActive) {
          return;
        }

        setState((currentState) => {
          const remoteOnlyState = hydrateSupabaseState({
            ...remoteState,
            employeeAttendanceWindows: Object.prototype.hasOwnProperty.call(remoteState ?? {}, 'employeeAttendanceWindows')
              ? remoteState.employeeAttendanceWindows
              : undefined,
            timeBlocks: Array.isArray(remoteState?.timeBlocks) ? remoteState.timeBlocks : undefined,
          }, null);
          const hydratedState = hydrateSupabaseState(remoteState, currentState);
          lastSyncedSignatureRef.current = buildPersistedStateSignature(remoteOnlyState);
          return hydratedState;
        });
        setIsSupabaseSyncReady(true);
      })
      .catch((error) => {
        console.error('Failed to load app state from Supabase.', error);
        if (isActive) {
          lastSyncedSignatureRef.current = buildPersistedStateSignature(state);
          setIsSupabaseSyncReady(true);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (managerSessionActive) {
      window.localStorage.setItem(MANAGER_SESSION_STORAGE_KEY, '1');
    } else {
      window.localStorage.removeItem(MANAGER_SESSION_STORAGE_KEY);
    }

    if (Number.isFinite(employeePortalSessionId)) {
      window.localStorage.setItem(EMPLOYEE_SESSION_STORAGE_KEY, String(employeePortalSessionId));
    } else {
      window.localStorage.removeItem(EMPLOYEE_SESSION_STORAGE_KEY);
    }
  }, [employeePortalSessionId, managerSessionActive]);

  useEffect(() => {
    if (!useSupabaseBackend || !isSupabaseConfigured || !isSupabaseSyncReady) {
      return undefined;
    }

    const nextSignature = buildPersistedStateSignature(state);
    if (nextSignature === lastSyncedSignatureRef.current) {
      return undefined;
    }

    if (syncTimeoutRef.current) {
      window.clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = window.setTimeout(() => {
      saveAppStateToSupabase(buildSupabasePersistedState(state))
        .then(() => {
          lastSyncedSignatureRef.current = nextSignature;
        })
        .catch((error) => {
          console.error('Failed to sync app state to Supabase.', error);
        });
    }, 500);

    return () => {
      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [isSupabaseSyncReady, state]);

  const addEmployeesToBlock = (blockId, selectedIds) => {
    const block = timeBlocks.find((entry) => entry.id === blockId);
    if (!block) {
      return null;
    }

    const employeesById = buildEmployeesById(employees);
    const safeSelectedIds = selectedIds.filter((employeeId) => isEmployeeEligibleForScheduleBlock(employeesById.get(employeeId), block, employeeAttendanceWindows, employeeAvailabilityCalendar));
    const nextEmployeeIds = [...new Set([...block.employeeIds, ...safeSelectedIds])];
    const updatedBlock = normalizeBlock({ ...block, employeeIds: nextEmployeeIds }, employeesById, block.dateKey);
    setState((currentState) => ({
      ...currentState,
      timeBlocks: currentState.timeBlocks.map((entry) => (entry.id === blockId ? updatedBlock : entry)),
    }));
    return updatedBlock;
  };

  const addEmployeesToWindow = (blockIds, selectedIds, summaryOverrides = {}) => {
    const uniqueBlockIds = [...new Set(blockIds ?? [])];
    const targetBlocks = timeBlocks.filter((entry) => uniqueBlockIds.includes(entry.id));
    if (!targetBlocks.length) {
      return null;
    }

    const employeesById = buildEmployeesById(employees);
    const targetWindow = targetBlocks[0];
    const windowKey = getAttendanceWindowKey(targetWindow);
    const windowDateKey = String(targetWindow.dateKey ?? formatDateKey());
    const startTime = targetBlocks.map((block) => getBlockStartLabel(block)).filter(Boolean).sort()[0] ?? '';
    const endTime = targetBlocks.map((block) => getBlockEndLabel(block)).filter(Boolean).sort().at(-1) ?? '';
    const safeSelectedIds = selectedIds.filter((employeeId) => isEmployeeEligibleForAttendanceWindow(employeesById.get(employeeId), targetWindow, employeeAttendanceWindows, employeeAvailabilityCalendar));
    if (!safeSelectedIds.length) {
      return null;
    }

    setState((currentState) => {
      const nextDateWindows = Object.fromEntries(
        Object.entries(currentState.employeeAttendanceWindows?.[windowDateKey] ?? {}).map(([entryKey, entryValue]) => {
          const nextEmployeeIds = entryKey === windowKey
            ? entryValue.employeeIds ?? []
            : (entryValue.employeeIds ?? []).filter((employeeId) => !safeSelectedIds.includes(employeeId));
          return [entryKey, { ...entryValue, employeeIds: nextEmployeeIds }];
        }).filter(([, entryValue]) => entryValue.employeeIds.length),
      );

      nextDateWindows[windowKey] = {
        ...buildAttendanceWindowEntry(currentState.employeeAttendanceWindows?.[windowDateKey]?.[windowKey] ?? targetWindow, windowKey),
        startTime: startTime || nextDateWindows[windowKey]?.startTime || getBlockStartLabel(targetWindow),
        endTime: endTime || nextDateWindows[windowKey]?.endTime || getBlockEndLabel(targetWindow),
        time: buildBlockTimeLabel(
          startTime || nextDateWindows[windowKey]?.startTime || getBlockStartLabel(targetWindow),
          endTime || nextDateWindows[windowKey]?.endTime || getBlockEndLabel(targetWindow),
        ),
        employeeIds: [...new Set([...(nextDateWindows[windowKey]?.employeeIds ?? []), ...safeSelectedIds])],
      };

      return {
        ...currentState,
        employeeAttendanceWindows: {
          ...(currentState.employeeAttendanceWindows ?? {}),
          [windowDateKey]: nextDateWindows,
        },
      };
    });

    return {
      ...targetBlocks[0],
      roundLabel: String(summaryOverrides.roundLabel ?? getBlockRoundLabel(targetBlocks[0])).trim(),
      time: String(summaryOverrides.time ?? buildBlockTimeLabel(startTime, endTime) ?? targetBlocks[0].time).trim(),
      title: String(summaryOverrides.title ?? targetBlocks[0].title).trim(),
    };
  };

  const removeEmployeeFromAttendanceWindow = (dateKey, windowKey, employeeId) => {
    const normalizedDateKey = String(dateKey ?? formatDateKey()).trim();
    const normalizedWindowKey = String(windowKey ?? '').trim();
    const normalizedEmployeeId = Number(employeeId);
    const targetWindow = employeeAttendanceWindows?.[normalizedDateKey]?.[normalizedWindowKey];
    if (!targetWindow || !targetWindow.employeeIds.includes(normalizedEmployeeId)) {
      return null;
    }

    setState((currentState) => {
      const nextDateWindows = { ...(currentState.employeeAttendanceWindows?.[normalizedDateKey] ?? {}) };
      const nextEmployeeIds = (nextDateWindows[normalizedWindowKey]?.employeeIds ?? []).filter((entry) => entry !== normalizedEmployeeId);

      if (nextEmployeeIds.length) {
        nextDateWindows[normalizedWindowKey] = {
          ...nextDateWindows[normalizedWindowKey],
          employeeIds: nextEmployeeIds,
        };
      } else {
        delete nextDateWindows[normalizedWindowKey];
      }

      const nextAttendanceWindows = { ...(currentState.employeeAttendanceWindows ?? {}) };
      if (Object.keys(nextDateWindows).length) {
        nextAttendanceWindows[normalizedDateKey] = nextDateWindows;
      } else {
        delete nextAttendanceWindows[normalizedDateKey];
      }

      return {
        ...currentState,
        employeeAttendanceWindows: nextAttendanceWindows,
      };
    });

    return {
      employee: employees.find((entry) => entry.id === normalizedEmployeeId) ?? null,
      time: targetWindow.time,
      dateKey: normalizedDateKey,
    };
  };

  const removeEmployeeFromBlock = (blockId, employeeId) => {
    const block = timeBlocks.find((entry) => entry.id === blockId);
    if (!block) {
      return null;
    }

    const nextEmployeeIds = block.employeeIds.filter((entry) => entry !== employeeId);
    const updatedBlock = normalizeBlock({ ...block, employeeIds: nextEmployeeIds }, buildEmployeesById(employees));
    setState((currentState) => ({
      ...currentState,
      timeBlocks: currentState.timeBlocks.map((entry) => (entry.id === blockId ? updatedBlock : entry)),
    }));
    return updatedBlock;
  };

  const moveEmployeeToBlock = (sourceBlockId, targetBlockId, employeeId) => {
    if (sourceBlockId === targetBlockId) {
      return null;
    }

    const sourceBlock = timeBlocks.find((entry) => entry.id === sourceBlockId);
    const targetBlock = timeBlocks.find((entry) => entry.id === targetBlockId);
    if (!sourceBlock || !targetBlock || targetBlock.employeeIds.includes(employeeId)) {
      return null;
    }

    const employeesById = buildEmployeesById(employees);
    if (!isEmployeeEligibleForScheduleBlock(employeesById.get(employeeId), targetBlock, employeeAttendanceWindows, employeeAvailabilityCalendar)) {
      return null;
    }

    const nextSourceBlock = normalizeBlock({
      ...sourceBlock,
      employeeIds: sourceBlock.employeeIds.filter((entry) => entry !== employeeId),
    }, employeesById, sourceBlock.dateKey);
    const nextTargetBlock = normalizeBlock({
      ...targetBlock,
      employeeIds: [...targetBlock.employeeIds, employeeId],
    }, employeesById, targetBlock.dateKey);

    setState((currentState) => ({
      ...currentState,
      timeBlocks: currentState.timeBlocks.map((entry) => {
        if (entry.id === sourceBlockId) {
          return nextSourceBlock;
        }
        if (entry.id === targetBlockId) {
          return nextTargetBlock;
        }
        return entry;
      }),
    }));

    return nextTargetBlock;
  };

  const autoAssignEmployeesToBlock = (blockId, dateKey = null) => {
    const block = timeBlocks.find((entry) => entry.id === blockId);
    if (!block) {
      return null;
    }

    const targetDateKey = dateKey ?? block.dateKey ?? formatDateKey();
    const employeesById = buildEmployeesById(employees);
    const currentAssigned = block.employeeIds.filter((employeeId) => isEmployeeAssignable(employeesById.get(employeeId), targetDateKey, employeeAvailabilityCalendar)).length;
    const shortage = Math.max(block.required - currentAssigned, 0);
    if (!shortage) {
      return null;
    }

    const selectedIds = employees
      .filter((employee) => isEmployeeEligibleForScheduleBlock(employee, { ...block, dateKey: targetDateKey }, employeeAttendanceWindows, employeeAvailabilityCalendar) && !block.employeeIds.includes(employee.id))
      .map((employee) => ({
        employee,
        score: scoreEmployeeForBlock(employee, block),
        assignmentCount: getTimeBlocksForDate(timeBlocks, targetDateKey).filter((entry) => entry.employeeIds.includes(employee.id)).length,
      }))
      .sort((left, right) => right.score - left.score || left.assignmentCount - right.assignmentCount || left.employee.name.localeCompare(right.employee.name, 'th'))
      .slice(0, shortage)
      .map(({ employee }) => employee.id);

    if (!selectedIds.length) {
      return null;
    }

    const updatedBlock = normalizeBlock({
      ...block,
      employeeIds: [...block.employeeIds, ...selectedIds],
    }, employeesById, block.dateKey);

    setState((currentState) => ({
      ...currentState,
      timeBlocks: currentState.timeBlocks.map((entry) => (entry.id === blockId ? updatedBlock : entry)),
    }));

    return {
      updatedBlock,
      addedCount: selectedIds.length,
    };
  };

  const saveTimeBlock = (blockInput) => {
    const startTime = normalizeClockValue(blockInput.startTime);
    const endTime = normalizeClockValue(blockInput.endTime);
    const derivedTimeLabel = buildBlockTimeLabel(startTime, endTime);
    const normalizedInput = {
      ...blockInput,
      dateKey: String(blockInput.dateKey ?? formatDateKey()),
      time: derivedTimeLabel || String(blockInput.time ?? '').trim(),
      startTime,
      endTime,
      roundPresetKey: String(blockInput.roundPresetKey ?? getScheduleShiftPresetKey(startTime, blockInput.roundLabel)),
      roundLabel: String(blockInput.roundLabel ?? '').trim(),
      title: String(blockInput.title ?? '').trim(),
      required: Math.min(MAX_EMPLOYEES, Number(blockInput.required) || 0),
      tasks: blockInput.tasks.map((task) => task.trim()).filter(Boolean),
    };

    if (!normalizedInput.time || !normalizedInput.title || !normalizedInput.roundLabel || normalizedInput.required <= 0) {
      return null;
    }

    const existingBlock = normalizedInput.id ? timeBlocks.find((entry) => entry.id === normalizedInput.id) : null;
    const nextBlock = normalizeBlock({
      id: existingBlock?.id ?? createDateScopedBlockId(normalizedInput.dateKey, Date.now()),
      employeeIds: existingBlock?.employeeIds ?? [],
      ...existingBlock,
      ...normalizedInput,
    }, buildEmployeesById(employees), normalizedInput.dateKey);

    setState((currentState) => ({
      ...currentState,
      timeBlocks: existingBlock
        ? currentState.timeBlocks.map((entry) => (entry.id === existingBlock.id ? nextBlock : entry))
        : [...currentState.timeBlocks, nextBlock],
    }));

    return nextBlock;
  };

  const deleteTimeBlock = (blockId) => {
    const block = timeBlocks.find((entry) => entry.id === blockId);
    if (!block) {
      return null;
    }

    setState((currentState) => ({
      ...currentState,
      timeBlocks: currentState.timeBlocks.filter((entry) => entry.id !== blockId),
    }));

    return block;
  };

  const deleteTimeWindow = (blockIds, summaryOverrides = {}) => {
    const uniqueBlockIds = [...new Set(blockIds ?? [])];
    const targetBlocks = timeBlocks.filter((entry) => uniqueBlockIds.includes(entry.id));
    if (!targetBlocks.length) {
      return null;
    }

    setState((currentState) => ({
      ...currentState,
      timeBlocks: currentState.timeBlocks.filter((entry) => !uniqueBlockIds.includes(entry.id)),
      employeeAttendanceWindows: (() => {
        const windowDateKey = String(targetBlocks[0]?.dateKey ?? formatDateKey());
        const windowKey = getAttendanceWindowKey(targetBlocks[0] ?? {});
        const nextDateWindows = { ...(currentState.employeeAttendanceWindows?.[windowDateKey] ?? {}) };
        delete nextDateWindows[windowKey];
        if (!Object.keys(nextDateWindows).length) {
          const nextAttendanceWindows = { ...(currentState.employeeAttendanceWindows ?? {}) };
          delete nextAttendanceWindows[windowDateKey];
          return nextAttendanceWindows;
        }

        return {
          ...(currentState.employeeAttendanceWindows ?? {}),
          [windowDateKey]: nextDateWindows,
        };
      })(),
    }));

    const startTime = targetBlocks.map((block) => getBlockStartLabel(block)).filter(Boolean).sort()[0] ?? '';
    const endTime = targetBlocks.map((block) => getBlockEndLabel(block)).filter(Boolean).sort().at(-1) ?? '';

    return {
      ...targetBlocks[0],
      roundLabel: String(summaryOverrides.roundLabel ?? getBlockRoundLabel(targetBlocks[0])).trim(),
      time: String(summaryOverrides.time ?? buildBlockTimeLabel(startTime, endTime) ?? targetBlocks[0].time).trim(),
      title: String(summaryOverrides.title ?? targetBlocks[0].title).trim(),
      deletedCount: targetBlocks.length,
    };
  };

  const buildScheduleAttendanceSyncSummary = (currentState) => {
    const employeesById = buildEmployeesById(currentState.employees);
    let removedCount = 0;
    let updatedBlockCount = 0;

    const nextTimeBlocks = currentState.timeBlocks.map((block) => {
      const nextEmployeeIds = block.employeeIds.filter((employeeId) => isEmployeeEligibleForScheduleBlock(
        employeesById.get(employeeId),
        block,
        currentState.employeeAttendanceWindows,
        currentState.employeeAvailabilityCalendar,
      ));

      if (nextEmployeeIds.length === block.employeeIds.length) {
        return block;
      }

      removedCount += block.employeeIds.length - nextEmployeeIds.length;
      updatedBlockCount += 1;
      return normalizeBlock({ ...block, employeeIds: nextEmployeeIds }, employeesById, block.dateKey);
    });

    return {
      removedCount,
      updatedBlockCount,
      nextTimeBlocks,
    };
  };

  const getScheduleAttendanceSyncSummary = () => buildScheduleAttendanceSyncSummary(state);

  const syncScheduleAssignmentsWithAttendance = () => {
    let removedCount = 0;
    let updatedBlockCount = 0;

    setState((currentState) => {
      const summary = buildScheduleAttendanceSyncSummary(currentState);
      removedCount = summary.removedCount;
      updatedBlockCount = summary.updatedBlockCount;

      if (!updatedBlockCount) {
        return currentState;
      }

      return {
        ...currentState,
        timeBlocks: summary.nextTimeBlocks,
      };
    });

    return {
      removedCount,
      updatedBlockCount,
    };
  };

  const copyWeekSchedule = (sourceDateKey, dayOffset = 7) => {
    const sourceWeekDateKeys = getWeekDateKeys(sourceDateKey ?? formatDateKey());
    const sourceWeekSet = new Set(sourceWeekDateKeys);
    const targetWeekDateKeys = sourceWeekDateKeys.map((dateKey) => formatDateKey(addDays(parseDateKeyValue(dateKey), dayOffset)));
    const targetWeekSet = new Set(targetWeekDateKeys);
    const targetDateBySourceDate = new Map(sourceWeekDateKeys.map((dateKey, index) => [dateKey, targetWeekDateKeys[index]]));
    const sourceBlocks = timeBlocks.filter((block) => sourceWeekSet.has(block.dateKey));
    if (!sourceBlocks.length) {
      return null;
    }

    const employeesById = buildEmployeesById(employees);
    let copiedCount = 0;

    setState((currentState) => {
      const preservedBlocks = currentState.timeBlocks.filter((block) => !targetWeekSet.has(block.dateKey));
      const copiedBlocks = currentState.timeBlocks
        .filter((block) => sourceWeekSet.has(block.dateKey))
        .map((block, index) => {
          copiedCount += 1;
          const targetDateKey = targetDateBySourceDate.get(block.dateKey) ?? block.dateKey;
          return normalizeBlock({
            ...block,
            id: createDateScopedBlockId(targetDateKey, `${block.templateId ?? block.id}::${index + 1}`),
            dateKey: targetDateKey,
            templateId: block.templateId ?? block.id,
          }, employeesById, targetDateKey);
        });

      return {
        ...currentState,
        employeeAttendanceWindows: Object.fromEntries(Object.entries(currentState.employeeAttendanceWindows ?? {}).filter(([dateKey]) => !targetWeekSet.has(dateKey)).concat(targetWeekDateKeys.map((targetDateKey, index) => {
          const sourceDateKey = sourceWeekDateKeys[index];
          const sourceWindows = currentState.employeeAttendanceWindows?.[sourceDateKey];
          return [targetDateKey, sourceWindows ? JSON.parse(JSON.stringify(sourceWindows)) : undefined];
        }).filter(([, value]) => value))),
        timeBlocks: [...preservedBlocks, ...copiedBlocks],
      };
    });

    return {
      copiedCount,
      targetWeekStartDateKey: targetWeekDateKeys[0],
    };
  };

  const copyDaySchedule = (sourceDateKey, dayOffset = 1) => {
    const normalizedSourceDateKey = sourceDateKey ?? formatDateKey();
    const targetDateKey = formatDateKey(addDays(parseDateKeyValue(normalizedSourceDateKey), dayOffset));
    const sourceBlocks = timeBlocks.filter((block) => block.dateKey === normalizedSourceDateKey);
    if (!sourceBlocks.length) {
      return null;
    }

    const employeesById = buildEmployeesById(employees);
    let copiedCount = 0;

    setState((currentState) => {
      const preservedBlocks = currentState.timeBlocks.filter((block) => block.dateKey !== targetDateKey);
      const copiedBlocks = currentState.timeBlocks
        .filter((block) => block.dateKey === normalizedSourceDateKey)
        .map((block, index) => {
          copiedCount += 1;
          return normalizeBlock({
            ...block,
            id: createDateScopedBlockId(targetDateKey, `${block.templateId ?? block.id}::${index + 1}`),
            dateKey: targetDateKey,
            templateId: block.templateId ?? block.id,
          }, employeesById, targetDateKey);
        });

      return {
        ...currentState,
        employeeAttendanceWindows: (() => {
          const nextAttendanceWindows = { ...(currentState.employeeAttendanceWindows ?? {}) };
          if (currentState.employeeAttendanceWindows?.[normalizedSourceDateKey]) {
            nextAttendanceWindows[targetDateKey] = JSON.parse(JSON.stringify(currentState.employeeAttendanceWindows[normalizedSourceDateKey]));
          } else {
            delete nextAttendanceWindows[targetDateKey];
          }
          return nextAttendanceWindows;
        })(),
        timeBlocks: [...preservedBlocks, ...copiedBlocks],
      };
    });

    return {
      copiedCount,
      targetDateKey,
    };
  };

  const createRequest = ({ type, detail, attachmentName }) => {
    const nextRequest = {
      id: Date.now(),
      title: mapRequestTitle(type),
      type,
      detail,
      attachmentName,
      date: formatDateTime(),
      status: 'รอดำเนินการ',
    };

    setState((currentState) => ({
      ...currentState,
      requests: [nextRequest, ...currentState.requests],
    }));
    return nextRequest;
  };

  const updateInventoryItem = (itemId, changes) => {
    let updatedItem = null;
    let historyEntry = null;

    setState((currentState) => ({
      ...currentState,
      inventoryHistory: (() => {
        const currentItem = currentState.inventoryItems.find((item) => item.id === itemId);
        if (!currentItem) {
          return currentState.inventoryHistory;
        }

        historyEntry = buildInventoryHistoryEntry(currentItem, normalizeInventoryItem({
          ...currentItem,
          ...changes,
          checkedBy: changes.checkedBy ?? currentItem.checkedBy ?? '',
          checkedAt: changes.checkedAt ?? formatDateTime(),
        }), changes);

        return historyEntry ? appendInventoryHistory(currentState.inventoryHistory, historyEntry) : currentState.inventoryHistory;
      })(),
      inventoryItems: currentState.inventoryItems.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        updatedItem = normalizeInventoryItem({
          ...item,
          ...changes,
          checkedBy: changes.checkedBy ?? item.checkedBy ?? '',
          checkedAt: changes.checkedAt ?? formatDateTime(),
        });

        return updatedItem;
      }),
    }));

    return updatedItem;
  };

  const createInventoryItem = (itemInput) => {
    const name = String(itemInput?.name ?? '').trim();
    const category = String(itemInput?.category ?? '').trim();
    const unit = String(itemInput?.unit ?? '').trim() || 'ชิ้น';
    const threshold = Math.max(0, Number(itemInput?.threshold ?? 0));
    const quantity = Math.max(0, Number(itemInput?.quantity ?? 0));
    const receivedToday = Math.max(0, Number(itemInput?.receivedToday ?? 0));
    const noExpiry = Boolean(itemInput?.noExpiry);
    const expiresOn = noExpiry ? '' : String(itemInput?.expiresOn ?? '').trim();

    if (!name || (!noExpiry && !expiresOn)) {
      return null;
    }

    const nextItem = normalizeInventoryItem({
      id: Date.now(),
      name,
      category,
      unit,
      threshold,
      expiresOn,
      noExpiry,
      quantity,
      receivedToday,
      baseQuantity: Math.max(0, quantity - receivedToday),
      checkedBy: itemInput?.checkedBy ?? '',
      checkedAt: formatDateTime(),
      useToday: Boolean(itemInput?.useToday),
    });

    setState((currentState) => ({
      ...currentState,
      inventoryHistory: appendInventoryHistory(currentState.inventoryHistory, buildInventoryHistoryEntry(null, nextItem, { checkedBy: itemInput?.checkedBy })),
      inventoryItems: [nextItem, ...currentState.inventoryItems],
    }));

    return nextItem;
  };

  const deleteInventoryItem = (itemId, actorName = '') => {
    let deletedItem = null;

    setState((currentState) => ({
      ...currentState,
      inventoryHistory: (() => {
        const currentItem = currentState.inventoryItems.find((item) => item.id === itemId);
        if (!currentItem) {
          return currentState.inventoryHistory;
        }

        return appendInventoryHistory(currentState.inventoryHistory, buildInventoryHistoryEntry(currentItem, null, { checkedBy: actorName || currentItem.checkedBy }));
      })(),
      inventoryItems: currentState.inventoryItems.filter((item) => {
        if (item.id === itemId) {
          deletedItem = item;
          return false;
        }

        return true;
      }),
    }));

    return deletedItem;
  };

  const recordSoldItem = (itemId, soldAmount = 1) => {
    const item = inventoryItems.find((entry) => entry.id === itemId);
    if (!item) {
      return null;
    }

    return updateInventoryItem(itemId, {
      soldToday: item.soldToday + soldAmount,
      quantity: Math.max(0, item.quantity - soldAmount),
    });
  };

  const createIssueReport = ({ detail, severity, title }) => {
    if (!title.trim() || !detail.trim()) {
      return null;
    }

    const nextIssue = {
      id: Date.now(),
      title: title.trim(),
      detail: detail.trim(),
      severity,
      date: formatDateTime(),
      status: 'รอดำเนินการ',
    };

    setState((currentState) => ({
      ...currentState,
      issueReports: [nextIssue, ...currentState.issueReports],
    }));

    return nextIssue;
  };

  const updateIssueReport = (issueId, changes) => {
    let updatedIssue = null;

    setState((currentState) => ({
      ...currentState,
      issueReports: currentState.issueReports.map((issue) => {
        if (issue.id !== issueId) {
          return issue;
        }

        updatedIssue = {
          ...issue,
          ...changes,
        };

        return updatedIssue;
      }),
    }));

    return updatedIssue;
  };

  const saveSettings = (nextSettings) => {
  const savedSettings = normalizeSettings({
    ...settings,
    ...nextSettings,
    lastSavedAt: formatDateTime(),
  });

    setState((currentState) => ({
      ...currentState,
      settings: savedSettings,
    }));
    return savedSettings;
  };

  const setEmployeeAvailabilityForDate = (employeeId, dateKey, status) => {
    if (!employees.some((employee) => employee.id === employeeId) || !dateKey) {
      return null;
    }

    const normalizedStatus = normalizeAvailabilityCalendarValue(status);
    const daySettings = getNormalizedCalendarDaySettings(dateKey, calendarDaySettings);
    if (normalizedStatus && isLeaveAvailabilityStatus(normalizedStatus) && daySettings.leaveLocked) {
      return null;
    }

    setState((currentState) => {
      const currentDateMap = currentState.employeeAvailabilityCalendar?.[employeeId] ?? {};
      const nextDateMap = { ...currentDateMap };

      if (!normalizedStatus) {
        delete nextDateMap[dateKey];
      } else {
        nextDateMap[dateKey] = normalizedStatus;
      }

      const nextCalendar = { ...(currentState.employeeAvailabilityCalendar ?? {}) };
      if (Object.keys(nextDateMap).length) {
        nextCalendar[employeeId] = nextDateMap;
      } else {
        delete nextCalendar[employeeId];
      }

      return {
        ...currentState,
        employeeAvailabilityCalendar: nextCalendar,
        employeeAttendanceWindows: normalizeEmployeeAttendanceWindows(currentState.employeeAttendanceWindows, null, buildEmployeesById(currentState.employees), nextCalendar),
      };
    });

    return normalizedStatus ?? 'ready';
  };

  const setEmployeeAvailabilityForWeek = (employeeId, dateKey, status) => {
    if (!employees.some((employee) => employee.id === employeeId) || !dateKey) {
      return null;
    }

    const normalizedStatus = normalizeAvailabilityCalendarValue(status);
    const weekDateKeys = getWeekDateKeys(dateKey);
    const writableWeekDateKeys = normalizedStatus && isLeaveAvailabilityStatus(normalizedStatus)
      ? weekDateKeys.filter((weekDateKey) => !getNormalizedCalendarDaySettings(weekDateKey, calendarDaySettings).leaveLocked)
      : weekDateKeys;

    if (normalizedStatus && !writableWeekDateKeys.length) {
      return null;
    }

    setState((currentState) => {
      const currentDateMap = currentState.employeeAvailabilityCalendar?.[employeeId] ?? {};
      const nextDateMap = { ...currentDateMap };

      writableWeekDateKeys.forEach((weekDateKey) => {
        if (!normalizedStatus) {
          delete nextDateMap[weekDateKey];
        } else {
          nextDateMap[weekDateKey] = normalizedStatus;
        }
      });

      const nextCalendar = { ...(currentState.employeeAvailabilityCalendar ?? {}) };
      if (Object.keys(nextDateMap).length) {
        nextCalendar[employeeId] = nextDateMap;
      } else {
        delete nextCalendar[employeeId];
      }

      return {
        ...currentState,
        employeeAvailabilityCalendar: nextCalendar,
        employeeAttendanceWindows: normalizeEmployeeAttendanceWindows(currentState.employeeAttendanceWindows, null, buildEmployeesById(currentState.employees), nextCalendar),
      };
    });

    return normalizedStatus ?? 'ready';
  };

  const setCalendarDaySetting = (dateKey, settingKey, enabled) => {
    if (!dateKey || !['leaveLocked', 'doublePay'].includes(settingKey)) {
      return null;
    }

    const normalizedEnabled = Boolean(enabled);

    setState((currentState) => {
      const currentSettings = getNormalizedCalendarDaySettings(dateKey, currentState.calendarDaySettings);
      const nextSettings = {
        ...currentSettings,
        [settingKey]: normalizedEnabled,
      };
      const nextCalendarDaySettings = { ...(currentState.calendarDaySettings ?? {}) };

      if (!nextSettings.leaveLocked && !nextSettings.doublePay) {
        delete nextCalendarDaySettings[dateKey];
      } else {
        nextCalendarDaySettings[dateKey] = nextSettings;
      }

      return {
        ...currentState,
        calendarDaySettings: nextCalendarDaySettings,
      };
    });

    return normalizedEnabled;
  };

  const createEmployee = (employeeInput) => {
    if (employees.length >= MAX_EMPLOYEES) {
      return null;
    }

    const nextEmployee = enrichEmployee({
      id: Date.now(),
      ...employeeInput,
      name: employeeInput.name.trim(),
      role: employeeInput.role.trim(),
      phone: employeeInput.phone.trim(),
      password: employeeInput.password?.trim() ?? '',
      skills: employeeInput.skills,
    });

    setState((currentState) => ({
      ...currentState,
      employees: [...currentState.employees, nextEmployee],
    }));

    return nextEmployee;
  };

  const updateEmployee = (employeeId, employeeInput) => {
    let updatedEmployee = null;

    setState((currentState) => {
      const nextEmployees = currentState.employees.map((employee) => {
        if (employee.id !== employeeId) {
          return employee;
        }

        updatedEmployee = enrichEmployee({
          ...employee,
          ...employeeInput,
          name: employeeInput.name.trim(),
          role: employeeInput.role.trim(),
          phone: employeeInput.phone.trim(),
          password: employeeInput.password?.trim() ?? '',
          skills: employeeInput.skills,
        });
        return updatedEmployee;
      });

      const nextEmployeesById = buildEmployeesById(nextEmployees);
      return {
        ...currentState,
        employees: nextEmployees,
        employeeAttendanceWindows: normalizeEmployeeAttendanceWindows(currentState.employeeAttendanceWindows, new Set(nextEmployees.map((employee) => employee.id)), nextEmployeesById, currentState.employeeAvailabilityCalendar),
        timeBlocks: currentState.timeBlocks.map((block) => normalizeBlock({
          ...block,
          employeeIds: block.employeeIds.filter((entry) => isEmployeeScheduleEligible(nextEmployeesById.get(entry), block.dateKey, currentState.employeeAvailabilityCalendar)),
        }, nextEmployeesById, block.dateKey)),
      };
    });

    return updatedEmployee;
  };

  const resetEmployeePortalPassword = (employeeId) => {
    let updatedEmployee = null;

    setState((currentState) => ({
      ...currentState,
      employees: currentState.employees.map((employee) => {
        if (employee.id !== employeeId) {
          return employee;
        }

        updatedEmployee = {
          ...employee,
          password: createResetEmployeePassword(currentState.employees, employeeId, employee.password),
        };
        return updatedEmployee;
      }),
    }));

    return updatedEmployee;
  };

  const deleteEmployee = (employeeId) => {
    const employee = employees.find((entry) => entry.id === employeeId);
    if (!employee) {
      return null;
    }

    setState((currentState) => {
      const nextEmployees = currentState.employees.filter((entry) => entry.id !== employeeId);
      const nextEmployeesById = buildEmployeesById(nextEmployees);
      const nextCalendar = { ...(currentState.employeeAvailabilityCalendar ?? {}) };
      delete nextCalendar[employeeId];

      return {
        ...currentState,
        employees: nextEmployees,
        employeePortalSessionId: currentState.employeePortalSessionId === employeeId ? null : currentState.employeePortalSessionId,
        employeeAvailabilityCalendar: nextCalendar,
        employeeAttendanceWindows: normalizeEmployeeAttendanceWindows(currentState.employeeAttendanceWindows, new Set(nextEmployees.map((entry) => entry.id)), nextEmployeesById, nextCalendar),
        timeBlocks: currentState.timeBlocks.map((block) => normalizeBlock({
          ...block,
          employeeIds: block.employeeIds.filter((entry) => entry !== employeeId),
        }, nextEmployeesById)),
      };
    });

    return employee;
  };

  const employeePortalLogin = async (phone, password) => {
    if (useSupabaseBackend && isSupabaseConfigured) {
      const matchedEmployee = await loginEmployeePortal(phone, password);

      if (!matchedEmployee) {
        return null;
      }

      setState((currentState) => ({
        ...currentState,
        employees: currentState.employees.some((employee) => employee.id === matchedEmployee.id)
          ? currentState.employees.map((employee) => (employee.id === matchedEmployee.id ? { ...employee, ...matchedEmployee } : employee))
          : normalizeEmployees([...currentState.employees, matchedEmployee]),
        managerSessionActive: false,
        employeePortalSessionId: matchedEmployee.id,
      }));

      return matchedEmployee;
    }

    const normalizedPhone = normalizeEmployeeCredential(phone);
    const normalizedPassword = normalizeEmployeeCredential(password);
    const matchedEmployee = employees.find((employee) => employee.active !== false && normalizeEmployeeCredential(employee.phone) === normalizedPhone && normalizeEmployeeCredential(employee.password) === normalizedPassword);

    if (!matchedEmployee) {
      return null;
    }

    setState((currentState) => ({
      ...currentState,
      managerSessionActive: false,
      employeePortalSessionId: matchedEmployee.id,
    }));

    return matchedEmployee;
  };

  const employeePortalLogout = () => {
    setState((currentState) => ({
      ...currentState,
      employeePortalSessionId: null,
    }));
  };

  const managerLogin = async (phone, password) => {
    if (useSupabaseBackend && isSupabaseConfigured) {
      const isLoggedIn = await loginManagerPortal(phone, password);

      if (!isLoggedIn) {
        return false;
      }

      setState((currentState) => ({
        ...currentState,
        employeePortalSessionId: null,
        managerSessionActive: true,
      }));

      return true;
    }

    const normalizedPhone = normalizeEmployeeCredential(phone);
    const normalizedPassword = normalizeEmployeeCredential(password);
    const managerPhone = normalizeEmployeeCredential(settings.managerPhone);
    const managerPassword = normalizeEmployeeCredential(settings.managerPassword);

    if (!normalizedPhone || !normalizedPassword || normalizedPhone !== managerPhone || normalizedPassword !== managerPassword) {
      return false;
    }

    setState((currentState) => ({
      ...currentState,
      employeePortalSessionId: null,
      managerSessionActive: true,
    }));

    return true;
  };

  const managerLogout = () => {
    setState((currentState) => ({
      ...currentState,
      managerSessionActive: false,
    }));
  };

  const value = {
    calendarDaySettings,
    employeeAvailabilityCalendar,
    employeeAttendanceWindows,
    employeePortalSessionId,
    employees,
    isSupabaseSyncReady,
    inventoryHistory,
    inventoryItems,
    issueReports,
    managerSessionActive,
    timeBlocks,
    requests,
    settings,
    addEmployeesToBlock,
    addEmployeesToWindow,
    removeEmployeeFromAttendanceWindow,
    removeEmployeeFromBlock,
    moveEmployeeToBlock,
    autoAssignEmployeesToBlock,
    saveTimeBlock,
    deleteTimeBlock,
    deleteTimeWindow,
    getScheduleAttendanceSyncSummary,
    syncScheduleAssignmentsWithAttendance,
    copyDaySchedule,
    copyWeekSchedule,
    createRequest,
    createInventoryItem,
    deleteInventoryItem,
    updateInventoryItem,
    recordSoldItem,
    createIssueReport,
    updateIssueReport,
    createEmployee,
    updateEmployee,
    resetEmployeePortalPassword,
    deleteEmployee,
    managerLogin,
    managerLogout,
    employeePortalLogin,
    employeePortalLogout,
    setCalendarDaySetting,
    setEmployeeAvailabilityForDate,
    setEmployeeAvailabilityForWeek,
    saveSettings,
    getEmployeeById: (employeeId) => employees.find((employee) => employee.id === employeeId),
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }

  return context;
}

export function getTimeBlocksForDate(timeBlocks = [], dateKey = formatDateKey()) {
  const toSortableMinutes = (timeLabel = '') => {
    const normalizedTime = String(timeLabel ?? '').trim();
    if (!normalizedTime) {
      return Number.POSITIVE_INFINITY;
    }

    const [hoursText = '0', minutesText = '0'] = normalizedTime.split(':');
    const hours = Number(hoursText);
    const minutes = Number(minutesText);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      return Number.POSITIVE_INFINITY;
    }

    return (hours * 60) + minutes;
  };

  return timeBlocks
    .filter((block) => String(block.dateKey ?? formatDateKey()) === String(dateKey))
    .sort((leftBlock, rightBlock) => {
      const startDiff = toSortableMinutes(getBlockStartLabel(leftBlock)) - toSortableMinutes(getBlockStartLabel(rightBlock));
      if (startDiff !== 0) {
        return startDiff;
      }

      const endDiff = toSortableMinutes(getBlockEndLabel(leftBlock)) - toSortableMinutes(getBlockEndLabel(rightBlock));
      if (endDiff !== 0) {
        return endDiff;
      }

      return String(leftBlock.title ?? '').localeCompare(String(rightBlock.title ?? ''), 'th');
    });
}