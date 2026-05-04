# Backend Scaffold

โฟลเดอร์นี้เตรียมไว้สำหรับ backend ที่เกี่ยวกับ Supabase โดยแยกออกจาก frontend ชัดเจน

## โครงสร้าง

```text
backend/
  supabase/
    functions/      Supabase Edge Functions
    migrations/     SQL migrations
    seeds/          seed data หรือ SQL เริ่มต้น
  .env.example      ตัวอย่าง env สำหรับ backend
```

## แนวทางใช้งาน

- ถ้าใช้ Supabase Database อย่างเดียว ให้เก็บ schema และ migration ไว้ใน `backend/supabase/migrations`
- ถ้าต้องมี logic ฝั่ง server ให้ใช้ Supabase Edge Functions ใน `backend/supabase/functions`
- ถ้าจะมี secret เช่น `SUPABASE_SERVICE_ROLE_KEY` ให้ใส่ใน env ของ Supabase หรือ CI เท่านั้น ห้าม commit ค่าใช้งานจริง
- migration เริ่มต้นของโปรเจกต์นี้ถูกเตรียมไว้แล้ว และออกแบบให้รองรับข้อมูลที่หน้าเว็บใช้จริง เช่น พนักงาน ตารางกะ สต็อก คำขอ และ issue reports
- seed ตัวอย่างอ้างอิงจาก mock data ปัจจุบันของแอป เพื่อให้เริ่มย้ายจาก local state ไป Supabase ได้ง่ายขึ้น

## หมายเหตุ

- GitHub Pages จะ deploy ได้เฉพาะ frontend
- backend จริงจะรันบน Supabase ไม่ได้รันบน GitHub Pages

## Frontend Integration

- ฝั่งเว็บมี service layer เตรียมไว้ที่ `src/services/supabase`
- ถ้าจะเริ่มเชื่อมจริง ให้ตั้งค่า `.env` จาก `.env.example` แล้วค่อยเรียกใช้ loader ใน service layer เพื่อดึงข้อมูลจาก Supabase

## Auth และ RLS

- ฝั่งเว็บตรวจ login ของ manager และ employee ผ่าน SQL RPC (`authenticate_manager_portal`, `authenticate_employee_portal`) แทนการดึงตาราง credential มาตรวจใน browser ตรง ๆ
- migration ที่เพิ่ม RPC auth อยู่ใน `backend/supabase/migrations/202605040003_auth_rpc.sql`
- RLS ปัจจุบันยังเป็นแบบ permissive เพื่อให้ static frontend ใช้งานต่อได้กับ publishable key เดิม
- ถ้าต้องการแยกสิทธิ์ manager/employee แบบบังคับจริง ควรต่อยอดด้วย Supabase Auth หรือย้าย write path ไปอยู่หลัง server-side boundary
