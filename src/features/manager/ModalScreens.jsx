import { useMemo, useState } from 'react';
import { Camera, CheckCircle2, Search, TriangleAlert, X } from 'lucide-react';
import { buildBlockTimeLabel, getBlockRoundLabel, getBlockStartLabel, getBlockEndLabel, normalizeClockValue } from '../../app/state/AppStateContext.jsx';

const scheduleRoundPresets = [
  {
    key: 'morning',
    label: 'รอบเช้า 06:30 - 16:30',
    roundLabel: 'รอบเช้า',
    startTime: '06:30',
    endTime: '16:30',
  },
  {
    key: 'late',
    label: 'รอบสาย 07:30 - 17:30',
    roundLabel: 'รอบสาย',
    startTime: '07:30',
    endTime: '17:30',
  },
  {
    key: 'custom',
    label: 'กำหนดเอง',
    roundLabel: 'รอบงาน',
    startTime: '',
    endTime: '',
  },
];

function findScheduleRoundPreset(presetKey = 'custom') {
  return scheduleRoundPresets.find((preset) => preset.key === presetKey) ?? scheduleRoundPresets[scheduleRoundPresets.length - 1];
}

function formatBlockRoundSummary(block) {
  if (!block) {
    return '';
  }

  const roundLabel = getBlockRoundLabel(block);
  return [roundLabel, block.time].filter(Boolean).join(' ');
}

export function AddEmployeeSheet({ block, employees, onApply, onClose }) {
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [summary, setSummary] = useState('');

  const filteredEmployees = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return employees;
    }
    return employees.filter((employee) => `${employee.name} ${employee.role}`.toLowerCase().includes(keyword));
  }, [employees, query]);

  const toggleEmployee = (employeeId) => {
    setSelectedIds((currentIds) => currentIds.includes(employeeId) ? currentIds.filter((entry) => entry !== employeeId) : [...currentIds, employeeId]);
  };

  const handleSubmit = () => {
    if (!selectedIds.length || !block) {
      return;
    }

    const result = onApply(selectedIds);
    if (result) {
      setSummary(result);
    }
  };

  return <section className="flow-page-shell"><div className="flow-page-card calm-flow-card"><div className="sheet-head flow-head"><div><b>เพิ่มพนักงานเข้ารอบงาน</b><p className="flow-subtitle">เลือกจากรายชื่อที่ยังว่าง แล้วกดยืนยันครั้งเดียว</p></div><button type="button" className="icon-button" onClick={onClose}><X size={16}/></button></div>{block ? <div className="sheet-note calm-note"><strong>{formatBlockRoundSummary(block)}</strong><span>{block.title}</span></div> : <div className="empty-card compact">ไม่พบรอบงานที่เลือก</div>}{summary ? <div className="form-success"><CheckCircle2 size={20}/><div><strong>อัปเดตรอบงานแล้ว</strong><p>{summary}</p></div></div> : <><div className="search-box page-search-box"><Search size={14}/><input className="plain-input" placeholder="ค้นหาชื่อหรือบทบาทพนักงาน" value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className="selection-caption">เลือกแล้ว {selectedIds.length} คน</div><div className="flow-list calm-flow-list">{filteredEmployees.map((employee) => <button type="button" className={`employee-choice selectable ${selectedIds.includes(employee.id) ? 'selected' : ''}`} key={employee.id} onClick={() => toggleEmployee(employee.id)}><span className="avatar-mini">{employee.avatar}</span><div><b>{employee.name} ({employee.role})</b></div>{selectedIds.includes(employee.id) ? <CheckCircle2 className="checked" size={18}/> : <span className="circle" />}</button>)}</div>{!filteredEmployees.length ? <div className="empty-card compact">ไม่พบพนักงานที่ค้นหา หรือรอบนี้มีพนักงานครบแล้ว</div> : null}</>}<div className="flow-footer"><button type="button" className="primary-inline flow-submit" onClick={summary ? onClose : handleSubmit} disabled={!summary && !selectedIds.length}>{summary ? 'กลับไปตารางงาน' : `ยืนยันเพิ่ม ${selectedIds.length} คน`}</button></div></div></section>;
}

export function RemoveConfirm({ block, employee, onCancel, onConfirm }) {
  const [summary, setSummary] = useState('');

  const handleConfirm = () => {
    const result = onConfirm();
    if (result) {
      setSummary(result);
    }
  };

  return <section className="flow-page-shell centered narrow"><div className="confirm-page-card calm-flow-card">{summary ? <div className="confirm-success"><CheckCircle2 size={28}/><b>นำพนักงานออกแล้ว</b><p>{summary}</p></div> : <><b>นำพนักงานออกจากรอบงาน</b><p>ยืนยันการนำ <strong>{employee?.name ?? 'ไม่พบพนักงาน'}</strong> ออกจาก {formatBlockRoundSummary(block) || 'รอบงานนี้'} เพื่อปรับตารางใหม่นะ?</p></>}<div className="modal-actions"><button type="button" onClick={onCancel}>{summary ? 'กลับสู่ตารางงาน' : 'ยกเลิก'}</button>{summary ? null : <button type="button" className="danger-btn" onClick={handleConfirm}>ยืนยันการนำออก</button>}</div></div></section>;
}

export function RequestHelp({ defaultDetail, defaultType, onClose, onSubmit, onViewRequests }) {
  const [formState, setFormState] = useState({
    type: defaultType,
    detail: defaultDetail,
    attachmentName: '',
  });
  const [submittedRequest, setSubmittedRequest] = useState(null);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormState((currentState) => ({ ...currentState, [name]: value }));
  };

  const handleSubmit = () => {
    if (!formState.detail.trim()) {
      return;
    }

    const request = onSubmit(formState);
    setSubmittedRequest(request);
  };

  return <section className="flow-page-shell"><div className="flow-page-card form-page-card calm-flow-card"><div className="sheet-head flow-head"><div><b>แจ้งปัญหา / ขอความช่วยเหลือ</b><p className="flow-subtitle">ส่งคำขอให้ทีมกลางจากหน้าสั้น ๆ นี้ได้เลย</p></div><button type="button" className="icon-button" onClick={onClose}><X size={16}/></button></div>{submittedRequest ? <div className="form-success"><CheckCircle2 size={20}/><div><strong>ส่งคำขอเรียบร้อยแล้ว</strong><p>{submittedRequest.title} ถูกเพิ่มในรายการคำขอของคุณแล้ว</p></div></div> : null}<label>ประเภทคำขอ</label><select className="select-box select-control" name="type" value={formState.type} onChange={handleChange}><option value="ขอพนักงานเพิ่ม">ขอพนักงานเพิ่ม</option><option value="รายงานปัญหา">รายงานปัญหา</option><option value="ขออุปกรณ์">ขออุปกรณ์</option><option value="ขอเปลี่ยนกะ">ขอเปลี่ยนกะ</option></select><label>รายละเอียด</label><textarea className="textarea-box textarea-control" name="detail" value={formState.detail} onChange={handleChange} placeholder="ระบุรายละเอียดที่ต้องการให้ทีมช่วยเหลือ" /><label>แนบรูปภาพ / หมายเหตุเพิ่มเติม</label><div className="attachment-row"><div className="camera-box"><Camera size={22}/></div><input className="text-input compact-input" name="attachmentName" value={formState.attachmentName} onChange={handleChange} placeholder="เช่น photo-counter-1.jpg" /></div><div className="flow-footer">{submittedRequest ? <button type="button" className="primary-inline flow-submit" onClick={onViewRequests}>เปิดศูนย์คำขอ</button> : <button type="button" className="primary-inline flow-submit" onClick={handleSubmit} disabled={!formState.detail.trim()}>ส่งคำขอ</button>}</div></div></section>;
}

export function ScheduleBlockEditor({ block, onClose, onSubmit }) {
  const isEditing = Boolean(block?.id);
  const initialPresetKey = findScheduleRoundPreset(block?.roundPresetKey).key;
  const [formState, setFormState] = useState({
    id: block?.id ?? null,
    roundPresetKey: initialPresetKey,
    roundLabel: getBlockRoundLabel(block),
    startTime: getBlockStartLabel(block),
    endTime: getBlockEndLabel(block),
    title: block?.title ?? '',
    required: String(block?.required ?? 1),
    tasksText: block?.tasks?.join('\n') ?? '',
  });
  const [summary, setSummary] = useState('');

  const handleChange = (event) => {
    const { name, value } = event.target;

    if (name === 'roundPresetKey') {
      const preset = findScheduleRoundPreset(value);
      setFormState((currentState) => ({
        ...currentState,
        roundPresetKey: preset.key,
        roundLabel: preset.key === 'custom' ? currentState.roundLabel || preset.roundLabel : preset.roundLabel,
        startTime: preset.startTime || currentState.startTime,
        endTime: preset.endTime || currentState.endTime,
      }));
      return;
    }

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
    const result = onSubmit({
      id: formState.id,
      roundPresetKey: formState.roundPresetKey,
      roundLabel: formState.roundLabel,
      startTime: formState.startTime,
      endTime: formState.endTime,
      time: buildBlockTimeLabel(formState.startTime, formState.endTime),
      title: formState.title,
      required: formState.required,
      tasks: formState.tasksText.split('\n'),
    });

    if (result) {
      setSummary(result);
    }
  };

  const roundPreviewLabel = [formState.roundLabel.trim(), buildBlockTimeLabel(formState.startTime, formState.endTime)].filter(Boolean).join(' ');
  const submitDisabled = !summary && (!formState.roundLabel.trim() || !normalizeClockValue(formState.startTime) || !normalizeClockValue(formState.endTime) || !formState.title.trim() || Number(formState.required) <= 0);

  return <section className="flow-page-shell"><div className="flow-page-card form-page-card calm-flow-card"><div className="sheet-head flow-head"><div><b>{isEditing ? 'แก้ไขรอบงาน' : 'เพิ่มรอบงานใหม่'}</b><p className="flow-subtitle">เลือกรอบงานสำเร็จรูป แล้วปรับเวลาเข้า เวลาเลิก และหน้าที่ได้ในฟอร์มเดียว</p></div><button type="button" className="icon-button" onClick={onClose}><X size={16}/></button></div>{summary ? <div className="form-success"><CheckCircle2 size={20}/><div><strong>{isEditing ? 'อัปเดตรอบงานแล้ว' : 'สร้างรอบงานแล้ว'}</strong><p>{summary}</p></div></div> : <><div className="compact-editor-note schedule-round-preview-note"><strong>{roundPreviewLabel || 'เลือกรอบงานก่อนบันทึก'}</strong><span>เลือกรอบเช้าหรือรอบสายเพื่อให้ระบบเติมเวลาเข้าและเวลาเลิกให้อัตโนมัติ</span></div><div className="form-grid compact-form-grid"><label className="field-group form-grid-full"><span>เลือกรอบงาน</span><select className="select-control" name="roundPresetKey" value={formState.roundPresetKey} onChange={handleChange}>{scheduleRoundPresets.map((preset) => <option key={preset.key} value={preset.key}>{preset.label}</option>)}</select></label><label className="field-group"><span>เวลาเข้า</span><input className="text-input" type="time" name="startTime" value={formState.startTime} onChange={handleChange} /></label><label className="field-group"><span>เวลาเลิกงาน</span><input className="text-input" type="time" name="endTime" value={formState.endTime} onChange={handleChange} /></label><label className="field-group form-grid-full"><span>ชื่อรอบงาน</span><input className="text-input" name="roundLabel" value={formState.roundLabel} onChange={handleChange} placeholder="เช่น รอบเช้า" /></label><label className="field-group"><span>จำนวนพนักงานที่ต้องใช้</span><input className="text-input" name="required" type="number" min="1" value={formState.required} onChange={handleChange} /></label><label className="field-group form-grid-full"><span>ชื่องาน / หน้าที่</span><input className="text-input" name="title" value={formState.title} onChange={handleChange} placeholder="เช่น เปิดร้าน" /></label><label className="field-group form-grid-full"><span>รายการงานเพิ่มเติม</span><textarea className="textarea-box textarea-control" name="tasksText" value={formState.tasksText} onChange={handleChange} placeholder="หนึ่งบรรทัดต่อหนึ่งงาน เช่น&#10;เปิดเครื่องกาแฟ&#10;เตรียมวัตถุดิบ" /></label></div>{isEditing ? <div className="compact-editor-note">พนักงานในรอบนี้จะคงอยู่เหมือนเดิม ระบบจะอัปเดตเฉพาะรอบงาน เวลา และจำนวนคนที่ต้องใช้</div> : null}</>}<div className="flow-footer schedule-round-editor-actions"><button type="button" className="ghost-button" onClick={onClose}>ยกเลิก</button><button type="button" className="primary-inline flow-submit" onClick={summary ? onClose : handleSubmit} disabled={submitDisabled}>{summary ? 'กลับไปตารางงาน' : isEditing ? 'บันทึกรอบงาน' : 'สร้างรอบงาน'}</button></div></div></section>;
}

export function MyRequests({ requests, layout = 'modal' }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      const matchesFilter = filter === 'all' ? true : filter === 'pending' ? request.status === 'รอดำเนินการ' : request.status === 'ดำเนินการแล้ว';
      const matchesQuery = query.trim() ? `${request.title} ${request.date}`.toLowerCase().includes(query.trim().toLowerCase()) : true;
      return matchesFilter && matchesQuery;
    });
  }, [filter, query, requests]);

  const pendingCount = requests.filter((request) => request.status === 'รอดำเนินการ').length;
  const doneCount = requests.filter((request) => request.status === 'ดำเนินการแล้ว').length;

  const wrapperClassName = layout === 'page' ? 'request-hub-page' : 'flow-page-shell';
  const cardClassName = layout === 'page' ? 'panel-card request-hub-card' : 'flow-page-card calm-flow-card';

  return <section className={wrapperClassName}><div className={cardClassName}>{layout === 'page' ? <><div className="request-page-hero"><div><span className="ops-hero-badge">Notifications center</span><h2>ศูนย์คำขอและการแจ้งเตือน</h2><p>ติดตามคำขอที่ส่งไว้และตรวจสถานะจากหน้าเดียว</p></div><span className="list-summary">{pendingCount} รายการรอ</span></div><div className="compact-page-stats compact-request-stats"><span className="compact-page-stat">ทั้งหมด {requests.length}</span><span className="compact-page-stat warning">รอ {pendingCount}</span><span className="compact-page-stat ok">เสร็จแล้ว {doneCount}</span></div></> : <><div className="flow-title-block"><div className="center-title flow-title">ศูนย์คำขอและการแจ้งเตือน</div><p className="flow-subtitle centered-copy">ติดตามคำขอที่ส่งไว้และตรวจสถานะจากหน้าเดียว</p></div><div className="request-summary-strip"><div className="request-summary-card"><strong>{requests.length}</strong><span>คำขอทั้งหมด</span></div><div className="request-summary-card warning"><strong>{pendingCount}</strong><span>รอดำเนินการ</span></div><div className="request-summary-card success"><strong>{doneCount}</strong><span>ดำเนินการแล้ว</span></div></div></>}<div className="search-box page-search-box"><Search size={14}/><input className="plain-input" placeholder="ค้นหาคำขอ" value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className="tabs full-page-tabs">{[{ key: 'all', label: 'ทั้งหมด' }, { key: 'pending', label: 'รอดำเนินการ' }, { key: 'done', label: 'ดำเนินการแล้ว' }].map((tab) => <button type="button" key={tab.key} className={filter === tab.key ? 'active' : undefined} onClick={() => setFilter(tab.key)}>{tab.label}</button>)}</div><div className="flow-list request-list calm-request-list">{filteredRequests.map((request) => <div className="request-item" key={request.id}><div><b>{request.title}</b><p>{request.date}</p>{request.detail ? <span className="request-detail">{request.detail}</span> : null}</div><span className={request.status === 'รอดำเนินการ' ? 'pending' : 'done'}>{request.status}</span></div>)}</div>{!filteredRequests.length ? <div className="empty-card compact"><TriangleAlert size={18}/>ไม่พบคำขอตามตัวกรองที่เลือก</div> : null}</div></section>;
}
