import { useState } from 'react';
import { BarChart3, Bell, CalendarDays, CheckCircle2, ChevronDown, Home, LogOut, Settings, Users, X } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { routePaths } from '../../app/routes.js';
import { useAppState } from '../../app/state/AppStateContext.jsx';

export const managerNavItems = [
  { label: 'หน้าหลัก', icon: Home, to: routePaths.home },
  { label: 'ตารางงาน', icon: CalendarDays, to: routePaths.desktopSchedule },
  { label: 'พนักงาน', icon: Users, to: routePaths.employees },
  { label: 'แจ้งเตือน', icon: Bell, to: routePaths.myRequests },
  { label: 'ประวัติแจ้งเตือน', icon: CheckCircle2, to: routePaths.requestHistory },
  { label: 'รายงาน', icon: BarChart3, to: routePaths.reports },
  { label: 'ตั้งค่า', icon: Settings, to: routePaths.settings },
];

export const employeeNavItems = [
  { label: 'หน้าพนักงาน', icon: Home, to: routePaths.employeeHome },
  { label: 'กะของฉัน', icon: CalendarDays, to: routePaths.employeeSchedule },
  { label: 'คำขอของฉัน', icon: Bell, to: routePaths.employeeRequests },
];

export default function DesktopWorkspace({
  title,
  headerActions,
  children,
  navItems = managerNavItems,
  profileName = null,
  profileAvatar = '👨🏻',
  rightActions = null,
  showSupportButton = true,
  contentClassName = '',
}) {
  const navigate = useNavigate();
  const { managerLogout, settings } = useAppState();
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [logoutConfirmed, setLogoutConfirmed] = useState(false);
  const isManagerWorkspace = navItems === managerNavItems;
  const resolvedProfileName = profileName ?? settings.managerName ?? 'ผู้จัดการร้าน';

  const resolvedRightActions = rightActions ?? (navItems === employeeNavItems
    ? <NavLink className="ghost-button" to={routePaths.managerLogin}>โหมดผู้จัดการ</NavLink>
    : <NavLink className="ghost-button" to={routePaths.employeeLogin}>โหมดพนักงาน</NavLink>);

  const openLogoutDialog = () => {
    setLogoutConfirmed(false);
    setIsLogoutDialogOpen(true);
  };

  const closeLogoutDialog = () => {
    setLogoutConfirmed(false);
    setIsLogoutDialogOpen(false);
  };

  const confirmLogout = () => {
    if (isManagerWorkspace) {
      managerLogout();
      closeLogoutDialog();
      navigate(routePaths.managerLogin, {
        replace: true,
        state: {
          portalMessage: 'ออกจากระบบผู้จัดการสำเร็จแล้ว',
        },
      });
      return;
    }

    setLogoutConfirmed(true);
  };

  return (
    <div className="desktop-panel">
      {/* Sidebar - Fixed Area */}
      <aside className="sidebar">
        <div className="sidebar-logo">Amazon</div>
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            // คำนวณความกว้างและขอบของเมนูให้เหมือนต้นฉบับเป๊ะ
            return (
              <NavLink 
                key={item.label} 
                to={item.to} 
                className={({ isActive }) => (isActive ? 'nav-item selected' : 'nav-item')} 
                end
              >
                <div className="nav-icon-container">
                  <Icon size={20} strokeWidth={2.5}/> 
                </div>
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <button type="button" className="logout" onClick={openLogoutDialog}><LogOut size={20} strokeWidth={2.5}/> ออกจากระบบ</button>
      </aside>

      <main className="desktop-main">
        {/* Topbar - Fixed Area */}
        <header className="desktop-topbar">
          <div className="page-title">{title}</div>
          {headerActions}
          <div className="spacer" />
          {resolvedRightActions}

          <button type="button" className="ghost-button flex-button user-profile-btn">
            <span className="user-icon">{profileAvatar}</span> {resolvedProfileName} <ChevronDown size={14}/>
          </button>
        </header>

        {/* Scrollable Content Area */}
        <div className={`desktop-content ${contentClassName}`.trim()}>
          {children}
        </div>
      </main>

      {isLogoutDialogOpen ? <div className="logout-dialog-backdrop" role="presentation">
        <section className="logout-dialog-card" role="dialog" aria-modal="true" aria-labelledby="logout-dialog-title">
          <div className="logout-dialog-header">
            <div className="logout-dialog-title-wrap">
              <div className="logout-dialog-icon" aria-hidden="true">
                {logoutConfirmed ? <CheckCircle2 size={20} /> : <LogOut size={20} />}
              </div>
              <div className="logout-dialog-copy">
                <b id="logout-dialog-title">{logoutConfirmed ? 'ออกจากระบบแล้ว' : 'ยืนยันการออกจากระบบ'}</b>
                <p>{logoutConfirmed ? 'ระบบตัวอย่างบันทึกสถานะการออกจากระบบเรียบร้อยแล้ว' : `คุณกำลังจะออกจากระบบของ ${resolvedProfileName}`}</p>
              </div>
            </div>
            <button type="button" className="icon-button logout-close-button" onClick={closeLogoutDialog} aria-label="ปิดหน้าต่างยืนยัน">
              <X size={16} />
            </button>
          </div>

          <div className="logout-dialog-body">
            {logoutConfirmed ? <div className="form-success logout-success-box">
              <CheckCircle2 size={22} />
              <div>
                <strong>พร้อมกลับไปเลือกใช้งานต่อ</strong>
                <p>คุณสามารถปิดหน้าต่างนี้ แล้วเลือกเข้าสู่โหมดผู้จัดการหรือพนักงานต่อได้ทันที</p>
              </div>
            </div> : <div className="logout-dialog-note">
              <strong>ออกจากระบบตอนนี้ใช่ไหม</strong>
              <p>เมื่อยืนยันแล้ว ระบบจะจบเซสชันตัวอย่างของหน้าปัจจุบันทันที</p>
            </div>}

            <div className="modal-actions logout-dialog-actions">
              <button type="button" className="logout-cancel-btn" onClick={closeLogoutDialog}>{logoutConfirmed ? 'ปิดหน้าต่าง' : 'ยกเลิก'}</button>
              {logoutConfirmed ? null : <button type="button" className="danger-btn logout-confirm-btn" onClick={confirmLogout}>ยืนยันออกจากระบบ</button>}
            </div>
          </div>
        </section>
      </div> : null}
    </div>
  );
}
