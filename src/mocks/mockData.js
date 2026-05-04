function formatDateKey(dateInput = new Date()) {
  const date = new Date(dateInput);
  date.setHours(0, 0, 0, 0);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(dateInput, amount = 0) {
  const date = new Date(dateInput);
  date.setDate(date.getDate() + amount);
  return date;
}

const today = new Date();
today.setHours(0, 0, 0, 0);

export const employees = [
  { id: 1, name: 'สมชาย', role: 'บาริสต้า', avatar: '👨🏻', phone: '0800000001', employeeCode: 'AMZ0001', availabilityStatus: 'ready' },
  { id: 2, name: 'สมหญิง', role: 'บาริสต้า', avatar: '👩🏻', phone: '0800000002', employeeCode: 'AMZ0002', availabilityStatus: 'ready' },
  { id: 3, name: 'อนันต์', role: 'พนักงานบริการ', avatar: '👨🏽', phone: '0800000003', employeeCode: 'AMZ0003', availabilityStatus: 'ready' },
  { id: 4, name: 'มานพ', role: 'ผู้จัดการร้าน', avatar: '🧑🏻', phone: '0800000004', employeeCode: 'AMZ0004', availabilityStatus: 'ready' },
  { id: 5, name: 'พลอย', role: 'พาทไทม์', avatar: '👩🏽', phone: '0800000005', employeeCode: 'AMZ0005', availabilityStatus: 'ready' }
];

export const employeeAvailabilityCalendar = {
  2: {
    [formatDateKey(today)]: 'annual_leave',
    [formatDateKey(addDays(today, 1))]: 'annual_leave',
    [formatDateKey(addDays(today, 7))]: 'personal_leave',
    [formatDateKey(addDays(today, 8))]: 'personal_leave',
  },
  3: {
    [formatDateKey(today)]: 'absent',
    [formatDateKey(addDays(today, 5))]: 'sick_leave',
  },
};

export const calendarDaySettings = {
  [formatDateKey(addDays(today, 2))]: {
    leaveLocked: true,
    doublePay: false,
  },
  [formatDateKey(addDays(today, 6))]: {
    leaveLocked: false,
    doublePay: true,
  },
};

export const timeBlocks = [
  { id: 1, time: '06:30 - 09:30', title: 'เปิดร้าน', required: 2, status: 'ok', tasks: ['เปิดร้าน', 'เปิดเครื่องกาแฟ', 'เตรียมวัตถุดิบ', 'ส่งงานมาตรฐาน'], employeeIds: [1, 4] },
  { id: 2, time: '10:00', title: 'เช็ดโต๊ะ', required: 1, status: 'ok', tasks: ['เช็ดโต๊ะ', 'กวาดร้าน'], employeeIds: [3, 5] },
  { id: 3, time: '13:00', title: 'เติมน้ำแข็ง', required: 1, status: 'ok', tasks: ['เติมน้ำแข็ง', 'เช็ดโต๊ะ', 'ดูร้าน'], employeeIds: [2, 5] },
  { id: 4, time: '14:00 - 16:00', title: 'เติมนม', required: 1, status: 'ok', tasks: ['เติมนม', 'เช็คสต็อก', 'เตรียมวัตถุดิบ'], employeeIds: [3] },
  { id: 5, time: '17:00 - 17:30', title: 'เช็คปิดร้าน', required: 2, status: 'ok', tasks: ['ทำความสะอาดเครื่อง', 'เช็คสต็อก', 'เช็คปิดร้าน'], employeeIds: [1, 2, 4] }
];

export const requests = [
  { id: 1, title: 'ขอรับพนักงานเพิ่ม', date: '02/05/2026 08:30', status: 'รอดำเนินการ' },
  { id: 2, title: 'แจ้งพนักงานลาออก', date: '01/05/2026 17:45', status: 'ดำเนินการแล้ว' },
  { id: 3, title: 'แจ้งคนขาดกะ', date: '01/05/2026 10:15', status: 'ดำเนินการแล้ว' },
  { id: 4, title: 'ขอเปลี่ยนกะ', date: '30/04/2026 09:20', status: 'รอดำเนินการ' }
];

export const inventoryItems = [
  { id: 101, name: 'เมล็ดกาแฟ House Blend', category: 'วัตถุดิบ', quantity: 3, unit: 'ถุง', threshold: 2, expiresOn: '2026-05-18', checkedAt: '03/05/2026 07:40', checkedBy: 'สมชาย', receivedToday: 1, soldToday: 42, useToday: false },
  { id: 102, name: 'นมสดพาสเจอร์ไรส์', category: 'นม', quantity: 8, unit: 'ขวด', threshold: 5, expiresOn: '2026-05-06', checkedAt: '03/05/2026 08:10', checkedBy: 'สมหญิง', receivedToday: 4, soldToday: 18, useToday: true },
  { id: 103, name: 'ไซรัปวานิลลา', category: 'เครื่องดื่ม', quantity: 2, unit: 'ขวด', threshold: 2, expiresOn: '2026-06-20', checkedAt: '03/05/2026 09:00', checkedBy: 'อนันต์', receivedToday: 0, soldToday: 12, useToday: false },
  { id: 104, name: 'ครัวซองต์เนยสด', category: 'ขนม', quantity: 9, unit: 'ชิ้น', threshold: 6, expiresOn: '2026-05-04', checkedAt: '03/05/2026 06:50', checkedBy: 'พลอย', receivedToday: 6, soldToday: 15, useToday: true },
  { id: 105, name: 'แก้วเย็น 16 oz', category: 'อุปกรณ์', quantity: 54, unit: 'ใบ', threshold: 20, expiresOn: '', noExpiry: true, checkedAt: '03/05/2026 10:00', checkedBy: 'มานพ', receivedToday: 12, soldToday: 37, useToday: false },
];

export const issueReports = [
  { id: 201, title: 'ตู้แช่นมเย็นไม่คงที่', detail: 'อุณหภูมิขึ้นลงช่วงเช้า ควรให้ช่างเข้าตรวจสอบ', severity: 'สูง', date: '03/05/2026 09:20', status: 'รอดำเนินการ' },
  { id: 202, title: 'ฝาถังขยะหลังบาร์หลวม', detail: 'เปิดปิดไม่สนิท เวลาช่วงเร่งด่วนใช้งานไม่สะดวก', severity: 'กลาง', date: '02/05/2026 18:15', status: 'กำลังตรวจสอบ' },
];
