import { useMemo, useState } from 'react';
import { CheckCircle2, Search, X } from 'lucide-react';
import { buildBlockTimeLabel, getBlockRoundLabel, scheduleShiftPresets } from '../../app/state/AppStateContext.jsx';

const allShiftDutyOptions = [...new Set(scheduleShiftPresets.flatMap((preset) => preset.defaultTasks))];

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

function findShiftPreset(presetKey) {
  return scheduleShiftPresets.find((preset) => preset.key === presetKey) ?? scheduleShiftPresets[0];
}

function formatBlockShiftSummary(block) {
  if (!block) {
    return '';
  }

  const shiftLabel = getBlockRoundLabel(block);
  return [shiftLabel, block.time].filter(Boolean).join(' ');
}

export function AddEmployeeSheet({ block, employees, onClose, onConfirm }) {
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

    const updatedBlock = onConfirm(selectedIds);
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
                <button
                  key={employee.id}
                  type="button"
                  className={`employee-choice selectable ${selectedIds.includes(employee.id) ? 'selected' : ''}`}
                  onClick={() => handleToggle(employee.id)}
                >
                  <div>
                    <strong>{employee.name}</strong>
                    <span>{employee.role}</span>
                  </div>
                  <span className={`tag ${getEmployeeTagTone(employee.role)}`}>{employee.skills?.[0] ?? employee.role}</span>
                </button>
              ))}
            </div>
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
  const initialPreset = findShiftPreset(block?.roundPresetKey);
  const [formState, setFormState] = useState({
    id: block?.id,
    roundPresetKey: initialPreset.key,
    required: String(block?.required ?? 1),
    tasks: block?.tasks?.length ? [...block.tasks] : [...initialPreset.defaultTasks],
  });
  const [summary, setSummary] = useState('');

  const selectedPreset = findShiftPreset(formState.roundPresetKey);

  const handleShiftChange = (event) => {
    const preset = findShiftPreset(event.target.value);
    setFormState((currentState) => ({
      ...currentState,
      roundPresetKey: preset.key,
      tasks: [...preset.defaultTasks],
    }));
  };

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    setFormState((currentState) => ({
      ...currentState,
      [name]: value,
    }));
  };

  const handleToggleTask = (task) => {
    setFormState((currentState) => ({
      ...currentState,
      tasks: currentState.tasks.includes(task)
        ? currentState.tasks.filter((currentTask) => currentTask !== task)
        : [...currentState.tasks, task],
    }));
  };

  const handleSubmit = () => {
    const submittedBlock = onSubmit({
      id: formState.id,
      roundPresetKey: selectedPreset.key,
      roundLabel: selectedPreset.label,
      startTime: selectedPreset.startTime,
      endTime: selectedPreset.endTime,
      title: selectedPreset.defaultTitle,
      required: Number(formState.required),
      tasks: formState.tasks,
    });

    if (!submittedBlock) {
      return;
    }

    setSummary(`${isEditing ? 'อัปเดต' : 'สร้าง'} ${formatBlockShiftSummary(submittedBlock)} แล้ว`);
  };

  const shiftPreviewLabel = [selectedPreset.label, buildBlockTimeLabel(selectedPreset.startTime, selectedPreset.endTime)].filter(Boolean).join(' ');
  const submitDisabled = !summary && (Number(formState.required) <= 0 || !formState.tasks.length);

  return (
    <section className="flow-page-shell">
      <div className="flow-page-card form-page-card calm-flow-card">
        <div className="sheet-head flow-head">
          <div>
            <b>{isEditing ? 'แก้ไขกะงาน' : 'เพิ่มกะงานใหม่'}</b>
            <p className="flow-subtitle">เลือกเฉพาะกะหลักของร้าน แล้วกำหนดจำนวนคนกับหน้าที่ในกะเท่านั้น</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        {summary ? (
          <div className="form-success">
            <CheckCircle2 size={20} />
            <div>
              <strong>{isEditing ? 'อัปเดตกะงานแล้ว' : 'สร้างกะงานแล้ว'}</strong>
              <p>{summary}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="compact-editor-note schedule-round-preview-note">
              <strong>{shiftPreviewLabel}</strong>
              <span>ระบบจะใช้เวลากะมาตรฐานของร้านให้อัตโนมัติ</span>
            </div>
            <div className="form-grid compact-form-grid">
              <label className="field-group form-grid-full">
                <span>เลือกกะงาน</span>
                <select className="select-control" name="roundPresetKey" value={formState.roundPresetKey} onChange={handleShiftChange}>
                  {scheduleShiftPresets.map((preset) => (
                    <option key={preset.key} value={preset.key}>
                      {preset.label} {preset.startTime} - {preset.endTime}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-group">
                <span>จำนวนพนักงานที่ต้องใช้</span>
                <input className="text-input" name="required" type="number" min="1" value={formState.required} onChange={handleFieldChange} />
              </label>
              <div className="field-group form-grid-full">
                <span>หน้าที่ในกะ</span>
                <div className="employee-duty-grid">
                  {allShiftDutyOptions.map((task) => (
                    <button
                      key={task}
                      type="button"
                      className={`shift-duty-chip ${formState.tasks.includes(task) ? 'selected' : ''}`}
                      onClick={() => handleToggleTask(task)}
                    >
                      {task}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {isEditing ? <div className="compact-editor-note">พนักงานในกะนี้จะคงอยู่เหมือนเดิม ระบบจะอัปเดตเฉพาะชนิดกะ จำนวนคน และหน้าที่ในกะ</div> : null}
          </>
        )}
        <div className="flow-footer schedule-round-editor-actions">
          <button type="button" className="ghost-button" onClick={onClose}>ยกเลิก</button>
          <button type="button" className="primary-inline flow-submit" onClick={summary ? onClose : handleSubmit} disabled={submitDisabled}>
            {summary ? 'กลับไปตารางงาน' : isEditing ? 'บันทึกกะงาน' : 'สร้างกะงาน'}
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
