import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Copy, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import DesktopWorkspace from './DesktopWorkspace.jsx';
import { routePaths } from '../../app/routes.js';
import { formatDateKey, getEmployeeAvailabilityMeta, getTimeBlocksForDate, useAppState } from '../../app/state/AppStateContext.jsx';

function addCalendarDays(dateInput, amount = 0) {
  const nextDate = new Date(dateInput);
  nextDate.setDate(nextDate.getDate() + amount);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function getWeekStart(dateInput = new Date()) {
  const date = new Date(dateInput);
  date.setHours(0, 0, 0, 0);
  const mondayOffset = (date.getDay() + 6) % 7;
  return addCalendarDays(date, -mondayOffset);
}

function getWeekDates(weekOffset = 0) {
  const weekStart = addCalendarDays(getWeekStart(new Date()), weekOffset * 7);
  return Array.from({ length: 7 }, (_, index) => addCalendarDays(weekStart, index));
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

function formatThaiWeekLabel(dateInput) {
  return new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(dateInput);
}

function formatThaiDayLabel(dateInput) {
  return new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(dateInput);
}

function getBlockStartLabel(timeLabel = '') {
  return String(timeLabel).split('-')[0].trim();
}

function buildEmployeeStartEntries(blocks, employees, dateKey, availabilityCalendar, employeeFilter = 'all') {
  const summaryByEmployeeId = new Map();

  blocks.forEach((block) => {
    const startMinutes = getBlockStartMinutes(block.time);
    const startLabel = getBlockStartLabel(block.time);

    block.employeeIds.forEach((employeeId) => {
      if (employeeFilter !== 'all' && String(employeeId) !== String(employeeFilter)) {
        return;
      }

      const employee = employees.find((entry) => entry.id === employeeId);
      if (!employee) {
        return;
      }

      const availabilityMeta = getEmployeeAvailabilityMeta(employee, dateKey, availabilityCalendar);
      const currentEntry = summaryByEmployeeId.get(employeeId);
      if (!currentEntry) {
        summaryByEmployeeId.set(employeeId, {
          employee,
          availabilityMeta,
          startLabel,
          startMinutes,
          blockCount: 1,
        });
        return;
      }

      currentEntry.blockCount += 1;
      if (startMinutes < currentEntry.startMinutes) {
        currentEntry.startMinutes = startMinutes;
        currentEntry.startLabel = startLabel;
      }
    });
  });

  return [...summaryByEmployeeId.values()].sort((leftEntry, rightEntry) => leftEntry.startMinutes - rightEntry.startMinutes || leftEntry.employee.name.localeCompare(rightEntry.employee.name, 'th'));
}

export default function WeeklySchedulePage() {
  const { copyWeekSchedule, employeeAvailabilityCalendar, employees, timeBlocks } = useAppState();
  const [weekOffset, setWeekOffset] = useState(0);
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [notice, setNotice] = useState('');
  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const weekEntries = useMemo(() => weekDates.map((date) => {
    const dateKey = formatDateKey(date);
    const blocks = [...getTimeBlocksForDate(timeBlocks, dateKey)].sort(sortBlocksByTime);
    const startEntries = buildEmployeeStartEntries(blocks, employees, dateKey, employeeAvailabilityCalendar, employeeFilter);
    return {
      date,
      dateKey,
      label: formatThaiDayLabel(date),
      blocks,
      startEntries,
    };
  }), [employeeAvailabilityCalendar, employeeFilter, employees, timeBlocks, weekDates]);
  const totalBlocks = weekEntries.reduce((sum, day) => sum + day.blocks.length, 0);
  const totalEmployees = weekEntries.reduce((sum, day) => sum + day.startEntries.length, 0);
  const scheduledEmployees = useMemo(() => {
    const seenEmployeeIds = new Set();
    return employees.filter((employee) => {
      const hasBlock = timeBlocks.some((block) => block.employeeIds.includes(employee.id));
      if (!hasBlock || seenEmployeeIds.has(employee.id)) {
        return false;
      }
      seenEmployeeIds.add(employee.id);
      return true;
    }).sort((leftEmployee, rightEmployee) => leftEmployee.name.localeCompare(rightEmployee.name, 'th'));
  }, [employees, timeBlocks]);

  const handleCopyWeek = () => {
    const result = copyWeekSchedule(weekEntries[0]?.dateKey ?? formatDateKey());
    if (!result) {
      setNotice('สัปดาห์นี้ยังไม่มีตารางให้คัดลอก');
      return;
    }

    setWeekOffset((currentValue) => currentValue + 1);
    setNotice(`คัดลอกตาราง ${result.copiedCount} ช่วง ไปสัปดาห์ถัดไปแล้ว`);
  };

  const weekStartLabel = weekDates[0] ? formatThaiWeekLabel(weekDates[0]) : '-';
  const weekEndLabel = weekDates[6] ? formatThaiWeekLabel(weekDates[6]) : '-';

  return (
    <DesktopWorkspace
      title="เวลาเข้างาน"
      headerActions={
        <div className="schedule-header-actions">
          <div className="schedule-date-nav">
            <button type="button" className="ghost-button" onClick={() => setWeekOffset((currentValue) => currentValue - 1)} aria-label="สัปดาห์ก่อนหน้า">
              <ChevronLeft size={16} />
            </button>
            <div className="schedule-date-display">
              <span className="date-text">{weekStartLabel} - {weekEndLabel}<CalendarDays size={16} /></span>
            </div>
            <button type="button" className="ghost-button" onClick={() => setWeekOffset((currentValue) => currentValue + 1)} aria-label="สัปดาห์ถัดไป">
              <ChevronRight size={16} />
            </button>
            <button type="button" className="ghost-button schedule-today-button" onClick={() => { setWeekOffset(0); setNotice(''); }}>สัปดาห์นี้</button>
          </div>
          <button type="button" className="ghost-button" onClick={handleCopyWeek}><Copy size={16} /> คัดลอกสัปดาห์ถัดไป</button>
          <button type="button" className="ghost-button" onClick={() => navigate(routePaths.desktopSchedule)}>กลับหน้าตาราง</button>
        </div>
      }
    >
      <section className="schedule-board-note panel-card compact-page-bar">
        <div className="compact-page-lead">
          <strong>จัดตารางงานรายสัปดาห์</strong>
          <p>ดูว่าแต่ละวันพนักงานคนไหนเริ่มกี่โมง เรียงตามเวลาเช้า และแก้ไขหรือลบช่วงงานได้จากหน้านี้</p>
        </div>
        <div className="compact-page-stats">
          <span className="compact-page-stat">ช่วงงานทั้งหมด {totalBlocks}</span>
          <span className="compact-page-stat">รายชื่อที่ลงกะ {totalEmployees} คน</span>
          <span className={`compact-page-stat ${totalBlocks ? 'ok' : 'warning'}`}>{totalBlocks ? 'มีตารางงานแล้ว' : 'ยังไม่มีช่วงงาน'}</span>
        </div>
      </section>

      <section className="panel-card weekly-schedule-toolbar">
        <div>
          <strong>กรองรายพนักงาน</strong>
          <p>เลือกดูเฉพาะคนใดคนหนึ่งว่าอาทิตย์นี้เริ่มงานกี่โมง</p>
        </div>
        <div className="weekly-schedule-toolbar-controls">
          <select className="select-control" value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)}>
            <option value="all">พนักงานทั้งหมด</option>
            {scheduledEmployees.map((employee) => <option key={employee.id} value={String(employee.id)}>{employee.name} ({employee.role})</option>)}
          </select>
        </div>
      </section>

      {notice ? <div className="form-success top-spaced schedule-copy-notice"><span>{notice}</span></div> : null}

      <section className="weekly-schedule-grid">
        {weekEntries.map((day) => (
          <article key={day.dateKey} className="panel-card weekly-schedule-day-card">
            <div className="weekly-schedule-day-head">
              <div>
                <strong>{day.label}</strong>
                <p>{day.startEntries.length ? `${day.startEntries.length} คนเริ่มงานในวันนี้` : 'ยังไม่มีพนักงานเริ่มงานในวันนี้'}</p>
              </div>
              <span className={`status-chip ${day.startEntries.length ? 'ok' : 'warning'}`}>{day.startEntries.length ? 'มีเวลาเข้า' : 'ว่าง'}</span>
            </div>

            <div className="weekly-schedule-start-list">
              {day.startEntries.length ? day.startEntries.map(({ employee, availabilityMeta, startLabel, blockCount }) => (
                <div key={`${day.dateKey}-${employee.id}`} className={`weekly-schedule-start-card tone-${availabilityMeta.tone}`}>
                  <div className="weekly-schedule-start-main">
                    <span className="avatar-mini">{employee.avatar}</span>
                    <div className="weekly-schedule-start-copy">
                      <strong>{employee.name} ({employee.role})</strong>
                      <span>{blockCount > 1 ? `มี ${blockCount} ช่วงงาน` : 'มี 1 ช่วงงาน'}</span>
                    </div>
                  </div>
                  <span className={`weekly-schedule-start-time ${getBlockStartMinutes(startLabel) <= 480 ? 'ok' : 'warning'}`}>เข้า {startLabel}</span>
                </div>
              )) : <div className="empty-card compact">ไม่มีเวลาเข้างานในวันนี้{employeeFilter !== 'all' ? 'สำหรับพนักงานที่เลือก' : ''}</div>}
            </div>

            <div className="weekly-schedule-day-footer">
              <Link className="primary-inline" to={routePaths.manageScheduleBlock} state={{ selectedDateKey: day.dateKey, returnTo: routePaths.weeklySchedule }}><Plus size={14} /> เพิ่มช่วงงาน</Link>
            </div>
          </article>
        ))}
      </section>
    </DesktopWorkspace>
  );
}