import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Copy, PencilLine, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import DesktopWorkspace from './DesktopWorkspace.jsx';
import { routePaths } from '../../app/routes.js';
import { computeBlockStatus, formatDateKey, getBlockEndLabel, getBlockRoundLabel, getBlockStartLabel, getTimeBlocksForDate, useAppState } from '../../app/state/AppStateContext.jsx';

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

function getBlockStatusLabel(required, assigned) {
  const shortage = Math.max(required - assigned, 0);
  if (!required) {
    return 'ยังไม่กำหนดคน';
  }
  if (!shortage) {
    return 'ครบแล้ว';
  }
  return `ขาด ${shortage} คน`;
}

function getRoundWorkingWindow(block) {
  const startLabel = getBlockStartLabel(block);
  const endLabel = getBlockEndLabel(block);
  if (startLabel && endLabel) {
    return `เข้า ${startLabel} · เลิก ${endLabel}`;
  }
  if (startLabel) {
    return `เข้า ${startLabel}`;
  }
  return block.time || '-';
}

export default function WeeklySchedulePage() {
  const navigate = useNavigate();
  const { copyWeekSchedule, employees, timeBlocks } = useAppState();
  const [weekOffset, setWeekOffset] = useState(0);
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [notice, setNotice] = useState('');

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const weekEntries = useMemo(() => weekDates.map((date) => {
    const dateKey = formatDateKey(date);
    const allBlocks = [...getTimeBlocksForDate(timeBlocks, dateKey)].sort(sortBlocksByTime);
    const blocks = employeeFilter === 'all'
      ? allBlocks
      : allBlocks.filter((block) => block.employeeIds.includes(Number(employeeFilter)) || block.employeeIds.includes(employeeFilter));

    const roundEntries = blocks.map((block) => {
      const assignedEmployees = block.employeeIds
        .map((employeeId) => employees.find((employee) => String(employee.id) === String(employeeId)))
        .filter(Boolean);
      const assignedCount = assignedEmployees.length;
      const status = computeBlockStatus(block.required, assignedCount);

      return {
        block,
        assignedEmployees,
        assignedCount,
        shortage: Math.max(block.required - assignedCount, 0),
        status,
      };
    });

    return {
      date,
      dateKey,
      label: formatThaiDayLabel(date),
      rounds: roundEntries,
    };
  }), [employeeFilter, employees, timeBlocks, weekDates]);

  const visibleRounds = weekEntries.flatMap((day) => day.rounds);
  const totalRounds = visibleRounds.length;
  const shortageRounds = visibleRounds.filter((entry) => entry.shortage > 0).length;
  const filledRounds = totalRounds - shortageRounds;
  const scheduledEmployeeCount = new Set(visibleRounds.flatMap((entry) => entry.assignedEmployees.map((employee) => employee.id))).size;
  const scheduledEmployees = useMemo(() => {
    const visibleEmployeeIds = new Set(visibleRounds.flatMap((entry) => entry.assignedEmployees.map((employee) => employee.id)));
    return employees
      .filter((employee) => visibleEmployeeIds.has(employee.id))
      .sort((leftEmployee, rightEmployee) => leftEmployee.name.localeCompare(rightEmployee.name, 'th'));
  }, [employees, visibleRounds]);

  const handleCopyWeek = () => {
    const result = copyWeekSchedule(weekEntries[0]?.dateKey ?? formatDateKey());
    if (!result) {
      setNotice('สัปดาห์นี้ยังไม่มีรอบงานให้คัดลอก');
      return;
    }

    setWeekOffset((currentValue) => currentValue + 1);
    setNotice(`คัดลอกรอบงาน ${result.copiedCount} รอบ ไปสัปดาห์ถัดไปแล้ว`);
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
          <strong>จัดตารางงานรายสัปดาห์ตามรอบงาน</strong>
          <p>ดูว่าแต่ละวันมีรอบเช้า รอบสาย หรือรอบกำหนดเองกี่รอบ และรอบไหนยังขาดคนก่อนกลับไปจัดในตารางหลัก</p>
        </div>
        <div className="compact-page-stats">
          <span className="compact-page-stat">รอบงานทั้งหมด {totalRounds}</span>
          <span className="compact-page-stat">พนักงานที่ลงงาน {scheduledEmployeeCount} คน</span>
          <span className={`compact-page-stat ${shortageRounds ? 'danger' : 'ok'}`}>{shortageRounds ? `รอบที่ขาดคน ${shortageRounds} รอบ` : `จัดครบแล้ว ${filledRounds} รอบ`}</span>
        </div>
      </section>

      <section className="panel-card weekly-schedule-toolbar">
        <div>
          <strong>กรองรายพนักงาน</strong>
          <p>เลือกดูเฉพาะคนใดคนหนึ่งว่าอาทิตย์นี้ถูกจัดไว้ในรอบงานใดบ้าง</p>
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
        {weekEntries.map((day) => {
          const dayShortageCount = day.rounds.filter((entry) => entry.shortage > 0).length;
          const dayStatusClass = !day.rounds.length ? 'warning' : dayShortageCount ? 'danger' : 'ok';
          const dayStatusLabel = !day.rounds.length ? 'ยังไม่จัดรอบงาน' : dayShortageCount ? `ขาด ${dayShortageCount} รอบ` : 'ครบแล้ว';

          return (
            <article key={day.dateKey} className="panel-card weekly-schedule-day-card">
              <div className="weekly-schedule-day-head">
                <div>
                  <strong>{day.label}</strong>
                  <p>{day.rounds.length ? `${day.rounds.length} รอบงานในวันนี้` : employeeFilter !== 'all' ? 'ไม่มีรอบงานของพนักงานที่เลือก' : 'ยังไม่จัดรอบงานในวันนี้'}</p>
                </div>
                <span className={`status-chip ${dayStatusClass}`}>{dayStatusLabel}</span>
              </div>

              <div className="weekly-schedule-start-list">
                {day.rounds.length ? day.rounds.map(({ block, assignedEmployees, assignedCount, shortage, status }) => (
                  <div key={block.id} className={`weekly-schedule-round-card ${status}`}>
                    <div className="weekly-schedule-round-head">
                      <div>
                        <strong>{getBlockRoundLabel(block)}</strong>
                        <p>{block.time}</p>
                      </div>
                      <span className={`weekly-schedule-start-time ${status === 'ok' ? '' : status}`.trim()}>{getBlockStatusLabel(block.required, assignedCount)}</span>
                    </div>
                    <div className="weekly-schedule-round-meta">
                      <span>ต้องการ {block.required} คน</span>
                      <span>จัดแล้ว {assignedCount} คน</span>
                      <span>{getRoundWorkingWindow(block)}</span>
                    </div>
                    <div className="weekly-schedule-round-duty">
                      <strong>ชื่องาน / หน้าที่</strong>
                      <p>{block.title}</p>
                    </div>
                    <div className={`weekly-schedule-round-employees ${assignedEmployees.length ? '' : 'empty'}`.trim()}>
                      {assignedEmployees.length
                        ? assignedEmployees.map((employee) => <span key={`${block.id}-${employee.id}`}>{employee.name}</span>)
                        : <span>{shortage ? 'ยังไม่มีคนลงรอบนี้' : 'รอบนี้ยังไม่มีรายชื่อพนักงาน'}</span>}
                    </div>
                    <div className="weekly-schedule-round-actions">
                      <Link className="schedule-inline-link" to={routePaths.manageScheduleBlock} state={{ blockId: block.id, returnTo: routePaths.weeklySchedule, selectedDateKey: day.dateKey }}><PencilLine size={14} /> แก้ไขรอบงาน</Link>
                    </div>
                  </div>
                )) : <div className="empty-card compact">{employeeFilter !== 'all' ? 'ไม่มีรอบงานสำหรับพนักงานที่เลือก' : 'ยังไม่จัดรอบงานในวันนี้'}</div>}
              </div>

              <div className="weekly-schedule-day-footer">
                <Link className="primary-inline" to={routePaths.manageScheduleBlock} state={{ selectedDateKey: day.dateKey, returnTo: routePaths.weeklySchedule }}><Plus size={14} /> เพิ่มรอบงาน</Link>
              </div>
            </article>
          );
        })}
      </section>
    </DesktopWorkspace>
  );
}