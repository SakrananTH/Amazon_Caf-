import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, Bell, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Eye, EyeOff, Home, PackagePlus, PackageSearch, Search } from 'lucide-react';
import { Link, Navigate, NavLink, useLocation, useNavigate } from 'react-router-dom';
import EmployeeChip from '../shared/EmployeeChip.jsx';
import { routePaths } from '../../app/routes.js';
import { computeBlockStatus, formatDateKey, getBlockEndLabel, getBlockRoundLabel, getBlockStartLabel, getEmployeeAvailabilityMeta, getTimeBlocksForDate, isEmployeeAssignable, useAppState } from '../../app/state/AppStateContext.jsx';

const employeeMobileNavItems = [
  { label: 'หน้าแรก', icon: Home, to: routePaths.employeeHome },
  { label: 'ตารางงาน', icon: CalendarDays, to: routePaths.employeeSchedule },
  { label: 'สต็อก', icon: PackageSearch, to: routePaths.employeeInventory, end: false },
];

const inventoryUnitOptions = ['ชิ้น', 'ขวด', 'กล่อง', 'ถุง', 'ใบ'];
const inventoryCategoryOptions = ['นม', 'ขนม', 'เบเกอรี่สด', 'เบเกอรี่แห้ง', 'อุปกรณ์', 'เครื่องดื่ม', 'วัตถุดิบ', 'อื่นๆ'];
const inventoryToneWeight = { danger: 4, attention: 3, warning: 2, ok: 1 };

const EMPLOYEE_PORTAL_IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const EMPLOYEE_PORTAL_IDLE_TIMEOUT_MINUTES = EMPLOYEE_PORTAL_IDLE_TIMEOUT_MS / (60 * 1000);

function findPortalEmployee(employees, employeePortalSessionId = null) {
  return employees.find((employee) => employee.id === employeePortalSessionId && employee.active !== false) ?? null;
}

function getBlockStartMinutes(timeLabel = '') {
  const firstSegment = String(timeLabel).split('-')[0].trim();
  const [hoursText, minutesText = '0'] = firstSegment.split(':');
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? (hours * 60) + minutes : 0;
}

function sortBlocksByTime(leftBlock, rightBlock) {
  return getBlockStartMinutes(leftBlock.time) - getBlockStartMinutes(rightBlock.time);
}

function getDaysUntilExpiry(dateString) {
  if (!dateString) {
    return Number.POSITIVE_INFINITY;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(targetDate.getTime())) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.round((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function addCalendarDays(dateInput, amount = 0) {
  const nextDate = new Date(dateInput);
  nextDate.setDate(nextDate.getDate() + amount);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function parseDateKey(dateKey) {
  const [year, month, day] = String(dateKey).split('-').map(Number);
  const nextDate = new Date(year, (month ?? 1) - 1, day ?? 1);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function formatThaiBuddhistDate(dateInput, options) {
  return new Intl.DateTimeFormat('th-TH-u-ca-buddhist', options).format(dateInput);
}

function formatThaiExpiryDate(dateString = '') {
  if (!dateString) {
    return 'ไม่มีวันหมดอายุ';
  }

  const parsedDate = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return dateString;
  }

  return formatThaiBuddhistDate(parsedDate, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatThaiDayCardLabel(dateInput) {
  return formatThaiBuddhistDate(dateInput, { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatThaiFullDate(dateKey) {
  return formatThaiBuddhistDate(parseDateKey(dateKey), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateInputValue(dateInput) {
  const nextDate = new Date(dateInput);
  if (Number.isNaN(nextDate.getTime())) {
    return '';
  }

  nextDate.setHours(0, 0, 0, 0);
  return formatDateKey(nextDate);
}

function formatThaiCalendarMonth(dateInput) {
  return formatThaiBuddhistDate(dateInput, { month: 'long', year: 'numeric' });
}

function formatThaiDateFieldValue(dateString = '') {
  if (!dateString) {
    return 'เลือกวันที่';
  }

  return formatThaiBuddhistDate(new Date(`${dateString}T00:00:00`), { day: 'numeric', month: 'short', year: 'numeric' });
}

function getCalendarMonthGrid(monthDate) {
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  monthStart.setHours(0, 0, 0, 0);
  const firstDayOffset = monthStart.getDay();
  const gridStart = addCalendarDays(monthStart, -firstDayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = addCalendarDays(gridStart, index);
    return {
      date,
      value: formatDateInputValue(date),
      dayLabel: date.getDate(),
      isCurrentMonth: date.getMonth() === monthDate.getMonth(),
    };
  });
}

function isSameCalendarDate(leftDate, rightDate) {
  return leftDate.getFullYear() === rightDate.getFullYear()
    && leftDate.getMonth() === rightDate.getMonth()
    && leftDate.getDate() === rightDate.getDate();
}

const thaiCalendarWeekdays = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

function ThaiDateInput({ value = '', onChange, disabled = false, label = 'เลือกวันที่' }) {
  const pickerRef = useRef(null);
  const suppressTriggerUntilRef = useRef(0);
  const parsedValue = value ? new Date(`${value}T00:00:00`) : null;
  const today = useMemo(() => addCalendarDays(new Date(), 0), []);
  const [isOpen, setIsOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const baseDate = parsedValue && !Number.isNaN(parsedValue.getTime()) ? parsedValue : today;
    return new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  });

  const closePicker = (suppressTrigger = false) => {
    if (suppressTrigger) {
      suppressTriggerUntilRef.current = Date.now() + 250;
    }

    setIsOpen(false);
  };

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handlePointerDown = (event) => {
      if (!pickerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!parsedValue || Number.isNaN(parsedValue.getTime())) {
      return;
    }

    setViewMonth(new Date(parsedValue.getFullYear(), parsedValue.getMonth(), 1));
  }, [value]);

  const monthGrid = useMemo(() => getCalendarMonthGrid(viewMonth), [viewMonth]);
  const selectedValue = parsedValue && !Number.isNaN(parsedValue.getTime()) ? formatDateInputValue(parsedValue) : '';
  const todayValue = formatDateInputValue(today);

  return (
    <div ref={pickerRef} className={`employee-mobile-date-field ${disabled ? 'disabled' : ''}`.trim()}>
      <button
        type="button"
        className={`text-input employee-mobile-date-trigger ${value ? '' : 'placeholder'}`.trim()}
        onClick={() => {
          if (disabled) {
            return;
          }

          if (Date.now() < suppressTriggerUntilRef.current) {
            return;
          }

          if (!isOpen) {
            const nextBaseDate = parsedValue && !Number.isNaN(parsedValue.getTime()) ? parsedValue : today;
            setViewMonth(new Date(nextBaseDate.getFullYear(), nextBaseDate.getMonth(), 1));
          }

          setIsOpen((currentValue) => !currentValue);
        }}
        disabled={disabled}
        aria-label={label}
      >
        <span>{formatThaiDateFieldValue(value)}</span>
        <CalendarDays size={16} />
      </button>
      {isOpen ? <>
        <button type="button" className="employee-mobile-date-picker-backdrop" aria-label={`ปิด${label}`} onClick={() => closePicker()} />
        <div className="employee-mobile-date-picker" role="dialog" aria-modal="true" aria-label={label}>
          <div className="employee-mobile-date-picker-head">
            <button type="button" className="ghost-button employee-mobile-date-nav" onClick={() => setViewMonth((currentMonth) => new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}><ChevronLeft size={16} /></button>
            <strong>{formatThaiCalendarMonth(viewMonth)}</strong>
            <button type="button" className="ghost-button employee-mobile-date-nav" onClick={() => setViewMonth((currentMonth) => new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}><ChevronRight size={16} /></button>
          </div>
          <div className="employee-mobile-date-weekdays">
            {thaiCalendarWeekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}
          </div>
          <div className="employee-mobile-date-grid">
            {monthGrid.map((day) => {
              const isToday = day.value === todayValue;
              const isSelected = day.value === selectedValue;

              return (
                <button
                  key={day.value}
                  type="button"
                  className={`employee-mobile-date-cell ${day.isCurrentMonth ? '' : 'outside'} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`.trim()}
                  onClick={() => {
                    onChange(day.value);
                    closePicker(true);
                  }}
                >
                  <span>{day.dayLabel}</span>
                </button>
              );
            })}
          </div>
          <div className="employee-mobile-date-actions">
            <button type="button" className="ghost-button" onClick={() => {
              onChange('');
              closePicker(true);
            }}>ล้างวันที่</button>
            <button type="button" className="ghost-button" onClick={() => {
              onChange(todayValue);
              setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1));
              closePicker(true);
            }}>วันนี้</button>
          </div>
        </div>
      </> : null}
    </div>
  );
}

function formatEmployeeRoundWindow(block) {
  const startLabel = getBlockStartLabel(block);
  const endLabel = getBlockEndLabel(block);

  if (startLabel && endLabel) {
    return `${startLabel} - ${endLabel}`;
  }
  if (startLabel) {
    return startLabel;
  }
  return block.time || '-';
}

function formatEmployeeTimeRange(block) {
  const startLabel = getBlockStartLabel(block);
  const endLabel = getBlockEndLabel(block);

  if (startLabel && endLabel) {
    return `${startLabel} - ${endLabel}`;
  }

  return block?.time || '-';
}

function getEmployeeAttendanceWindowForDate(attendanceWindows = {}, employeeId, dateKey = '') {
  const normalizedEmployeeId = Number(employeeId);
  if (!Number.isFinite(normalizedEmployeeId) || !dateKey) {
    return null;
  }

  return Object.values(attendanceWindows?.[dateKey] ?? {}).find((window) => (window?.employeeIds ?? []).some((entry) => Number(entry) === normalizedEmployeeId)) ?? null;
}

function getAssignedBlockSummary(blocks = []) {
  if (!blocks.length) {
    return '';
  }

  return blocks.slice(0, 3).map((block) => String(block.title ?? getBlockRoundLabel(block)).trim()).filter(Boolean).join(' • ');
}

function getAssignedEmployeesForBlock(block = {}, employeesById = new Map(), dateKey = '', availabilityCalendar = null) {
  return (block.employeeIds ?? []).reduce((result, employeeId) => {
    const employee = employeesById.get(Number(employeeId));

    if (!employee) {
      return result;
    }

    const meta = getEmployeeAvailabilityMeta(employee, dateKey, availabilityCalendar);

    if (meta.assignable) {
      result.assignedEmployees.push(employee);
    } else {
      result.unavailableEmployees.push({ employee, meta });
    }

    return result;
  }, { assignedEmployees: [], unavailableEmployees: [] });
}

function getEmployeeShiftStatus({ hasAttendanceWindow = false, hasAssignedBlocks = false, availabilityMeta = null, hasPublishedSchedule = false } = {}) {
  if (availabilityMeta && availabilityMeta.assignable === false) {
    return {
      tone: 'warning',
      label: 'ลาหยุด',
      noAssignmentText: 'วันนี้คุณไม่ได้ลงกะเพราะลาหยุด',
    };
  }

  if (hasAttendanceWindow && hasAssignedBlocks) {
    return {
      tone: 'ok',
      label: 'มีงานในตาราง',
      noAssignmentText: '',
    };
  }

  if (hasAttendanceWindow) {
    return {
      tone: 'ok',
      label: 'มีเวลาเข้างาน',
      noAssignmentText: 'วันนี้มีเวลาเข้างานแล้ว แต่ยังไม่มีงานในตาราง',
    };
  }

  if (hasPublishedSchedule) {
    return {
      tone: 'attention',
      label: 'ยังไม่มีเวลาเข้างาน',
      noAssignmentText: 'วันนี้ยังไม่มีเวลาเข้างานของคุณ',
    };
  }

  return {
    tone: 'attention',
    label: 'ยังไม่ลงเวลาเข้างาน',
    noAssignmentText: 'รอผู้จัดการลงเวลาเข้างานในระบบ',
  };
}

function EmployeeMobileTeamBlockDetail({ block, assignedEmployees = [], unavailableEmployees = [] }) {
  const blockStatus = computeBlockStatus(block.required, assignedEmployees.length);

  return (
    <div className="employee-mobile-block-detail employee-mobile-team-block-detail">
      <div className="employee-mobile-team-block-head">
        <div>
          <strong>{block.title}</strong>
          <span>{formatEmployeeRoundWindow(block)} • {getBlockRoundLabel(block)}</span>
        </div>
        <span className={`status-chip ${blockStatus}`}>{assignedEmployees.length}/{block.required} คน</span>
      </div>
      <small>{block.tasks.length ? `หน้าที่: ${block.tasks.join(' • ')}` : 'ยังไม่ได้ระบุหน้าที่ของช่วงงานนี้'}</small>
      {unavailableEmployees.length ? <div className="employee-mobile-team-unavailable-note">ไม่พร้อมลงกะ: {unavailableEmployees.map(({ employee, meta }) => `${employee.name} (${meta.label})`).join(' • ')}</div> : null}
      <div className={`employee-mobile-team-chip-list ${assignedEmployees.length ? '' : 'empty'}`.trim()}>
        {assignedEmployees.length
          ? assignedEmployees.map((employee) => (
            <EmployeeChip
              key={`${block.id}-${employee.id}`}
              employee={employee}
              className="employee-mobile-team-chip"
            />
          ))
          : <span>ยังไม่มีพนักงานในช่วงงานนี้</span>}
      </div>
    </div>
  );
}

function getWeekDates(baseDate = new Date()) {
  const currentDate = new Date(baseDate);
  currentDate.setHours(0, 0, 0, 0);
  const mondayOffset = (currentDate.getDay() + 6) % 7;
  const weekStart = addCalendarDays(currentDate, -mondayOffset);
  return Array.from({ length: 7 }, (_, index) => addCalendarDays(weekStart, index));
}

function getInventoryTone(item) {
  return getInventoryStatusMeta(item).tone;
}

function getInventoryStatusMeta(item) {
  const expiryDays = getDaysUntilExpiry(item.expiresOn);

  if (item.quantity <= 0) {
    return { tone: 'danger', label: 'หมดแล้ว', detail: 'ควรรับเข้าเพิ่มทันที' };
  }

  if (!item.expiresOn || item.noExpiry) {
    if (item.quantity <= item.threshold) {
      return { tone: 'warning', label: 'สต็อกต่ำ', detail: `จุดเตือน ${item.threshold} ${item.unit}` };
    }

    return { tone: 'ok', label: 'ไม่มีวันหมดอายุ', detail: 'พร้อมใช้งาน' };
  }

  if (expiryDays <= 0) {
    return { tone: 'danger', label: 'หมดอายุแล้ว', detail: 'ควรแยกออกทันที' };
  }

  if (expiryDays <= 2) {
    return { tone: 'attention', label: 'ใกล้หมดอายุ', detail: `เหลือ ${expiryDays} วัน • ควรใช้ก่อน` };
  }

  if (expiryDays <= 7) {
    return { tone: 'warning', label: 'ใกล้หมดอายุ', detail: `เหลือ ${expiryDays} วัน` };
  }

  if (item.quantity <= item.threshold) {
    return { tone: 'warning', label: 'สต็อกต่ำ', detail: `จุดเตือน ${item.threshold} ${item.unit}` };
  }

  return { tone: 'ok', label: 'พร้อมใช้', detail: 'สต็อกยังเพียงพอ' };
}

function getInventorySearchText(item) {
  return [item.name, item.category, item.unit, item.id]
    .map((value) => String(value ?? '').trim().toLowerCase())
    .join(' ');
}

function EmployeeMobileWorkspace({ children, profileAvatar, profileName, profileSubtitle = '', title, accountAction = null }) {
  const location = useLocation();
  const isIssuePage = location.pathname === routePaths.employeeRequests;

  return (
    <div className="employee-mobile-page">
      <div className="employee-mobile-shell">
        <header className="employee-mobile-header">
          <div className="employee-mobile-header-top">
            <div className="employee-mobile-title-line">
              <span className="employee-mobile-kicker">Employee mobile</span>
              <h1>{title}</h1>
            </div>
            {isIssuePage ? <span className="employee-mobile-header-link selected">แจ้งปัญหา</span> : <Link className="employee-mobile-header-link" to={routePaths.employeeRequests}>แจ้งปัญหา</Link>}
          </div>
          <div className="employee-mobile-userbar">
            <span className="employee-mobile-avatar">{profileAvatar}</span>
            <div className="employee-mobile-usercopy">
              <strong>{profileName}</strong>
              {profileSubtitle ? <small>{profileSubtitle}</small> : null}
            </div>
            {accountAction}
          </div>
        </header>

        <main className="employee-mobile-content">{children}</main>

        <nav className="employee-mobile-nav">
          {employeeMobileNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} end={item.end ?? true} className={({ isActive }) => `employee-mobile-nav-item ${isActive ? 'selected' : ''}`.trim()}>
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

function EmployeePortalLoginCard({ employees = [], onLogin, onSuccess }) {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!employees.length) {
      setEmployeeId('');
      return;
    }

    setEmployeeId((currentValue) => currentValue && employees.some((employee) => String(employee.id) === currentValue)
      ? currentValue
      : String(employees[0].id));
  }, [employees]);

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await onLogin(employeeId, password);
      if (!result) {
        setError('รหัสผ่านรวมพนักงานไม่ถูกต้อง หรือยังไม่ได้เลือกรายชื่อพนักงาน');
        return;
      }

      setError('');
      onSuccess?.(result);
    } catch {
      setError('เชื่อมต่อข้อมูลพนักงานไม่สำเร็จ ลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="employee-mobile-section-card employee-mobile-login-card">
      <div className="employee-mobile-section-head">
        <div>
          <h3>เข้าสู่ระบบพนักงาน</h3>
          <p>เลือกรายชื่อพนักงานของคุณ แล้วกรอกรหัสผ่านรวมพนักงานเพื่อดูตารางกะ แจ้งสต็อก และรายงานปัญหาได้ทันที</p>
        </div>
        <Bell size={18} />
      </div>
      <div className="employee-mobile-form-grid employee-mobile-login-form-grid">
        <label className="employee-mobile-login-field">
          <span>รายชื่อพนักงาน</span>
          <select className="text-input" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
            {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} • {employee.role}</option>)}
          </select>
        </label>
        <label className="employee-mobile-login-field">
          <span>รหัสผ่านรวมพนักงาน</span>
          <div className="employee-mobile-password-shell">
            <input className="text-input employee-mobile-password-input" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="รหัสผ่านรวมพนักงาน" />
            <button type="button" className="employee-mobile-password-toggle" onClick={() => setShowPassword((currentValue) => !currentValue)} aria-label={showPassword ? 'ซ่อนรหัสผ่านพนักงาน' : 'แสดงรหัสผ่านพนักงาน'}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>
        <div className="employee-mobile-login-actions">
          <button type="button" className="primary-inline employee-mobile-submit" onClick={handleSubmit} disabled={!employeeId || !password.trim() || isSubmitting}>{isSubmitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</button>
          <Link className="employee-mobile-login-manager-link" to={routePaths.managerLogin}>ไปหน้า Login ผู้จัดการ</Link>
        </div>
      </div>
        <div className="compact-home-note employee-mobile-login-help">
          <strong>วิธีเข้าใช้งาน</strong>
          <span>1. เลือกรายชื่อของตัวเองจากรายการพนักงาน</span>
          <span>2. ใส่รหัสผ่านรวมพนักงานที่ผู้จัดการตั้งไว้</span>
        </div>
      <div className="employee-mobile-login-benefits">
        <span>ดูตารางกะของตัวเอง</span>
        <span>เช็กสต็อกที่ต้องตามต่อ</span>
        <span>รายงานปัญหาหน้างานได้ทันที</span>
      </div>
      {error ? <div className="form-success top-spaced employee-mobile-login-error"><span>{error}</span></div> : null}
    </section>
  );
}

function EmployeePortalGate({ children, currentEmployee, onLogout, title }) {
  const navigate = useNavigate();
  const { employeePortalSessionId, isSupabaseSyncReady } = useAppState();
  const isRestoringEmployeeSession = !isSupabaseSyncReady && Number.isFinite(employeePortalSessionId);

  useEffect(() => {
    if (!currentEmployee) {
      return undefined;
    }

    const events = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
    let timeoutId = null;

    const redirectToLogin = (portalMessage) => {
      onLogout();
      navigate(routePaths.employeeLogin, {
        replace: true,
        state: { portalMessage },
      });
    };

    const resetIdleTimer = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }

      timeoutId = window.setTimeout(() => {
        redirectToLogin(`ไม่มีการใช้งานเกิน ${EMPLOYEE_PORTAL_IDLE_TIMEOUT_MINUTES} นาที ระบบออกจากระบบอัตโนมัติแล้ว`);
      }, EMPLOYEE_PORTAL_IDLE_TIMEOUT_MS);
    };

    events.forEach((eventName) => window.addEventListener(eventName, resetIdleTimer));
    resetIdleTimer();

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }

      events.forEach((eventName) => window.removeEventListener(eventName, resetIdleTimer));
    };
  }, [currentEmployee, navigate, onLogout]);

  if (isRestoringEmployeeSession) {
    return (
      <EmployeeMobileWorkspace title={title} profileAvatar="⏳" profileName="กำลังกู้คืนเซสชัน" profileSubtitle="กำลังโหลดข้อมูลพนักงานล่าสุด">
        <section className="employee-mobile-section-card">
          <div className="employee-mobile-section-head">
            <div>
              <h3>กำลังเปิดหน้าพนักงาน</h3>
              <p>กำลังกู้คืนข้อมูลการเข้าสู่ระบบและตารางงานล่าสุด</p>
            </div>
            <CalendarDays size={18} />
          </div>
        </section>
      </EmployeeMobileWorkspace>
    );
  }

  if (!currentEmployee) {
    return <Navigate to={routePaths.employeeLogin} replace />;
  }

  const handleLogout = () => {
    onLogout();
    navigate(routePaths.employeeLogin, {
      replace: true,
      state: {
        portalMessage: 'ออกจากระบบสำเร็จแล้ว',
      },
    });
  };

  return (
    <EmployeeMobileWorkspace title={title} profileAvatar={currentEmployee.avatar} profileName={`${currentEmployee.name} · ${currentEmployee.role}`} profileSubtitle="ยืนยันตัวตนแล้ว" accountAction={<button type="button" className="employee-mobile-logout-button" onClick={handleLogout}>ออก</button>}>
      {children}
    </EmployeeMobileWorkspace>
  );
}

export function EmployeeMobileLoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { employeePortalLogin, employeePortalSessionId, employees, isSupabaseSyncReady } = useAppState();
  const currentEmployee = findPortalEmployee(employees, employeePortalSessionId);
  const portalMessage = location.state?.portalMessage ?? '';
  const availableEmployees = useMemo(() => employees.filter((employee) => employee.active !== false && employee.role !== 'ผู้จัดการร้าน'), [employees]);

  if (!isSupabaseSyncReady && Number.isFinite(employeePortalSessionId)) {
    return (
      <EmployeeMobileWorkspace title="เข้าสู่ระบบพนักงาน" profileAvatar="⏳" profileName="กำลังกู้คืนเซสชัน" profileSubtitle="กำลังตรวจสอบข้อมูลพนักงานล่าสุด">
        <section className="employee-mobile-section-card employee-mobile-login-hero-card">
          <div className="employee-mobile-login-hero-copy">
            <span className="employee-mobile-login-kicker">Shift Ready</span>
            <strong>กำลังกู้คืนการเข้าสู่ระบบของคุณ</strong>
            <p>รอสักครู่ ระบบกำลังตรวจสอบข้อมูลพนักงานและตารางงานล่าสุดก่อนเปิดหน้าใช้งาน</p>
          </div>
        </section>
      </EmployeeMobileWorkspace>
    );
  }

  if (currentEmployee) {
    return <Navigate to={routePaths.employeeHome} replace />;
  }

  return (
    <EmployeeMobileWorkspace title="เข้าสู่ระบบพนักงาน" profileAvatar="🔐" profileName="พนักงาน" profileSubtitle="พร้อมเข้าใช้งานบนมือถือ">
      <section className="employee-mobile-section-card employee-mobile-login-hero-card">
        <div className="employee-mobile-login-hero-copy">
          <span className="employee-mobile-login-kicker">Shift Ready</span>
          <strong>เข้าระบบแล้วรู้เลยว่าวันนี้ต้องทำอะไรต่อ</strong>
          <p>หน้า employee portal ออกแบบให้พนักงานเปิดดูง่ายบนมือถือ ทั้งกะงาน สต็อก และรายการที่ต้องช่วยจัดการระหว่างวัน</p>
        </div>

        <div className="employee-mobile-login-quick-grid">
          <article className="employee-mobile-login-quick-card">
            <CalendarDays size={16} />
            <div>
              <strong>ดูตารางวันนี้</strong>
              <span>เช็กเวลาเริ่มงานและช่วงที่รับผิดชอบ</span>
            </div>
          </article>
          <article className="employee-mobile-login-quick-card">
            <PackageSearch size={16} />
            <div>
              <strong>ตามสต็อกที่สำคัญ</strong>
              <span>เห็นของต่ำกว่าจุดเตือนและของใกล้หมดอายุ</span>
            </div>
          </article>
          <article className="employee-mobile-login-quick-card">
            <ClipboardList size={16} />
            <div>
              <strong>แจ้งงานหน้างาน</strong>
              <span>ส่งเรื่องให้ผู้จัดการเห็นและติดตามได้ต่อเนื่อง</span>
            </div>
          </article>
        </div>
      </section>

      {portalMessage ? <div className="form-success employee-mobile-login-success"><span>{portalMessage}</span></div> : null}
      <EmployeePortalLoginCard employees={availableEmployees} onLogin={employeePortalLogin} onSuccess={() => navigate(routePaths.employeeHome, { replace: true })} />
    </EmployeeMobileWorkspace>
  );
}

export function EmployeeMobileHomePage() {
  const { employeeAttendanceWindows, employeeAvailabilityCalendar, employeePortalLogout, employeePortalSessionId, employees, inventoryItems, issueReports, timeBlocks } = useAppState();
  const todayDateKey = formatDateKey();
  const currentEmployee = findPortalEmployee(employees, employeePortalSessionId);
  const assignedBlocks = useMemo(() => currentEmployee ? [...getTimeBlocksForDate(timeBlocks, todayDateKey)].sort(sortBlocksByTime).filter((block) => block.employeeIds.includes(currentEmployee.id)) : [], [currentEmployee, timeBlocks, todayDateKey]);
  const todayAttendanceWindow = useMemo(() => currentEmployee ? getEmployeeAttendanceWindowForDate(employeeAttendanceWindows, currentEmployee.id, todayDateKey) : null, [currentEmployee, employeeAttendanceWindows, todayDateKey]);
  const nextBlock = assignedBlocks[0] ?? null;
  const expiringItems = inventoryItems.filter((item) => getDaysUntilExpiry(item.expiresOn) <= 5);
  const lowStockItems = inventoryItems.filter((item) => item.quantity <= item.threshold);
  const openIssues = issueReports.filter((issue) => issue.status !== 'ดำเนินการแล้ว');
  const todayAvailability = currentEmployee ? getEmployeeAvailabilityMeta(currentEmployee, todayDateKey, employeeAvailabilityCalendar) : null;
  const upcomingWeek = useMemo(() => {
    if (!currentEmployee) {
      return [];
    }

    return Array.from({ length: 7 }, (_, index) => {
      const date = addCalendarDays(new Date(), index);
      const dateKey = formatDateKey(date);
      const myAvailability = getEmployeeAvailabilityMeta(currentEmployee, dateKey, employeeAvailabilityCalendar);
      const teammatesOff = employees
        .filter((employee) => employee.id !== currentEmployee.id && employee.active !== false)
        .map((employee) => ({ employee, meta: getEmployeeAvailabilityMeta(employee, dateKey, employeeAvailabilityCalendar) }))
        .filter(({ meta }) => meta.value !== 'ready' && meta.value !== 'inactive');

      return {
        dateKey,
        dateLabel: formatThaiDayCardLabel(date),
        fullLabel: formatThaiFullDate(dateKey),
        myAvailability,
        teammatesOff,
        attendanceWindow: myAvailability.assignable ? getEmployeeAttendanceWindowForDate(employeeAttendanceWindows, currentEmployee.id, dateKey) : null,
        assignedBlocks: myAvailability.assignable ? [...getTimeBlocksForDate(timeBlocks, dateKey)].sort(sortBlocksByTime).filter((block) => block.employeeIds.includes(currentEmployee.id)) : [],
      };
    });
  }, [currentEmployee, employeeAttendanceWindows, employeeAvailabilityCalendar, employees, timeBlocks]);

  return (
    <EmployeePortalGate title="หน้าพนักงาน" currentEmployee={currentEmployee} onLogout={employeePortalLogout}>
      <section className="employee-mobile-hero-card">
        <div>
          <strong>{todayAvailability?.assignable ? (todayAttendanceWindow ? `เวลาเข้างาน ${formatEmployeeRoundWindow(todayAttendanceWindow)}` : nextBlock ? `${getBlockRoundLabel(nextBlock)} ${formatEmployeeRoundWindow(nextBlock)}` : 'วันนี้ยังไม่มีกะงานที่ถูกมอบหมาย') : `วันนี้${todayAvailability?.label ?? 'งดลงกะ'}`}</strong>
          <p>{todayAvailability?.assignable ? (todayAttendanceWindow ? (assignedBlocks.length ? getAssignedBlockSummary(assignedBlocks) : 'มีเวลาเข้างานแล้ว แต่ยังไม่ถูกมอบหมายงานในตาราง') : nextBlock ? nextBlock.title : 'รอผู้จัดการจัดเวลาเข้างานหรืออัปเดตงานในระบบ') : `สถานะวันนี้: ${todayAvailability?.label ?? 'ไม่พร้อมลงกะ'}`}</p>
        </div>
        <Link className="employee-mobile-inline-link" to={routePaths.employeeSchedule}>ดูกะทั้งหมด <ArrowRight size={14} /></Link>
      </section>

      <section className="employee-mobile-section-card">
        <div className="employee-mobile-section-head">
          <div>
            <h3>ช่วงงานในตารางวันนี้</h3>
            <p>สรุปช่วงงานที่ได้รับมอบหมายวันนี้ แยกจากเวลาเข้างานหลักของคุณ</p>
          </div>
          <CalendarDays size={18} />
        </div>
        <div className="employee-mobile-card-list">
          {assignedBlocks.map((block) => (
            <article key={block.id} className="employee-mobile-list-card">
              <strong>{getBlockRoundLabel(block)}</strong>
              <p>{formatEmployeeRoundWindow(block)}</p>
              <p>{block.tasks.slice(0, 3).join(' • ')}</p>
            </article>
          ))}
          {!assignedBlocks.length ? <div className="empty-card">วันนี้ยังไม่มีช่วงงานในตารางของคุณ</div> : null}
        </div>
      </section>

      <section className="employee-mobile-section-card">
        <div className="employee-mobile-section-head">
          <div>
            <h3>เวลาเข้างาน 7 วันข้างหน้า</h3>
            <p>ดูเวลาเข้างานจริงของแต่ละวัน พร้อมสรุปว่ามีช่วงงานในตารางกี่ช่วง</p>
          </div>
          <CalendarDays size={18} />
        </div>
        <div className="employee-mobile-week-grid">
          {upcomingWeek.map((day) => (
            <article key={day.dateKey} className="employee-mobile-week-card">
              <div className="employee-mobile-week-head">
                <strong>{day.dateLabel}</strong>
                <span className={`status-chip ${day.myAvailability.tone}`}>{day.myAvailability.label}</span>
              </div>
              <p>{day.fullLabel}</p>
                {day.myAvailability.assignable && (day.attendanceWindow || day.assignedBlocks.length) ? <div className="employee-mobile-week-list">
                  {day.attendanceWindow ? <span>เข้างาน • {formatEmployeeRoundWindow(day.attendanceWindow)}</span> : null}
                  <span>{day.assignedBlocks.length ? `งานในตาราง ${day.assignedBlocks.length} ช่วง` : 'ยังไม่ถูกมอบหมายงานในตาราง'}</span>
                </div> : <div className="employee-mobile-week-list empty"><span>วันนั้นยังไม่มีเวลาเข้างานของคุณ</span></div>}
            </article>
          ))}
        </div>
      </section>

      <section className="employee-mobile-section-card">
        <div className="employee-mobile-section-head">
          <div>
            <h3>ใครหยุดบ้าง</h3>
            <p>ดูวันลา วันป่วย และวันขาดของเพื่อนร่วมงานล่วงหน้า</p>
          </div>
          <ClipboardList size={18} />
        </div>
        <div className="employee-mobile-card-list">
          {upcomingWeek.map((day) => (
            <article key={`leave-${day.dateKey}`} className="employee-mobile-list-card">
              <div className="employee-mobile-stock-head">
                <div>
                  <strong>{day.fullLabel}</strong>
                  <p>{day.teammatesOff.length ? `มี ${day.teammatesOff.length} คนไม่พร้อมลงกะ` : 'ทุกคนพร้อมลงกะ'}</p>
                </div>
                <span className={`status-chip ${day.teammatesOff.length ? 'warning' : 'ok'}`}>{day.teammatesOff.length ? 'มีวันหยุด' : 'พร้อม'}</span>
              </div>
              <div className={`employee-mobile-leave-list ${day.teammatesOff.length ? '' : 'empty'}`.trim()}>
                {day.teammatesOff.length ? day.teammatesOff.map(({ employee, meta }) => (
                  <span key={`${day.dateKey}-${employee.id}`}>{employee.name} • {meta.label}</span>
                )) : <span>ยังไม่มีคนลาหรือขาดในวันนี้</span>}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="employee-mobile-stat-grid">
        <article className="employee-mobile-stat-card">
          <span>ใกล้หมดอายุ</span>
          <strong>{expiringItems.length}</strong>
          <small>สินค้า</small>
        </article>
        <article className="employee-mobile-stat-card">
          <span>สต็อกต่ำ</span>
          <strong>{lowStockItems.length}</strong>
          <small>รายการ</small>
        </article>
        <article className="employee-mobile-stat-card">
          <span>ช่วงงานวันนี้</span>
          <strong>{assignedBlocks.length}</strong>
          <small>ช่วง</small>
        </article>
        <article className="employee-mobile-stat-card">
          <span>ปัญหาค้าง</span>
          <strong>{openIssues.length}</strong>
          <small>รายการ</small>
        </article>
      </section>
    </EmployeePortalGate>
  );
}

export function EmployeeMobileShiftPage() {
  const { employeeAttendanceWindows, employeeAvailabilityCalendar, employeePortalLogout, employeePortalSessionId, employees, timeBlocks } = useAppState();
  const [weekOffset, setWeekOffset] = useState(0);
  const [expandedDateKey, setExpandedDateKey] = useState(null);
  const todayDate = useMemo(() => addCalendarDays(new Date(), weekOffset * 7), [weekOffset]);
  const todayDateKey = formatDateKey(todayDate);
  const currentEmployee = findPortalEmployee(employees, employeePortalSessionId);
  const employeesById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);
  const todayScheduleBlocks = useMemo(() => [...getTimeBlocksForDate(timeBlocks, todayDateKey)].sort(sortBlocksByTime), [timeBlocks, todayDateKey]);
  const assignedBlocks = useMemo(() => currentEmployee ? [...getTimeBlocksForDate(timeBlocks, todayDateKey)].sort(sortBlocksByTime).filter((block) => block.employeeIds.includes(currentEmployee.id)) : [], [currentEmployee, timeBlocks, todayDateKey]);
  const todayAttendanceWindow = useMemo(() => currentEmployee ? getEmployeeAttendanceWindowForDate(employeeAttendanceWindows, currentEmployee.id, todayDateKey) : null, [currentEmployee, employeeAttendanceWindows, todayDateKey]);
  const todayTeamBlocks = useMemo(() => todayScheduleBlocks.map((block) => {
    const { assignedEmployees, unavailableEmployees } = getAssignedEmployeesForBlock(block, employeesById, todayDateKey, employeeAvailabilityCalendar);

    return {
      ...block,
      assignedEmployees,
      unavailableEmployees,
    };
  }), [employeeAvailabilityCalendar, employeesById, todayDateKey, todayScheduleBlocks]);
  const todayScheduledEmployeeCount = useMemo(() => new Set(todayTeamBlocks.flatMap((block) => block.assignedEmployees.map((employee) => employee.id))).size, [todayTeamBlocks]);
  const todayUnavailableEmployeeCount = useMemo(() => new Set(todayTeamBlocks.flatMap((block) => block.unavailableEmployees.map(({ employee }) => employee.id))).size, [todayTeamBlocks]);

  useEffect(() => {
    setExpandedDateKey(todayDateKey);
  }, [todayDateKey]);

  const weekDays = useMemo(() => getWeekDates(todayDate).map((date) => {
    const dateKey = formatDateKey(date);
    const scheduleBlocks = [...getTimeBlocksForDate(timeBlocks, dateKey)].sort(sortBlocksByTime);
    const dayBlocks = currentEmployee ? scheduleBlocks.filter((block) => block.employeeIds.includes(currentEmployee.id)) : [];
    const availabilityMeta = currentEmployee ? getEmployeeAvailabilityMeta(currentEmployee, dateKey, employeeAvailabilityCalendar) : null;
    const teamBlocks = scheduleBlocks.map((block) => {
      const { assignedEmployees, unavailableEmployees } = getAssignedEmployeesForBlock(block, employeesById, dateKey, employeeAvailabilityCalendar);

      return {
        ...block,
        assignedEmployees,
        unavailableEmployees,
      };
    });
    const unavailableEmployeeCount = new Set(teamBlocks.flatMap((block) => block.unavailableEmployees.map(({ employee }) => employee.id))).size;

    return {
      date,
      dateKey,
      dayLabel: formatThaiDayCardLabel(date),
      fullLabel: formatThaiFullDate(dateKey),
      hasPublishedSchedule: scheduleBlocks.length > 0,
      attendanceWindow: currentEmployee ? getEmployeeAttendanceWindowForDate(employeeAttendanceWindows, currentEmployee.id, dateKey) : null,
      blocks: dayBlocks,
      teamBlocks,
      teamEmployeeCount: new Set(teamBlocks.flatMap((block) => block.assignedEmployees.map((employee) => employee.id))).size,
      unavailableEmployeeCount,
      availabilityMeta,
    };
  }), [currentEmployee, employeeAttendanceWindows, employeeAvailabilityCalendar, employeesById, timeBlocks, todayDate]);
  const weekShiftCount = weekDays.reduce((sum, day) => sum + (day.attendanceWindow ? 1 : 0), 0);
  const firstAssignedBlock = assignedBlocks[0] ?? null;
  const todayStartLabel = firstAssignedBlock ? formatEmployeeTimeRange(firstAssignedBlock) : todayAttendanceWindow ? formatEmployeeTimeRange(todayAttendanceWindow) : '';
  const todayHasPublishedSchedule = todayScheduleBlocks.length > 0;
  const todayAvailabilityMeta = currentEmployee ? getEmployeeAvailabilityMeta(currentEmployee, todayDateKey, employeeAvailabilityCalendar) : null;
  const todayStatus = getEmployeeShiftStatus({
    hasAttendanceWindow: Boolean(todayAttendanceWindow),
    hasAssignedBlocks: Boolean(assignedBlocks.length),
    availabilityMeta: todayAvailabilityMeta,
    hasPublishedSchedule: todayHasPublishedSchedule,
  });

  return (
    <EmployeePortalGate title="เวลาเข้างานและตารางทีม" currentEmployee={currentEmployee} onLogout={employeePortalLogout}>
      <section className="employee-mobile-section-card">
        <div className="employee-mobile-section-head">
          <div>
            <h3>เวลาเข้างานวันนี้</h3>
            <p>แสดงเวลาเข้างานของคุณ พร้อมเปิดดูตารางทีมและหน้าที่ของแต่ละช่วงงานในวันเดียวกัน</p>
          </div>
          <CalendarDays size={18} />
        </div>
        <div className="employee-mobile-page-links">
          <Link className="employee-mobile-inline-link" to={routePaths.employeeHome}><ChevronLeft size={14} /> กลับหน้าพนักงาน</Link>
          <Link className="employee-mobile-inline-link" to={routePaths.employeeInventory}>ไปหน้าสต็อก <ArrowRight size={14} /></Link>
        </div>
        <div className="employee-mobile-week-toolbar">
          <button type="button" className="ghost-button" onClick={() => setWeekOffset((currentValue) => currentValue - 1)}><ChevronLeft size={16} /> สัปดาห์ก่อน</button>
          <span className="status-chip ok">ทั้งสัปดาห์ {weekShiftCount} วันเข้างาน</span>
          <button type="button" className="ghost-button" onClick={() => setWeekOffset((currentValue) => currentValue + 1)}>สัปดาห์ถัดไป <ChevronRight size={16} /></button>
        </div>
        <div className="employee-mobile-week-grid">
          <article className="employee-mobile-week-card">
            <div className="employee-mobile-week-head">
              <strong>{formatThaiFullDate(todayDateKey)}</strong>
              <span className={`status-chip ${todayStatus.tone}`}>{todayStatus.label}</span>
            </div>
            <p>{todayAttendanceWindow ? `เข้างาน • ${formatEmployeeRoundWindow(todayAttendanceWindow)}` : todayStatus.noAssignmentText}</p>
            <div className={`employee-mobile-week-list ${assignedBlocks.length ? '' : 'empty'}`.trim()}>
              {assignedBlocks.length ? assignedBlocks.map((block) => <span key={`${block.id}-${block.title}`}>{block.title} • {formatEmployeeRoundWindow(block)}</span>) : <span>{todayStatus.noAssignmentText}</span>}
            </div>
            {todayStartLabel ? <div className="employee-mobile-hero-note">ช่วงงานแรกวันนี้ {todayStartLabel}</div> : null}
          </article>
          <article className="employee-mobile-week-card">
            <div className="employee-mobile-week-head">
              <strong>ตารางทีมวันนี้</strong>
              <span className={`status-chip ${todayTeamBlocks.length ? 'ok' : 'attention'}`}>{todayTeamBlocks.length ? `${todayTeamBlocks.length} ช่วงงาน` : 'ยังไม่มีตารางทีม'}</span>
            </div>
            <p>{todayTeamBlocks.length ? `วันนี้มีพนักงานลงงาน ${todayScheduledEmployeeCount} คน${todayUnavailableEmployeeCount ? ` • ไม่พร้อมลงกะ ${todayUnavailableEmployeeCount} คน` : ''}` : 'วันนี้ยังไม่มีช่วงงานของทีมในระบบ'}</p>
            <div className={`employee-mobile-week-list ${todayTeamBlocks.length ? '' : 'empty'}`.trim()}>
              {todayTeamBlocks.length
                ? todayTeamBlocks.map((block) => (
                  <EmployeeMobileTeamBlockDetail
                    key={`${todayDateKey}-${block.id}`}
                    block={block}
                    assignedEmployees={block.assignedEmployees}
                    unavailableEmployees={block.unavailableEmployees}
                  />
                ))
                : <span>วันนี้ยังไม่มีช่วงงานของทีมในตาราง</span>}
            </div>
          </article>
        </div>
      </section>

      <section className="employee-mobile-section-card">
        <div className="employee-mobile-section-head">
          <div>
            <h3>ตารางงานและหน้าที่ของทีมรายสัปดาห์</h3>
            <p>แตะแต่ละวันเพื่อดูว่าทีมลงงานกี่ช่วง ใครอยู่กะไหน และช่วงนั้นต้องรับผิดชอบอะไรบ้าง</p>
          </div>
          <ClipboardList size={18} />
        </div>
        <div className="employee-mobile-schedule-list">
          {weekDays.map((day) => {
            const dayStatus = day.teamBlocks.length
              ? { tone: 'ok', label: `มี ${day.teamBlocks.length} ช่วงงาน`, noAssignmentText: '' }
              : day.hasPublishedSchedule
                ? { tone: 'attention', label: 'ยังไม่มีคนลงงาน', noAssignmentText: 'วันนี้มีตาราง แต่ยังไม่มีพนักงานถูกลงในช่วงงาน' }
                : { tone: 'attention', label: 'ยังไม่มีตารางทีม', noAssignmentText: 'วันนี้ยังไม่มีช่วงงานของทีมในระบบ' };
            const isExpanded = expandedDateKey === day.dateKey;

            return (
              <button key={day.dateKey} type="button" className={`employee-mobile-schedule-item ${isExpanded ? 'expanded' : ''}`} onClick={() => setExpandedDateKey((currentKey) => currentKey === day.dateKey ? null : day.dateKey)}>
                <div className="employee-mobile-schedule-item-head">
                  <div>
                    <strong>{day.dayLabel}</strong>
                    <p>{day.fullLabel}</p>
                  </div>
                  <span className={`status-chip ${dayStatus.tone}`}>{dayStatus.label}</span>
                </div>
                <div className="employee-mobile-schedule-item-summary">
                  {day.teamBlocks.length ? <span>พนักงานในตาราง {day.teamEmployeeCount} คน{day.unavailableEmployeeCount ? ` • ไม่พร้อมลงกะ ${day.unavailableEmployeeCount} คน` : ''} • เปิดดูหน้าที่และคนในแต่ละกะ</span> : <span>{dayStatus.noAssignmentText}</span>}
                </div>
                {isExpanded ? <div className={`employee-mobile-week-list ${day.teamBlocks.length ? '' : 'empty'}`.trim()}>
                  {day.teamBlocks.length ? day.teamBlocks.map((block) => (
                    <EmployeeMobileTeamBlockDetail
                      key={`${day.dateKey}-${block.id}`}
                      block={block}
                      assignedEmployees={block.assignedEmployees}
                      unavailableEmployees={block.unavailableEmployees}
                    />
                  )) : <span>{dayStatus.noAssignmentText}</span>}
                </div> : null}
              </button>
            );
          })}
        </div>
      </section>
    </EmployeePortalGate>
  );
}

export function EmployeeMobileInventoryPage({ inventoryView = 'check' }) {
  const { createInventoryItem, deleteInventoryItem, employeePortalLogout, employeePortalSessionId, employees, inventoryHistory, inventoryItems, updateInventoryItem } = useAppState();
  const navigate = useNavigate();
  const currentEmployee = findPortalEmployee(employees, employeePortalSessionId);
  const [inventoryFilter, setInventoryFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [inventoryDisplayMode, setInventoryDisplayMode] = useState('cards');
  const [expandedCardItemId, setExpandedCardItemId] = useState(null);
  const [expandedCompactItemId, setExpandedCompactItemId] = useState(null);
  const [expandedHistoryItemId, setExpandedHistoryItemId] = useState(null);
  const [expandedOptionItemId, setExpandedOptionItemId] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);
  const [inventoryQuery, setInventoryQuery] = useState('');
  const [inventoryNotice, setInventoryNotice] = useState('');
  const [showNewItemForm, setShowNewItemForm] = useState(false);
  const [itemDrafts, setItemDrafts] = useState({});
  const [newItemForm, setNewItemForm] = useState({
    name: '',
    category: 'วัตถุดิบ',
    unit: 'ชิ้น',
    threshold: '',
    expiresOn: formatDateKey(),
    quantity: '',
    noExpiry: false,
  });
  const summaryCards = useMemo(() => ([
    { label: 'ทั้งหมด', value: inventoryItems.length, note: 'รายการ' },
    { label: 'ใกล้หมดอายุ', value: inventoryItems.filter((item) => getDaysUntilExpiry(item.expiresOn) <= 7 && getDaysUntilExpiry(item.expiresOn) > 0).length, note: 'รายการ' },
    { label: 'สต็อกต่ำ', value: inventoryItems.filter((item) => item.quantity <= item.threshold && item.quantity > 0).length, note: 'รายการ' },
    { label: 'หมดอายุแล้ว', value: inventoryItems.filter((item) => getDaysUntilExpiry(item.expiresOn) <= 0).length, note: 'รายการ' },
  ]), [inventoryItems]);
  const inventoryCategories = useMemo(() => {
    const seenCategories = new Set();

    return [...inventoryCategoryOptions, ...inventoryItems.map((item) => item.category || 'อื่นๆ')].reduce((categories, category) => {
      const normalizedCategory = String(category || 'อื่นๆ').trim() || 'อื่นๆ';

      if (seenCategories.has(normalizedCategory)) {
        return categories;
      }

      seenCategories.add(normalizedCategory);
      categories.push(normalizedCategory);
      return categories;
    }, []);
  }, [inventoryItems]);
  const sortedItems = useMemo(() => [...inventoryItems].sort((left, right) => {
    const toneDiff = inventoryToneWeight[getInventoryTone(right)] - inventoryToneWeight[getInventoryTone(left)];
    if (toneDiff !== 0) {
      return toneDiff;
    }

    const expiryDiff = getDaysUntilExpiry(left.expiresOn) - getDaysUntilExpiry(right.expiresOn);
    if (expiryDiff !== 0) {
      return expiryDiff;
    }

    return left.quantity - right.quantity;
  }), [inventoryItems]);
  const todayIncomingItems = useMemo(() => [...inventoryItems]
    .filter((item) => Number(item.receivedToday ?? 0) > 0)
    .sort((leftItem, rightItem) => Number(rightItem.receivedToday ?? 0) - Number(leftItem.receivedToday ?? 0)), [inventoryItems]);
  const incomingItems = useMemo(() => [...inventoryItems]
    .filter((item) => {
      const normalizedQuery = inventoryQuery.trim().toLowerCase();

      if (categoryFilter !== 'all' && (item.category || 'อื่นๆ') !== categoryFilter) {
        return false;
      }

      return !normalizedQuery || getInventorySearchText(item).includes(normalizedQuery);
    })
    .sort((leftItem, rightItem) => {
      const leftReceivedToday = Number(leftItem.receivedToday ?? 0);
      const rightReceivedToday = Number(rightItem.receivedToday ?? 0);
      if (rightReceivedToday !== leftReceivedToday) {
        return rightReceivedToday - leftReceivedToday;
      }

      return String(leftItem.name).localeCompare(String(rightItem.name), 'th');
    }), [categoryFilter, inventoryItems, inventoryQuery]);
  const filteredItems = useMemo(() => {
    const normalizedQuery = inventoryQuery.trim().toLowerCase();

    return sortedItems.filter((item) => {
      if (normalizedQuery && !getInventorySearchText(item).includes(normalizedQuery)) {
        return false;
      }

      if (categoryFilter !== 'all' && (item.category || 'อื่นๆ') !== categoryFilter) {
        return false;
      }

      if (inventoryFilter === 'expiring') {
        const expiryDays = getDaysUntilExpiry(item.expiresOn);
        return expiryDays <= 7 && expiryDays > 0;
      }

      if (inventoryFilter === 'low-stock') {
        return item.quantity <= item.threshold && item.quantity > 0;
      }

      if (inventoryFilter === 'out') {
        return item.quantity <= 0;
      }

      if (inventoryFilter === 'expired') {
        return getDaysUntilExpiry(item.expiresOn) <= 0;
      }

      return true;
    });
  }, [categoryFilter, inventoryFilter, inventoryQuery, sortedItems]);
  const optionSheetItem = useMemo(() => inventoryItems.find((item) => item.id === expandedOptionItemId) ?? null, [expandedOptionItemId, inventoryItems]);
  const editingItem = useMemo(() => inventoryItems.find((item) => item.id === editingItemId) ?? null, [editingItemId, inventoryItems]);

  useEffect(() => {
    setItemDrafts((currentDrafts) => inventoryItems.reduce((drafts, item) => {
      const existingDraft = currentDrafts[item.id] ?? {};
      drafts[item.id] = {
        name: existingDraft.name ?? item.name,
        category: existingDraft.category ?? (item.category || 'อื่นๆ'),
        unit: existingDraft.unit ?? item.unit,
        threshold: existingDraft.threshold ?? String(item.threshold ?? 0),
        noExpiry: existingDraft.noExpiry ?? Boolean(item.noExpiry),
        receivedAmount: existingDraft.receivedAmount ?? '',
        countedQuantity: existingDraft.countedQuantity ?? String(item.quantity),
        expiresOn: existingDraft.expiresOn ?? item.expiresOn ?? '',
      };
      return drafts;
    }, {}));
  }, [inventoryItems]);

  useEffect(() => {
    setExpandedCompactItemId((currentItemId) => (filteredItems.some((item) => item.id === currentItemId) ? currentItemId : null));
  }, [filteredItems]);

  useEffect(() => {
    setExpandedCardItemId((currentItemId) => (filteredItems.some((item) => item.id === currentItemId) ? currentItemId : null));
  }, [filteredItems]);

  useEffect(() => {
    setExpandedHistoryItemId((currentItemId) => (filteredItems.some((item) => item.id === currentItemId) ? currentItemId : null));
  }, [filteredItems]);

  useEffect(() => {
    setExpandedOptionItemId((currentItemId) => (filteredItems.some((item) => item.id === currentItemId) ? currentItemId : null));
  }, [filteredItems]);

  useEffect(() => {
    setEditingItemId((currentItemId) => (inventoryItems.some((item) => item.id === currentItemId) ? currentItemId : null));
  }, [inventoryItems]);

  const updateItemDraft = (itemId, field, value) => {
    setItemDrafts((currentDrafts) => ({
      ...currentDrafts,
      [itemId]: {
        ...(currentDrafts[itemId] ?? {}),
        [field]: value,
      },
    }));
  };

  const handleReceiveInventory = (item) => {
    const draft = itemDrafts[item.id] ?? {};
    const receiveAmount = Math.max(0, Number(draft.receivedAmount ?? 0));
    if (!receiveAmount) {
      setInventoryNotice(`กรอกจำนวนของใหม่สำหรับ ${item.name} ก่อนบันทึกรับของ`);
      return;
    }

    const updatedItem = updateInventoryItem(item.id, {
      quantity: item.quantity + receiveAmount,
      receivedToday: Number(item.receivedToday ?? 0) + receiveAmount,
      baseQuantity: Number(item.baseQuantity ?? Math.max(item.quantity - Number(item.receivedToday ?? 0), 0)),
      checkedBy: currentEmployee?.name ?? item.checkedBy,
    });

    updateItemDraft(item.id, 'receivedAmount', '');
    updateItemDraft(item.id, 'countedQuantity', String(updatedItem?.quantity ?? item.quantity + receiveAmount));
    setInventoryNotice(`รับ ${item.name} เข้าใหม่ ${receiveAmount} ${item.unit} แล้ว ตอนนี้รวม ${updatedItem?.quantity ?? item.quantity + receiveAmount} ${item.unit}`);
  };

  const handleCheckInventory = (item) => {
    const draft = itemDrafts[item.id] ?? {};
    const countedQuantity = Math.max(0, Number(draft.countedQuantity ?? item.quantity));
    const noExpiry = Boolean(draft.noExpiry ?? item.noExpiry);
    const expiresOn = noExpiry ? '' : String(draft.expiresOn ?? item.expiresOn ?? '').trim();
    const updatedItem = updateInventoryItem(item.id, {
      quantity: countedQuantity,
      noExpiry,
      expiresOn: noExpiry ? '' : (expiresOn || item.expiresOn),
      checkedBy: currentEmployee?.name ?? item.checkedBy,
    });
    const nextExpiryDate = updatedItem?.expiresOn ?? expiresOn ?? item.expiresOn;

    setInventoryNotice(`เช็ก ${item.name} แล้ว คงเหลือจริง ${updatedItem?.quantity ?? countedQuantity} ${item.unit} • หมดอายุ ${formatThaiExpiryDate(nextExpiryDate)}`);
  };

  const handleSaveInventoryDetails = (item) => {
    const draft = itemDrafts[item.id] ?? {};
    const name = String(draft.name ?? item.name).trim();
    const category = String(draft.category ?? item.category ?? 'อื่นๆ').trim() || 'อื่นๆ';
    const unit = String(draft.unit ?? item.unit).trim() || 'ชิ้น';
    const threshold = Math.max(0, Number(draft.threshold ?? item.threshold ?? 0));
    const noExpiry = Boolean(draft.noExpiry ?? item.noExpiry);
    const expiresOn = noExpiry ? '' : String(item.expiresOn ?? '').trim();

    if (!name) {
      setInventoryNotice('กรอกชื่อสินค้าให้ครบก่อนบันทึกข้อมูลรายการ');
      return;
    }

    const importantChanges = [];
    if (name !== item.name) {
      importantChanges.push(`ชื่อสินค้า: ${item.name} -> ${name}`);
    }

    if (unit !== item.unit) {
      importantChanges.push(`หน่วย: ${item.unit} -> ${unit}`);
    }

    if (category !== (item.category || 'อื่นๆ')) {
      importantChanges.push(`หมวดหมู่: ${item.category || 'อื่นๆ'} -> ${category}`);
    }

    if (importantChanges.length > 0) {
      const confirmed = window.confirm(`ยืนยันการแก้ไขข้อมูลสำคัญของสินค้า\n\n${importantChanges.join('\n')}`);
      if (!confirmed) {
        return;
      }
    }

    const updatedItem = updateInventoryItem(item.id, {
      name,
      category,
      unit,
      threshold,
      noExpiry,
      expiresOn,
      checkedBy: currentEmployee?.name ?? item.checkedBy,
    });

    setEditingItemId(null);
    setExpandedOptionItemId(null);
    setInventoryNotice(`อัปเดตข้อมูลรายการ ${updatedItem?.name ?? name} แล้ว`);
  };

  const handleDeleteInventoryItem = (item) => {
    const confirmed = window.confirm(`ต้องการลบ “${item.name}” หรือไม่?\n\nการลบจะทำให้ประวัติของรายการนี้หายไปด้วย`);
    if (!confirmed) {
      return;
    }

    const deletedItem = deleteInventoryItem(item.id, currentEmployee?.name ?? 'ระบบ');
    setExpandedCompactItemId((currentItemId) => (currentItemId === item.id ? null : currentItemId));
    setExpandedOptionItemId((currentItemId) => (currentItemId === item.id ? null : currentItemId));
    setEditingItemId((currentItemId) => (currentItemId === item.id ? null : currentItemId));
    setInventoryNotice(`ลบรายการ ${deletedItem?.name ?? item.name} ออกจากคลังแล้ว`);
  };

  const handleCreateInventoryItem = () => {
    const quantity = Math.max(0, Number(newItemForm.quantity ?? 0));
    const createdItem = createInventoryItem({
      name: newItemForm.name,
      category: newItemForm.category,
      unit: newItemForm.unit,
      threshold: Number(newItemForm.threshold ?? 0),
      expiresOn: newItemForm.noExpiry ? '' : newItemForm.expiresOn,
      noExpiry: newItemForm.noExpiry,
      quantity,
      receivedToday: quantity,
      checkedBy: currentEmployee?.name ?? '',
    });

    if (!createdItem) {
      setInventoryNotice('กรอกชื่อสินค้า และเลือกวันหมดอายุหรือระบุว่าไม่มีวันหมดอายุ');
      return;
    }

    setNewItemForm({
      name: '',
      category: 'วัตถุดิบ',
      unit: 'ชิ้น',
      threshold: '',
      expiresOn: formatDateKey(),
      quantity: '',
      noExpiry: false,
    });
    setShowNewItemForm(false);
    setInventoryNotice(`เพิ่มสินค้า ${createdItem.name} เข้าระบบแล้ว พร้อมรับเข้าเริ่มต้น ${createdItem.quantity} ${createdItem.unit}`);
    navigate(routePaths.employeeInventoryIncoming);
  };

  const renderInventoryEditorCard = (item, extraClassName = '', forceExpanded = false) => {
    const statusMeta = getInventoryStatusMeta(item);
    const tone = statusMeta.tone;
    const checkerLabel = item.checkedBy ? `โดย ${item.checkedBy}` : 'รอพนักงานเช็ก';
    const draft = itemDrafts[item.id] ?? {
      name: item.name,
      category: item.category || 'อื่นๆ',
      unit: item.unit,
      threshold: String(item.threshold ?? 0),
      noExpiry: Boolean(item.noExpiry),
      receivedAmount: '',
      countedQuantity: String(item.quantity),
      expiresOn: item.expiresOn ?? '',
    };
    const baseQuantity = Number(item.baseQuantity ?? Math.max(item.quantity - Number(item.receivedToday ?? 0), 0));
    const isNoExpiry = Boolean(draft.noExpiry ?? item.noExpiry);
    const itemHistory = inventoryHistory.filter((entry) => entry.itemId === item.id).slice(0, 3);
    const isExpanded = forceExpanded || expandedCardItemId === item.id;
    const isHistoryExpanded = expandedHistoryItemId === item.id;
    const isOptionExpanded = expandedOptionItemId === item.id;

    return (
      <article key={item.id} className={`employee-mobile-list-card employee-mobile-stock-card ${tone} ${extraClassName}`.trim()}>
        <div className="employee-mobile-stock-head">
          <div className="employee-mobile-stock-main">
            <strong>{item.name}</strong>
            <p>{item.category || 'อื่นๆ'} • {item.unit}</p>
          </div>
          <div className={`employee-mobile-stock-status ${tone}`}>
            <span>{statusMeta.label}</span>
            <small>{statusMeta.detail}</small>
          </div>
        </div>
        <div className="employee-mobile-stock-facts">
          <div className="employee-mobile-stock-fact">
            <span>เหลือจริง</span>
            <strong>{item.quantity} {item.unit}</strong>
          </div>
          <div className="employee-mobile-stock-fact">
            <span>หมดอายุ</span>
            <strong>{formatThaiExpiryDate(item.expiresOn)}</strong>
          </div>
          <div className="employee-mobile-stock-fact">
            <span>รับเข้าใหม่</span>
            <strong>{Number(item.receivedToday ?? 0)} {item.unit}</strong>
          </div>
        </div>
        <p className="employee-mobile-stock-meta">เช็กล่าสุด {item.checkedAt} {checkerLabel} • ยอดก่อนรับ {baseQuantity} {item.unit}</p>
        {!forceExpanded ? <div className="employee-mobile-stock-actions employee-mobile-card-top-actions">
          <button type="button" className={isExpanded ? 'primary-inline' : 'ghost-button'} onClick={() => setExpandedCardItemId((currentItemId) => (currentItemId === item.id ? null : item.id))}>{isExpanded ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียด'}</button>
        </div> : null}
        {!isExpanded ? <p className="employee-mobile-stock-collapsed-note">กดดูรายละเอียดเพื่อเช็กสต็อก ดูประวัติ หรือแก้ไขข้อมูลพื้นฐานของรายการนี้</p> : null}
        {isExpanded ? <>
        <div className="employee-mobile-stock-metrics">
          <label className="employee-mobile-inline-field">
            <span>นับคงเหลือจริง</span>
            <input type="number" min="0" className="text-input" value={draft.countedQuantity} onChange={(event) => updateItemDraft(item.id, 'countedQuantity', event.target.value)} placeholder="จำนวนที่นับได้" />
          </label>
          <label className="employee-mobile-inline-field">
            <span>{isNoExpiry ? 'ไม่มีวันหมดอายุ' : 'วันหมดอายุจริง'}</span>
            <ThaiDateInput value={draft.expiresOn ?? ''} disabled={isNoExpiry} label="วันหมดอายุจริง" onChange={(nextValue) => updateItemDraft(item.id, 'expiresOn', nextValue)} />
          </label>
          <label className="employee-mobile-inline-checkbox employee-mobile-inline-field-full">
            <input type="checkbox" checked={isNoExpiry} onChange={(event) => updateItemDraft(item.id, 'noExpiry', event.target.checked)} />
            <span>ไม่มีวันหมดอายุ</span>
          </label>
        </div>
        <div className="employee-mobile-stock-actions employee-mobile-stock-actions-single">
          <button type="button" className="primary-inline" onClick={() => handleCheckInventory(item)}>บันทึกสต็อก</button>
        </div>
        <div className="employee-mobile-secondary-action-group">
          <p className="employee-mobile-inline-hint employee-mobile-secondary-action-label">ตัวเลือกเพิ่มเติม</p>
          <div className="employee-mobile-stock-actions employee-mobile-history-toggle-row employee-mobile-option-row employee-mobile-secondary-actions">
            <button type="button" className={isHistoryExpanded ? 'primary-inline' : 'ghost-button'} onClick={() => setExpandedHistoryItemId((currentItemId) => (currentItemId === item.id ? null : item.id))}>{isHistoryExpanded ? 'ซ่อนประวัติ' : 'ประวัติ'}</button>
            <button type="button" className={isOptionExpanded ? 'primary-inline' : 'ghost-button'} onClick={() => setExpandedOptionItemId((currentItemId) => (currentItemId === item.id ? null : item.id))}>เพิ่มเติม</button>
          </div>
        </div>
        {isHistoryExpanded ? <div className="employee-mobile-history-block">
          <div className="employee-mobile-history-head">
            <strong>ประวัติล่าสุดของรายการนี้</strong>
            <span>{itemHistory.length} รายการ</span>
          </div>
          {itemHistory.length ? <div className="employee-mobile-history-list">
            {itemHistory.map((entry) => (
              <article key={entry.id} className="employee-mobile-history-item">
                <div>
                  <strong>{entry.label}</strong>
                  <p>{entry.detail}</p>
                </div>
                <small>{entry.actorName} • {entry.at}</small>
              </article>
            ))}
          </div> : <div className="empty-card compact">ยังไม่มีประวัติรายการนี้</div>}
        </div> : null}
        </> : null}
      </article>
    );
  };

  const renderIncomingInventoryCard = (item) => {
    const draft = itemDrafts[item.id] ?? {
      receivedAmount: '',
      expiresOn: item.expiresOn ?? '',
      noExpiry: Boolean(item.noExpiry),
    };
    const isNoExpiry = Boolean(draft.noExpiry ?? item.noExpiry);
    const receiveAmount = Math.max(0, Number(draft.receivedAmount ?? 0));
    const nextQuantity = item.quantity + receiveAmount;

    return (
      <article key={item.id} className="employee-mobile-list-card ok employee-mobile-incoming-card">
        <div className="employee-mobile-stock-head">
          <div>
            <strong>{item.name}</strong>
            <p>{item.category || 'อื่นๆ'} • {item.unit}</p>
            <p>คงเหลือปัจจุบัน {item.quantity} {item.unit} • รับวันนี้ {Number(item.receivedToday ?? 0)} {item.unit}</p>
            <p>หลังรับเข้า {nextQuantity} {item.unit}</p>
          </div>
          <span className="status-chip ok">รับของเข้า</span>
        </div>
        <div className="employee-mobile-stock-metrics employee-mobile-incoming-metrics">
          <label className="employee-mobile-inline-field">
            <span>จำนวนรับเข้า</span>
            <input type="number" min="0" className="text-input" value={draft.receivedAmount} onChange={(event) => updateItemDraft(item.id, 'receivedAmount', event.target.value)} placeholder="เช่น 10" />
          </label>
          <label className="employee-mobile-inline-field">
            <span>{isNoExpiry ? 'ล็อตนี้ไม่มีวันหมดอายุ' : 'วันหมดอายุของล็อตนี้'}</span>
            <ThaiDateInput value={draft.expiresOn ?? ''} disabled={isNoExpiry} label="วันหมดอายุของล็อตนี้" onChange={(nextValue) => updateItemDraft(item.id, 'expiresOn', nextValue)} />
          </label>
          <label className="employee-mobile-inline-checkbox employee-mobile-inline-field-full">
            <input type="checkbox" checked={isNoExpiry} onChange={(event) => updateItemDraft(item.id, 'noExpiry', event.target.checked)} />
            <span>ล็อตนี้ไม่มีวันหมดอายุ</span>
          </label>
        </div>
        <div className="employee-mobile-stock-actions employee-mobile-stock-actions-single">
          <button type="button" className="primary-inline" onClick={() => handleReceiveInventory(item)}>บันทึกรับเข้า</button>
        </div>
      </article>
    );
  };

  return (
    <EmployeePortalGate title={inventoryView === 'incoming' ? 'รับของเข้า' : 'เช็กสต็อก'} currentEmployee={currentEmployee} onLogout={employeePortalLogout}>
      <section className="employee-mobile-section-card">
        <div className="employee-mobile-section-head">
          <div>
            <h3>สต็อกและวันหมดอายุ</h3>
            <p>{inventoryView === 'check' ? 'อัปเดตจำนวนคงเหลือจริงและวันหมดอายุ' : 'ค้นหาสินค้าที่มีอยู่แล้วเพื่อรับของเข้า หรือเพิ่มสินค้าใหม่เมื่อยังไม่มีในระบบ'}</p>
          </div>
          <PackageSearch size={18} />
        </div>
        {inventoryNotice ? <div className="form-success employee-mobile-notice-banner"><span>{inventoryNotice}</span></div> : null}
        <div className="employee-mobile-search-toolbar">
          <label className="employee-mobile-inline-field employee-mobile-search-field">
            <span>{inventoryView === 'incoming' ? 'ค้นหาสินค้าที่รับเข้า' : 'ค้นหาสินค้า'}</span>
            <div className="employee-mobile-search-shell">
              <Search size={16} />
              <input className="text-input employee-mobile-search-input" value={inventoryQuery} onChange={(event) => setInventoryQuery(event.target.value)} placeholder={inventoryView === 'incoming' ? 'ค้นหาชื่อสินค้า / รหัส / หมวดหมู่' : 'ค้นหาชื่อสินค้า หมวดหมู่ หน่วย หรือรหัส'} />
            </div>
          </label>
          <label className="employee-mobile-inline-field employee-mobile-category-field">
            <span>หมวดหมู่</span>
            <select className="text-input employee-mobile-filter-select" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="all">ทุกหมวดหมู่</option>
              {inventoryCategories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
        </div>
        <div className="employee-mobile-filter-row">
          <div className="segmented-control employee-mobile-segmented-control employee-mobile-stock-view-switch">
            {[
              { value: 'check', label: 'เช็กสต็อก' },
              { value: 'incoming', label: 'รับของเข้า' },
            ].map((item) => (
              <button key={item.value} type="button" className={inventoryView === item.value ? 'active' : undefined} onClick={() => navigate(item.value === 'check' ? routePaths.employeeInventoryCheck : routePaths.employeeInventoryIncoming)}>{item.label}</button>
            ))}
          </div>
          <p className="employee-mobile-filter-summary">{inventoryView === 'check' ? 'เช็กจำนวนคงเหลือจริง อัปเดตวันหมดอายุ และบันทึกสต็อกของรายการที่นับแล้ว' : `รับของเข้าของสินค้าที่มีอยู่แล้ว และถ้าไม่พบค่อยเพิ่มสินค้าใหม่ • วันนี้มีรายการรับเข้า ${todayIncomingItems.length} รายการ`}</p>
        </div>
        {inventoryView === 'incoming' ? <div className="employee-mobile-filter-row">
          <p className="employee-mobile-filter-summary">แสดง {incomingItems.length} รายการ{categoryFilter !== 'all' ? ` • หมวด ${categoryFilter}` : ''} ในมุมมองรับของเข้า</p>
        </div> : null}
        {inventoryView === 'check' ? <div className="employee-mobile-filter-row">
          <div className="employee-mobile-secondary-toolbar">
            <select className="text-input employee-mobile-filter-select" value={inventoryFilter} onChange={(event) => setInventoryFilter(event.target.value)}>
              <option value="all">แสดงทั้งหมด</option>
              <option value="expiring">ใกล้หมดอายุ</option>
              <option value="low-stock">สต็อกต่ำ</option>
              <option value="out">หมดแล้ว</option>
              <option value="expired">หมดอายุแล้ว</option>
            </select>
            <div className="segmented-control employee-mobile-compact-toggle">
              {[
                { value: 'cards', label: 'การ์ด' },
                { value: 'compact', label: 'ลิสต์ย่อ' },
              ].map((item) => (
                <button key={item.value} type="button" className={inventoryDisplayMode === item.value ? 'active' : undefined} onClick={() => setInventoryDisplayMode(item.value)}>{item.label}</button>
              ))}
            </div>
          </div>
          {inventoryDisplayMode === 'compact' && expandedCompactItemId !== null ? <button type="button" className="ghost-button employee-mobile-close-expanded" onClick={() => setExpandedCompactItemId(null)}>ปิดทั้งหมด</button> : null}
          <p className="employee-mobile-filter-summary">แสดง {filteredItems.length} รายการ{categoryFilter !== 'all' ? ` • หมวด ${categoryFilter}` : ''} ในมุมมองนี้ {inventoryDisplayMode === 'compact' ? '• ลิสต์ย่อเหมาะกับไล่ดูเร็ว' : '• การ์ดเหมาะกับเช็กและเปิดรายละเอียดรายสินค้า'}</p>
        </div> : null}
        {inventoryView === 'check' ? <div className="employee-mobile-stock-summary-grid">
          {summaryCards.map((item) => (
            <article key={item.label} className="employee-mobile-stock-summary-card">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.note}</small>
            </article>
          ))}
        </div> : null}
        {inventoryView === 'incoming' ? <div className="employee-mobile-add-stock-card employee-mobile-incoming-intro-card">
          <div className="employee-mobile-section-head compact">
            <div>
              <h3>รับของเข้า</h3>
              <p>ค้นหาสินค้าที่มีอยู่แล้วเพื่อบันทึกรับเข้า แล้วค่อยเพิ่มสินค้าใหม่เมื่อยังไม่มีในระบบ</p>
            </div>
            <PackagePlus size={18} />
          </div>
          <div className="employee-mobile-inline-cta-row">
            <span className="employee-mobile-inline-hint">ไม่พบสินค้าในระบบ?</span>
            <button type="button" className={showNewItemForm ? 'primary-inline' : 'ghost-button'} onClick={() => setShowNewItemForm((currentValue) => !currentValue)}>{showNewItemForm ? 'ซ่อนฟอร์มเพิ่มสินค้าใหม่' : '+ เพิ่มสินค้าใหม่'}</button>
          </div>
          {showNewItemForm ? <div className="employee-mobile-stock-subpanel">
            <div className="employee-mobile-section-head compact">
              <div>
                <h3>เพิ่มสินค้าใหม่</h3>
                <p>กรอกข้อมูลตั้งต้นของสินค้าใหม่ก่อนเริ่มใช้งาน</p>
              </div>
              <PackagePlus size={18} />
            </div>
            <div className="employee-mobile-add-stock-grid">
              <label className="employee-mobile-inline-field">
                <span>ชื่อสินค้า</span>
                <input className="text-input" value={newItemForm.name} onChange={(event) => setNewItemForm((currentForm) => ({ ...currentForm, name: event.target.value }))} placeholder="เช่น นมสดพาสเจอร์ไรส์" />
              </label>
              <label className="employee-mobile-inline-field">
                <span>หมวดหมู่</span>
                <select className="text-input" value={newItemForm.category} onChange={(event) => setNewItemForm((currentForm) => ({ ...currentForm, category: event.target.value }))}>
                  {inventoryCategoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="employee-mobile-inline-field">
                <span>หน่วย</span>
                <select className="text-input" value={newItemForm.unit} onChange={(event) => setNewItemForm((currentForm) => ({ ...currentForm, unit: event.target.value }))}>
                  {inventoryUnitOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="employee-mobile-inline-field">
                <span>จำนวนเริ่มต้น</span>
                <input className="text-input" type="number" min="0" value={newItemForm.quantity} onChange={(event) => setNewItemForm((currentForm) => ({ ...currentForm, quantity: event.target.value }))} placeholder="เช่น 12" />
              </label>
              <label className="employee-mobile-inline-field employee-mobile-inline-field-full">
                <span>จุดเตือน</span>
                <input className="text-input" type="number" min="0" value={newItemForm.threshold} onChange={(event) => setNewItemForm((currentForm) => ({ ...currentForm, threshold: event.target.value }))} placeholder="เริ่มเตือนเมื่อเหลือเท่าไร" />
              </label>
              <label className="employee-mobile-inline-checkbox employee-mobile-inline-field-full">
                <input type="checkbox" checked={newItemForm.noExpiry} onChange={(event) => setNewItemForm((currentForm) => ({ ...currentForm, noExpiry: event.target.checked }))} />
                <span>ไม่มีวันหมดอายุ</span>
              </label>
              <label className="employee-mobile-inline-field employee-mobile-inline-field-full">
                <span>วันหมดอายุ</span>
                <ThaiDateInput value={newItemForm.expiresOn} disabled={newItemForm.noExpiry} label="วันหมดอายุ" onChange={(nextValue) => setNewItemForm((currentForm) => ({ ...currentForm, expiresOn: nextValue }))} />
              </label>
            </div>
            <div className="employee-mobile-stock-actions employee-mobile-stock-actions-single">
              <button type="button" className="primary-inline" onClick={handleCreateInventoryItem}>เพิ่มสินค้า</button>
            </div>
          </div> : null}
        </div> : null}
        {inventoryView === 'incoming' ? <div className="employee-mobile-card-list">
          {incomingItems.map((item) => renderIncomingInventoryCard(item))}
          {!incomingItems.length ? <div className="empty-card">ไม่พบสินค้าในระบบตามคำค้นนี้ ลองกดเพิ่มสินค้าใหม่ได้เลย</div> : null}
        </div> : null}
        {inventoryView === 'check' && inventoryDisplayMode === 'compact' ? <div className="employee-mobile-compact-list">
          {filteredItems.map((item) => {
            const statusMeta = getInventoryStatusMeta(item);
            const tone = statusMeta.tone;
            const isExpanded = expandedCompactItemId === item.id;

            return (
              <div key={item.id} className="employee-mobile-compact-item">
                <button type="button" className={`employee-mobile-compact-row ${tone} ${isExpanded ? 'expanded' : ''}`.trim()} onClick={() => setExpandedCompactItemId((currentItemId) => (currentItemId === item.id ? null : item.id))}>
                  <div className="employee-mobile-compact-main">
                    <div className="employee-mobile-compact-title-row">
                      <strong>{item.name}</strong>
                      <span className={`status-chip ${tone}`}>{statusMeta.label}</span>
                    </div>
                    <p>{item.category || 'อื่นๆ'} • เหลือ {item.quantity} {item.unit}</p>
                    <p>{item.noExpiry ? 'ไม่มีวันหมดอายุ' : `หมดอายุ ${formatThaiExpiryDate(item.expiresOn)}`}</p>
                  </div>
                  <div className="employee-mobile-compact-side">
                    <strong>{item.quantity}</strong>
                    <span>{item.unit}</span>
                    <small>{isExpanded ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียด'}</small>
                  </div>
                </button>
                {isExpanded ? renderInventoryEditorCard(item, 'employee-mobile-compact-editor-card', true) : null}
              </div>
            );
          })}
          {!filteredItems.length ? <div className="empty-card">ไม่พบสินค้าตามมุมมองที่เลือก</div> : null}
        </div> : null}
        {inventoryView === 'check' && inventoryDisplayMode === 'cards' ? <div className="employee-mobile-card-list">
          {filteredItems.map((item) => renderInventoryEditorCard(item))}
          {!filteredItems.length ? <div className="empty-card">ไม่พบสินค้าตามมุมมองที่เลือก</div> : null}
        </div> : null}
      </section>
      {optionSheetItem ? <div className="employee-mobile-sheet-backdrop" role="presentation" onClick={() => setExpandedOptionItemId(null)}>
        <section className="employee-mobile-sheet-card" role="dialog" aria-modal="true" aria-labelledby="inventory-option-sheet-title" onClick={(event) => event.stopPropagation()}>
          <div className="employee-mobile-sheet-handle" aria-hidden="true" />
          <div className="employee-mobile-sheet-head">
            <div>
              <strong id="inventory-option-sheet-title">เพิ่มเติม</strong>
              <p>{optionSheetItem.name}</p>
            </div>
            <button type="button" className="ghost-button employee-mobile-dialog-close" onClick={() => setExpandedOptionItemId(null)}>ปิด</button>
          </div>
          <div className="employee-mobile-option-sheet employee-mobile-option-sheet-modal">
            <button type="button" className="ghost-button" onClick={() => {
              setEditingItemId(optionSheetItem.id);
              setExpandedOptionItemId(null);
            }}>แก้ไขข้อมูลสินค้า</button>
            <button type="button" className="danger-inline" onClick={() => {
              setExpandedOptionItemId(null);
              handleDeleteInventoryItem(optionSheetItem);
            }}>ลบรายการ</button>
            <button type="button" className="ghost-button" onClick={() => setExpandedOptionItemId(null)}>ยกเลิก</button>
          </div>
        </section>
      </div> : null}
      {editingItem ? <div className="employee-mobile-dialog-backdrop" role="presentation" onClick={() => setEditingItemId(null)}>
        <section className="employee-mobile-dialog-card" role="dialog" aria-modal="true" aria-labelledby="inventory-edit-dialog-title" onClick={(event) => event.stopPropagation()}>
          <div className="employee-mobile-dialog-head">
            <div>
              <strong id="inventory-edit-dialog-title">แก้ไขข้อมูลสินค้า</strong>
              <p>แก้เฉพาะข้อมูลตั้งต้นของสินค้า ไม่รวมการนับสต็อกและการรับของเข้า</p>
            </div>
            <button type="button" className="ghost-button employee-mobile-dialog-close" onClick={() => setEditingItemId(null)}>ปิด</button>
          </div>
          <div className="employee-mobile-dialog-body employee-mobile-item-detail-grid">
            <label className="employee-mobile-inline-field employee-mobile-inline-field-full">
              <span>ชื่อสินค้า</span>
              <input type="text" className="text-input" value={itemDrafts[editingItem.id]?.name ?? editingItem.name} onChange={(event) => updateItemDraft(editingItem.id, 'name', event.target.value)} placeholder="ชื่อสินค้า" />
            </label>
            <label className="employee-mobile-inline-field">
              <span>หมวดหมู่</span>
              <select className="text-input" value={itemDrafts[editingItem.id]?.category ?? (editingItem.category || 'อื่นๆ')} onChange={(event) => updateItemDraft(editingItem.id, 'category', event.target.value)}>
                {inventoryCategoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="employee-mobile-inline-field">
              <span>หน่วย</span>
              <select className="text-input" value={itemDrafts[editingItem.id]?.unit ?? editingItem.unit} onChange={(event) => updateItemDraft(editingItem.id, 'unit', event.target.value)}>
                {inventoryUnitOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="employee-mobile-inline-field employee-mobile-inline-field-full">
              <span>จุดเตือน</span>
              <input type="number" min="0" className="text-input" value={itemDrafts[editingItem.id]?.threshold ?? String(editingItem.threshold ?? 0)} onChange={(event) => updateItemDraft(editingItem.id, 'threshold', event.target.value)} placeholder="เริ่มเตือนเมื่อเหลือเท่าไร" />
            </label>
            <label className="employee-mobile-inline-checkbox employee-mobile-inline-field-full">
              <input type="checkbox" checked={Boolean(itemDrafts[editingItem.id]?.noExpiry ?? editingItem.noExpiry)} onChange={(event) => updateItemDraft(editingItem.id, 'noExpiry', event.target.checked)} />
              <span>สินค้านี้ไม่มีวันหมดอายุ</span>
            </label>
          </div>
          <div className="employee-mobile-stock-actions employee-mobile-dialog-actions">
            <button type="button" className="ghost-button" onClick={() => setEditingItemId(null)}>ยกเลิก</button>
            <button type="button" className="primary-inline" onClick={() => handleSaveInventoryDetails(editingItem)}>บันทึกข้อมูลสินค้า</button>
          </div>
        </section>
      </div> : null}
    </EmployeePortalGate>
  );
}

export function EmployeeMobileIssuePage() {
  const { createIssueReport, employeePortalLogout, employeePortalSessionId, employees, issueReports } = useAppState();
  const currentEmployee = findPortalEmployee(employees, employeePortalSessionId);
  const [formState, setFormState] = useState({
    title: '',
    detail: '',
    severity: 'กลาง',
  });
  const [summary, setSummary] = useState('');

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormState((currentState) => ({ ...currentState, [name]: value }));
  };

  const handleSubmit = () => {
    const result = createIssueReport(formState);
    if (!result) {
      return;
    }

    setSummary(`ส่งปัญหา ${result.title} แล้ว`);
    setFormState({ title: '', detail: '', severity: 'กลาง' });
  };

  return (
    <EmployeePortalGate title="แจ้งปัญหา" currentEmployee={currentEmployee} onLogout={employeePortalLogout}>
      <section className="employee-mobile-section-card">
        <div className="employee-mobile-section-head">
          <div>
            <h3>แจ้งปัญหาหน้างาน</h3>
            <p>ระบุอาการที่พบเพื่อให้ผู้จัดการติดตามต่อได้เร็วขึ้น</p>
          </div>
          <AlertTriangle size={18} />
        </div>
        <div className="employee-mobile-form-grid">
          <input className="text-input" name="title" value={formState.title} onChange={handleChange} placeholder="หัวข้อปัญหา เช่น ตู้แช่เสียงดัง" />
          <select className="text-input" name="severity" value={formState.severity} onChange={handleChange}>
            <option value="ต่ำ">ระดับต่ำ</option>
            <option value="กลาง">ระดับกลาง</option>
            <option value="สูง">ระดับสูง</option>
          </select>
          <textarea className="textarea-box textarea-control" name="detail" value={formState.detail} onChange={handleChange} placeholder="อธิบายปัญหาที่พบและสิ่งที่กระทบงาน" />
          <button type="button" className="primary-inline employee-mobile-submit" onClick={handleSubmit} disabled={!formState.title.trim() || !formState.detail.trim()}>ส่งแจ้งปัญหา</button>
        </div>
        {summary ? <div className="form-success top-spaced"><span>{summary}</span></div> : null}
      </section>

      <section className="employee-mobile-section-card">
        <div className="employee-mobile-section-head">
          <div>
            <h3>ปัญหาที่ส่งแล้ว</h3>
            <p>ดูสถานะว่ารายการไหนยังรอดำเนินการ</p>
          </div>
          <Bell size={18} />
        </div>
        <div className="employee-mobile-card-list">
          {issueReports.map((issue) => (
            <article key={issue.id} className="employee-mobile-list-card">
              <div className="employee-mobile-stock-head">
                <div>
                  <strong>{issue.title}</strong>
                  <p>{issue.date}</p>
                </div>
                <span className={`status-chip ${issue.severity === 'สูง' ? 'danger' : issue.severity === 'กลาง' ? 'warning' : 'ok'}`}>{issue.status}</span>
              </div>
              <p className="employee-mobile-issue-detail">{issue.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </EmployeePortalGate>
  );
}