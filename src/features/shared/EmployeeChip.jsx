import { getEmployeeAvailabilityMeta } from '../../app/state/AppStateContext.jsx';

const ROLE_TONE_SKILL_PREFIX = '__roleTone__:';
const ROLE_HINT_SKILL_PREFIX = '__roleHint__:';

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
  { value: 'บาริสต้า', label: 'บาริสต้า', toneLabel: 'โทนส้ม', detailLabel: 'เครื่องดื่ม', hint: 'โทนส้ม • เครื่องดื่ม', className: 'chip-role-barista' },
  { value: 'พนักงานบริการ', label: 'พนักงานบริการ', toneLabel: 'โทนน้ำเงิน', detailLabel: 'หน้าร้าน', hint: 'โทนน้ำเงิน • หน้าร้าน', className: 'chip-role-service' },
  { value: 'ผู้จัดการร้าน', label: 'ผู้จัดการร้าน', toneLabel: 'โทนม่วง', detailLabel: 'หัวหน้า', hint: 'โทนม่วง • หัวหน้า', className: 'chip-role-lead' },
  { value: 'พาทไทม์', label: 'พาทไทม์', toneLabel: 'โทนเขียวอมเหลือง', detailLabel: 'เสริมกะ', hint: 'โทนเขียวอมเหลือง • เสริมกะ', className: 'chip-role-parttime' },
  { value: 'ดูแลสต็อก', label: 'ดูแลสต็อก', toneLabel: 'โทนฟ้า', detailLabel: 'เตรียมงาน', hint: 'โทนฟ้า • เตรียมงาน', className: 'chip-role-ops' },
];

export const employeeChipLegendItems = [
  ...roleToneRules.map(({ className, label }) => ({ className, label })),
  { className: 'chip-role-default', label: 'บทบาททั่วไป' },
];

function readRoleMetadata(skills = []) {
  return (Array.isArray(skills) ? skills : []).reduce((metadata, skill) => {
    const value = String(skill ?? '').trim();
    if (!value) {
      return metadata;
    }

    if (value.startsWith(ROLE_TONE_SKILL_PREFIX)) {
      metadata.toneClassName = value.slice(ROLE_TONE_SKILL_PREFIX.length).trim();
    }

    if (value.startsWith(ROLE_HINT_SKILL_PREFIX)) {
      metadata.hint = value.slice(ROLE_HINT_SKILL_PREFIX.length).trim();
    }

    return metadata;
  }, { toneClassName: '', hint: '' });
}

function resolveRoleClassNameFromLabel(role = '') {
  const normalizedRole = String(role).trim().toLowerCase();
  const matchedTone = roleToneRules.find(({ keywords }) => keywords.some((keyword) => normalizedRole.includes(keyword)));
  return matchedTone?.className ?? 'chip-role-default';
}

export function stripRoleMetadataSkills(skills = []) {
  return (Array.isArray(skills) ? skills : [])
    .map((skill) => String(skill ?? '').trim())
    .filter((skill) => skill && !skill.startsWith(ROLE_TONE_SKILL_PREFIX) && !skill.startsWith(ROLE_HINT_SKILL_PREFIX));
}

export function buildRoleMetadataSkills(skills = [], { toneClassName = '', hint = '' } = {}) {
  const nextSkills = [...stripRoleMetadataSkills(skills)];
  const normalizedToneClassName = String(toneClassName ?? '').trim();
  const normalizedHint = String(hint ?? '').trim();

  if (normalizedToneClassName) {
    nextSkills.push(`${ROLE_TONE_SKILL_PREFIX}${normalizedToneClassName}`);
  }

  if (normalizedHint) {
    nextSkills.push(`${ROLE_HINT_SKILL_PREFIX}${normalizedHint}`);
  }

  return nextSkills;
}

export function getRoleClassName(role = '', skills = []) {
  const metadata = readRoleMetadata(skills);
  if (metadata.toneClassName) {
    return metadata.toneClassName;
  }

  return resolveRoleClassNameFromLabel(role);
}

export function getRolePresentation(role = '', skills = []) {
  const normalizedRole = String(role ?? '').trim();
  const metadata = readRoleMetadata(skills);
  const matchedOption = employeeRoleOptions.find((option) => option.className === metadata.toneClassName)
    ?? employeeRoleOptions.find((option) => option.value === normalizedRole)
    ?? null;
  const className = metadata.toneClassName || matchedOption?.className || resolveRoleClassNameFromLabel(normalizedRole);

  return {
    label: normalizedRole,
    className,
    toneLabel: matchedOption?.toneLabel ?? '',
    hint: metadata.hint || matchedOption?.detailLabel || '',
    option: matchedOption,
  };
}

export default function EmployeeChip({ employee, onClick, draggable = false, onDragStart, onDragEnd, className = '', dateKey = null, availabilityCalendar = null, showRole = false }) {
  if (!employee) {
    return null;
  }

  const roleClassName = getRoleClassName(employee.role, employee.skills);
  const availabilityMeta = getEmployeeAvailabilityMeta(employee, dateKey, availabilityCalendar);
  const shouldShowStatus = availabilityMeta.value !== 'ready';
  const displayName = showRole ? `${employee.name} (${employee.role})` : employee.name;

  if (onClick) {
    return <button type="button" draggable={draggable} className={`chip chip-button ${roleClassName} ${className}`.trim()} onClick={onClick} onDragStart={onDragStart} onDragEnd={onDragEnd}><span className="avatar-mini">{employee.avatar}</span><span className="chip-name">{displayName}</span>{shouldShowStatus ? <span className={`chip-status-badge ${availabilityMeta.tone}`}>{availabilityMeta.shortLabel}</span> : null}</button>;
  }

  return <span draggable={draggable} className={`chip ${roleClassName} ${className}`.trim()} onDragStart={onDragStart} onDragEnd={onDragEnd}><span className="avatar-mini">{employee.avatar}</span><span className="chip-name">{displayName}</span>{shouldShowStatus ? <span className={`chip-status-badge ${availabilityMeta.tone}`}>{availabilityMeta.shortLabel}</span> : null}</span>;
}
