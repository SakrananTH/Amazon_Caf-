import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import DesktopSchedule from '../features/manager/DesktopSchedule.jsx';
import DesktopWorkspace from '../features/manager/DesktopWorkspace.jsx';
import EmployeeHolidayPlanner from '../features/manager/EmployeeHolidayPlanner.jsx';
import { EmployeesPage, HomePage, InventoryCatalogPage, ManagerLoginPage, ManagerNotificationsPage, ReportsPage, SettingsPage } from '../features/manager/ManagementPages.jsx';
import { EmployeeMobileHomePage, EmployeeMobileInventoryPage, EmployeeMobileIssuePage, EmployeeMobileLoginPage, EmployeeMobileShiftPage } from '../features/employee/MobileEmployeePortal.jsx';
import { AddEmployeeSheet, RemoveConfirm, RequestHelp, ScheduleBlockEditor } from '../features/manager/ModalScreens.jsx';
import WeeklySchedulePage from '../features/manager/WeeklySchedulePage.jsx';
import { routePaths } from './routes.js';
import { isEmployeeEligibleForAttendanceWindow, isEmployeeEligibleForScheduleBlock, isEmployeeScheduleEligible, useAppState } from './state/AppStateContext.jsx';

function findDefaultAddBlock(blocks) {
  return blocks.find((block) => block.employeeIds.length < block.required) ?? blocks[0] ?? null;
}

function findDefaultRemoveBlock(blocks) {
  return blocks.find((block) => block.employeeIds.length) ?? blocks[0] ?? null;
}

function ManagerDesktopGate({ children }) {
  const location = useLocation();
  const { managerSessionActive } = useAppState();

  if (!managerSessionActive) {
    return <Navigate to={routePaths.managerLogin} replace state={{ returnTo: location.pathname, portalMessage: 'กรุณาเข้าสู่ระบบผู้จัดการก่อนใช้งาน' }} />;
  }

  return children;
}

function ManagerLoginRoutePage() {
  return (
    <div className="screen-stage desktop">
      <ManagerLoginPage />
    </div>
  );
}

function HomeRoutePage() {
  return (
    <ManagerDesktopGate>
      <div className="screen-stage desktop">
        <HomePage />
      </div>
    </ManagerDesktopGate>
  );
}

function EmployeeHomeRoutePage() {
  return (
    <div className="screen-stage employee-mobile">
      <EmployeeMobileHomePage />
    </div>
  );
}

function EmployeeLoginRoutePage() {
  return (
    <div className="screen-stage employee-mobile">
      <EmployeeMobileLoginPage />
    </div>
  );
}

function DesktopSchedulePage() {
  const { autoAssignEmployeesToBlock, copyDaySchedule, deleteTimeBlock, employeeAttendanceWindows, employeeAvailabilityCalendar, employees, moveEmployeeToBlock, timeBlocks } = useAppState();
  return (
    <ManagerDesktopGate>
      <div className="screen-stage desktop">
        <DesktopSchedule blocks={timeBlocks} employees={employees} employeeAttendanceWindows={employeeAttendanceWindows} employeeAvailabilityCalendar={employeeAvailabilityCalendar} moveEmployeeToBlock={moveEmployeeToBlock} autoAssignEmployeesToBlock={autoAssignEmployeesToBlock} copyDaySchedule={copyDaySchedule} deleteTimeBlock={deleteTimeBlock} />
      </div>
    </ManagerDesktopGate>
  );
}

function LeavePlannerRoutePage() {
  return (
    <ManagerDesktopGate>
      <div className="screen-stage desktop">
        <EmployeeHolidayPlanner />
      </div>
    </ManagerDesktopGate>
  );
}

function WeeklyScheduleRoutePage() {
  return (
    <ManagerDesktopGate>
      <div className="screen-stage desktop">
        <WeeklySchedulePage />
      </div>
    </ManagerDesktopGate>
  );
}

function EmployeesRoutePage() {
  return (
    <ManagerDesktopGate>
      <div className="screen-stage desktop">
        <EmployeesPage />
      </div>
    </ManagerDesktopGate>
  );
}

function EmployeeScheduleRoutePage() {
  return (
    <div className="screen-stage employee-mobile">
      <EmployeeMobileShiftPage />
    </div>
  );
}

function EmployeeInventoryRoutePage() {
  return <Navigate to={routePaths.employeeInventoryCheck} replace />;
}

function EmployeeInventoryCheckRoutePage() {
  return (
    <div className="screen-stage employee-mobile">
      <EmployeeMobileInventoryPage inventoryView="check" />
    </div>
  );
}

function EmployeeInventoryIncomingRoutePage() {
  return (
    <div className="screen-stage employee-mobile">
      <EmployeeMobileInventoryPage inventoryView="incoming" />
    </div>
  );
}

function AddEmployeePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { addEmployeesToBlock, addEmployeesToWindow, employeeAttendanceWindows, employeeAvailabilityCalendar, employees, timeBlocks } = useAppState();
  const returnTo = location.state?.returnTo ?? routePaths.desktopSchedule;
  const selectedDateKey = location.state?.selectedDateKey ?? null;
  const blockIds = Array.isArray(location.state?.blockIds) ? location.state.blockIds : [];
  const isAttendanceWindowFlow = blockIds.length > 0;
  const selectedBlocks = blockIds.length ? timeBlocks.filter((entry) => blockIds.includes(entry.id)) : [];
  const block = timeBlocks.find((entry) => entry.id === location.state?.blockId) ?? selectedBlocks[0] ?? findDefaultAddBlock(timeBlocks);
  const displayBlock = selectedBlocks.length
    ? {
        ...block,
        roundLabel: String(location.state?.roundLabel ?? block?.roundLabel ?? '').trim(),
        time: String(location.state?.timeLabel ?? block?.time ?? '').trim(),
        title: String(location.state?.windowLabel ?? block?.title ?? '').trim(),
      }
    : block;
  const targetBlocks = selectedBlocks.length ? selectedBlocks : block ? [block] : [];
  const availableEmployees = targetBlocks.length
    ? employees.filter((employee) => {
        if (isAttendanceWindowFlow) {
          return isEmployeeEligibleForAttendanceWindow(employee, targetBlocks[0], employeeAttendanceWindows, employeeAvailabilityCalendar);
        }

        return !targetBlocks[0].employeeIds.includes(employee.id) && isEmployeeEligibleForScheduleBlock(employee, targetBlocks[0], employeeAttendanceWindows, employeeAvailabilityCalendar);
      })
    : [];

  return (
    <ManagerDesktopGate>
	  <div className="screen-stage standalone-modal">
        <AddEmployeeSheet
          employees={availableEmployees}
          block={displayBlock}
          emptyStateMessage={isAttendanceWindowFlow
            ? 'ยังไม่มีพนักงานให้เลือกในช่วงนี้ เพราะอาจถูกลงเวลาเข้างานช่วงอื่นแล้ว หรืออยู่ในสถานะลา/ขาด/พักงาน'
            : 'ต้องลงเวลาเข้างานก่อน หรือเวลาเลิกงานของพนักงานยังไม่ครอบคลุมช่วงงานนี้'}
          onConfirm={(selectedIds) => {
            if (!displayBlock) {
              return '';
            }

            if (isAttendanceWindowFlow) {
              return addEmployeesToWindow(targetBlocks.map((entry) => entry.id), selectedIds, {
                roundLabel: displayBlock.roundLabel,
                time: displayBlock.time,
                title: displayBlock.title,
              });
            }

            return block ? addEmployeesToBlock(block.id, selectedIds) : '';
          }}
          onClose={() => navigate(returnTo, { state: { selectedDateKey } })}
        />
	  </div>
    </ManagerDesktopGate>
  );
}

function RemoveEmployeePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { employees, removeEmployeeFromBlock, timeBlocks } = useAppState();
  const returnTo = location.state?.returnTo ?? routePaths.desktopSchedule;
  const selectedDateKey = location.state?.selectedDateKey ?? null;
  const block = timeBlocks.find((entry) => entry.id === location.state?.blockId) ?? findDefaultRemoveBlock(timeBlocks);
  const employeeId = location.state?.employeeId ?? block?.employeeIds[0];
  const employee = employees.find((entry) => entry.id === employeeId);

  return (
    <ManagerDesktopGate>
	  <div className="screen-stage standalone-modal remove-flow">
        <RemoveConfirm
          block={block}
          employee={employee}
          onCancel={() => navigate(returnTo, { state: { selectedDateKey } })}
          onConfirm={() => {
            if (!block || !employee) {
              return '';
            }

            const updatedBlock = removeEmployeeFromBlock(block.id, employee.id);
            return updatedBlock ? `${employee.name} ถูกนำออกจาก ${updatedBlock.roundLabel} ${updatedBlock.time}` : '';
          }}
        />
	  </div>
    </ManagerDesktopGate>
  );
}

function RequestHelpPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { createRequest, timeBlocks } = useAppState();
  const returnTo = location.state?.returnTo ?? routePaths.desktopSchedule;
  const block = timeBlocks.find((entry) => entry.id === location.state?.blockId) ?? findDefaultAddBlock(timeBlocks);
  const shortage = block ? Math.max(block.required - block.employeeIds.length, 0) : 0;

  return (
    <ManagerDesktopGate>
	  <div className="screen-stage standalone-modal">
        <RequestHelp
          defaultDetail={location.state?.defaultDetail ?? (block ? `กะงาน ${block.time}\nหน้าที่หลัก: ${block.title}\nขาดพนักงาน ${shortage} คน` : '')}
          defaultType={location.state?.defaultType ?? 'ขอพนักงานเพิ่ม'}
          onClose={() => navigate(returnTo)}
          onSubmit={createRequest}
          onViewRequests={() => navigate(routePaths.myRequests)}
        />
	  </div>
    </ManagerDesktopGate>
  );
}

function ScheduleBlockPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { saveTimeBlock, timeBlocks } = useAppState();
  const returnTo = location.state?.returnTo ?? routePaths.desktopSchedule;
  const selectedDateKey = location.state?.selectedDateKey ?? null;
  const block = timeBlocks.find((entry) => entry.id === location.state?.blockId) ?? null;

  return (
    <ManagerDesktopGate>
	  <div className="screen-stage standalone-modal">
        <ScheduleBlockEditor
          block={block}
          onClose={() => navigate(returnTo, { state: { selectedDateKey } })}
          onSubmit={(payload) => {
            const updatedBlock = saveTimeBlock({ ...payload, dateKey: block?.dateKey ?? selectedDateKey });
            if (!updatedBlock) {
              return '';
            }

            return block ? `อัปเดต ${updatedBlock.roundLabel} ${updatedBlock.time} • ${updatedBlock.title} แล้ว` : `เพิ่มกะ ${updatedBlock.roundLabel} ${updatedBlock.time} • ${updatedBlock.title} แล้ว`;
          }}
        />
	  </div>
    </ManagerDesktopGate>
  );
}

function MyRequestsPage() {
  return (
    <ManagerDesktopGate>
	  <div className="screen-stage desktop">
        <ManagerNotificationsPage />
      </div>
    </ManagerDesktopGate>
  );
}

function RequestHistoryPage() {
  return (
    <ManagerDesktopGate>
	  <div className="screen-stage desktop">
        <ManagerNotificationsPage initialFilter="history" />
      </div>
    </ManagerDesktopGate>
  );
}

function EmployeeRequestsPage() {
  return (
    <div className="screen-stage employee-mobile">
      <EmployeeMobileIssuePage />
    </div>
  );
}

function ReportsRoutePage() {
  return (
    <ManagerDesktopGate>
	  <div className="screen-stage desktop">
        <ReportsPage />
      </div>
    </ManagerDesktopGate>
  );
}

function InventoryCatalogRoutePage() {
  return (
    <ManagerDesktopGate>
	  <div className="screen-stage desktop">
        <InventoryCatalogPage />
      </div>
    </ManagerDesktopGate>
  );
}

function SettingsRoutePage() {
  return (
    <ManagerDesktopGate>
	  <div className="screen-stage desktop">
        <SettingsPage />
      </div>
    </ManagerDesktopGate>
  );
}

export const screenCatalog = [
  {
    id: 'manager-login',
    path: routePaths.managerLogin,
    title: 'เข้าสู่ระบบผู้จัดการ',
    description: 'กรอกเบอร์โทรศัพท์และรหัสผ่านของผู้จัดการก่อนเข้าใช้งานระบบจัดการ',
    component: ManagerLoginRoutePage,
  },
  {
    id: 'home',
    path: routePaths.home,
    title: 'หน้าหลัก',
    description: 'หน้าหลักของผู้จัดการร้านพร้อมตารางงานประจำวัน',
    component: HomeRoutePage,
  },
  {
    id: 'employee-login',
    path: routePaths.employeeLogin,
    title: 'เข้าสู่ระบบพนักงาน',
    description: 'กรอกเบอร์โทรศัพท์และรหัสผ่านก่อนเข้าใช้งานโหมดพนักงาน',
    component: EmployeeLoginRoutePage,
  },
  {
    id: 'employee-home',
    path: routePaths.employeeHome,
    title: 'หน้าพนักงาน',
    description: 'หน้าหลักพนักงานแบบมือถือสำหรับดูกะ สต็อก และปัญหา',
    component: EmployeeHomeRoutePage,
  },
  {
    id: 'desktop-schedule',
    path: routePaths.desktopSchedule,
    title: 'ตารางงาน',
    description: 'มุมมองหลักของผู้จัดการร้านสำหรับดูภาพรวมทั้งวัน',
    component: DesktopSchedulePage,
  },
  {
    id: 'leave-planner',
    path: routePaths.leavePlanner,
    title: 'ปฏิทินวันหยุด',
    description: 'กำหนดวันลา วันหยุดไม่ได้ และวัน 2 แรง แยกจากหน้าตารางหลัก',
    component: LeavePlannerRoutePage,
  },
  {
    id: 'weekly-schedule',
    path: routePaths.weeklySchedule,
    title: 'เวลาเข้างาน',
    description: 'มุมมองรายสัปดาห์สำหรับดู แก้ไข และลบกะงาน',
    component: WeeklyScheduleRoutePage,
  },
  {
    id: 'employee-schedule',
    path: routePaths.employeeSchedule,
    title: 'เวลาเข้างานของฉัน',
    description: 'มุมมองเวลาเข้างานและช่วงงานในตารางของพนักงานแบบมือถือ',
    component: EmployeeScheduleRoutePage,
  },
  {
    id: 'employee-inventory',
    path: routePaths.employeeInventory,
    title: 'สต็อก',
    description: 'redirect ไปหน้าตรวจสต็อกของพนักงาน',
    component: EmployeeInventoryRoutePage,
  },
  {
    id: 'employee-inventory-check',
    path: routePaths.employeeInventoryCheck,
    title: 'เช็กสต็อก',
    description: 'ตรวจจำนวนของคงเหลือและวันหมดอายุผ่านมือถือ',
    component: EmployeeInventoryCheckRoutePage,
  },
  {
    id: 'employee-inventory-incoming',
    path: routePaths.employeeInventoryIncoming,
    title: 'ของมาใหม่',
    description: 'ดูของที่รับเข้าใหม่และเพิ่มสินค้าใหม่ผ่านมือถือ',
    component: EmployeeInventoryIncomingRoutePage,
  },
  {
    id: 'manage-schedule-block',
    path: routePaths.manageScheduleBlock,
    title: 'จัดการข้อมูลงาน',
    description: 'ฟอร์มสร้างและแก้ไขกะงานในตาราง',
    component: ScheduleBlockPage,
  },
  {
    id: 'employees',
    path: routePaths.employees,
    title: 'พนักงาน',
    description: 'จัดการรายชื่อพนักงานและสถานะการลงกะในระบบ',
    component: EmployeesRoutePage,
  },
  {
    id: 'add-employee',
    path: routePaths.addEmployee,
    title: 'เพิ่มพนักงาน',
    description: 'หน้าสำหรับเลือกและเพิ่มพนักงานเข้ากะงาน',
    component: AddEmployeePage,
  },
  {
    id: 'remove-employee',
    path: routePaths.removeEmployee,
    title: 'นำพนักงานออก',
    description: 'หน้า confirm ก่อนนำพนักงานออกจากกะงาน',
    component: RemoveEmployeePage,
  },
  {
    id: 'request-help',
    path: routePaths.requestHelp,
    title: 'แจ้งปัญหา / ขอความช่วยเหลือ',
    description: 'ฟอร์มแจ้งปัญหาหรือขอพนักงานเพิ่มเติมพร้อมแนบรูปได้',
    component: RequestHelpPage,
  },
  {
    id: 'my-requests',
    path: routePaths.myRequests,
    title: 'คำขอของฉัน',
    description: 'สรุปรายการคำขอทั้งหมดพร้อมสถานะการดำเนินการ',
    component: MyRequestsPage,
  },
  {
    id: 'request-history',
    path: routePaths.requestHistory,
    title: 'ประวัติแจ้งเตือน',
    description: 'ดูรายการแจ้งเตือนที่ปิดงานแล้วและตรวจย้อนหลังได้จากหน้าเดียว',
    component: RequestHistoryPage,
  },
  {
    id: 'employee-requests',
    path: routePaths.employeeRequests,
    title: 'แจ้งปัญหา',
    description: 'หน้าพนักงานสำหรับแจ้งปัญหาและติดตามสถานะ',
    component: EmployeeRequestsPage,
  },
  {
    id: 'reports',
    path: routePaths.reports,
    title: 'รายงาน',
    description: 'สรุป coverage และสถานะกำลังคนรายกะงาน',
    component: ReportsRoutePage,
  },
  {
    id: 'inventory-catalog',
    path: routePaths.inventoryCatalog,
    title: 'คลังสต็อก',
    description: 'หน้ารายการสินค้าในคลังพร้อมค้นหาและกรองตามหมวดหมู่',
    component: InventoryCatalogRoutePage,
  },
  {
    id: 'settings',
    path: routePaths.settings,
    title: 'ตั้งค่า',
    description: 'ตั้งค่าข้อมูลสาขาและการแจ้งเตือนของระบบ',
    component: SettingsRoutePage,
  },
];