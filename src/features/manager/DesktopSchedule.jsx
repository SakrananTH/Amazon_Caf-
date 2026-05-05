import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Copy, PencilLine, Plus, TriangleAlert } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import DesktopWorkspace from './DesktopWorkspace.jsx';
import EmployeeChip from '../shared/EmployeeChip.jsx';
import { routePaths } from '../../app/routes.js';
import { computeBlockStatus, formatDateKey, getEmployeeAvailabilityMeta, getTimeBlocksForDate, isEmployeeEligibleForScheduleBlock, isEmployeeScheduleEligible } from '../../app/state/AppStateContext.jsx';

function getRoundStatusLabel(required, assigned) {
  const shortage = Math.max(required - assigned, 0);
  if (!required) {
    return 'ยังไม่กำหนดคน';
  }
  if (!shortage) {
    return 'ครบแล้ว';
  }
  return `ขาด ${shortage} คน`;
}

export default function DesktopSchedule({ blocks, employees, employeeAttendanceWindows, employeeAvailabilityCalendar, moveEmployeeToBlock, autoAssignEmployeesToBlock, copyDaySchedule }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [dayOffset, setDayOffset] = useState(0);
  const [dragState, setDragState] = useState(null);
  const [copyNotice, setCopyNotice] = useState('');

  useEffect(() => {
    const selectedDateKey = location.state?.selectedDateKey;
    if (!selectedDateKey) {
      return;
    }

    setCopyNotice('');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [year, month, day] = String(selectedDateKey).split('-').map(Number);
    const nextDate = new Date(year, (month ?? 1) - 1, day ?? 1);
    nextDate.setHours(0, 0, 0, 0);
    setDayOffset(Math.round((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  }, [location.state]);

  const findEmployee = (id) => employees.find((employee) => employee.id === id);
  const boardDate = useMemo(() => {
    const nextDate = new Date();
    nextDate.setHours(0, 0, 0, 0);
    nextDate.setDate(nextDate.getDate() + dayOffset);
    return nextDate;
  }, [dayOffset]);
  const boardDateKey = useMemo(() => formatDateKey(boardDate), [boardDate]);
  const dateBlocks = useMemo(() => getTimeBlocksForDate(blocks, boardDateKey), [blocks, boardDateKey]);
  const getAvailabilityMeta = (employee) => getEmployeeAvailabilityMeta(employee, boardDateKey, employeeAvailabilityCalendar);
  const isAssignableOnBoardDate = (employee) => isEmployeeScheduleEligible(employee, boardDateKey, employeeAvailabilityCalendar);
  const totalRequired = dateBlocks.reduce((sum, block) => sum + block.required, 0);
  const totalAssigned = dateBlocks.reduce((sum, block) => sum + block.employeeIds.filter((employeeId) => isAssignableOnBoardDate(findEmployee(employeeId))).length, 0);
  const shortageBlocks = dateBlocks.filter((block) => computeBlockStatus(block.required, block.employeeIds.filter((employeeId) => isAssignableOnBoardDate(findEmployee(employeeId))).length) !== 'ok');
  const activeEmployees = new Set(dateBlocks.flatMap((block) => block.employeeIds.filter((employeeId) => isAssignableOnBoardDate(findEmployee(employeeId))))).size;
  const readyEmployees = employees.filter((employee) => isAssignableOnBoardDate(employee));
  const annualLeaveEmployees = employees.filter((employee) => getAvailabilityMeta(employee).value === 'annual_leave');
  const personalLeaveEmployees = employees.filter((employee) => getAvailabilityMeta(employee).value === 'personal_leave');
  const sickLeaveEmployees = employees.filter((employee) => getAvailabilityMeta(employee).value === 'sick_leave');
  const absentEmployees = employees.filter((employee) => getAvailabilityMeta(employee).value === 'absent');
  const formattedBoardDate = new Intl.DateTimeFormat('th-TH', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(boardDate);
  const coverageRate = totalRequired ? Math.round((totalAssigned / totalRequired) * 100) : 0;

  const shiftBoardDate = (amount) => {
    setCopyNotice('');
    setDayOffset((currentValue) => currentValue + amount);
  };

  const handleCopyWeek = () => {
    const result = copyDaySchedule?.(boardDateKey);
    if (!result) {
      setCopyNotice('วันนี้ยังไม่มีตารางให้คัดลอก');
      return;
    }

    setDayOffset((currentValue) => currentValue + 1);
    setCopyNotice(`คัดลอกตาราง ${result.copiedCount} กะ ไปวันถัดไปแล้ว`);
  };

  return (
    <DesktopWorkspace
      title="ตารางงาน"
      headerActions={
        <div className="schedule-header-actions">
          <div className="schedule-date-nav">
            <button type="button" className="ghost-button" onClick={() => shiftBoardDate(-1)} aria-label="วันก่อนหน้า">
              <ChevronLeft size={16} />
            </button>
            <div className="schedule-date-display">
              <span className="date-text">
                {formattedBoardDate}
                <CalendarDays size={16} />
              </span>
            </div>
            <button type="button" className="ghost-button" onClick={() => shiftBoardDate(1)} aria-label="วันถัดไป">
              <ChevronRight size={16} />
            </button>
            <button type="button" className="ghost-button schedule-today-button" onClick={() => { setCopyNotice(''); setDayOffset(0); }}>
              วันนี้
            </button>
          </div>
          <button type="button" className="ghost-button" onClick={() => navigate(routePaths.leavePlanner)}>
            ปฏิทินวันหยุด
          </button>
          <button type="button" className="ghost-button" onClick={() => navigate(routePaths.weeklySchedule)}>
            เวลาเข้างาน
          </button>
          <button type="button" className="ghost-button" onClick={handleCopyWeek}>
            <Copy size={16} /> คัดลอกวันถัดไป
          </button>
          <button type="button" className="primary-inline" onClick={() => navigate(routePaths.manageScheduleBlock, { state: { returnTo: routePaths.desktopSchedule, selectedDateKey: boardDateKey } })}>
            <Plus size={16} /> เพิ่มกะงาน
          </button>
        </div>
      }
    >
      <section className="schedule-board-container">
        {copyNotice ? <div className="form-success schedule-copy-notice"><span>{copyNotice}</span></div> : null}

        <div className="schedule-board-note panel-card compact-page-bar">
          <div className="compact-page-lead">
            <strong>จัดการตารางตามกะงาน</strong>
            <p>แต่ละวันแบ่งเป็นหลายช่วงงานตามเวลาเดิม และลงคนได้เฉพาะผู้ที่มีเวลาเข้างานครอบคลุมช่วงนั้นเท่านั้น</p>
          </div>
          <div className="compact-page-stats">
            <span className="compact-page-stat">Coverage {coverageRate}%</span>
            <span className="compact-page-stat">พร้อมลงกะ {readyEmployees.length} / {employees.length} คน</span>
            <span className="compact-page-stat">ใช้งานจริง {activeEmployees} คน</span>
            <span className={`compact-page-stat ${annualLeaveEmployees.length ? 'warning' : ''}`}>ลา {annualLeaveEmployees.length} คน</span>
            <span className={`compact-page-stat ${personalLeaveEmployees.length ? 'warning' : ''}`}>ลากิจ {personalLeaveEmployees.length} คน</span>
            <span className={`compact-page-stat ${sickLeaveEmployees.length ? 'warning' : ''}`}>ลาป่วย {sickLeaveEmployees.length} คน</span>
            <span className={`compact-page-stat ${absentEmployees.length ? 'danger' : ''}`}>ขาด {absentEmployees.length} คน</span>
            <span className={`compact-page-stat ${shortageBlocks.length ? 'danger' : 'ok'}`}>{shortageBlocks.length ? `ขาด ${shortageBlocks.length} กะ` : 'ครบทุกกะ'}</span>
          </div>
        </div>

        <div className="schedule-helper-inline">
          <span>ลากชื่อพนักงานเพื่อย้ายกะได้ทันที</span>
          <span>ปุ่มเพิ่มอัตโนมัติจะเลือกเฉพาะคนที่พร้อมลงกะ และเรียงตามบทบาทงานก่อน</span>
        </div>

        <div className="board-horizontal-scroll">
          {dateBlocks.map((block) => {
            const assignedEmployees = block.employeeIds.map((id) => findEmployee(id)).filter(Boolean);
            const assigned = assignedEmployees.filter((employee) => isAssignableOnBoardDate(employee)).length;
            const scheduled = assignedEmployees.length;
            const required = block.required;
            const status = computeBlockStatus(required, assigned);
            const shortage = Math.max(required - assigned, 0);
            const annualLeaveCount = assignedEmployees.filter((employee) => getAvailabilityMeta(employee).value === 'annual_leave').length;
            const personalLeaveCount = assignedEmployees.filter((employee) => getAvailabilityMeta(employee).value === 'personal_leave').length;
            const sickLeaveCount = assignedEmployees.filter((employee) => getAvailabilityMeta(employee).value === 'sick_leave').length;
            const absentCount = assignedEmployees.filter((employee) => getAvailabilityMeta(employee).value === 'absent').length;
            const availableForAuto = employees.filter((employee) => isEmployeeEligibleForScheduleBlock(employee, block, employeeAttendanceWindows, employeeAvailabilityCalendar) && !block.employeeIds.includes(employee.id)).length;
            const isDanger = status === 'danger';
            const isWarning = status === 'warning';
            const StatusIcon = isDanger ? AlertCircle : isWarning ? TriangleAlert : CheckCircle2;
            const isDropTarget = dragState?.targetBlockId === block.id;
            return (
              <article key={block.id} className={`column schedule-col ${status}`}>
                <div className="col-header">
                  <div className="col-time-row">
                    <h3 className={`col-time ${isDanger ? 'text-danger' : ''}`}>{block.time}</h3>
                    <span className={`status-chip ${status}`}>
                      {getRoundStatusLabel(required, assigned)}
                    </span>
                  </div>
                  <div className="col-time-meta">ช่วงงานในตาราง</div>
                  <h4 className="col-title">{block.title}</h4>
                  <div className="col-status-row">
                    <div className="col-req-text">ต้องมี {required} คน</div>
                    <StatusIcon size={16} className={isDanger ? 'icon-danger' : isWarning ? 'icon-warning' : 'icon-success'} />
                  </div>
                  <div className="col-curr-text">จัดแล้ว {assigned} คน • วางชื่อ {scheduled} คน{shortage ? ` • ขาดอีก ${shortage} คน` : ''}</div>
                  {annualLeaveCount || personalLeaveCount || sickLeaveCount || absentCount ? <div className="schedule-attendance-summary">ลา {annualLeaveCount} • กิจ {personalLeaveCount} • ป่วย {sickLeaveCount} • ขาด {absentCount}</div> : null}
                  <button type="button" className="schedule-inline-link" onClick={() => navigate(routePaths.manageScheduleBlock, { state: { blockId: block.id, returnTo: routePaths.desktopSchedule, selectedDateKey: boardDateKey } })}>
                    <PencilLine size={14} /> แก้ไขกะงาน
                  </button>
                </div>

                <div className="col-body">
                  <div className="task-section">
                    <p className="section-label">หน้าที่ในกะ</p>
                    <ul className="task-list">
                      {block.tasks.map((task) => <li key={task}>{task}</li>)}
                    </ul>
                  </div>

                  <div className="employee-section">
                    <div className="section-head-inline">
                      <p className="section-label">พนักงานในกะ</p>
                      <span className="section-hint">คลิกชื่อเพื่อนำออก</span>
                    </div>

                    <div className={`employee-list schedule-employee-list ${isDropTarget ? 'is-drop-target' : ''}`} onDragOver={(event) => {
                      event.preventDefault();
                      if (dragState?.sourceBlockId !== block.id) {
                        setDragState((currentState) => currentState ? { ...currentState, targetBlockId: block.id } : currentState);
                      }
                    }} onDragLeave={() => {
                      if (dragState?.targetBlockId === block.id) {
                        setDragState((currentState) => currentState ? { ...currentState, targetBlockId: null } : currentState);
                      }
                    }} onDrop={(event) => {
                      event.preventDefault();
                      if (dragState?.sourceBlockId && dragState.employeeId) {
                        moveEmployeeToBlock(dragState.sourceBlockId, block.id, dragState.employeeId);
                      }
                      setDragState(null);
                    }}>
                      {block.employeeIds.map((id) => (
                        <EmployeeChip
                          key={id}
                          employee={findEmployee(id)}
                          dateKey={boardDateKey}
                          availabilityCalendar={employeeAvailabilityCalendar}
                          showRole
                          draggable
                          className="schedule-chip-draggable"
                          onDragStart={() => setDragState({ employeeId: id, sourceBlockId: block.id, targetBlockId: null })}
                          onDragEnd={() => setDragState(null)}
                          onClick={() => navigate(routePaths.removeEmployee, { state: { blockId: block.id, employeeId: id, selectedDateKey: boardDateKey, returnTo: routePaths.desktopSchedule } })}
                        />
                      ))}
                      {!block.employeeIds.length ? <div className="empty-card compact">ยังไม่มีพนักงานในกะนี้</div> : null}
                    </div>

                    <div className="schedule-column-actions">
                      <button
                        type="button"
                        className="add-employee-btn"
                        onClick={() => navigate(routePaths.addEmployee, { state: { blockId: block.id, selectedDateKey: boardDateKey, returnTo: routePaths.desktopSchedule } })}
                      >
                        <Plus size={16} /> เพิ่มคนในกะ
                      </button>
                      {shortage ? <button type="button" className="ghost-button schedule-auto-fill-btn" disabled={!availableForAuto} onClick={() => autoAssignEmployeesToBlock(block.id, boardDateKey)}>{availableForAuto ? 'เพิ่มอัตโนมัติ' : 'ไม่มีคนให้เพิ่ม'}</button> : null}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
          {!dateBlocks.length ? <div className="empty-card">วันนี้ยังไม่มีกะงานในตาราง สามารถเพิ่มกะงานของวันที่เลือกได้ทันที</div> : null}
        </div>
      </section>
    </DesktopWorkspace>
  );
}
