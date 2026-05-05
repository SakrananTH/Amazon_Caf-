import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BarChart3, Bell, Clock3, Copy, Eye, EyeOff, LogIn, LockKeyhole, PackageSearch, PencilLine, ShieldCheck, Smartphone, Store, TriangleAlert, UserPlus2, Users, UserX } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import DesktopWorkspace, { employeeNavItems } from './DesktopWorkspace.jsx';
import EmployeeChip, { buildRoleMetadataSkills, employeeChipLegendItems, employeeRoleOptions, getRoleClassName, getRolePresentation, stripRoleMetadataSkills } from '../shared/EmployeeChip.jsx';
import { MAX_EMPLOYEES, computeBlockStatus, employeeAvailabilityOptions, formatDateKey, getEmployeeAvailabilityMeta, getTimeBlocksForDate, isEmployeeScheduleEligible, useAppState } from '../../app/state/AppStateContext.jsx';
import { routePaths } from '../../app/routes.js';

function getBlockCoverage(block, employeesById, dateKey, availabilityCalendar) {
  const assigned = block.employeeIds.filter((employeeId) => isEmployeeScheduleEligible(employeesById.get(employeeId), dateKey, availabilityCalendar)).length;
  return {
    assigned,
    status: computeBlockStatus(block.required, assigned),
  };
}

function MetricCard({ label, value, note, tone = 'default' }) {
  return (
    <article className={`metric-card metric-card-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function getBlockDateValue(block) {
  if (!block?.date) {
    return 0;
  }

  const parsedDate = new Date(block.date);
  if (!Number.isNaN(parsedDate.getTime())) {
    return parsedDate.getTime();
  }

  const dateMatch = String(block.date).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!dateMatch) {
    return 0;
  }

  const [, day, month, year] = dateMatch;
  return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
}

function getBlockStartMinutes(timeLabel = '') {
  const firstSegment = String(timeLabel).split('-')[0].trim();
  const [hoursText, minutesText = '0'] = firstSegment.split(':');
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? (hours * 60) + minutes : 0;
}

function sortBlocksBySchedule(leftBlock, rightBlock) {
  const dateDiff = getBlockDateValue(leftBlock) - getBlockDateValue(rightBlock);
  if (dateDiff !== 0) {
    return dateDiff;
  }

  return getBlockStartMinutes(leftBlock.time) - getBlockStartMinutes(rightBlock.time);
}

function getDaysUntilExpiry(dateString) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetDate = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(targetDate.getTime())) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.round((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getInventoryTone(item) {
  const expiryDays = getDaysUntilExpiry(item.expiresOn);
  if (item.quantity <= item.threshold || expiryDays <= 2) {
    return 'danger';
  }

  if (item.quantity <= item.threshold + 2 || expiryDays <= 5) {
    return 'warning';
  }

  return 'ok';
}

function getIssueTone(issue) {
  if (issue.severity === 'สูง' || issue.status === 'รอดำเนินการ') {
    return 'danger';
  }

  if (issue.severity === 'กลาง' || issue.status === 'กำลังตรวจสอบ') {
    return 'warning';
  }

  return 'ok';
}

function getIssueSeverityWeight(issue) {
  if (issue.severity === 'สูง') {
    return 3;
  }

  if (issue.severity === 'กลาง') {
    return 2;
  }

  return 1;
}

function findPortalEmployee(employees, dateKey = null, availabilityCalendar = null) {
  return employees.find((employee) => isEmployeeScheduleEligible(employee, dateKey, availabilityCalendar)) ?? employees.find((employee) => employee.active && employee.role !== 'ผู้จัดการร้าน') ?? employees.find((employee) => employee.active) ?? employees[0] ?? null;
}

function buildManagerOpsSummary(inventoryItems, issueReports) {
  const lowStockItems = [...inventoryItems]
    .filter((item) => item.quantity <= item.threshold)
    .sort((leftItem, rightItem) => (rightItem.threshold - rightItem.quantity) - (leftItem.threshold - leftItem.quantity));

  const expiringItems = [...inventoryItems]
    .filter((item) => getDaysUntilExpiry(item.expiresOn) <= 5)
    .sort((leftItem, rightItem) => getDaysUntilExpiry(leftItem.expiresOn) - getDaysUntilExpiry(rightItem.expiresOn));

  const openIssues = [...issueReports]
    .filter((issue) => issue.status !== 'ดำเนินการแล้ว')
    .sort((leftIssue, rightIssue) => getIssueSeverityWeight(rightIssue) - getIssueSeverityWeight(leftIssue));

  const priorityAlerts = [
    ...openIssues.map((issue) => ({
      id: `issue-${issue.id}`,
      kind: 'issue',
      issueId: issue.id,
      itemId: null,
      title: issue.title,
      detail: `${issue.date} • ระดับ${issue.severity}`,
      action: issue.status,
      tone: getIssueTone(issue),
    })),
    ...expiringItems.map((item) => {
      const expiryDays = getDaysUntilExpiry(item.expiresOn);
      return {
        id: `expiry-${item.id}`,
        kind: 'expiry',
        issueId: null,
        itemId: item.id,
        title: item.name,
        detail: expiryDays <= 0 ? 'หมดอายุแล้ว ต้องแยกตรวจทันที' : `หมดอายุอีก ${expiryDays} วัน`,
        action: `คงเหลือ ${item.quantity} ${item.unit}`,
        tone: expiryDays <= 2 ? 'danger' : 'warning',
      };
    }),
    ...lowStockItems.map((item) => ({
      id: `stock-${item.id}`,
      kind: 'stock',
      issueId: null,
      itemId: item.id,
      title: item.name,
      detail: `เหลือ ${item.quantity} ${item.unit} จากจุดเตือน ${item.threshold} ${item.unit}`,
      action: 'สต็อกต่ำ',
      tone: 'danger',
    })),
  ].sort((leftAlert, rightAlert) => {
    const toneWeight = { danger: 3, warning: 2, ok: 1 };
    return toneWeight[rightAlert.tone] - toneWeight[leftAlert.tone];
  });

  return {
    lowStockItems,
    expiringItems,
    openIssues,
    priorityAlerts,
  };
}

function createEmployeeDraft() {
  return {
    name: '',
    role: 'บาริสต้า',
    roleTone: 'chip-role-barista',
    roleHint: 'เครื่องดื่ม',
    phone: '',
    employeeCode: '',
    password: '',
    avatar: '👨🏻',
    skillsText: '',
    availabilityStatus: 'ready',
    active: true,
  };
}

const avatarOptions = [
  { value: '👨🏻', label: 'ชาย 1' },
  { value: '👩🏻', label: 'หญิง 1' },
];

export function HomePage() {
  const { employeeAvailabilityCalendar, employees, inventoryItems, issueReports, timeBlocks } = useAppState();
  const todayDateKey = formatDateKey();
  const sortedBlocks = useMemo(() => [...getTimeBlocksForDate(timeBlocks, todayDateKey)].sort(sortBlocksBySchedule), [timeBlocks, todayDateKey]);
  const nextBlocks = sortedBlocks.slice(0, 2);
  const assignedEmployees = new Set(sortedBlocks.flatMap((block) => block.employeeIds.filter((employeeId) => isEmployeeScheduleEligible(employees.find((employee) => employee.id === employeeId), todayDateKey, employeeAvailabilityCalendar))));
  const activeEmployees = employees.filter((employee) => isEmployeeScheduleEligible(employee, todayDateKey, employeeAvailabilityCalendar));
  const { expiringItems, lowStockItems, openIssues, priorityAlerts } = useMemo(() => buildManagerOpsSummary(inventoryItems, issueReports), [inventoryItems, issueReports]);
  const focusAlerts = priorityAlerts.slice(0, 3);
  const compactAlerts = priorityAlerts.slice(0, 2);
  const spotlightItem = expiringItems[0] ?? lowStockItems[0] ?? null;
  const coveragePercent = employees.length ? Math.round((activeEmployees.length / employees.length) * 100) : 0;

  const getAssignedEmployees = (employeeIds) => employeeIds
    .map((employeeId) => employees.find((employee) => employee.id === employeeId))
    .filter(Boolean);

  return (
    <DesktopWorkspace title="หน้าหลัก" headerActions={<Link className="ghost-button" to={routePaths.myRequests}>เปิดศูนย์แจ้งเตือน <ArrowRight size={16} /></Link>}>
      <div className="home-screen-shell">
        <section className="ops-hero home-ops-hero">
          <div className="ops-hero-copy">
            <span className="ops-hero-badge">Manager overview</span>
            <h2>{priorityAlerts.length ? `มี ${priorityAlerts.length} เรื่องที่ควรจัดการในร้านวันนี้` : 'ภาพรวมร้านวันนี้อยู่ในเกณฑ์พร้อมทำงาน'}</h2>
            <p>{priorityAlerts.length ? `เน้นตรวจสต็อกใกล้หมดอายุ ของที่ต่ำกว่าจุดเตือน และปัญหาหน้างานก่อนรอบเร่งด่วน` : 'ดูสต็อก ทีมลงงาน และสิ่งที่ต้องเช็กในหน้าเดียวโดยไม่ต้องสลับหลายหน้า'}</p>

            <div className="ops-focus-list home-focus-list">
              {focusAlerts.length ? focusAlerts.map((alert) => (
                <div key={alert.id} className={`ops-focus-item ${alert.tone}`}>
                  <div>
                    <strong>{alert.title}</strong>
                    <span>{alert.detail}</span>
                  </div>
                  <span className={`status-chip ${alert.tone}`}>{alert.action}</span>
                </div>
              )) : (
                <div className="ops-focus-item ok">
                  <div>
                    <strong>ภาพรวมร้านปกติ</strong>
                    <span>ยังไม่มีรายการเร่งด่วน สามารถโฟกัสการจัดกะและเช็กสต็อกประจำวันได้</span>
                  </div>
                  <span className="status-chip ok">พร้อมใช้งาน</span>
                </div>
              )}
            </div>
          </div>

          <aside className="ops-hero-aside">
            <div className="ops-aside-card emphasis home-emphasis-card">
              <span>ทีมพร้อมใช้งานวันนี้</span>
              <strong>{activeEmployees.length}/{employees.length} คน</strong>
              <small>ครอบคลุมกำลังคน {coveragePercent}% • ลงกะจริง {assignedEmployees.size} คน</small>
            </div>

            <div className="ops-signal-grid home-signal-grid">
              <div className="ops-aside-card">
                <TriangleAlert size={16} />
                <strong>{openIssues.length}</strong>
                <small>ปัญหาค้าง</small>
              </div>
              <div className="ops-aside-card">
                <PackageSearch size={16} />
                <strong>{lowStockItems.length}</strong>
                <small>สต็อกต่ำ</small>
              </div>
              <div className="ops-aside-card">
                <Clock3 size={16} />
                <strong>{expiringItems.length}</strong>
                <small>ใกล้หมดอายุ</small>
              </div>
            </div>

            <div className="ops-aside-card home-stock-spotlight">
              <span>โฟกัสคลังวันนี้</span>
              <strong>{spotlightItem ? spotlightItem.name : 'ยังไม่มีรายการเด่น'}</strong>
              <small>{spotlightItem ? `เหลือ ${spotlightItem.quantity} ${spotlightItem.unit} • หมดอายุ ${new Intl.DateTimeFormat('th-TH-u-ca-buddhist', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${spotlightItem.expiresOn}T00:00:00`))}` : 'ของในคลังยังไม่เข้ากลุ่มเสี่ยง'}</small>
            </div>
          </aside>
        </section>

        <section className="workspace-columns home-dashboard-columns">
        <article className="panel-card home-alert-panel">
          <div className="panel-head">
            <div>
              <h3>รายการเร่งด่วนวันนี้</h3>
              <p>ใช้ข้อมูลเดียวกับหน้าแจ้งเตือน แต่ย่อให้เห็นเฉพาะเรื่องที่ต้องลงมือก่อน</p>
            </div>
            <Bell size={18} className="panel-accent danger" />
          </div>

          <div className="request-feed home-request-feed">
            {compactAlerts.map((alert) => (
              <div key={alert.id} className="request-feed-item">
                <div>
                  <strong>{alert.title}</strong>
                  <p>{alert.detail}</p>
                </div>
                <span className={`status-chip ${alert.tone}`}>{alert.action}</span>
              </div>
            ))}
            {!priorityAlerts.length ? <div className="empty-card">ตอนนี้ยังไม่มีรายการเร่งด่วน</div> : null}
          </div>

          <div className="home-panel-footer">
            <Link className="inline-action" to={routePaths.myRequests}>เปิดศูนย์แจ้งเตือน</Link>
            <Link className="inline-action" to={routePaths.reports}>ดูรายงานคลัง</Link>
          </div>
        </article>

        <article className="panel-card home-shift-panel">
          <div className="panel-head">
            <div>
              <h3>กะที่กำลังจะถึง</h3>
              <p>ดูช่วงงานถัดไปพร้อมคนที่ลงจริงและเปิดตารางได้ทันที</p>
            </div>
            <Users size={18} className="panel-accent" />
          </div>

          <div className="home-role-legend">
            {employeeChipLegendItems.map((item) => <span key={item.className} className={`chip ${item.className} home-role-legend-chip`}>{item.label}</span>)}
          </div>

          <div className="action-list home-shift-list">
            {nextBlocks.map((block) => (
              <div key={block.id} className="action-row home-shift-row">
                <div>
                  <strong>{block.time} {block.title}</strong>
                  <p>จัดแล้ว {block.employeeIds.length}/{block.required} คน • งาน {block.tasks.length} รายการ</p>
                  {block.employeeIds.length ? <div className="home-assigned-chips">{getAssignedEmployees(block.employeeIds).map((employee) => <EmployeeChip key={`${block.id}-${employee.id}`} employee={employee} dateKey={todayDateKey} availabilityCalendar={employeeAvailabilityCalendar} showRole />)}</div> : null}
                </div>
                <Link className="inline-action" to={routePaths.desktopSchedule}>เปิดตาราง</Link>
              </div>
            ))}
            {!nextBlocks.length ? <div className="empty-card">ยังไม่มีช่วงงานในระบบ</div> : null}
          </div>
        </article>
        </section>
      </div>
    </DesktopWorkspace>
  );
}

export function EmployeeHomePage() {
  const { employeeAvailabilityCalendar, employees, requests, timeBlocks } = useAppState();
  const todayDateKey = formatDateKey();
  const currentEmployee = findPortalEmployee(employees, todayDateKey, employeeAvailabilityCalendar);
  const assignedBlocks = useMemo(() => currentEmployee ? [...getTimeBlocksForDate(timeBlocks, todayDateKey)].sort(sortBlocksBySchedule).filter((block) => block.employeeIds.includes(currentEmployee.id)) : [], [currentEmployee, timeBlocks, todayDateKey]);
  const nextBlock = assignedBlocks[0] ?? null;
  const totalTasks = assignedBlocks.reduce((sum, block) => sum + block.tasks.length, 0);
  const recentRequests = requests.slice(0, 3);

  return (
    <DesktopWorkspace title="หน้าพนักงาน" navItems={employeeNavItems} profileName={currentEmployee?.name ?? 'พนักงาน'} profileAvatar={currentEmployee?.avatar ?? '👨🏻'} showSupportButton={false} headerActions={<Link className="ghost-button" to={routePaths.employeeSchedule}>ดูกะของฉัน <ArrowRight size={16} /></Link>}>
      <section className={`dashboard-priority-bar ${assignedBlocks.length ? 'is-clear' : 'is-critical'}`}>
        <div>
          <span className="priority-kicker">My day</span>
          <strong>{currentEmployee ? `${currentEmployee.name} มีกะวันนี้ ${assignedBlocks.length} ช่วง` : 'ยังไม่มีข้อมูลพนักงานในระบบ'}</strong>
          <p>{nextBlock ? `กะถัดไปคือ ${nextBlock.time} • ${nextBlock.title}` : 'วันนี้ยังไม่มีกะที่ถูกมอบหมาย'}</p>
        </div>
        <Link className="ghost-button" to={routePaths.employeeRequests}>ดูคำขอของฉัน <ArrowRight size={16} /></Link>
      </section>

      <section className="dashboard-grid">
        <MetricCard label="กะของฉันวันนี้" value={`${assignedBlocks.length} ช่วง`} note={nextBlock ? `เริ่มที่ ${nextBlock.time}` : 'ยังไม่มีกะ'} tone="coverage" />
        <MetricCard label="งานที่ได้รับ" value={`${totalTasks} งาน`} note={currentEmployee ? `สำหรับ ${currentEmployee.role}` : 'รอข้อมูลพนักงาน'} tone="default" />
        <MetricCard label="คำขอล่าสุด" value={`${recentRequests.length} รายการ`} note={recentRequests[0] ? recentRequests[0].title : 'ยังไม่มีคำขอ'} tone={recentRequests.length ? 'positive' : 'default'} />
      </section>
    </DesktopWorkspace>
  );
}

export function EmployeeSchedulePage() {
  const { employeeAvailabilityCalendar, employees, timeBlocks } = useAppState();
  const todayDateKey = formatDateKey();
  const employeesById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);
  const currentEmployee = findPortalEmployee(employees, todayDateKey, employeeAvailabilityCalendar);
  const assignedBlocks = useMemo(() => currentEmployee ? [...getTimeBlocksForDate(timeBlocks, todayDateKey)].sort(sortBlocksBySchedule).filter((block) => block.employeeIds.includes(currentEmployee.id)) : [], [currentEmployee, timeBlocks, todayDateKey]);
  const totalTasks = assignedBlocks.reduce((sum, block) => sum + block.tasks.length, 0);
  const nextBlock = assignedBlocks[0] ?? null;

  return (
    <DesktopWorkspace title="กะของฉัน" navItems={employeeNavItems} profileName={currentEmployee?.name ?? 'พนักงาน'} profileAvatar={currentEmployee?.avatar ?? '👨🏻'} showSupportButton={false} headerActions={<Link className="ghost-button" to={routePaths.requestHelp} state={{ returnTo: routePaths.employeeRequests, defaultType: 'ขอเปลี่ยนกะ', defaultDetail: nextBlock ? `เกี่ยวกับกะ ${nextBlock.time} • ${nextBlock.title}` : '' }}>ส่งคำขอ <ArrowRight size={16} /></Link>}>
      <section className="schedule-board-note panel-card compact-page-bar">
        <div className="compact-page-lead">
          <strong>มุมมองสำหรับพนักงาน</strong>
          <p>ดูเฉพาะกะที่ได้รับมอบหมาย งานหลักของแต่ละช่วง และทีมที่ทำงานร่วมกัน</p>
        </div>
        <div className="compact-page-stats">
          <span className="compact-page-stat">กะทั้งหมด {assignedBlocks.length}</span>
          <span className="compact-page-stat">งานรวม {totalTasks}</span>
          <span className={`compact-page-stat ${nextBlock ? 'ok' : 'warning'}`}>{nextBlock ? `ถัดไป ${nextBlock.time}` : 'ยังไม่มีกะ'}</span>
        </div>
      </section>

      <section className="workspace-columns notifications-layout">
        <article className="panel-card notification-panel">
          <div className="panel-head">
            <div>
              <h3>รายละเอียดกะของฉัน</h3>
              <p>สรุปช่วงเวลา รายการงาน และสถานะในแต่ละช่วง</p>
            </div>
            <PencilLine size={18} className="panel-accent" />
          </div>

          <div className="action-list">
            {assignedBlocks.map((block) => (
              (() => {
                const coverage = getBlockCoverage(block, employeesById, todayDateKey, employeeAvailabilityCalendar);
                return (
                  <div key={block.id} className="action-row">
                    <div>
                      <strong>{block.time} {block.title}</strong>
                      <p>ต้องมี {block.required} คน ตอนนี้พร้อมจริง {coverage.assigned} คน</p>
                      <div className="assignment-pills">
                        {block.tasks.map((task) => <span key={`${block.id}-${task}`} className="assignment-pill">{task}</span>)}
                      </div>
                    </div>
                    <span className={`status-chip ${coverage.status}`}>{coverage.status === 'ok' ? 'พร้อมทำงาน' : coverage.status === 'warning' ? 'ต้องระวัง' : 'ขาดคน'}</span>
                  </div>
                );
              })()
            ))}
            {!assignedBlocks.length ? <div className="empty-card">ยังไม่มีกะของคุณในวันนี้</div> : null}
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-head">
            <div>
              <h3>ทีมที่ทำงานร่วมกัน</h3>
              <p>ดูเพื่อนร่วมกะจากช่วงงานที่คุณได้รับมอบหมาย</p>
            </div>
            <Users size={18} className="panel-accent" />
          </div>

          <div className="home-assigned-chips">
            {currentEmployee ? employees.filter((employee) => assignedBlocks.some((block) => block.employeeIds.includes(employee.id))).map((employee) => <EmployeeChip key={employee.id} employee={employee} dateKey={todayDateKey} availabilityCalendar={employeeAvailabilityCalendar} showRole />) : null}
            {!currentEmployee || !assignedBlocks.length ? <div className="empty-card">เมื่อมีกะ ระบบจะแสดงรายชื่อทีมที่ทำงานร่วมกันตรงนี้</div> : null}
          </div>
        </article>
      </section>
    </DesktopWorkspace>
  );
}

export function EmployeesPage() {
  const { createEmployee, deleteEmployee, employees, resetEmployeePortalPassword, timeBlocks, updateEmployee } = useAppState();
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(employees[0]?.id ?? null);
  const [mode, setMode] = useState('edit');
  const [editorTab, setEditorTab] = useState('profile');
  const [formState, setFormState] = useState(createEmployeeDraft);
  const [saveMessage, setSaveMessage] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const [showEmployeePassword, setShowEmployeePassword] = useState(false);
  const [isRoleEditorOpen, setIsRoleEditorOpen] = useState(false);
  const roleTitleInputRef = useRef(null);

  const filteredEmployees = useMemo(() => employees.filter((employee) => {
    const matchesQuery = query.trim() ? `${employee.name} ${employee.role} ${employee.phone} ${employee.employeeCode ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()) : true;
    const matchesRole = roleFilter === 'all' ? true : employee.role === roleFilter;
    return matchesQuery && matchesRole;
  }), [employees, query, roleFilter]);

  const employeeLimitReached = employees.length >= MAX_EMPLOYEES;
  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId) ?? null;
  const assignmentsForEmployee = (employeeId) => getTimeBlocksForDate(timeBlocks, formatDateKey()).filter((block) => block.employeeIds.includes(employeeId));
  const selectedAssignments = selectedEmployee ? assignmentsForEmployee(selectedEmployee.id) : [];
  const activeRoleOption = useMemo(() => {
    return employeeRoleOptions.find((option) => option.className === String(formState.roleTone ?? '').trim())
      ?? employeeRoleOptions.find((option) => option.value === formState.role)
      ?? employeeRoleOptions.find((option) => option.className === getRoleClassName(formState.role))
      ?? null;
  }, [formState.role, formState.roleTone]);
  const currentRoleLabel = String(formState.role ?? '').trim();
  const currentRoleHint = String(formState.roleHint ?? '').trim();
  const currentRoleClassName = String(formState.roleTone ?? '').trim() || getRoleClassName(formState.role);

  useEffect(() => {
    if (mode === 'create') {
      setFormState(createEmployeeDraft());
      return;
    }

    if (!selectedEmployee && employees[0]) {
      setSelectedEmployeeId(employees[0].id);
      return;
    }

    if (selectedEmployee) {
      const rolePresentation = getRolePresentation(selectedEmployee.role, selectedEmployee.skills);
      setFormState({
        name: selectedEmployee.name,
        role: selectedEmployee.role,
        roleTone: rolePresentation.className,
        roleHint: rolePresentation.hint,
        phone: selectedEmployee.phone,
        employeeCode: selectedEmployee.employeeCode ?? '',
        password: selectedEmployee.password ?? selectedEmployee.employeeCode ?? '',
        avatar: selectedEmployee.avatar,
        skillsText: stripRoleMetadataSkills(selectedEmployee.skills).join(', '),
        availabilityStatus: selectedEmployee.availabilityStatus ?? 'ready',
        active: selectedEmployee.active,
      });
    }
  }, [employees, mode, selectedEmployee]);

  useEffect(() => {
    if (employeeLimitReached && mode === 'create') {
      setMode('edit');
      setSelectedEmployeeId(employees[0]?.id ?? null);
    }
  }, [employeeLimitReached, employees, mode]);

  useEffect(() => {
    setCopyMessage('');
  }, [mode, selectedEmployeeId, formState.employeeCode, formState.password]);

  useEffect(() => {
    setEditorTab('profile');
  }, [mode, selectedEmployeeId]);

  useEffect(() => {
    setShowEmployeePassword(false);
  }, [mode, selectedEmployeeId]);

  useEffect(() => {
    setIsRoleEditorOpen(false);
  }, [mode, selectedEmployeeId]);

  useEffect(() => {
    if (!isRoleEditorOpen) {
      return;
    }

    requestAnimationFrame(() => {
      roleTitleInputRef.current?.focus();
      roleTitleInputRef.current?.select();
    });
  }, [isRoleEditorOpen]);

  useEffect(() => {
    if (!isRoleEditorOpen) {
      return undefined;
    }

    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        setIsRoleEditorOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscapeKey);
    return () => window.removeEventListener('keydown', handleEscapeKey);
  }, [isRoleEditorOpen]);

  const handleChange = (event) => {
    const { checked, name, type, value } = event.target;
    setFormState((currentState) => ({
      ...currentState,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleRolePresetSelect = (option) => {
    setFormState((currentState) => {
      const currentOption = employeeRoleOptions.find((entry) => entry.className === String(currentState.roleTone ?? '').trim())
        ?? employeeRoleOptions.find((entry) => entry.value === currentState.role)
        ?? null;
      const isSameTone = currentOption?.className === option.className;

      return {
        ...currentState,
        role: isSameTone && String(currentState.role ?? '').trim() ? currentState.role : option.label,
        roleTone: option.className,
        roleHint: isSameTone && String(currentState.roleHint ?? '').trim() ? currentState.roleHint : option.detailLabel,
      };
    });
  };

  const handleRoleToneSelect = (option) => {
    setFormState((currentState) => ({
      ...currentState,
      role: String(currentState.role ?? '').trim() ? currentState.role : option.label,
      roleTone: option.className,
      roleHint: String(currentState.roleHint ?? '').trim() ? currentState.roleHint : option.detailLabel,
    }));
  };

  const normalizePayload = () => ({
    ...formState,
    role: String(formState.role ?? '').trim(),
    roleTone: String(formState.roleTone ?? '').trim(),
    roleHint: String(formState.roleHint ?? '').trim(),
    skills: buildRoleMetadataSkills(formState.skillsText.split(',').map((skill) => skill.trim()).filter(Boolean), {
      toneClassName: formState.roleTone,
      hint: formState.roleHint,
    }),
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    const payload = normalizePayload();

    if (!payload.name.trim() || !payload.phone.trim()) {
      return;
    }

    if (mode === 'create') {
      const nextEmployee = createEmployee(payload);
      if (!nextEmployee) {
        setSaveMessage(`ร้านนี้กำหนดพนักงานได้สูงสุด ${MAX_EMPLOYEES} คน`);
        return;
      }

      setSelectedEmployeeId(nextEmployee.id);
      setMode('edit');
      setSaveMessage(`เพิ่มพนักงาน ${nextEmployee.name} แล้ว • เข้าระบบด้วย ${nextEmployee.phone} / ${nextEmployee.password}`);
      return;
    }

    if (!selectedEmployee) {
      return;
    }

    const updatedEmployee = updateEmployee(selectedEmployee.id, payload);
    if (updatedEmployee) {
      setSaveMessage(`บันทึกข้อมูลของ ${updatedEmployee.name} แล้ว • ใช้เบอร์ ${updatedEmployee.phone} / ${updatedEmployee.password}`);
    }
  };

  const handleDelete = () => {
    if (!selectedEmployee) {
      return;
    }

    const removedEmployee = deleteEmployee(selectedEmployee.id);
    if (!removedEmployee) {
      return;
    }

    const nextSelected = employees.find((employee) => employee.id !== removedEmployee.id);
    setSelectedEmployeeId(nextSelected?.id ?? null);
    setMode(nextSelected ? 'edit' : 'create');
    setSaveMessage(`ลบ ${removedEmployee.name} ออกจากระบบแล้ว`);
  };

  const handleResetEmployeePassword = () => {
    if (!selectedEmployee) {
      return;
    }

    const updatedEmployee = resetEmployeePortalPassword(selectedEmployee.id);
    if (!updatedEmployee) {
      return;
    }

    setFormState((currentState) => ({
      ...currentState,
      password: updatedEmployee.password,
    }));
    setSaveMessage(`สร้างรหัสผ่านใหม่ของ ${updatedEmployee.name} แล้ว • ใช้ ${updatedEmployee.phone} / ${updatedEmployee.password}`);
  };

  const handleCopyEmployeePassword = async () => {
    const password = String(formState.password ?? '').trim();
    if (!password || mode !== 'edit') {
      return;
    }

    try {
      await navigator.clipboard.writeText(password);
      setCopyMessage(`คัดลอกรหัสผ่าน ${password} แล้ว`);
    } catch {
      setCopyMessage('คัดลอกรหัสผ่านไม่สำเร็จ ลองใหม่อีกครั้ง');
    }
  };

  const handleCopyEmployeeCredentials = async () => {
    const employeeName = String(formState.name ?? '').trim();
    const phone = String(formState.phone ?? '').trim();
    const password = String(formState.password ?? '').trim();
    if (!employeeName || !phone || !password || mode !== 'edit') {
      return;
    }

    try {
      await navigator.clipboard.writeText(`สวัสดี ${employeeName}\nข้อมูลเข้าสู่ระบบพนักงานของคุณ\nเบอร์โทร: ${phone}\nรหัสผ่าน: ${password}\nกรุณาเก็บข้อมูลนี้ไว้สำหรับเข้าใช้งาน`);
      setCopyMessage(`คัดลอกข้อความพร้อมส่งของ ${employeeName} แล้ว`);
    } catch {
      setCopyMessage('คัดลอกข้อความพร้อมส่งไม่สำเร็จ ลองใหม่อีกครั้ง');
    }
  };

  const handleCopyEmployeeShortCredentials = async () => {
    const employeeName = String(formState.name ?? '').trim();
    const phone = String(formState.phone ?? '').trim();
    const password = String(formState.password ?? '').trim();
    if (!employeeName || !phone || !password || mode !== 'edit') {
      return;
    }

    try {
      await navigator.clipboard.writeText(`${employeeName} เข้าโหมดพนักงานด้วย เบอร์ ${phone} รหัสผ่าน ${password}`);
      setCopyMessage(`คัดลอกข้อความสั้นสำหรับ ${employeeName} แล้ว`);
    } catch {
      setCopyMessage('คัดลอกข้อความสั้นไม่สำเร็จ ลองใหม่อีกครั้ง');
    }
  };

  return (
    <DesktopWorkspace title="พนักงาน" headerActions={employeeLimitReached ? null : <button type="button" className="ghost-button" onClick={() => { setMode('create'); setSelectedEmployeeId(null); setSaveMessage(''); }}><UserPlus2 size={16} /> เพิ่มพนักงาน</button>}>
      <section className="employee-page-layout">
        <article className="panel-card employee-list-panel">
          <div className="panel-head">
            <div>
              <h3>รายชื่อพนักงาน</h3>
              <p>ร้านนี้กำหนดพนักงานได้สูงสุด {MAX_EMPLOYEES} คน</p>
              <small className="employee-list-helper">เลือกพนักงานจากรายการเพื่อเปิดโหมดแก้ไขทางด้านขวา</small>
            </div>
            <span className="list-summary">{filteredEmployees.length} คน</span>
          </div>

          <div className="employee-toolbar">
            <input className="text-input" placeholder="ค้นหาชื่อ เบอร์โทร รหัส หรือบทบาท" value={query} onChange={(event) => setQuery(event.target.value)} />
            <select className="text-input" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
              <option value="all">ทุกบทบาท</option>
              {employeeRoleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>

          <div className="employee-list employee-directory-list">
            {filteredEmployees.map((employee) => {
              const assignments = assignmentsForEmployee(employee.id);
              const isSelected = mode === 'edit' && selectedEmployeeId === employee.id;
              const availabilityMeta = getEmployeeAvailabilityMeta(employee);
              return (
                <button key={employee.id} type="button" className={`employee-list-item availability-${availabilityMeta.value} tone-${availabilityMeta.tone} ${isSelected ? 'selected' : ''}`} onClick={() => { setMode('edit'); setSelectedEmployeeId(employee.id); setSaveMessage(''); }}>
                  <span className="employee-list-avatar">{employee.avatar}</span>
                  <span className="employee-list-copy">
                    <strong>{employee.name}</strong>
                    <span className="employee-list-meta-row">
                      <small>{employee.role}</small>
                      <small>{employee.phone}</small>
                    </span>
                    <span className="employee-list-meta-row">
                      <small>รหัส {employee.employeeCode}</small>
                      <small>{assignments.length ? `กะ ${assignments.length}` : 'ยังไม่ลงกะ'}</small>
                    </span>
                  </span>
                  <span className="employee-list-actions">
                    <span className={`employee-list-edit-pill ${isSelected ? 'selected' : ''}`}>
                      <PencilLine size={12} />
                      {isSelected ? 'กำลังแก้ไข' : 'แก้ไข'}
                    </span>
                    <span className={`status-chip ${availabilityMeta.tone}`}>{availabilityMeta.label}</span>
                  </span>
                </button>
              );
            })}
            {!filteredEmployees.length ? <div className="empty-card">ไม่พบพนักงานตามคำค้นหรือบทบาทที่เลือก</div> : null}
          </div>
          {employeeLimitReached ? <div className="compact-home-note">จำนวนพนักงานครบ {MAX_EMPLOYEES} คนแล้ว หากต้องการเพิ่มใหม่ให้ลบหรือแก้ไขข้อมูลคนเดิมก่อน</div> : null}
        </article>

        <form className="panel-card employee-editor-panel" onSubmit={handleSubmit}>
          <div className="panel-head">
            <div>
              <h3>{mode === 'create' ? 'เพิ่มพนักงานใหม่' : 'ข้อมูลพนักงาน'}</h3>
              <p>{mode === 'create' ? 'กรอกเฉพาะข้อมูลที่จำเป็นเพื่อสร้างคนใหม่ในระบบ' : 'แก้ไขข้อมูลหลัก สถานะ และทักษะในหน้าจอเดียว'}</p>
            </div>
            {mode === 'edit' && selectedEmployee ? <span className={`status-chip ${getEmployeeAvailabilityMeta(selectedEmployee).tone}`}>{getEmployeeAvailabilityMeta(selectedEmployee).label}</span> : <PencilLine size={18} className="panel-accent" />}
          </div>

          <div className="employee-editor-tab-row" role="tablist" aria-label="หมวดข้อมูลพนักงาน">
            <button type="button" role="tab" aria-selected={editorTab === 'profile'} className={`employee-editor-tab ${editorTab === 'profile' ? 'selected' : ''}`} onClick={() => setEditorTab('profile')}>ข้อมูลหลัก</button>
            <button type="button" role="tab" aria-selected={editorTab === 'access'} className={`employee-editor-tab ${editorTab === 'access' ? 'selected' : ''}`} onClick={() => setEditorTab('access')}>สิทธิ์เข้าใช้</button>
            <button type="button" role="tab" aria-selected={editorTab === 'status'} className={`employee-editor-tab ${editorTab === 'status' ? 'selected' : ''}`} onClick={() => setEditorTab('status')}>สถานะงาน</button>
          </div>

          <div className="employee-editor-grid">
            {editorTab === 'profile' ? (
              <div className="employee-profile-layout employee-editor-full">
                <section className="employee-profile-card employee-profile-main">
                  <div className="employee-profile-basic-grid">
                    <label className="field-group">
                      <span>ชื่อพนักงาน</span>
                      <input className="text-input" name="name" value={formState.name} onChange={handleChange} />
                    </label>
                    <label className="field-group">
                      <span>เบอร์โทรศัพท์</span>
                      <input className="text-input" name="phone" value={formState.phone} onChange={handleChange} />
                    </label>
                  </div>

                  <div className="field-group employee-role-field-group">
                    <span>บทบาทพร้อมสีแนะนำ</span>
                    <div className="employee-role-summary-shell">
                      <div className="employee-role-summary-card">
                        <span className={`chip ${currentRoleClassName} employee-role-chip`}>{currentRoleLabel || 'ยังไม่ได้ตั้งหัวข้อ'}</span>
                        <small>{`${activeRoleOption?.toneLabel ?? 'โทนทั่วไป'} • ${currentRoleHint || activeRoleOption?.detailLabel || 'เพิ่มคำอธิบายให้บทบาทนี้'}`}</small>
                      </div>
                      <button type="button" className="ghost-button employee-role-open-button" onClick={() => setIsRoleEditorOpen(true)}>
                        <PencilLine size={15} /> ปรับแต่งบทบาท
                      </button>
                    </div>
                    <small className="employee-role-helper">เลือกกล่องด้านล่างเพื่อใช้เป็นต้นแบบ แล้วค่อยกดปุ่มปรับแต่งบทบาทเมื่ออยากแก้ชื่อหรือโทนสีเพิ่มเติม</small>
                    <div className="employee-role-preset-list">
                      {employeeRoleOptions.map((option) => (
                        <button key={option.value} type="button" className={`employee-role-preset ${activeRoleOption?.className === option.className ? 'selected' : ''}`} onClick={() => handleRolePresetSelect(option)}>
                          <span className={`chip ${activeRoleOption?.className === option.className ? currentRoleClassName : option.className} employee-role-chip`}>{option.label}</span>
                          <small>{option.hint}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="employee-profile-side">
                  <div className="field-group employee-profile-card employee-avatar-field-group">
                    <span>Avatar</span>
                    <div className="employee-avatar-picker">
                      <div className="employee-avatar-preview" aria-hidden="true">{formState.avatar}</div>
                      <div className="employee-avatar-options">
                        {avatarOptions.map((option) => (
                          <button key={option.value} type="button" className={`employee-avatar-option ${formState.avatar === option.value ? 'selected' : ''}`} onClick={() => setFormState((currentState) => ({ ...currentState, avatar: option.value }))}>
                            <span className="employee-avatar-option-icon">{option.value}</span>
                            <span>{option.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <label className="field-group employee-profile-card employee-skills-field-group">
                    <span>ทักษะ</span>
                    <input className="text-input" name="skillsText" value={formState.skillsText} onChange={handleChange} placeholder="คั่นด้วย comma เช่น บาริสต้า, เปิดร้าน" />
                  </label>
                </section>
              </div>
            ) : null}

            {editorTab === 'access' ? (
              <div className="employee-access-layout employee-editor-full">
                <section className="employee-profile-card employee-access-primary">
                  <div className="employee-access-credential-grid">
                    <label className="field-group">
                      <span>เบอร์โทรศัพท์สำหรับเข้าใช้</span>
                      <input className="text-input" value={formState.phone} readOnly />
                    </label>

                    <label className="field-group">
                      <span>รหัสผ่าน</span>
                      <div className="employee-access-password-row">
                        <input className="text-input employee-access-password-input" type={showEmployeePassword ? 'text' : 'password'} name="password" value={formState.password} onChange={handleChange} placeholder="ถ้าว่าง ระบบจะใช้รหัสเดียวกับรหัสพนักงาน" />
                        <button type="button" className="employee-access-password-toggle" onClick={() => setShowEmployeePassword((currentValue) => !currentValue)} aria-label={showEmployeePassword ? 'ซ่อนรหัสผ่านพนักงาน' : 'แสดงรหัสผ่านพนักงาน'}>
                          {showEmployeePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                        <button type="button" className="ghost-button employee-login-copy-button employee-access-inline-copy" onClick={handleCopyEmployeePassword} disabled={mode !== 'edit' || !formState.password.trim()}>
                          <Copy size={15} /> คัดลอก
                        </button>
                      </div>
                    </label>
                  </div>

                  <label className="field-group employee-editor-full">
                    <span>รหัสพนักงาน</span>
                    <input className="text-input" value={mode === 'create' ? 'สร้างอัตโนมัติเมื่อบันทึก' : formState.employeeCode} readOnly />
                  </label>

                  <small className="employee-login-credential-note">พนักงานใช้เบอร์โทรและรหัสผ่านสำหรับเข้าโหมดพนักงาน ส่วนรหัสพนักงานเก็บไว้เป็นข้อมูลอ้างอิงในระบบ</small>
                  {copyMessage ? <small className="employee-login-copy-status">{copyMessage}</small> : null}
                </section>

                <aside className="employee-profile-card employee-access-side">
                  <div className="employee-editor-note-card employee-access-note-card">
                    <strong>ทางลัดจัดการสิทธิ์เข้าใช้</strong>
                    <p>ดูรหัสผ่านแบบมองเห็นได้ คัดลอกข้อมูลส่งให้พนักงาน หรือสร้างรหัสผ่านใหม่ได้จากกล่องนี้</p>
                  </div>

                  <div className="employee-login-copy-actions employee-access-quick-actions">
                    <button type="button" className="ghost-button employee-login-copy-button" onClick={handleCopyEmployeeCredentials} disabled={mode !== 'edit' || !formState.name.trim() || !formState.phone.trim() || !formState.password.trim()}>
                      <Copy size={15} /> คัดลอกข้อความพร้อมส่ง
                    </button>
                    <button type="button" className="ghost-button employee-login-copy-button" onClick={handleCopyEmployeeShortCredentials} disabled={mode !== 'edit' || !formState.name.trim() || !formState.phone.trim() || !formState.password.trim()}>
                      <Copy size={15} /> คัดลอกข้อความสั้น Line/SMS
                    </button>
                    {mode === 'edit' ? <button type="button" className="ghost-button employee-login-copy-button" onClick={handleResetEmployeePassword}>สร้างรหัสผ่านใหม่</button> : null}
                  </div>

                  <div className="employee-access-preview-card">
                    <span>ข้อมูลที่พนักงานใช้ตอนนี้</span>
                    <strong>{formState.phone || '-'}</strong>
                    <small>รหัสผ่าน {formState.password || '-'}</small>
                  </div>
                </aside>
              </div>
            ) : null}

            {editorTab === 'status' ? (
              <>
                <label className="field-group">
                  <span>สถานะพนักงานวันนี้</span>
                  <select className="text-input" name="availabilityStatus" value={formState.availabilityStatus} onChange={handleChange} disabled={!formState.active}>
                    {employeeAvailabilityOptions.map((option) => <option key={option.value} value={option.value}>{option.label} • {option.hint}</option>)}
                  </select>
                </label>

                <label className="checkbox-row employee-editor-full">
                  <input type="checkbox" name="active" checked={formState.active} onChange={handleChange} />
                  <span>เปิดไว้เมื่อพนักงานยังอยู่ในระบบ ถ้าปิด ระบบจะมองเป็นพักงานและไม่นำไปจัดกะ</span>
                </label>
              </>
            ) : null}
          </div>

          {editorTab === 'status' && mode === 'edit' && selectedEmployee ? (
            <div className="employee-assignment-box">
              <strong>กะงานของวันนี้</strong>
              <div className="assignment-pills">
                {selectedAssignments.map((block) => <span key={block.id} className="assignment-pill">{block.time} • {block.title}</span>)}
                {!selectedAssignments.length ? <span className="empty-card compact">ยังไม่มีการมอบหมายกะวันนี้</span> : null}
              </div>
            </div>
          ) : null}

          <div className="employee-editor-actions">
            <button type="submit" className="primary-inline">{mode === 'create' ? 'บันทึกพนักงานใหม่' : 'บันทึกการเปลี่ยนแปลง'}</button>
            {mode === 'edit' ? <button type="button" className="danger-inline" onClick={handleDelete}><UserX size={16} /> ลบพนักงาน</button> : null}
          </div>

          {isRoleEditorOpen ? (
            <div className="employee-role-dialog-backdrop" role="presentation" onClick={() => setIsRoleEditorOpen(false)}>
              <section className="employee-role-dialog-card" role="dialog" aria-modal="true" aria-labelledby="employee-role-dialog-title" onClick={(event) => event.stopPropagation()}>
                <div className="employee-role-dialog-head">
                  <div className="employee-role-dialog-title-wrap">
                    <span className="employee-role-dialog-kicker">Role Styling</span>
                    <strong id="employee-role-dialog-title">แก้ไขบทบาทพนักงาน</strong>
                    <p>จัดชื่อหัวข้อ โทนสี และคำอธิบายให้เป็นระเบียบมากขึ้นในหน้าต่างเดียว</p>
                  </div>
                  <button type="button" className="ghost-button employee-role-editor-close" onClick={() => setIsRoleEditorOpen(false)}>ปิด</button>
                </div>

                <div className="employee-role-dialog-layout">
                  <div className="employee-role-dialog-main">
                    <div className="employee-role-editor-preview employee-role-editor-preview--modal">
                      <span className={`chip ${currentRoleClassName} employee-role-chip`}>{currentRoleLabel || 'ยังไม่ได้ตั้งหัวข้อ'}</span>
                      <small>{`${activeRoleOption?.toneLabel ?? 'โทนทั่วไป'} • ${currentRoleHint || activeRoleOption?.detailLabel || 'คำอธิบายบทบาท'}`}</small>
                    </div>

                    <div className="employee-role-editor-grid">
                      <label className="field-group">
                        <span>หัวข้อ</span>
                        <input
                          ref={roleTitleInputRef}
                          className="text-input"
                          name="role"
                          value={formState.role}
                          onChange={handleChange}
                          placeholder="พิมพ์ชื่อบทบาท เช่น หัวหน้าบาริสต้า"
                        />
                      </label>

                      <label className="field-group">
                        <span>คำอธิบายใต้หัวข้อ</span>
                        <input
                          className="text-input"
                          name="roleHint"
                          value={formState.roleHint}
                          onChange={handleChange}
                          placeholder="เช่น เครื่องดื่ม หรือ ดูแลหน้าร้าน"
                        />
                      </label>
                    </div>
                  </div>

                  <aside className="employee-role-dialog-side">
                    <div className="employee-role-tone-strip employee-role-tone-strip--modal">
                      <span>โทนสี</span>
                      <div className="employee-role-tone-options">
                        {employeeRoleOptions.map((option) => (
                          <button key={`${option.value}-tone`} type="button" className={`employee-role-tone-option ${currentRoleClassName === option.className ? 'selected' : ''}`} onClick={() => handleRoleToneSelect(option)}>
                            <span className={`chip ${option.className} employee-role-chip`}>{option.toneLabel}</span>
                            <small>{option.detailLabel}</small>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="employee-role-dialog-note">
                      <strong>วิธีใช้งาน</strong>
                      <p>เลือกโทนสีที่ใกล้เคียงก่อน แล้วค่อยปรับหัวข้อและคำอธิบายให้เหมาะกับตำแหน่งจริงของพนักงาน</p>
                    </div>
                  </aside>
                </div>

                <div className="employee-role-dialog-actions">
                  <button type="button" className="ghost-button" onClick={() => setIsRoleEditorOpen(false)}>ปิดหน้าต่าง</button>
                  <button type="button" className="primary-inline" onClick={() => setIsRoleEditorOpen(false)}>ใช้ค่าชุดนี้</button>
                </div>
              </section>
            </div>
          ) : null}

          {saveMessage ? <div className="form-success top-spaced"><span>{saveMessage}</span></div> : null}
        </form>
      </section>
    </DesktopWorkspace>
  );
}

export function ManagerNotificationsPage({ initialFilter = 'all' } = {}) {
  const { inventoryItems, issueReports, updateIssueReport } = useAppState();
  const [alertFilter, setAlertFilter] = useState(initialFilter);
  const [alertQuery, setAlertQuery] = useState('');
  const isHistoryFilter = alertFilter === 'history';

  const issueAlerts = useMemo(() => [...issueReports]
    .sort((leftIssue, rightIssue) => {
      const severityDiff = getIssueSeverityWeight(rightIssue) - getIssueSeverityWeight(leftIssue);
      if (severityDiff !== 0) {
        return severityDiff;
      }

      const statusWeight = {
        'รอดำเนินการ': 3,
        'กำลังตรวจสอบ': 2,
        'ดำเนินการแล้ว': 1,
      };

      return (statusWeight[rightIssue.status] ?? 0) - (statusWeight[leftIssue.status] ?? 0);
    })
    .map((issue) => ({
      id: `issue-${issue.id}`,
      kind: 'issue',
      issueId: issue.id,
      title: issue.title,
      detail: `${issue.date} • ระดับ${issue.severity}`,
      action: issue.status,
      tone: getIssueTone(issue),
      severity: issue.severity,
      reporter: issue.employeeName ?? issue.reportedBy ?? null,
      extraDetail: issue.detail ?? '',
    })), [issueReports]);

  const activeIssueAlerts = useMemo(() => issueAlerts.filter((alert) => alert.action !== 'ดำเนินการแล้ว'), [issueAlerts]);
  const resolvedIssueAlerts = useMemo(() => issueAlerts.filter((alert) => alert.action === 'ดำเนินการแล้ว'), [issueAlerts]);

  const lowStockAlerts = useMemo(() => [...inventoryItems]
    .filter((item) => Number(item.quantity ?? 0) <= Number(item.threshold ?? 0))
    .sort((leftItem, rightItem) => {
      const leftDeficit = Number(leftItem.threshold ?? 0) - Number(leftItem.quantity ?? 0);
      const rightDeficit = Number(rightItem.threshold ?? 0) - Number(rightItem.quantity ?? 0);
      if (rightDeficit !== leftDeficit) {
        return rightDeficit - leftDeficit;
      }

      return Number(leftItem.quantity ?? 0) - Number(rightItem.quantity ?? 0);
    })
    .map((item) => {
      const threshold = Number(item.threshold ?? 0);
      const quantity = Number(item.quantity ?? 0);
      const deficit = Math.max(threshold - quantity, 0);
      return {
        id: `stock-${item.id}`,
        kind: 'stock',
        issueId: null,
        title: item.name,
        detail: `เหลือ ${quantity} ${item.unit} จากจุดเตือน ${threshold} ${item.unit}`,
        action: 'สต็อกต่ำ',
        tone: quantity === 0 || deficit >= Math.max(1, Math.ceil(threshold / 2)) ? 'danger' : 'warning',
        severity: quantity === 0 ? 'สูง' : 'กลาง',
        reporter: null,
        extraDetail: `หมวดหมู่ ${item.category || 'อื่นๆ'}${item.checkedAt ? ` • เช็กล่าสุด ${item.checkedAt}` : ''}${item.checkedBy ? ` โดย ${item.checkedBy}` : ''}`,
      };
    }), [inventoryItems]);

  const sortAlerts = (sourceAlerts) => {
    const toneWeight = { danger: 3, warning: 2, ok: 1 };
    const kindWeight = { issue: 2, stock: 1 };

    return [...sourceAlerts].sort((leftAlert, rightAlert) => {
      const toneDiff = (toneWeight[rightAlert.tone] ?? 0) - (toneWeight[leftAlert.tone] ?? 0);
      if (toneDiff !== 0) {
        return toneDiff;
      }

      const kindDiff = (kindWeight[rightAlert.kind] ?? 0) - (kindWeight[leftAlert.kind] ?? 0);
      if (kindDiff !== 0) {
        return kindDiff;
      }

      return String(leftAlert.title).localeCompare(String(rightAlert.title), 'th');
    });
  };

  const currentAlerts = useMemo(() => sortAlerts([...activeIssueAlerts, ...lowStockAlerts]), [activeIssueAlerts, lowStockAlerts]);
  const historyAlerts = useMemo(() => sortAlerts(resolvedIssueAlerts), [resolvedIssueAlerts]);

  const openIssues = useMemo(() => issueReports.filter((issue) => issue.status !== 'ดำเนินการแล้ว'), [issueReports]);
  const pendingIssues = useMemo(() => issueReports.filter((issue) => issue.status === 'รอดำเนินการ'), [issueReports]);
  const reviewingIssues = useMemo(() => issueReports.filter((issue) => issue.status === 'กำลังตรวจสอบ'), [issueReports]);
  const highSeverityIssues = useMemo(() => openIssues.filter((issue) => issue.severity === 'สูง'), [openIssues]);
  const resolvedIssues = useMemo(() => issueReports.filter((issue) => issue.status === 'ดำเนินการแล้ว'), [issueReports]);
  const resolvedHighSeverityIssues = useMemo(() => resolvedIssues.filter((issue) => issue.severity === 'สูง'), [resolvedIssues]);
  const filterTabs = [
    { value: 'all', label: 'ทั้งหมด' },
    { value: 'urgent', label: 'ด่วน' },
    { value: 'issues', label: 'ปัญหา' },
    { value: 'stock', label: 'สต็อกต่ำ' },
    { value: 'history', label: 'ประวัติ' },
  ];

  const filteredAlerts = useMemo(() => {
    const baseAlerts = (() => {
      if (alertFilter === 'history') {
        return historyAlerts;
      }

      if (alertFilter === 'urgent') {
        return currentAlerts.filter((alert) => alert.tone === 'danger');
      }

      if (alertFilter === 'issues') {
        return currentAlerts.filter((alert) => alert.kind === 'issue');
      }

      if (alertFilter === 'stock') {
        return currentAlerts.filter((alert) => alert.kind === 'stock');
      }

      return currentAlerts;
    })();

    const normalizedQuery = alertQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return baseAlerts;
    }

    return baseAlerts.filter((alert) => `${alert.title} ${alert.detail} ${alert.action} ${alert.extraDetail} ${alert.reporter ?? ''}`.toLowerCase().includes(normalizedQuery));
  }, [alertFilter, alertQuery, currentAlerts, historyAlerts]);

  const handleIssueStatus = (issueId, status) => {
    updateIssueReport(issueId, { status });
  };

  const panelTitle = isHistoryFilter ? 'ประวัติแจ้งเตือนเก่า' : 'สิ่งที่ต้องดูตอนนี้';
  const panelDescription = isHistoryFilter
    ? 'ดูรายการปัญหาที่ปิดงานแล้วและค้นย้อนหลังได้จากหน้าเดียว'
    : 'กรอง ค้นหา และติดตามทั้งปัญหากับรายการสต็อกต่ำได้จากหน้าเดียว';
  const shellTitle = isHistoryFilter ? 'คลังประวัติแจ้งเตือน' : 'ศูนย์แจ้งเตือนร้าน';
  const shellDescription = isHistoryFilter
    ? 'รวมรายการที่ปิดงานแล้วเพื่อย้อนดูบริบทเดิมได้ โดยไม่ปะปนกับงานค้างปัจจุบัน'
    : 'รวมปัญหาที่พนักงานแจ้งและสต็อกที่ต่ำกว่าจุดเตือน เพื่อให้ผู้จัดการติดตามงานจากหน้าเดียว';
  const visibleAlerts = isHistoryFilter ? historyAlerts : currentAlerts;

  return (
    <DesktopWorkspace title="แจ้งเตือน" contentClassName="desktop-content--notifications-fixed">
      <div className="notification-page">
      <section className="schedule-board-note panel-card compact-page-bar">
        <div className="compact-page-lead">
          <strong>{shellTitle}</strong>
          <p>{shellDescription}</p>
        </div>
        <div className="compact-page-stats">
          <span className={`compact-page-stat ${isHistoryFilter ? (resolvedIssues.length ? 'ok' : 'warning') : (openIssues.length ? 'danger' : 'ok')}`}>{isHistoryFilter ? `ปิดงานแล้ว ${resolvedIssues.length}` : `ปัญหาค้าง ${openIssues.length}`}</span>
          <span className={`compact-page-stat ${isHistoryFilter ? (resolvedHighSeverityIssues.length ? 'warning' : 'ok') : (lowStockAlerts.length ? 'warning' : 'ok')}`}>{isHistoryFilter ? `เคสหนักย้อนหลัง ${resolvedHighSeverityIssues.length}` : `สต็อกต่ำ ${lowStockAlerts.length}`}</span>
          <span className={`compact-page-stat ${isHistoryFilter ? (issueReports.length ? 'ok' : 'warning') : (highSeverityIssues.length ? 'danger' : 'ok')}`}>{isHistoryFilter ? `แจ้งเตือนรวม ${issueReports.length}` : `รุนแรงสูง ${highSeverityIssues.length}`}</span>
        </div>
      </section>

      <section className="workspace-columns notifications-layout">
        <article className="panel-card notification-panel">
          <div className="panel-head">
            <div>
              <h3>{panelTitle}</h3>
              <p>{panelDescription}</p>
            </div>
            <Bell size={18} className={`panel-accent ${isHistoryFilter ? 'warning' : 'danger'}`} />
          </div>

          <div className="notification-feed-shell">
            <div className="notification-toolbar notification-toolbar-sticky">
              <div className="notification-toolbar-main">
                <div className="segmented-control">
                  {filterTabs.map((item) => (
                    <button key={item.value} type="button" className={alertFilter === item.value ? 'active' : undefined} onClick={() => setAlertFilter(item.value)}>{item.label}</button>
                  ))}
                </div>

                <input className="text-input notification-search-input" placeholder="ค้นหาหัวข้อปัญหา ชื่อสินค้า รายละเอียด หรือชื่อผู้แจ้ง" value={alertQuery} onChange={(event) => setAlertQuery(event.target.value)} />
              </div>
            </div>

            <div className="request-feed">
              {filteredAlerts.map((alert) => {
              return (
                <div key={alert.id} className="request-feed-item">
                  <div>
                    <strong>{alert.title}</strong>
                    <p>{alert.detail}</p>
                    {alert.extraDetail ? <span className="request-feed-caption">{alert.extraDetail}</span> : null}
                    {alert.reporter ? <span className="request-feed-caption">ผู้แจ้ง: {alert.reporter}</span> : null}
                  </div>
                  <div className="request-feed-side">
                    <span className={`status-chip ${alert.tone}`}>{alert.action}</span>
                    {alert.kind === 'issue' && !isHistoryFilter ? (
                      <div className="request-feed-actions">
                        <button type="button" className="ghost-button" onClick={() => handleIssueStatus(alert.issueId, 'กำลังตรวจสอบ')} disabled={alert.action === 'กำลังตรวจสอบ'}>รับทราบแล้ว</button>
                        <button type="button" className="primary-inline" onClick={() => handleIssueStatus(alert.issueId, 'ดำเนินการแล้ว')} disabled={alert.action === 'ดำเนินการแล้ว'}>ปิดงาน</button>
                      </div>
                    ) : <span className="request-feed-helper">{isHistoryFilter ? 'ปิดงานแล้ว • ใช้รายการนี้สำหรับย้อนดูรายละเอียดเดิม' : 'ติดตามให้ทีมตรวจนับและวางแผนเติมสินค้า'}</span>}
                  </div>
                </div>
              );
              })}
              {!filteredAlerts.length ? <div className="empty-card">ไม่พบรายการตามตัวกรองหรือคำค้นที่เลือก</div> : null}
            </div>
          </div>
        </article>

        <aside className="panel-card notification-side-panel">
          <div className="panel-head">
            <div>
              <h3>สรุปเร็ว</h3>
              <p>ภาพรวมที่ช่วยตัดสินใจก่อนเปิดรายการย่อย</p>
            </div>
            <TriangleAlert size={18} className="panel-accent danger" />
          </div>

          <div className="notification-summary-grid">
            <article className="notification-summary-card danger">
              <div className="notification-summary-card-head">
                <span className="notification-summary-icon danger"><TriangleAlert size={16} /></span>
                <span className="notification-summary-label">{isHistoryFilter ? 'ปิดงานแล้ว' : 'รอดำเนินการ'}</span>
              </div>
              <strong>{isHistoryFilter ? resolvedIssues.length : pendingIssues.length}</strong>
              <small>{isHistoryFilter ? (resolvedIssues[0] ? resolvedIssues[0].title : 'ยังไม่มีประวัติที่ปิดงานแล้ว') : (pendingIssues[0] ? pendingIssues[0].title : 'ไม่มีรายการรอดำเนินการ')}</small>
            </article>
            <article className="notification-summary-card warning">
              <div className="notification-summary-card-head">
                <span className="notification-summary-icon warning"><PackageSearch size={16} /></span>
                <span className="notification-summary-label">{isHistoryFilter ? 'รุนแรงสูง' : 'สต็อกต่ำ'}</span>
              </div>
              <strong>{isHistoryFilter ? resolvedHighSeverityIssues.length : lowStockAlerts.length}</strong>
              <small>{isHistoryFilter ? (resolvedHighSeverityIssues[0] ? resolvedHighSeverityIssues[0].title : 'ยังไม่มีเคสหนักในประวัติ') : (lowStockAlerts[0] ? lowStockAlerts[0].title : 'ยังไม่มีสินค้าต่ำกว่าจุดเตือน')}</small>
            </article>
            <article className="notification-summary-card warning">
              <div className="notification-summary-card-head">
                <span className="notification-summary-icon warning"><Bell size={16} /></span>
                <span className="notification-summary-label">{isHistoryFilter ? 'ย้อนหลังทั้งหมด' : 'กำลังตรวจสอบ'}</span>
              </div>
              <strong>{isHistoryFilter ? historyAlerts.length : reviewingIssues.length}</strong>
              <small>{isHistoryFilter ? (historyAlerts[0] ? historyAlerts[0].title : 'ยังไม่มีรายการย้อนหลัง') : (reviewingIssues[0] ? reviewingIssues[0].title : 'ยังไม่มีงานที่รับทราบแล้ว')}</small>
            </article>
          </div>

          <div className="notification-mini-feed">
            <strong className="notification-mini-feed-title">{isHistoryFilter ? 'ปิดงานล่าสุด' : 'รายการล่าสุด'}</strong>
            {visibleAlerts.slice(0, 4).map((alert) => (
              <div key={`summary-${alert.id}`} className={`notification-mini-item kind-${alert.kind}`}>
                <div className="notification-mini-item-head">
                  <div className="notification-mini-item-title">
                    <span className={`notification-mini-kind ${alert.kind}`}>
                      {alert.kind === 'issue' ? <TriangleAlert size={14} /> : <PackageSearch size={14} />}
                    </span>
                    <strong>{alert.title}</strong>
                  </div>
                  <span className={`status-chip ${alert.tone}`}>{alert.action}</span>
                </div>
                <div className="notification-mini-item-detail">
                  <p>{alert.detail}</p>
                </div>
              </div>
            ))}
            {!visibleAlerts.length ? <div className="empty-card compact">{isHistoryFilter ? 'ยังไม่มีประวัติแจ้งเตือนของสาขา' : 'ตอนนี้ยังไม่มีรายการแจ้งเตือนของสาขา'}</div> : null}
          </div>
        </aside>
      </section>
      </div>
    </DesktopWorkspace>
  );
}

export function ReportsPage() {
  const { inventoryItems } = useAppState();
  const [filter, setFilter] = useState('all');
  const lowStockItems = useMemo(() => inventoryItems.filter((item) => item.quantity <= item.threshold), [inventoryItems]);
  const lowestRemainingItem = useMemo(() => [...inventoryItems].sort((leftItem, rightItem) => {
    const quantityDiff = Number(leftItem.quantity ?? 0) - Number(rightItem.quantity ?? 0);
    if (quantityDiff !== 0) {
      return quantityDiff;
    }

    return Number(leftItem.threshold ?? 0) - Number(rightItem.threshold ?? 0);
  })[0] ?? null, [inventoryItems]);
  const expiringItems = useMemo(() => inventoryItems.filter((item) => getDaysUntilExpiry(item.expiresOn) <= 5), [inventoryItems]);
  const newArrivalItems = useMemo(() => [...inventoryItems].filter((item) => Number(item.receivedToday ?? 0) > 0).sort((leftItem, rightItem) => Number(rightItem.receivedToday ?? 0) - Number(leftItem.receivedToday ?? 0)), [inventoryItems]);
  const totalNewToday = useMemo(() => inventoryItems.reduce((sum, item) => sum + Number(item.receivedToday ?? 0), 0), [inventoryItems]);
  const checkedItemsCount = useMemo(() => inventoryItems.filter((item) => Boolean(item.checkedAt)).length, [inventoryItems]);
  const recentlyCheckedItems = useMemo(() => {
    const parseCheckedValue = (dateString = '') => {
      const match = String(dateString).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
      if (!match) {
        return 0;
      }

      const [, day, month, year, hours, minutes] = match;
      return new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes)).getTime();
    };

    return [...inventoryItems]
      .filter((item) => item.checkedAt)
      .sort((leftItem, rightItem) => parseCheckedValue(rightItem.checkedAt) - parseCheckedValue(leftItem.checkedAt));
  }, [inventoryItems]);

  const filterMeta = {
    all: { label: 'สต็อกทั้งหมด', description: 'ดูของเหลือ วันหมดอายุ ของมาใหม่ และรายการที่พนักงานเช็กล่าสุด' },
    expiring: { label: 'ใกล้หมดอายุ', description: 'มองเฉพาะของที่ควรติดตามก่อนถึงวันหมดอายุ' },
    new: { label: 'ของมาใหม่', description: 'ดูของที่พนักงานเพิ่งรับเข้าในวันนี้' },
    checked: { label: 'เช็กล่าสุด', description: 'ดูสินค้าที่พนักงานเพิ่งตรวจนับล่าสุด' },
  };

  const leadInventoryItem = lowestRemainingItem ?? expiringItems[0] ?? lowStockItems[0] ?? newArrivalItems[0] ?? recentlyCheckedItems[0] ?? inventoryItems[0] ?? null;

  const reportOverviewCards = useMemo(() => ([
    {
      id: 'stock-remaining',
      label: leadInventoryItem ? `คงเหลือ ${leadInventoryItem.name}` : 'ของเหลือในคลัง',
      value: leadInventoryItem ? `${leadInventoryItem.quantity} ${leadInventoryItem.unit}` : '0 หน่วย',
      detail: leadInventoryItem ? `สินค้าที่เหลือน้อยที่สุดตอนนี้มี ${leadInventoryItem.quantity} ${leadInventoryItem.unit} • จุดเตือน ${leadInventoryItem.threshold} ${leadInventoryItem.unit}` : 'ยังไม่มีข้อมูลสินค้าในคลัง',
      tone: leadInventoryItem ? getInventoryTone(leadInventoryItem) : 'ok',
      icon: 'stock',
    },
    {
      id: 'stock-new',
      label: 'ของมาใหม่วันนี้',
      value: `${totalNewToday} หน่วย`,
      detail: newArrivalItems[0] ? `${newArrivalItems[0].name} เข้าเพิ่ม ${newArrivalItems[0].receivedToday} ${newArrivalItems[0].unit}` : 'วันนี้ยังไม่มีของที่รับเข้าใหม่',
      tone: totalNewToday ? 'ok' : 'warning',
      icon: 'checked',
    },
    {
      id: 'stock-expiry',
      label: 'ใกล้หมดอายุ',
      value: `${expiringItems.length} รายการ`,
      detail: expiringItems[0] ? `${expiringItems[0].name} หมดอายุ ${formatInventoryExpiryDate(expiringItems[0].expiresOn)}` : 'ยังไม่มีของใกล้หมดอายุ',
      tone: expiringItems.length ? 'warning' : 'ok',
      icon: 'expiry',
    },
    {
      id: 'stock-checked',
      label: 'พนักงานเช็กแล้ว',
      value: `${checkedItemsCount} รายการ`,
      detail: recentlyCheckedItems[0] ? `${recentlyCheckedItems[0].name} • ${recentlyCheckedItems[0].checkedBy ?? 'ไม่ระบุชื่อ'}` : 'ยังไม่มีประวัติเช็กสินค้า',
      tone: checkedItemsCount ? 'ok' : 'warning',
      icon: 'checked',
    },
  ]), [checkedItemsCount, expiringItems, leadInventoryItem, newArrivalItems, recentlyCheckedItems, totalNewToday]);

  const managerSummary = useMemo(() => {
    const leadItem = expiringItems[0] ?? lowStockItems[0] ?? newArrivalItems[0] ?? recentlyCheckedItems[0] ?? null;
    return {
      eyebrow: 'สรุปคลังสินค้า',
      title: leadItem ? leadItem.name : 'สต็อกอยู่ในเกณฑ์ดี',
      detail: leadItem ? `เหลือ ${leadItem.quantity} ${leadItem.unit} • หมดอายุ ${formatInventoryExpiryDate(leadItem.expiresOn)} • เช็กล่าสุด ${leadItem.checkedBy ?? 'ไม่ระบุชื่อ'}` : 'ยังไม่มีรายการที่ต้องเฝ้าติดตามหรือประสานทีมตรวจสอบ',
      chip: expiringItems.length ? `ใกล้หมดอายุ ${expiringItems.length}` : lowStockItems.length ? `ต่ำกว่าจุดเตือน ${lowStockItems.length}` : totalNewToday ? `มาใหม่ ${totalNewToday}` : 'พร้อมใช้งาน',
      tone: expiringItems.length ? 'warning' : lowStockItems.length ? 'danger' : 'ok',
      icon: expiringItems.length ? 'expiry' : lowStockItems.length ? 'alert' : 'stock',
    };
  }, [expiringItems, lowStockItems, newArrivalItems, recentlyCheckedItems, totalNewToday]);

  const filteredRows = useMemo(() => {
    const sortedByPriority = [...inventoryItems]
      .sort((leftItem, rightItem) => {
        const toneWeight = { danger: 3, warning: 2, ok: 1 };
        const toneDiff = toneWeight[getInventoryTone(rightItem)] - toneWeight[getInventoryTone(leftItem)];
        if (toneDiff !== 0) {
          return toneDiff;
        }
        return getDaysUntilExpiry(leftItem.expiresOn) - getDaysUntilExpiry(rightItem.expiresOn);
      });

    let sourceItems = sortedByPriority;

    if (filter === 'expiring') {
      sourceItems = expiringItems;
    } else if (filter === 'new') {
      sourceItems = newArrivalItems;
    } else if (filter === 'checked') {
      sourceItems = recentlyCheckedItems;
    }

    return sourceItems.map((item) => {
      const tone = getInventoryTone(item);
      const expiryDays = getDaysUntilExpiry(item.expiresOn);
      const stockFill = Math.max(10, Math.min(100, Math.round((item.quantity / Math.max(item.threshold * 2, 1)) * 100)));
      return {
        id: `stock-${item.id}`,
        tone,
        title: item.name,
        subtitle: `เหลือ ${item.quantity} ${item.unit} • หมดอายุ ${formatInventoryExpiryDate(item.expiresOn)}`,
        badge: getManagerStockBadge(item),
        progressPrimary: `ของเข้าใหม่วันนี้ ${Number(item.receivedToday ?? 0)} ${item.unit} • จุดเตือน ${item.threshold} ${item.unit}`,
        progressSecondary: `เช็กล่าสุด ${item.checkedAt ?? '-'}${item.checkedBy ? ` โดย ${item.checkedBy}` : ''}${expiryDays <= 0 ? ' • ควรประสานทีมตรวจสอบทันที' : ` • เหลืออีก ${expiryDays} วัน`}`,
        fillWidth: stockFill,
      };
    });
  }, [expiringItems, filter, inventoryItems, newArrivalItems, recentlyCheckedItems]);

  return (
    <DesktopWorkspace title="รายงาน" contentClassName="desktop-content--reports-fixed">
      <div className="report-screen-shell">
        <section className="schedule-board-note panel-card compact-page-bar report-page-bar">
          <div className="compact-page-lead">
            <strong>ศูนย์รายงานสาขา</strong>
            <p>รวมภาพสต็อก ของมาใหม่ วันหมดอายุ และสิ่งที่พนักงานเช็กไว้ล่าสุดให้อยู่ในหน้าเดียว</p>
          </div>
          <div className="report-page-actions">
            <div className="compact-page-stats">
              <span className={`compact-page-stat ${lowStockItems.length ? 'danger' : 'ok'}`}>สต็อกต่ำ {lowStockItems.length}</span>
              <span className={`compact-page-stat ${expiringItems.length ? 'warning' : 'ok'}`}>ใกล้หมดอายุ {expiringItems.length}</span>
              <span className={`compact-page-stat ${totalNewToday ? 'ok' : ''}`}>ของมาใหม่ {totalNewToday}</span>
              <span className="compact-page-stat">เช็กแล้ว {checkedItemsCount} รายการ</span>
            </div>
            <Link className="ghost-button report-catalog-jump-button" to={routePaths.inventoryCatalog}>ไปหน้ารายการในคลัง</Link>
          </div>
        </section>

        <section className="report-analytics-grid">
          <article className="panel-card report-main-panel">
            <div className="panel-head">
              <div>
                <h3>รายงานคลังจากข้อมูลจริง</h3>
                <p>{filterMeta[filter].description}</p>
              </div>
              <div className="segmented-control">
                {[
                  { value: 'all', label: 'ทั้งหมด' },
                  { value: 'expiring', label: 'ใกล้หมดอายุ' },
                  { value: 'new', label: 'ของมาใหม่' },
                  { value: 'checked', label: 'เช็กล่าสุด' },
                ].map((item) => <button key={item.value} type="button" className={filter === item.value ? 'active' : undefined} onClick={() => setFilter(item.value)}>{item.label}</button>)}
              </div>
            </div>

            <div className="report-section-head">
              <strong>ภาพรวมวันนี้</strong>
              <span>{reportOverviewCards.length} ตัวชี้วัด</span>
            </div>
            <div className="report-overview-strip">
              {reportOverviewCards.map((card) => (
                <article key={card.id} className={`report-overview-card ${card.tone}`}>
                  <div className="report-overview-head">
                    <span className={`report-overview-icon ${card.tone}`}>{renderManagerReportIcon(card.icon)}</span>
                    <span className="report-overview-label">{card.label}</span>
                  </div>
                  <strong>{card.value}</strong>
                  <small>{card.detail}</small>
                </article>
              ))}
            </div>

            <div className="report-section-head">
              <strong>รายการที่ต้องติดตาม</strong>
              <span>{filteredRows.length} รายการ</span>
            </div>
            <div className="report-card-list">
              {filteredRows.map((row) => (
                <div key={row.id} className={`report-block-card ${row.tone}`}>
                  <div className="report-block-main">
                    <div className="report-block-title-group">
                      <div className="report-block-kicker-row">
                        <span className={`report-kind-pill ${row.tone}`}>{filterMeta[filter].label}</span>
                      </div>
                      <strong>{row.title}</strong>
                      <p>{row.subtitle}</p>
                    </div>
                    <span className={`status-chip ${row.tone}`}>{row.badge}</span>
                  </div>
                  <div className="report-progress-copy">
                    <span>{row.progressPrimary}</span>
                    <small>{row.progressSecondary}</small>
                  </div>
                  <div className="report-coverage-track">
                    <span className={`report-coverage-fill ${row.tone}`} style={{ width: `${Math.max(row.fillWidth, 8)}%` }} />
                  </div>
                </div>
              ))}
              {!filteredRows.length ? <div className="empty-card">ไม่พบข้อมูลตามหมวดรายงานที่เลือก</div> : null}
            </div>
          </article>

          <aside className="panel-card report-insights-panel">
            <div className="panel-head">
              <div>
                <h3>สรุปสำหรับผู้จัดการ</h3>
                <p>อ่านมุมมองคลังสั้น ๆ เพื่อกำกับงาน ติดตามความเสี่ยง และประสานทีมให้ตรงจุด</p>
              </div>
              <BarChart3 size={18} className="panel-accent danger" />
            </div>

            <article className={`report-manager-brief ${managerSummary.tone}`}>
              <div className="report-manager-brief-head">
                <span className={`report-overview-icon ${managerSummary.tone}`}>{renderManagerReportIcon(managerSummary.icon, 18)}</span>
                <div>
                  <small>{managerSummary.eyebrow}</small>
                  <strong>{managerSummary.title}</strong>
                </div>
              </div>
              <p>{managerSummary.detail}</p>
              <span className={`status-chip ${managerSummary.tone}`}>{managerSummary.chip}</span>
            </article>

            <div className="report-side-section">
              <div className="report-side-section-head">
                <strong>เช็กล่าสุดโดยพนักงาน</strong>
                <span className="list-summary">{recentlyCheckedItems.length ? `${recentlyCheckedItems.length} รายการ` : 'ยังไม่มีข้อมูล'}</span>
              </div>
              <div className="report-insight-list">
                {recentlyCheckedItems.length ? recentlyCheckedItems.slice(0, 3).map((item) => (
                  <div key={`checked-${item.id}`} className="report-insight-item">
                    <div>
                      <strong>{item.name}</strong>
                      <p>{item.checkedAt} • {item.checkedBy ?? 'ไม่ระบุชื่อ'} • หมดอายุ {formatInventoryExpiryDate(item.expiresOn)}</p>
                    </div>
                    <span className={`status-chip ${getInventoryTone(item)}`}>{getManagerStockBadge(item)}</span>
                  </div>
                )) : <div className="empty-card">ตอนนี้ยังไม่มีรายการเช็กสินค้าจากพนักงาน</div>}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </DesktopWorkspace>
  );
}

function formatInventoryExpiryDate(dateString = '') {
  const parsedDate = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('th-TH-u-ca-buddhist', { day: 'numeric', month: 'short', year: 'numeric' }).format(parsedDate);
}

function getManagerStockBadge(item) {
  const expiryDays = getDaysUntilExpiry(item.expiresOn);
  if (expiryDays <= 0) {
    return 'หมดอายุแล้ว';
  }

  if (expiryDays <= 2) {
    return 'เร่งติดตาม';
  }

  if (item.quantity <= item.threshold) {
    return 'ต่ำกว่าจุดเตือน';
  }

  if (Number(item.receivedToday ?? 0) > 0) {
    return 'มาใหม่';
  }

  return 'ปกติ';
}

function renderManagerReportIcon(icon, size = 16) {
  if (icon === 'alert') {
    return <TriangleAlert size={size} />;
  }

  if (icon === 'stock') {
    return <PackageSearch size={size} />;
  }

  if (icon === 'expiry') {
    return <Clock3 size={size} />;
  }

  if (icon === 'checked') {
    return <Bell size={size} />;
  }

  return <BarChart3 size={size} />;
}

function InventoryCatalogPanel({ inventoryItems, className = '' }) {
  const [inventoryQuery, setInventoryQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const inventoryCategories = useMemo(() => {
    const categories = Array.from(new Set(inventoryItems.map((item) => item.category || 'อื่นๆ')));
    return categories.sort((leftCategory, rightCategory) => leftCategory.localeCompare(rightCategory, 'th'));
  }, [inventoryItems]);

  const filteredCatalogGroups = useMemo(() => {
    const normalizedQuery = inventoryQuery.trim().toLowerCase();
    const sortedItems = [...inventoryItems].sort((leftItem, rightItem) => {
      const categoryDiff = String(leftItem.category || 'อื่นๆ').localeCompare(String(rightItem.category || 'อื่นๆ'), 'th');
      if (categoryDiff !== 0) {
        return categoryDiff;
      }

      const toneWeight = { danger: 3, warning: 2, ok: 1 };
      const toneDiff = (toneWeight[getInventoryTone(rightItem)] ?? 0) - (toneWeight[getInventoryTone(leftItem)] ?? 0);
      if (toneDiff !== 0) {
        return toneDiff;
      }

      return String(leftItem.name).localeCompare(String(rightItem.name), 'th');
    });

    const filteredItems = sortedItems.filter((item) => {
      const itemCategory = item.category || 'อื่นๆ';
      if (categoryFilter !== 'all' && itemCategory !== categoryFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return `${item.name} ${itemCategory} ${item.checkedBy ?? ''} ${item.unit}`.toLowerCase().includes(normalizedQuery);
    });

    const groupedItems = new Map();
    filteredItems.forEach((item) => {
      const category = item.category || 'อื่นๆ';
      if (!groupedItems.has(category)) {
        groupedItems.set(category, []);
      }
      groupedItems.get(category).push(item);
    });

    return Array.from(groupedItems.entries()).map(([category, items]) => ({ category, items }));
  }, [categoryFilter, inventoryItems, inventoryQuery]);

  const filteredCatalogCount = useMemo(() => filteredCatalogGroups.reduce((sum, group) => sum + group.items.length, 0), [filteredCatalogGroups]);

  return (
    <section className={`panel-card report-catalog-panel ${className}`.trim()}>
      <div className="panel-head">
        <div>
          <h3>คลังสต็อก</h3>
          <p>ดูรายการสินค้าในคลังทั้งหมด ค้นหาได้ และแยกตามหมวดหมู่เพื่อเช็กภาพรวมของสาขา</p>
        </div>
        <PackageSearch size={18} className="panel-accent danger" />
      </div>

      <div className="report-catalog-toolbar">
        <input className="text-input report-catalog-search" placeholder="ค้นหาชื่อสินค้า หมวดหมู่ หรือชื่อพนักงานที่เช็กล่าสุด" value={inventoryQuery} onChange={(event) => setInventoryQuery(event.target.value)} />
        <select className="text-input report-catalog-select" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
          <option value="all">ทุกหมวดหมู่</option>
          {inventoryCategories.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
      </div>

      <div className="report-section-head">
        <strong>รายการในคลัง</strong>
        <span>{filteredCatalogCount} รายการ • {filteredCatalogGroups.length} หมวดหมู่</span>
      </div>

      <div className="report-catalog-list">
        {filteredCatalogGroups.map((group) => (
          <section key={group.category} className="report-catalog-group">
            <div className="report-catalog-group-list">
              {group.items.map((item) => {
                const tone = getInventoryTone(item);
                const expiryLabel = item.noExpiry ? 'ไม่กำหนด' : formatInventoryExpiryDate(item.expiresOn);
                return (
                  <article key={`catalog-${item.id}`} className={`report-catalog-row ${tone}`}>
                    <div className="report-catalog-main">
                      <div className="report-block-kicker-row">
                        <span className={`report-kind-pill ${tone}`}>{item.category || 'อื่นๆ'}</span>
                        <span className="report-catalog-meta">จุดเตือน {item.threshold} {item.unit}</span>
                      </div>
                      <strong>{item.name}</strong>
                      <p>คงเหลือ {item.quantity} {item.unit} • หมดอายุ {expiryLabel} • มาใหม่วันนี้ {Number(item.receivedToday ?? 0)} {item.unit}</p>
                    </div>
                    <div className="report-catalog-side">
                      <span className={`status-chip ${tone}`}>{getManagerStockBadge(item)}</span>
                      <small>เช็กล่าสุด {item.checkedAt ?? '-'}{item.checkedBy ? ` โดย ${item.checkedBy}` : ''}</small>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
        {!filteredCatalogCount ? <div className="empty-card">ไม่พบรายการในคลังตามคำค้นหรือหมวดหมู่ที่เลือก</div> : null}
      </div>
    </section>
  );
}

export function ManagerNotificationHistoryPage() {
  return <ManagerNotificationsPage initialFilter="history" />;
}

export function InventoryCatalogPage() {
  const { inventoryItems } = useAppState();
  const lowStockItems = useMemo(() => inventoryItems.filter((item) => item.quantity <= item.threshold), [inventoryItems]);
  const expiringItems = useMemo(() => inventoryItems.filter((item) => getDaysUntilExpiry(item.expiresOn) <= 5), [inventoryItems]);
  const totalNewToday = useMemo(() => inventoryItems.reduce((sum, item) => sum + Number(item.receivedToday ?? 0), 0), [inventoryItems]);
  const categoryCount = useMemo(() => new Set(inventoryItems.map((item) => item.category || 'อื่นๆ')).size, [inventoryItems]);

  return (
    <DesktopWorkspace title="คลังสต็อก" contentClassName="desktop-content--reports-fixed">
      <div className="report-screen-shell">
        <section className="schedule-board-note panel-card compact-page-bar report-page-bar">
          <div className="compact-page-lead">
            <strong>รายการในคลัง</strong>
            <p>ดูสต็อกทั้งหมดของสาขา ค้นหารายการ และกรองตามหมวดหมู่ได้จากหน้าเดียว</p>
          </div>
          <div className="report-page-actions">
            <div className="compact-page-stats">
              <span className={`compact-page-stat ${lowStockItems.length ? 'danger' : 'ok'}`}>สต็อกต่ำ {lowStockItems.length}</span>
              <span className={`compact-page-stat ${expiringItems.length ? 'warning' : 'ok'}`}>ใกล้หมดอายุ {expiringItems.length}</span>
              <span className={`compact-page-stat ${totalNewToday ? 'ok' : ''}`}>ของมาใหม่ {totalNewToday}</span>
              <span className="compact-page-stat">หมวดหมู่ {categoryCount}</span>
            </div>
            <Link className="ghost-button report-catalog-jump-button" to={routePaths.reports}>กลับหน้ารายงาน</Link>
          </div>
        </section>

        <InventoryCatalogPanel inventoryItems={inventoryItems} className="report-catalog-panel--fixed" />
      </div>
    </DesktopWorkspace>
  );
}

export function SettingsPage() {
  const { saveSettings, settings } = useAppState();
  const [formState, setFormState] = useState(settings);
  const [saveMessage, setSaveMessage] = useState('');
  const [showManagerPassword, setShowManagerPassword] = useState(false);
  const [accessMessage, setAccessMessage] = useState('');

  useEffect(() => {
    setFormState(settings);
  }, [settings]);

  const handleChange = (event) => {
    const { checked, name, type, value } = event.target;
    setFormState((currentState) => ({
      ...currentState,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const savedSettings = saveSettings(formState);
    setSaveMessage(`บันทึกการตั้งค่าแล้วเมื่อ ${savedSettings.lastSavedAt}`);
  };

  const handleCopyManagerPassword = async () => {
    if (!formState.managerPassword) {
      setAccessMessage('ยังไม่มีรหัสผ่านผู้จัดการให้คัดลอก');
      return;
    }

    try {
      await navigator.clipboard.writeText(formState.managerPassword);
      setAccessMessage(`คัดลอกรหัสผ่าน ${formState.managerPassword} แล้ว`);
    } catch {
      setAccessMessage('คัดลอกรหัสผ่านผู้จัดการไม่สำเร็จ ลองใหม่อีกครั้ง');
    }
  };

  return (
    <DesktopWorkspace title="ตั้งค่า">
      <form className="settings-form" onSubmit={handleSubmit}>
        <div className="settings-grid">
          <article className="panel-card settings-card settings-store-card">
            <div className="panel-head">
              <div>
                <h3>ข้อมูลสาขา</h3>
                <p>ข้อมูลส่วนนี้ใช้แสดงในหน้าหลัก รายงาน และส่วนหัวของระบบ</p>
              </div>
            </div>

            <div className="form-grid compact-form-grid">
              <label className="field-group">
                <span>ชื่อสาขา</span>
                <input className="text-input" name="storeName" value={formState.storeName} onChange={handleChange} />
              </label>
              <label className="field-group">
                <span>ชื่อผู้จัดการร้าน</span>
                <input className="text-input" name="managerName" value={formState.managerName} onChange={handleChange} />
              </label>
              <label className="field-group">
                <span>เบอร์โทรศัพท์ผู้จัดการ</span>
                <input className="text-input" name="managerPhone" value={formState.managerPhone} onChange={handleChange} />
              </label>
              <label className="field-group form-grid-full">
                <span>รหัสผ่านผู้จัดการ</span>
                <div className="employee-access-password-row settings-password-row">
                  <input className="text-input employee-access-password-input" name="managerPassword" type={showManagerPassword ? 'text' : 'password'} value={formState.managerPassword} onChange={handleChange} />
                  <button type="button" className="employee-access-password-toggle" onClick={() => setShowManagerPassword((currentValue) => !currentValue)} aria-label={showManagerPassword ? 'ซ่อนรหัสผ่านผู้จัดการ' : 'แสดงรหัสผ่านผู้จัดการ'}>
                    {showManagerPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button type="button" className="ghost-button employee-access-inline-copy" onClick={handleCopyManagerPassword}>
                    <Copy size={15} /> คัดลอก
                  </button>
                </div>
              </label>
              <label className="field-group form-grid-full">
                <span>มุมมองเริ่มต้น</span>
                <input className="text-input" name="preferredView" value="Desktop Schedule" readOnly />
              </label>
            </div>

            <div className="settings-access-note">
              <div className="settings-access-note-head">
                <span className="settings-access-note-icon"><ShieldCheck size={18} /></span>
                <div>
                  <strong>ข้อมูลที่ใช้ตอนนี้</strong>
                  <p>ใช้ข้อมูลชุดนี้สำหรับเข้า manager login ของสาขา</p>
                </div>
              </div>

              <div className="settings-access-note-credentials">
                <div className="settings-access-note-row">
                  <span className="settings-access-note-label"><Smartphone size={14} /> เบอร์โทร</span>
                  <b>{formState.managerPhone || '-'}</b>
                </div>
                <div className="settings-access-note-row">
                  <span className="settings-access-note-label"><LockKeyhole size={14} /> รหัสผ่าน</span>
                  <b>{formState.managerPassword || '-'}</b>
                </div>
              </div>
            </div>

            {accessMessage ? <div className="compact-home-note settings-access-feedback">{accessMessage}</div> : null}

            <div className="settings-inline-facts">
              <span className="settings-fact-pill">{formState.storeName || 'ยังไม่ได้ตั้งชื่อสาขา'}</span>
              <span className="settings-fact-pill">Manager login</span>
              <span className="settings-fact-pill">สิทธิ์เต็มของสาขา</span>
            </div>
          </article>

          <article className="panel-card settings-card settings-impact-card">
            <div className="panel-head">
              <div>
                <h3>การแจ้งเตือนและผลลัพธ์</h3>
                <p>ตั้งค่าเฉพาะสิ่งที่มีผลจริง พร้อมสรุปว่าหน้านี้จะไปเปลี่ยนอะไรในระบบบ้าง</p>
              </div>
            </div>

            <label className="field-group">
              <span>จำนวนคนที่ต่ำกว่าค่ากำหนดก่อนแจ้งเตือน</span>
              <select className="text-input" name="shortageThreshold" value={formState.shortageThreshold} onChange={handleChange}>
                <option value="1">ต่ำกว่าเป้าหมาย 1 คน</option>
                <option value="2">ต่ำกว่าเป้าหมาย 2 คน</option>
              </select>
            </label>

            <label className="checkbox-row">
              <input type="checkbox" name="notificationsEnabled" checked={formState.notificationsEnabled} onChange={handleChange} />
              <span>เปิดการแจ้งเตือนเมื่อช่วงเวลาใดคนไม่ครบ</span>
            </label>

            <label className="checkbox-row">
              <input type="checkbox" name="autoCloseResolvedRequests" checked={formState.autoCloseResolvedRequests} onChange={handleChange} />
              <span>ปิดคำขอให้อัตโนมัติเมื่อแก้ไขเสร็จแล้ว</span>
            </label>

            <div className="settings-impact-list">
              <div className="settings-impact-item">
                <strong>หน้าหลักและรายงาน</strong>
                <p>ใช้ชื่อสาขาและชื่อผู้จัดการเป็นข้อมูลอ้างอิงในส่วนหัวและการ์ดสรุป</p>
              </div>
              <div className="settings-impact-item">
                <strong>การแจ้งเตือนกำลังคน</strong>
                <p>{formState.notificationsEnabled ? `ระบบจะเตือนเมื่อจำนวนคนต่ำกว่าเป้าหมาย ${formState.shortageThreshold} คน` : 'ปิดการเตือนเรื่องจำนวนคนไม่ครบอยู่ในตอนนี้'}</p>
              </div>
              <div className="settings-impact-item">
                <strong>การติดตามคำขอ</strong>
                <p>{formState.autoCloseResolvedRequests ? 'คำขอที่แก้เสร็จแล้วจะถูกปิดให้อัตโนมัติ' : 'คำขอที่แก้เสร็จแล้วจะยังคงเปิดไว้จนกดปิดเอง'}</p>
              </div>
            </div>
          </article>
        </div>

        <div className="settings-actions">
          <button type="submit" className="primary-inline">บันทึกการตั้งค่า</button>
          {saveMessage ? <span className="save-note">{saveMessage}</span> : null}
        </div>
      </form>
    </DesktopWorkspace>
  );
}

export function ManagerLoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { managerLogin, managerSessionActive, settings } = useAppState();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const portalMessage = location.state?.portalMessage ?? '';

  if (managerSessionActive) {
    return <Navigate to={location.state?.returnTo ?? routePaths.home} replace />;
  }

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const isLoggedIn = await managerLogin(phone, password);
      if (!isLoggedIn) {
        setError('ไม่พบข้อมูลผู้จัดการจากเบอร์โทรและรหัสผ่านที่กรอก');
        return;
      }

      setError('');
      navigate(location.state?.returnTo ?? routePaths.home, { replace: true });
    } catch {
      setError('เชื่อมต่อข้อมูลผู้จัดการไม่สำเร็จ ลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="screen-stage desktop manager-login-stage">
      <div className="manager-login-shell">
        <section className="manager-login-showcase">
          <div className="manager-login-showcase-copy">
            <h2>พร้อมเปิดร้านแบบมั่นใจในทุกกะ</h2>
            <p>รวมตารางงาน การแจ้งเตือน สต็อก และปัญหาหน้างานไว้ใน flow เดียว เพื่อให้ผู้จัดการตัดสินใจได้เร็วตั้งแต่ก่อนเปิดร้าน</p>
          </div>

          <article className="manager-login-spotlight-card">
            <div className="manager-login-spotlight-head">
              <span className="manager-login-feature-icon"><Store size={18} /></span>
              <div>
                <strong>{settings.storeName}</strong>
                <p>หน้า manager ใช้จัดการตาราง พนักงาน และเรื่องเร่งด่วนของสาขาแบบต่อเนื่องในที่เดียว</p>
              </div>
            </div>

            <div className="manager-login-compact-points">
              <div>
                <small>สิทธิ์เข้าใช้</small>
                <strong>เฉพาะผู้จัดการ</strong>
              </div>
              <div>
                <small>พร้อมใช้งาน</small>
                <strong>ตาราง + แจ้งเตือน + สต็อก</strong>
              </div>
            </div>
          </article>
        </section>

        <section className="panel-card manager-login-card">
          <div className="panel-head manager-login-head">
            <div>
              <h3>เข้าสู่ระบบผู้จัดการ</h3>
              <p>ใส่เบอร์โทรศัพท์และรหัสผ่านเพื่อเข้าไปจัดการตาราง พนักงาน และการแจ้งเตือนของสาขา</p>
            </div>
            <LogIn size={18} className="panel-accent" />
          </div>

          {portalMessage ? <div className="form-success schedule-copy-notice"><span>{portalMessage}</span></div> : null}

          <div className="manager-login-grid">
            <label className="field-group manager-login-field">
              <span>เบอร์โทรศัพท์</span>
              <div className="manager-login-input-shell">
                <span className="manager-login-input-icon"><Smartphone size={16} /></span>
                <input className="text-input manager-login-input" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="เบอร์โทรศัพท์" />
              </div>
            </label>
            <label className="field-group manager-login-field">
              <span>รหัสผ่าน</span>
              <div className="manager-login-input-shell">
                <span className="manager-login-input-icon"><LockKeyhole size={16} /></span>
                <input className="text-input manager-login-input" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="รหัสผ่านผู้จัดการ" />
                <button type="button" className="manager-login-password-toggle" onClick={() => setShowPassword((currentValue) => !currentValue)} aria-label={showPassword ? 'ซ่อนรหัสผ่านผู้จัดการ' : 'แสดงรหัสผ่านผู้จัดการ'}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
          </div>

          {error ? <div className="form-success top-spaced employee-mobile-login-error"><span>{error}</span></div> : null}

          <div className="manager-login-actions">
            <button type="button" className="primary-inline manager-login-submit" onClick={handleSubmit} disabled={!phone.trim() || !password.trim()}>เข้าสู่ระบบผู้จัดการ</button>
            <Link className="ghost-button manager-login-secondary-link" to={routePaths.employeeLogin}>ไปหน้า Login พนักงาน</Link>
          </div>

          <div className="manager-login-footnote">
            <span>ชื่อผู้จัดการปัจจุบัน: {settings.managerName}</span>
            <span>ข้อมูลเข้าสู่ระบบสามารถอัปเดตได้จากหน้า ตั้งค่า หลังจาก login</span>
          </div>
        </section>
      </div>
    </div>
  );
}
