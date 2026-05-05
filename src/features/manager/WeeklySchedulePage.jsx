import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Copy, PencilLine, Plus, Save, Trash2, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import DesktopWorkspace from './DesktopWorkspace.jsx';
import { DeleteTimeWindowConfirm } from './ModalScreens.jsx';
import { routePaths } from '../../app/routes.js';
import { buildBlockTimeLabel, formatDateKey, getBlockEndLabel, getBlockRoundLabel, getBlockStartLabel, getTimeBlocksForDate, scheduleShiftPresets, useAppState } from '../../app/state/AppStateContext.jsx';

const schedulePresetByKey = new Map(scheduleShiftPresets.map((preset) => [preset.key, preset]));

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

function getBlockEndMinutes(timeLabel = '') {
  const segments = String(timeLabel).split('-');
  const lastSegment = (segments[1] ?? segments[0] ?? '').trim();
  const [hoursText, minutesText = '0'] = lastSegment.split(':');
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? (hours * 60) + minutes : 0;
}

function formatMinutesAsClock(totalMinutes = 0) {
  const normalizedMinutes = Math.max(0, Number(totalMinutes) || 0);
  const hours = Math.floor(normalizedMinutes / 60);
  const minutes = normalizedMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function normalizeSearchValue(value = '') {
  return String(value).trim().toLowerCase().replace(/\s+/g, '');
}

function sortBlocksByTime(leftBlock, rightBlock) {
  return getBlockStartMinutes(leftBlock.time) - getBlockStartMinutes(rightBlock.time);
}

function getWeeklyWindowKey(block = {}) {
  const presetKey = String(block?.roundPresetKey ?? '').trim();
  if (presetKey && presetKey !== 'custom') {
    return presetKey;
  }

  const roundLabel = normalizeSearchValue(getBlockRoundLabel(block));
  if (roundLabel.includes('กะสาย') || roundLabel.includes('รอบสาย') || roundLabel.includes('กะเย็น') || roundLabel.includes('รอบเย็น')) {
    return 'late';
  }

  return 'morning';
}

function buildAttendanceWindow(blocks = [], groupKey = '') {
  if (!blocks.length) {
    return {
      timeLabel: '-',
      workingWindow: '-',
    };
  }

  const preset = schedulePresetByKey.get(groupKey);
  if (preset) {
    const timeLabel = buildBlockTimeLabel(preset.startTime, preset.endTime);
    return {
      timeLabel,
      workingWindow: `เข้า ${preset.startTime} · เลิก ${preset.endTime}`,
    };
  }

  const startMinutes = blocks.reduce((earliestMinutes, block) => {
    const blockMinutes = getBlockStartMinutes(getBlockStartLabel(block));
    return Math.min(earliestMinutes, blockMinutes);
  }, Number.POSITIVE_INFINITY);
  const endMinutes = blocks.reduce((latestMinutes, block) => {
    const blockMinutes = getBlockEndMinutes(getBlockEndLabel(block));
    return Math.max(latestMinutes, blockMinutes);
  }, 0);

  const startTime = Number.isFinite(startMinutes) ? formatMinutesAsClock(startMinutes) : '';
  const endTime = endMinutes > 0 ? formatMinutesAsClock(endMinutes) : '';
  const timeLabel = buildBlockTimeLabel(startTime, endTime) || blocks[0]?.time || '-';

  return {
    timeLabel,
    workingWindow: startTime && endTime ? `เข้า ${startTime} · เลิก ${endTime}` : timeLabel,
  };
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

function getAttendanceStatusLabel(assignedCount) {
  return assignedCount ? `ลงงาน ${assignedCount} คน` : 'ยังไม่มีคนลงงาน';
}

export default function WeeklySchedulePage() {
  const navigate = useNavigate();
  const { copyWeekSchedule, deleteTimeWindow, employeeAttendanceWindows, employees, getScheduleAttendanceSyncSummary, removeEmployeeFromAttendanceWindow, syncScheduleAssignmentsWithAttendance, timeBlocks } = useAppState();
  const [weekOffset, setWeekOffset] = useState(0);
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [notice, setNotice] = useState('');
  const [pendingDeleteWindow, setPendingDeleteWindow] = useState(null);

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const weekEntries = useMemo(() => weekDates.map((date) => {
    const dateKey = formatDateKey(date);
    const allBlocks = [...getTimeBlocksForDate(timeBlocks, dateKey)].sort(sortBlocksByTime);
    const blocks = allBlocks;

    const groupedBlocks = blocks.reduce((groups, block) => {
      const groupKey = getWeeklyWindowKey(block);
      const preset = schedulePresetByKey.get(groupKey);
      const currentGroup = groups.get(groupKey) ?? {
        groupKey,
        summaryLabel: 'ช่วงเวลาเข้างาน',
        blocks: [],
      };

      currentGroup.blocks.push(block);
      groups.set(groupKey, currentGroup);
      return groups;
    }, new Map());

    const roundEntries = [...groupedBlocks.values()]
      .map((group) => {
        const groupedTimeBlocks = [...group.blocks].sort(sortBlocksByTime);
        const attendanceWindow = employeeAttendanceWindows?.[dateKey]?.[group.groupKey] ?? null;
        const allAssignedEmployees = (attendanceWindow?.employeeIds ?? [])
          .map((employeeId) => employees.find((entry) => String(entry.id) === String(employeeId)))
          .filter(Boolean);
        const assignedEmployees = employeeFilter === 'all'
          ? allAssignedEmployees
          : allAssignedEmployees.filter((employee) => String(employee.id) === String(employeeFilter));
        const assignedCount = assignedEmployees.length;
        const { timeLabel, workingWindow } = buildAttendanceWindow(groupedTimeBlocks, group.groupKey);

        return {
          groupKey: group.groupKey,
          blockIds: groupedTimeBlocks.map((block) => block.id),
          primaryBlockId: groupedTimeBlocks[0]?.id ?? null,
          groupedBlockCount: groupedTimeBlocks.length,
          summaryLabel: group.summaryLabel,
          timeLabel,
          workingWindow,
          assignedEmployees,
          assignedCount,
          status: assignedCount ? 'ok' : 'danger',
        };
      })
      .sort((leftEntry, rightEntry) => getBlockStartMinutes(leftEntry.timeLabel) - getBlockStartMinutes(rightEntry.timeLabel));

    return {
      date,
      dateKey,
      label: formatThaiDayLabel(date),
      rounds: roundEntries,
    };
  }), [employeeAttendanceWindows, employeeFilter, employees, timeBlocks, weekDates]);

  const visibleRounds = weekEntries.flatMap((day) => day.rounds);
  const totalRounds = visibleRounds.length;
  const emptyRounds = visibleRounds.filter((entry) => entry.assignedCount === 0).length;
  const attendanceSyncSummary = getScheduleAttendanceSyncSummary();
  const hasPendingAttendanceSync = attendanceSyncSummary.removedCount > 0;
  const scheduledEmployeeCount = new Set(visibleRounds.flatMap((entry) => entry.assignedEmployees.map((employee) => employee.id))).size;
  const scheduledEmployees = useMemo(() => {
    const visibleEmployeeIds = new Set(visibleRounds.flatMap((entry) => entry.assignedEmployees.map((employee) => employee.id)));
    return employees
      .filter((employee) => visibleEmployeeIds.has(employee.id))
      .sort((leftEmployee, rightEmployee) => leftEmployee.name.localeCompare(rightEmployee.name, 'th'));
  }, [employees, visibleRounds]);

  const handleCopyDay = () => {
    const result = copyWeekSchedule(weekEntries[0]?.dateKey ?? formatDateKey(), 1);
    if (!result) {
      setNotice('สัปดาห์นี้ยังไม่มีกะงานให้คัดลอก');
      return;
    }

    setNotice(`คัดลอกกะงาน ${result.copiedCount} กะ ไปวันถัดไปแล้ว`);
  };

  const handleSaveAttendance = () => {
    const result = syncScheduleAssignmentsWithAttendance();
    if (!result) {
      setNotice('บันทึกเวลาเข้างานแล้ว');
      return;
    }

    if (result.removedCount) {
      setNotice(`บันทึกเวลาเข้างานแล้ว และอัปเดตตารางงาน ${result.updatedBlockCount} ช่วง ลบพนักงานที่ไม่ตรงเวลาเข้างานออก ${result.removedCount} รายการ`);
      return;
    }

    setNotice('บันทึกเวลาเข้างานแล้ว');
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
          <button type="button" className="ghost-button" onClick={handleCopyDay}><Copy size={16} /> คัดลอกวันถัดไป</button>
          <button
            type="button"
            className={hasPendingAttendanceSync ? 'primary-inline' : 'ghost-button text-success'}
            onClick={handleSaveAttendance}
          >
            <Save size={16} />
            บันทึกเวลาเข้างาน
            {hasPendingAttendanceSync ? <span className="action-badge">{attendanceSyncSummary.removedCount}</span> : null}
          </button>
          <button type="button" className="ghost-button" onClick={() => navigate(routePaths.desktopSchedule)}>กลับหน้าตาราง</button>
        </div>
      }
    >
      <section className="schedule-board-note panel-card compact-page-bar">
        <div className="compact-page-lead">
          <strong>ดูเวลาเข้างานรายสัปดาห์</strong>
          <p>สรุปเฉพาะเวลาเข้า-เลิกของแต่ละช่วง และดูรายชื่อพนักงานที่เข้างานในเวลานั้นได้ทันที</p>
        </div>
        <div className="compact-page-stats">
          <span className="compact-page-stat">ช่วงเข้างานทั้งหมด {totalRounds}</span>
          <span className="compact-page-stat">พนักงานที่มีเวลาเข้างาน {scheduledEmployeeCount} คน</span>
          <span className={`compact-page-stat ${emptyRounds ? 'danger' : 'ok'}`}>{emptyRounds ? `ยังไม่มีคน ${emptyRounds} ช่วง` : 'มีคนลงครบทุกช่วง'}</span>
        </div>
      </section>

      <section className="panel-card weekly-schedule-toolbar">
        <div>
          <strong>กรองรายพนักงาน</strong>
          <p>เลือกดูเฉพาะคนใดคนหนึ่งว่าอาทิตย์นี้ถูกจัดไว้ในช่วงเวลาเข้างานใดบ้าง</p>
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
          const dayEmptyCount = day.rounds.filter((entry) => entry.assignedCount === 0).length;
          const dayStatusClass = !day.rounds.length ? 'warning' : dayEmptyCount ? 'danger' : 'ok';
          const dayStatusLabel = !day.rounds.length ? 'ยังไม่จัดกะงาน' : dayEmptyCount ? `ยังไม่มีคน ${dayEmptyCount} ช่วง` : 'มีคนลงครบ';

          return (
            <article key={day.dateKey} className="panel-card weekly-schedule-day-card">
              <div className="weekly-schedule-day-head">
                <div>
                  <strong>{day.label}</strong>
                  <p>{day.rounds.length ? `${day.rounds.length} ช่วงเวลาเข้างานในวันนี้` : employeeFilter !== 'all' ? 'ไม่มีเวลาเข้างานของพนักงานที่เลือก' : 'ยังไม่กำหนดเวลาเข้างานในวันนี้'}</p>
                </div>
                <span className={`status-chip ${dayStatusClass}`}>{dayStatusLabel}</span>
              </div>

              <div className="weekly-schedule-start-list">
                {day.rounds.length ? day.rounds.map(({ assignedEmployees, assignedCount, blockIds, groupKey, groupedBlockCount, primaryBlockId, summaryLabel, status, timeLabel, workingWindow }) => (
                  <div key={`${day.dateKey}-${summaryLabel}-${timeLabel}`} className={`weekly-schedule-round-card ${status}`}>
                    <div className="weekly-schedule-round-head">
                      <div>
                        <strong>{timeLabel}</strong>
                        <p>{workingWindow}</p>
                      </div>
                      <span className={`weekly-schedule-start-time ${status === 'ok' ? '' : status}`.trim()}>{getAttendanceStatusLabel(assignedCount)}</span>
                    </div>
                    <div className="weekly-schedule-round-meta">
                      <span>{summaryLabel}</span>
                      <span>พนักงาน {assignedCount} คน</span>
                      <span>รวม {groupedBlockCount} ช่วงงานย่อย</span>
                    </div>
                    <div className={`weekly-schedule-round-employees ${assignedEmployees.length ? '' : 'empty'}`.trim()}>
                      {assignedEmployees.length
                        ? assignedEmployees.map((employee) => (
                          <button
                            key={`${blockIds[0]}-${employee.id}`}
                            type="button"
                            className="weekly-schedule-employee-chip"
                            onClick={() => {
                              const removedEntry = removeEmployeeFromAttendanceWindow(day.dateKey, groupKey, employee.id);
                              if (!removedEntry?.employee) {
                                return;
                              }

                              setNotice(`นำ ${removedEntry.employee.name} ออกจากเวลาเข้างาน ${timeLabel} แล้ว`);
                            }}
                          >
                            <span>{employee.name}</span>
                            <X size={12} />
                          </button>
                        ))
                        : <span>ยังไม่มีคนลงช่วงเวลานี้</span>}
                    </div>
                    <div className="weekly-schedule-round-actions">
                      <Link className="schedule-inline-link" to={routePaths.addEmployee} state={{ blockId: primaryBlockId, blockIds, returnTo: routePaths.weeklySchedule, selectedDateKey: day.dateKey, roundLabel: '', timeLabel, windowLabel: groupedBlockCount > 1 ? `ใช้กับ ${groupedBlockCount} ช่วงงานในตาราง` : 'ใช้กับ 1 ช่วงงานในตาราง' }}><Plus size={14} /> เพิ่มพนักงาน</Link>
                      <Link className="schedule-inline-link" to={routePaths.manageScheduleBlock} state={{ blockId: primaryBlockId, returnTo: routePaths.weeklySchedule, selectedDateKey: day.dateKey }}><PencilLine size={14} /> แก้ไข</Link>
                      <button type="button" className="schedule-inline-link" onClick={() => setPendingDeleteWindow({ dayLabel: day.label, summaryLabel, timeLabel, blockIds, groupedBlockCount, employeeNames: assignedEmployees.map((employee) => employee.name) })}><Trash2 size={14} /> ลบช่วงงาน</button>
                    </div>
                  </div>
                )) : <div className="empty-card compact">{employeeFilter !== 'all' ? 'ไม่มีเวลาเข้างานสำหรับพนักงานที่เลือก' : 'ยังไม่กำหนดเวลาเข้างานในวันนี้'}</div>}
              </div>

              <div className="weekly-schedule-day-footer">
                <Link className="primary-inline" to={routePaths.manageScheduleBlock} state={{ selectedDateKey: day.dateKey, returnTo: routePaths.weeklySchedule }}><Plus size={14} /> เพิ่มเวลาเข้างาน</Link>
              </div>
            </article>
          );
        })}
      </section>
      {pendingDeleteWindow ? (
        <div className="weekly-schedule-dialog-backdrop">
          <DeleteTimeWindowConfirm
            dayLabel={pendingDeleteWindow.dayLabel}
            roundLabel={pendingDeleteWindow.summaryLabel}
            timeLabel={pendingDeleteWindow.timeLabel}
            employeeNames={pendingDeleteWindow.employeeNames}
            groupedBlockCount={pendingDeleteWindow.groupedBlockCount}
            onCancel={() => setPendingDeleteWindow(null)}
            onConfirm={() => {
              const deletedWindow = deleteTimeWindow(pendingDeleteWindow.blockIds, {
                roundLabel: pendingDeleteWindow.roundLabel,
                time: pendingDeleteWindow.timeLabel,
              });
              if (!deletedWindow) {
                return '';
              }

              setNotice(`ลบเวลาเข้างาน ${deletedWindow.time} แล้ว (${deletedWindow.deletedCount} ช่วงงานย่อย)`);
              return `ลบเวลาเข้างาน ${pendingDeleteWindow.timeLabel} ของ${pendingDeleteWindow.dayLabel} แล้ว`;
            }}
          />
        </div>
      ) : null}
    </DesktopWorkspace>
  );
}