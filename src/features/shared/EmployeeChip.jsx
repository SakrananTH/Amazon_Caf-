import { getEmployeeAvailabilityMeta } from '../../app/state/AppStateContext.jsx';

const roleToneRules = [
  {
    className: 'chip-role-lead',
    label: 'ผู้จัดการ / หัวหน้า',
    keywords: ['ผู้จัดการ', 'หัวหน้า', 'manager', 'lead', 'supervisor'],
  },
  {
    className: 'chip-role-barista',
    label: 'บาริสต้า / เครื่องดื่ม',
    keywords: ['บาริสต้า', 'barista', 'กาแฟ', 'coffee', 'เครื่องดื่ม'],
  },
  {
    className: 'chip-role-service',
    label: 'บริการ / หน้าร้าน',
    keywords: ['บริการ', 'service', 'ต้อนรับ', 'หน้าร้าน', 'customer', 'เสิร์ฟ'],
  },
  {
    className: 'chip-role-parttime',
    label: 'พาทไทม์ / เสริมกะ',
    keywords: ['พาทไทม์', 'พาร์ทไทม์', 'พาร์ตไทม์', 'part-time', 'part time'],
  },
  {
    className: 'chip-role-ops',
    label: 'สต็อก / เตรียมงาน',
    keywords: ['สต็อก', 'stock', 'คลัง', 'ครัว', 'kitchen', 'เตรียม', 'prep'],
  },
];

export const employeeRoleOptions = [
  { value: 'บาริสต้า', label: 'บาริสต้า', hint: 'โทนส้ม • เครื่องดื่ม', className: 'chip-role-barista' },
  { value: 'พนักงานบริการ', label: 'พนักงานบริการ', hint: 'โทนน้ำเงิน • หน้าร้าน', className: 'chip-role-service' },
  { value: 'ผู้จัดการร้าน', label: 'ผู้จัดการร้าน', hint: 'โทนม่วง • หัวหน้า', className: 'chip-role-lead' },
  { value: 'พาทไทม์', label: 'พาทไทม์', hint: 'โทนเขียวอมเหลือง • เสริมกะ', className: 'chip-role-parttime' },
  { value: 'ดูแลสต็อก', label: 'ดูแลสต็อก', hint: 'โทนฟ้า • เตรียมงาน', className: 'chip-role-ops' },
];

export const employeeChipLegendItems = [
  ...roleToneRules.map(({ className, label }) => ({ className, label })),
  { className: 'chip-role-default', label: 'บทบาททั่วไป' },
];

export function getRoleClassName(role = '') {
  const normalizedRole = String(role).trim().toLowerCase();
  const matchedTone = roleToneRules.find(({ keywords }) => keywords.some((keyword) => normalizedRole.includes(keyword)));
  return matchedTone?.className ?? 'chip-role-default';
}

export default function EmployeeChip({ employee, onClick, draggable = false, onDragStart, onDragEnd, className = '', dateKey = null, availabilityCalendar = null, showRole = false }) {
  if (!employee) {
    return null;
  }

  const roleClassName = getRoleClassName(employee.role);
  const availabilityMeta = getEmployeeAvailabilityMeta(employee, dateKey, availabilityCalendar);
  const shouldShowStatus = availabilityMeta.value !== 'ready';
  const displayName = showRole ? `${employee.name} (${employee.role})` : employee.name;

  if (onClick) {
    return <button type="button" draggable={draggable} className={`chip chip-button ${roleClassName} ${className}`.trim()} onClick={onClick} onDragStart={onDragStart} onDragEnd={onDragEnd}><span className="avatar-mini">{employee.avatar}</span><span className="chip-name">{displayName}</span>{shouldShowStatus ? <span className={`chip-status-badge ${availabilityMeta.tone}`}>{availabilityMeta.shortLabel}</span> : null}</button>;
  }

  return <span draggable={draggable} className={`chip ${roleClassName} ${className}`.trim()} onDragStart={onDragStart} onDragEnd={onDragEnd}><span className="avatar-mini">{employee.avatar}</span><span className="chip-name">{displayName}</span>{shouldShowStatus ? <span className={`chip-status-badge ${availabilityMeta.tone}`}>{availabilityMeta.shortLabel}</span> : null}</span>;
}
