import { useMemo, useState } from 'react';
import { CheckCircle2, Search, X } from 'lucide-react';
import { buildBlockTimeLabel, getBlockEndLabel, getBlockRoundLabel, getBlockStartLabel, normalizeClockValue, scheduleShiftPresets } from '../../app/state/AppStateContext.jsx';
import { getRolePresentation, stripRoleMetadataSkills } from '../shared/EmployeeChip.jsx';

const scheduleRoundPresets = [
  ...scheduleShiftPresets.map((preset) => ({
    key: preset.key,
    label: `${preset.label} ${preset.startTime} - ${preset.endTime}`,
    roundLabel: preset.label,
    startTime: preset.startTime,
    endTime: preset.endTime,
  })),
  {
    key: 'custom',
    label: 'กำหนดเอง',
    roundLabel: 'รอบงาน',
    startTime: '',
    endTime: '',
  },
];

function getEmployeeTagTone(role = '') {
  if (String(role).includes('ผู้จัดการ')) {
    return 'lavender';
  }
  if (String(role).includes('บาริสต้า')) {
    return 'blue';
  }
  if (String(role).includes('บริการ')) {
    return 'green';
  }
  return 'warn';
}

function findScheduleRoundPreset(presetKey = 'custom') {
  return scheduleRoundPresets.find((preset) => preset.key === presetKey) ?? scheduleRoundPresets[scheduleRoundPresets.length - 1];
}

function formatBlockShiftSummary(block) {
  if (!block) {
    return '';
  }

  return String(block.time ?? '').trim() || [getBlockStartLabel(block), getBlockEndLabel(block)].filter(Boolean).join(' - ');
}

export function AddEmployeeSheet({ block, employees, emptyStateMessage = 'ไม่มีพนักงานที่เลือกเข้าช่วงงานนี้ได้', onApply, onClose, onConfirm }) {
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [summary, setSummary] = useState('');

  const filteredEmployees = useMemo(() => {
    const loweredQuery = query.trim().toLowerCase();
    return employees.filter((employee) => !loweredQuery || employee.name.toLowerCase().includes(loweredQuery) || employee.role.toLowerCase().includes(loweredQuery));
  }, [employees, query]);

  const handleToggle = (employeeId) => {
    setSelectedIds((currentIds) => (currentIds.includes(employeeId) ? currentIds.filter((currentId) => currentId !== employeeId) : [...currentIds, employeeId]));
  };

  const handleConfirm = () => {
    if (!block || !selectedIds.length) {
      return;
    }

    const updatedBlock = onConfirm ? onConfirm(selectedIds) : onApply?.(selectedIds);
    if (!updatedBlock) {
      return;
    }

    const selectedEmployees = employees.filter((employee) => selectedIds.includes(employee.id));
    const names = selectedEmployees.map((employee) => employee.name).join(', ');
    setSummary(`เพิ่ม ${selectedEmployees.length} คนเข้า ${formatBlockShiftSummary(updatedBlock)} แล้ว${names ? `: ${names}` : ''}`);
    setSelectedIds([]);
  };

  return (
    <section className="flow-page-shell">
      <div className="flow-page-card calm-flow-card">
        <div className="sheet-head flow-head">
          <div>
            <b>เพิ่มพนักงานเข้ากะงาน</b>
            <p className="flow-subtitle">เลือกจากรายชื่อที่ยังว่าง แล้วกดยืนยันครั้งเดียว</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        {block ? (
          <div className="sheet-note calm-note">
            <strong>{formatBlockShiftSummary(block)}</strong>
            <span>{block.title}</span>
          </div>
        ) : (
          <div className="empty-card compact">ไม่พบกะงานที่เลือก</div>
        )}
        {summary ? (
          <div className="form-success">
            <CheckCircle2 size={20} />
            <div>
              <strong>อัปเดตกะงานแล้ว</strong>
              <p>{summary}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="search-box page-search-box">
              <Search size={14} />
              <input className="plain-input" placeholder="ค้นหาชื่อหรือบทบาทพนักงาน" value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
            <div className="selection-caption">เลือกแล้ว {selectedIds.length} คน</div>
            <div className="flow-list calm-flow-list">
              {filteredEmployees.map((employee) => (
                (() => {
                  const rolePresentation = getRolePresentation(employee.role, employee.skills);
                  const visibleSkills = stripRoleMetadataSkills(employee.skills).slice(0, 2);
                  const isSelected = selectedIds.includes(employee.id);

                  return (
                    <button
                      key={employee.id}
                      type="button"
                      className={`employee-choice selectable rich-choice ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleToggle(employee.id)}
                    >
                      <span className="avatar-mini employee-choice-avatar">{employee.avatar ?? '👤'}</span>
                      <div className="employee-choice-copy">
                        <div className="employee-choice-headline">
                          <strong>{employee.name}</strong>
                          <span className={`employee-choice-role ${getEmployeeTagTone(employee.role)}`}>{rolePresentation.label}</span>
                        </div>
                        <p>{rolePresentation.hint || employee.role}</p>
                        <div className="employee-choice-meta-row">
                          <span className="employee-choice-code">{employee.employeeCode ?? '-'}</span>
                          {visibleSkills.map((skill) => <span key={`${employee.id}-${skill}`} className="employee-choice-skill">{skill}</span>)}
                        </div>
                      </div>
                      <span className={`employee-choice-indicator ${isSelected ? 'selected' : ''}`}>
                        {isSelected ? <CheckCircle2 size={18} /> : <span className="circle" />}
                      </span>
                    </button>
                  );
                })()
              ))}
            </div>
            {!filteredEmployees.length ? <div className="empty-card compact">{emptyStateMessage}</div> : null}
          </>
        )}
        <div className="modal-actions sticky-actions">
          <button type="button" onClick={onClose}>{summary ? 'กลับสู่ตารางงาน' : 'ยกเลิก'}</button>
          {summary ? null : <button type="button" className="primary-btn" onClick={handleConfirm} disabled={!selectedIds.length}>ยืนยันเพิ่มเข้ากะ</button>}
        </div>
      </div>
    </section>
  );
}

export function RemoveConfirm({ block, employee, onCancel, onConfirm }) {
  const [summary, setSummary] = useState('');

  const handleConfirm = () => {
    if (!block || !employee) {
      return;
    }

    const updatedBlock = onConfirm();
    if (!updatedBlock) {
      return;
    }

    setSummary(`นำ ${employee.name} ออกจาก ${formatBlockShiftSummary(updatedBlock)} แล้ว`);
  };

  return (
    <section className="flow-page-shell centered narrow">
      <div className="confirm-page-card calm-flow-card">
        {summary ? (
          <div className="confirm-success">
            <CheckCircle2 size={28} />
            <b>นำพนักงานออกแล้ว</b>
            <p>{summary}</p>
          </div>
        ) : (
          <>
            <b>นำพนักงานออกจากกะงาน</b>
            <p>ยืนยันการนำ <strong>{employee?.name ?? 'ไม่พบพนักงาน'}</strong> ออกจาก {formatBlockShiftSummary(block) || 'กะงานนี้'} เพื่อปรับตารางใหม่นะ?</p>
          </>
        )}
        <div className="modal-actions">
          <button type="button" onClick={onCancel}>{summary ? 'กลับสู่ตารางงาน' : 'ยกเลิก'}</button>
          {summary ? null : <button type="button" className="danger-btn" onClick={handleConfirm}>ยืนยันการนำออก</button>}
        </div>
      </div>
    </section>
  );
}

export function DeleteTimeWindowConfirm({
  dayLabel,
  roundLabel,
  timeLabel,
  employeeNames = [],
  groupedBlockCount = 0,
  title = 'ลบช่วงเวลาเข้างาน',
  successTitle = 'ลบช่วงงานแล้ว',
  description = null,
  impactLabel = 'พนักงานที่อยู่ในช่วงนี้',
  emptyEmployeesLabel = 'ยังไม่มีพนักงานในช่วงเวลานี้',
  confirmLabel = 'ยืนยันการลบ',
  cancelLabel = 'ยกเลิก',
  successCancelLabel = 'กลับสู่เวลาเข้างาน',
  onCancel,
  onConfirm,
}) {
  const [summary, setSummary] = useState('');

  const handleConfirm = () => {
    const result = onConfirm?.();
    if (!result) {
      return;
    }

    setSummary(result);
  };

  return (
    <section className="flow-page-shell">
      <div className="confirm-page-card calm-flow-card">
        {summary ? (
          <div className="confirm-success">
            <CheckCircle2 size={28} />
            <b>{successTitle}</b>
            <p>{summary}</p>
          </div>
        ) : (
          <>
            <b>{title}</b>
            <p className="flow-subtitle">{description ?? <>ยืนยันการลบ <strong>{timeLabel}</strong> ของ <strong>{dayLabel}</strong> ระบบจะลบช่วงงานย่อย {groupedBlockCount} ช่วงในวันนั้นด้วย</>}</p>
            <div className="calm-note">
              <strong>{impactLabel}</strong>
              <span>{employeeNames.length ? employeeNames.join(', ') : emptyEmployeesLabel}</span>
            </div>
          </>
        )}
        <div className="modal-actions">
          <button type="button" onClick={onCancel}>{summary ? successCancelLabel : cancelLabel}</button>
          {summary ? null : <button type="button" className="danger-btn" onClick={handleConfirm}>{confirmLabel}</button>}
        </div>
      </div>
    </section>
  );
}

export function RequestHelp({ defaultDetail = '', defaultType = 'ขอพนักงานเพิ่ม', onClose, onSubmit, onViewRequests }) {
  const [type, setType] = useState(defaultType);
  const [detail, setDetail] = useState(defaultDetail);
  const [attachmentName, setAttachmentName] = useState('');
  const [summary, setSummary] = useState('');

  const handleSubmit = () => {
    const nextRequest = onSubmit?.({
      type,
      detail: detail.trim(),
      attachmentName: attachmentName.trim(),
    });

    if (!nextRequest) {
      return;
    }

    setSummary(`ส่งคำขอ ${nextRequest.title} แล้ว`);
  };

  return (
    <section className="flow-page-shell centered narrow">
      <div className="confirm-page-card calm-flow-card">
        {summary ? (
          <div className="confirm-success">
            <CheckCircle2 size={28} />
            <b>ส่งคำขอเรียบร้อย</b>
            <p>{summary}</p>
          </div>
        ) : (
          <div className="form-grid compact-form-grid">
            <div className="field-group form-grid-full">
              <b>แจ้งปัญหา / ขอความช่วยเหลือ</b>
              <p className="flow-subtitle">ใช้ฟอร์มนี้เพื่อขอพนักงานเพิ่ม ขอเปลี่ยนกะ หรือแนบรายละเอียดปัญหาที่ต้องการให้ผู้จัดการติดตาม</p>
            </div>
            <label className="field-group form-grid-full">
              <span>ประเภทคำขอ</span>
              <select className="select-control" value={type} onChange={(event) => setType(event.target.value)}>
                <option value="ขอพนักงานเพิ่ม">ขอพนักงานเพิ่ม</option>
                <option value="ขอเปลี่ยนกะ">ขอเปลี่ยนกะ</option>
                <option value="แจ้งปัญหาหน้างาน">แจ้งปัญหาหน้างาน</option>
              </select>
            </label>
            <label className="field-group form-grid-full">
              <span>รายละเอียด</span>
              <textarea className="textarea-box textarea-control" value={detail} onChange={(event) => setDetail(event.target.value)} placeholder="อธิบายสิ่งที่ต้องการให้ช่วย เช่น ขาดคนกะสาย 1 คน หรือ ต้องการสลับกะกับเพื่อนร่วมงาน" />
            </label>
            <label className="field-group form-grid-full">
              <span>ชื่อไฟล์แนบ (ถ้ามี)</span>
              <input className="text-input" value={attachmentName} onChange={(event) => setAttachmentName(event.target.value)} placeholder="เช่น photo-issue.jpg" />
            </label>
          </div>
        )}
        <div className="modal-actions">
          <button type="button" onClick={summary ? (onViewRequests ?? onClose) : onClose}>{summary ? 'ดูคำขอทั้งหมด' : 'ปิด'}</button>
          {summary ? null : <button type="button" className="primary-btn" onClick={handleSubmit} disabled={!detail.trim()}>ส่งคำขอ</button>}
        </div>
      </div>
    </section>
  );
}

export function ScheduleBlockEditor({ block, onClose, onSubmit }) {
  const isEditing = Boolean(block?.id);
  const initialPreset = findScheduleRoundPreset(block?.roundPresetKey);
  const [formState, setFormState] = useState({
    id: block?.id ?? null,
    roundPresetKey: initialPreset.key,
    roundLabel: getBlockRoundLabel(block),
    startTime: getBlockStartLabel(block),
    endTime: getBlockEndLabel(block),
    title: block?.title ?? '',
    required: String(block?.required ?? 1),
    tasksText: block?.tasks?.join('\n') ?? '',
  });
  const [summary, setSummary] = useState('');

  const handleShiftChange = (event) => {
    const preset = findScheduleRoundPreset(event.target.value);
    setFormState((currentState) => ({
      ...currentState,
      roundPresetKey: preset.key,
      roundLabel: preset.key === 'custom' ? currentState.roundLabel || preset.roundLabel : preset.roundLabel,
      startTime: preset.startTime || currentState.startTime,
      endTime: preset.endTime || currentState.endTime,
    }));
  };

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    if (name === 'startTime' || name === 'endTime') {
      setFormState((currentState) => ({
        ...currentState,
        [name]: normalizeClockValue(value) || value,
      }));
      return;
    }

    setFormState((currentState) => ({
      ...currentState,
      [name]: value,
    }));
  };

  const handleSubmit = () => {
    const submittedBlock = onSubmit({
      id: formState.id,
      roundPresetKey: formState.roundPresetKey,
      roundLabel: formState.roundLabel,
      startTime: formState.startTime,
      endTime: formState.endTime,
      time: buildBlockTimeLabel(formState.startTime, formState.endTime),
      title: formState.title,
      required: Number(formState.required),
      tasks: formState.tasksText.split('\n'),
    });

    if (!submittedBlock) {
      return;
    }

    setSummary(`${isEditing ? 'อัปเดต' : 'สร้าง'} ${formatBlockShiftSummary(submittedBlock)} แล้ว`);
  };

  const roundPreviewLabel = [formState.roundLabel.trim(), buildBlockTimeLabel(formState.startTime, formState.endTime)].filter(Boolean).join(' ');
  const submitDisabled = !summary && (!formState.roundLabel.trim() || !normalizeClockValue(formState.startTime) || !normalizeClockValue(formState.endTime) || !formState.title.trim() || Number(formState.required) <= 0);

  return (
    <section className="flow-page-shell">
      <div className="flow-page-card form-page-card calm-flow-card">
        <div className="sheet-head flow-head">
          <div>
            <b>{isEditing ? 'แก้ไขช่วงงาน' : 'เพิ่มช่วงงานใหม่'}</b>
            <p className="flow-subtitle">กำหนดกะหลัก เวลาเข้า เวลาเลิก และหน้าที่ของช่วงนี้ได้เองในฟอร์มเดียว</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        {summary ? (
          <div className="form-success">
            <CheckCircle2 size={20} />
            <div>
              <strong>{isEditing ? 'อัปเดตช่วงงานแล้ว' : 'สร้างช่วงงานแล้ว'}</strong>
              <p>{summary}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="compact-editor-note schedule-round-preview-note">
              <strong>{roundPreviewLabel || 'เลือกช่วงงานก่อนบันทึก'}</strong>
              <span>เลือกกะหลักสำเร็จรูป หรือกำหนดชื่อช่วงงานและเวลาเองได้</span>
            </div>
            <div className="form-grid compact-form-grid">
              <label className="field-group form-grid-full">
                <span>เลือกกะหลัก</span>
                <select className="select-control" name="roundPresetKey" value={formState.roundPresetKey} onChange={handleShiftChange}>
                  {scheduleRoundPresets.map((preset) => (
                    <option key={preset.key} value={preset.key}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-group">
                <span>เวลาเข้า</span>
                <input className="text-input" type="time" name="startTime" value={formState.startTime} onChange={handleFieldChange} />
              </label>
              <label className="field-group">
                <span>เวลาเลิกงาน</span>
                <input className="text-input" type="time" name="endTime" value={formState.endTime} onChange={handleFieldChange} />
              </label>
              <label className="field-group form-grid-full">
                <span>ชื่อช่วงงาน</span>
                <input className="text-input" name="roundLabel" value={formState.roundLabel} onChange={handleFieldChange} placeholder="เช่น กะเช้า" />
              </label>
              <label className="field-group">
                <span>จำนวนพนักงานที่ต้องใช้</span>
                <input className="text-input" name="required" type="number" min="1" value={formState.required} onChange={handleFieldChange} />
              </label>
              <label className="field-group form-grid-full">
                <span>ชื่องาน / หน้าที่หลัก</span>
                <input className="text-input" name="title" value={formState.title} onChange={handleFieldChange} placeholder="เช่น เปิดร้าน" />
              </label>
              <label className="field-group form-grid-full">
                <span>รายการงานเพิ่มเติม</span>
                <textarea className="textarea-box textarea-control" name="tasksText" value={formState.tasksText} onChange={handleFieldChange} placeholder="หนึ่งบรรทัดต่อหนึ่งงาน เช่น&#10;เปิดเครื่องกาแฟ&#10;เตรียมวัตถุดิบ" />
              </label>
            </div>
            {isEditing ? <div className="compact-editor-note">พนักงานในช่วงนี้จะคงอยู่เหมือนเดิม ระบบจะอัปเดตเฉพาะชื่อช่วง เวลา และหน้าที่ของช่วงงานนี้</div> : null}
          </>
        )}
        <div className="flow-footer schedule-round-editor-actions">
          <button type="button" className="ghost-button" onClick={onClose}>ยกเลิก</button>
          <button type="button" className="primary-inline flow-submit" onClick={summary ? onClose : handleSubmit} disabled={submitDisabled}>
            {summary ? 'กลับไปตารางงาน' : isEditing ? 'บันทึกช่วงงาน' : 'สร้างช่วงงาน'}
          </button>
        </div>
      </div>
    </section>
  );
}

export function MyRequests({ requests, onClose }) {
  return (
    <section className="flow-page-shell">
      <div className="flow-page-card calm-flow-card">
        <div className="sheet-head flow-head">
          <div>
            <b>คำขอของฉัน</b>
            <p className="flow-subtitle">ติดตามสถานะคำขอปรับตารางหรือขอวันลาได้ในที่เดียว</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="flow-list calm-flow-list">
          {requests.map((request) => (
            <div key={request.id} className="request-card">
              <div>
                <strong>{request.type}</strong>
                <span>{request.reason}</span>
              </div>
              <span className={`tag ${request.status === 'resolved' ? 'ok' : 'warn'}`}>{request.status === 'resolved' ? 'จัดการแล้ว' : 'กำลังรอ'}</span>
            </div>
          ))}
          {!requests.length ? <div className="empty-card compact">ยังไม่มีคำขอใด ๆ</div> : null}
        </div>
        <div className="modal-actions sticky-actions">
          <button type="button" onClick={onClose}>ปิด</button>
        </div>
      </div>
    </section>
  );
}
