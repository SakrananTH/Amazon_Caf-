import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DesktopWorkspace from './DesktopWorkspace.jsx';
import { routePaths } from '../../app/routes.js';
import { formatDateKey, getCalendarDayMeta, getEmployeeAvailabilityMeta, isManagerRole, useAppState } from '../../app/state/AppStateContext.jsx';

const thaiWeekdayLabels = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];
const leaveStatuses = new Set(['annual_leave', 'personal_leave', 'sick_leave']);

function addCalendarDays(dateInput, amount = 0) {
  const nextDate = new Date(dateInput);
  nextDate.setDate(nextDate.getDate() + amount);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function startOfMonth(dateInput = new Date()) {
  const date = new Date(dateInput);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addCalendarMonths(dateInput, amount = 0) {
  const date = startOfMonth(dateInput);
  date.setMonth(date.getMonth() + amount);
  return date;
}

function parseDateKey(dateKey) {
  const [year, month, day] = String(dateKey).split('-').map(Number);
  const parsedDate = new Date(year, (month ?? 1) - 1, day ?? 1);
  parsedDate.setHours(0, 0, 0, 0);
  return parsedDate;
}

function buildCalendarDays(monthDate) {
  const firstDayOfMonth = startOfMonth(monthDate);
  const calendarStart = addCalendarDays(firstDayOfMonth, -((firstDayOfMonth.getDay() + 6) % 7));

  return Array.from({ length: 42 }, (_, index) => {
    const date = addCalendarDays(calendarStart, index);
    return {
      date,
      dateKey: formatDateKey(date),
      isCurrentMonth: date.getMonth() === firstDayOfMonth.getMonth(),
      isToday: formatDateKey(date) === formatDateKey(),
    };
  });
}

function formatThaiDate(dateInput, options) {
  return new Intl.DateTimeFormat('th-TH', options).format(dateInput);
}

function getThaiDateLabel(dateKey) {
  return formatThaiDate(parseDateKey(dateKey), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function getThaiMonthLabel(dateInput) {
  return formatThaiDate(dateInput, { month: 'long', year: 'numeric' });
}

function getAvailabilityActionLabel(status) {
  if (status === 'annual_leave') {
    return 'ลา';
  }

  if (status === 'personal_leave') {
    return 'ลากิจ';
  }

  if (status === 'sick_leave') {
    return 'ลาป่วย';
  }

  if (status === 'absent') {
    return 'ขาด';
  }

  return 'พร้อมลงกะ';
}

function getDayEntries(dateKey, employees, employeeAvailabilityCalendar) {
  return employees.reduce((entries, employee) => {
    const meta = getEmployeeAvailabilityMeta(employee, dateKey, employeeAvailabilityCalendar);
    if (meta.value === 'ready' || meta.value === 'inactive') {
      return entries;
    }

    entries.push({ employee, meta });
    return entries;
  }, []);
}

function getDayTone(dayEntries, dayMeta) {
  if (dayMeta.leaveLocked || dayEntries.some(({ meta }) => meta.value === 'absent')) {
    return 'danger';
  }

  if (dayMeta.doublePay || dayEntries.length) {
    return 'warning';
  }

  return 'ok';
}

function getShortEmployeeName(name = '') {
  const trimmedName = String(name).trim();
  if (!trimmedName) {
    return '';
  }

  const [firstPart] = trimmedName.split(/\s+/);
  if (firstPart.length <= 4) {
    return firstPart;
  }

  return `${firstPart.slice(0, 4)}.`;
}

export default function EmployeeHolidayPlanner() {
  const navigate = useNavigate();
  const {
    calendarDaySettings,
    employeeAvailabilityCalendar,
    employees,
    setCalendarDaySetting,
    setEmployeeAvailabilityForDate,
  } = useAppState();
  const [monthDate, setMonthDate] = useState(startOfMonth(new Date()));
  const [selectedDateKey, setSelectedDateKey] = useState(formatDateKey());
  const [isEditorOpen, setIsEditorOpen] = useState(true);
  const [notice, setNotice] = useState('');

  const calendarDays = useMemo(() => buildCalendarDays(monthDate), [monthDate]);
  const plannerEmployees = useMemo(() => employees.filter((employee) => !isManagerRole(employee.role)), [employees]);
  const selectedDateLabel = getThaiDateLabel(selectedDateKey);
  const selectedDayMeta = getCalendarDayMeta(selectedDateKey, calendarDaySettings);
  const selectedDateEntries = getDayEntries(selectedDateKey, plannerEmployees, employeeAvailabilityCalendar);

  const handleDateClick = (day) => {
    const nextDateKey = day.dateKey;
    setNotice('');
    setMonthDate(startOfMonth(day.date));

    if (selectedDateKey === nextDateKey) {
      setIsEditorOpen((currentValue) => !currentValue);
      return;
    }

    setSelectedDateKey(nextDateKey);
    setIsEditorOpen(true);
  };

  const handleChangeEmployeeStatus = (employee, status) => {
    const result = setEmployeeAvailabilityForDate(employee.id, selectedDateKey, status);
    if (result === null && leaveStatuses.has(status) && selectedDayMeta.leaveLocked) {
      setNotice(`วันที่ ${selectedDateLabel} ถูกตั้งเป็นวันหยุดไม่ได้ จึงไม่สามารถลงวันลาได้`);
      return;
    }

    if (!status) {
      setNotice(`ยกเลิกสถานะวันลาของ ${employee.name} วันที่ ${selectedDateLabel} แล้ว`);
      return;
    }

    const nextLabel = getAvailabilityActionLabel(status);
    setNotice(`ตั้ง ${employee.name} เป็น${nextLabel} วันที่ ${selectedDateLabel}`);
  };

  const handleToggleDaySetting = (settingKey) => {
    const nextValue = !selectedDayMeta[settingKey];
    setCalendarDaySetting(selectedDateKey, settingKey, nextValue);
    setNotice(
      settingKey === 'leaveLocked'
        ? `${selectedDateLabel} ${nextValue ? 'ถูกตั้งเป็นวันหยุดไม่ได้' : 'เปิดให้ลงวันหยุดได้แล้ว'}`
        : `${selectedDateLabel} ${nextValue ? 'ถูกตั้งเป็นวัน 2 แรง' : 'ยกเลิกสถานะวัน 2 แรงแล้ว'}`,
    );
  };

  return (
    <DesktopWorkspace
      title="ปฏิทินวันหยุด"
      headerActions={
        <div className="schedule-header-actions">
          <div className="schedule-date-nav">
            <button type="button" className="ghost-button" onClick={() => setMonthDate((currentValue) => addCalendarMonths(currentValue, -1))} aria-label="เดือนก่อนหน้า">
              <ChevronLeft size={16} />
            </button>
            <div className="schedule-date-display">
              <span className="date-text">
                {getThaiMonthLabel(monthDate)}
                <CalendarDays size={16} />
              </span>
            </div>
            <button type="button" className="ghost-button" onClick={() => setMonthDate((currentValue) => addCalendarMonths(currentValue, 1))} aria-label="เดือนถัดไป">
              <ChevronRight size={16} />
            </button>
            <button type="button" className="ghost-button schedule-today-button" onClick={() => { setMonthDate(startOfMonth(new Date())); setSelectedDateKey(formatDateKey()); setIsEditorOpen(true); setNotice(''); }}>
              วันนี้
            </button>
          </div>
          <button type="button" className="ghost-button" onClick={() => navigate(routePaths.desktopSchedule)}>
            กลับหน้าตาราง
          </button>
        </div>
      }
    >
      <section className="leave-planner-layout">
        <article className="panel-card employee-calendar-box leave-planner-calendar-panel">
          <div className="employee-calendar-head leave-planner-head">
            <div>
              <strong>กดวันครั้งเดียวเพื่อเลือกและจัดการพนักงาน กดซ้ำเพื่อยกเลิก</strong>
              <p>กำหนดได้ทั้งวันหยุดพนักงาน, วันหยุดไม่ได้ และวัน 2 แรง โดยชื่อกับตัวละครจะขึ้นบนช่องวันทันที</p>
            </div>
            <span className={`status-chip ${selectedDayMeta.tone}`}>{selectedDateLabel}</span>
          </div>

          <div className="employee-calendar-weekdays">
            {thaiWeekdayLabels.map((label) => <span key={label}>{label}</span>)}
          </div>

          <div className="employee-calendar-grid leave-planner-grid">
            {calendarDays.map((day) => {
              const dayEntries = getDayEntries(day.dateKey, plannerEmployees, employeeAvailabilityCalendar);
              const dayMeta = getCalendarDayMeta(day.dateKey, calendarDaySettings);
              const tone = getDayTone(dayEntries, dayMeta);
              const isSelectedDay = day.dateKey === selectedDateKey;
              const dayStatusLabel = isSelectedDay ? (isEditorOpen ? 'เลือกแล้ว' : 'ยกเลิกแล้ว') : 'เลือกวัน';

              return (
                <button
                  key={day.dateKey}
                  type="button"
                  className={`employee-calendar-day leave-planner-day ${day.isCurrentMonth ? 'in-month' : 'out-month'} ${tone} ${isSelectedDay ? 'selected' : ''} ${day.isToday ? 'today' : ''}`}
                  onClick={() => handleDateClick(day)}
                >
                  <div className="leave-planner-day-top">
                    <span className="employee-calendar-day-number">{day.date.getDate()}</span>
                    <div className="leave-planner-day-flags">
                      {dayMeta.labels.map((label) => <span key={label} className={`leave-planner-day-flag ${dayMeta.tone}`}>{label}</span>)}
                    </div>
                  </div>
                  <div className="leave-planner-day-entries">
                    {dayEntries.length ? dayEntries.map(({ employee, meta }) => (
                      <span key={employee.id} className={`leave-planner-day-person tone-${meta.tone}`} title={employee.name}>
                        <span className="avatar-mini">{employee.avatar}</span>
                        <span>{getShortEmployeeName(employee.name)}</span>
                      </span>
                    )) : <span className={`employee-calendar-day-status ${tone}`}>{dayStatusLabel}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </article>

        <aside className="panel-card employee-calendar-box leave-planner-detail-panel">
          <div className="leave-planner-detail-head">
            <div>
              <span className="employee-calendar-kicker">วันที่เลือก</span>
              <strong>{selectedDateLabel}</strong>
              <p>{isEditorOpen ? 'ตอนนี้เลือกสถานะรายคนและคุณสมบัติของวันได้แล้ว' : 'กดวันที่เดิมซ้ำอีกครั้งเพื่อยกเลิกการเลือกวันนี้'}</p>
            </div>
            <div className="leave-planner-summary-tags">
              {selectedDayMeta.labels.length ? selectedDayMeta.labels.map((label) => <span key={label} className={`leave-planner-day-flag ${selectedDayMeta.tone}`}>{label}</span>) : <span className="status-chip ok">วันปกติ</span>}
            </div>
          </div>

          <div className="employee-calendar-actions-inline leave-planner-day-actions">
            <span className="employee-calendar-kicker">คุณสมบัติของวัน</span>
            <div className="employee-calendar-action-buttons">
              <button type="button" className={selectedDayMeta.leaveLocked ? 'danger-inline' : 'ghost-button'} onClick={() => handleToggleDaySetting('leaveLocked')}>
                {selectedDayMeta.leaveLocked ? 'ยกเลิกวันหยุดไม่ได้' : 'วันนี้หยุดไม่ได้'}
              </button>
              <button type="button" className={selectedDayMeta.doublePay ? 'primary-inline' : 'ghost-button'} onClick={() => handleToggleDaySetting('doublePay')}>
                {selectedDayMeta.doublePay ? 'ยกเลิกวัน 2 แรง' : 'วัน 2 แรง'}
              </button>
            </div>
          </div>

          <div className="employee-calendar-actions-inline leave-planner-selected-list">
            <span className="employee-calendar-kicker">คนที่ตั้งสถานะไว้แล้ว</span>
            <div className="leave-planner-current-entries">
              {selectedDateEntries.length ? selectedDateEntries.map(({ employee, meta }) => (
                <span key={employee.id} className={`leave-planner-day-person tone-${meta.tone}`}>
                  <span className="avatar-mini">{employee.avatar}</span>
                  <span>{employee.name} ({employee.role})</span>
                  <span className={`chip-status-badge ${meta.tone}`}>{meta.shortLabel}</span>
                </span>
              )) : <div className="empty-card compact">ยังไม่มีคนถูกตั้งเป็นลา ลาป่วย หรือขาดในวันนี้</div>}
            </div>
          </div>

          <div className="leave-planner-employee-list">
            {plannerEmployees.map((employee) => {
              const employeeMeta = getEmployeeAvailabilityMeta(employee, selectedDateKey, employeeAvailabilityCalendar);
              return (
                <article key={employee.id} className={`leave-planner-employee-card tone-${employeeMeta.tone} ${isEditorOpen ? 'editable' : 'locked'}`}>
                  <div className="leave-planner-employee-head">
                    <span className="schedule-calendar-employee-name"><span className="avatar-mini">{employee.avatar}</span>{employee.name} ({employee.role})</span>
                    <span className={`chip-status-badge ${employeeMeta.tone}`}>{employeeMeta.label}</span>
                  </div>
                  <div className="employee-calendar-action-buttons">
                    <button type="button" className="ghost-button" disabled={!isEditorOpen} onClick={() => handleChangeEmployeeStatus(employee, null)}>ยกเลิก</button>
                    <button type="button" className="ghost-button" disabled={!isEditorOpen || selectedDayMeta.leaveLocked} onClick={() => handleChangeEmployeeStatus(employee, 'annual_leave')}>ลา</button>
                    <button type="button" className="ghost-button" disabled={!isEditorOpen || selectedDayMeta.leaveLocked} onClick={() => handleChangeEmployeeStatus(employee, 'sick_leave')}>ลาป่วย</button>
                  </div>
                </article>
              );
            })}
          </div>

          {notice ? <div className="form-success top-spaced"><span>{notice}</span></div> : null}
        </aside>
      </section>
    </DesktopWorkspace>
  );
}
