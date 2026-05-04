# Amazon Schedule UI
โปรเจกต์นี้เป็น frontend-only สำหรับหน้าจอจัดตารางงานและพอร์ทัลพนักงานของร้าน

ตอนนี้ยังไม่มี backend/server แยกอยู่ใน repo นี้ ข้อมูลที่เห็นในระบบมาจาก mock state ภายในแอป

## โครงสร้างหลัก

```text
src/
  app/                 แกนแอป เช่น App, routes, screen catalog, state provider
    state/             global app state และ business helpers
  features/
    manager/           หน้าจอและ flow ฝั่งผู้จัดการ
    employee/          หน้าจอและ flow ฝั่งพนักงาน
    shared/            component ที่ใช้ร่วมกันหลายฝั่ง
  mocks/               mock data สำหรับจำลองระบบแทน backend
  styles/              theme และ styles กลาง
  main.jsx             Vite entry point
```

## วิธีอ่านโปรเจกต์สำหรับคนมาใหม่

- ถ้าจะดู route ทั้งหมด เริ่มที่ `src/app/screenCatalog.jsx`
- ถ้าจะแก้ state หรือ business rule กลาง ดู `src/app/state/AppStateContext.jsx`
- ถ้าจะแก้หน้าผู้จัดการ ดู `src/features/manager`
- ถ้าจะแก้หน้าพนักงาน ดู `src/features/employee`
- ถ้าจะเชื่อม backend จริงในอนาคต แนะนำเพิ่ม `src/services` หรือแยก server ออกเป็นอีกโปรเจกต์ แล้วค่อยเลิกใช้ `src/mocks`

## หมายเหตุ

- `src/mocks` คือข้อมูลจำลอง ไม่ใช่ backend
- อย่าใส่ API call ตรงใน component ถ้าจะเพิ่ม backend จริง ให้แยกไว้ใน service layer

## Deploy

- frontend สามารถ deploy ขึ้น GitHub Pages ได้ผ่าน workflow ใน `.github/workflows/deploy-pages.yml`
- GitHub ไม่ได้รัน backend server แบบถาวรให้โปรเจกต์นี้
- ถ้าใช้ Supabase ให้ถือว่า Supabase คือ backend/database และ frontend ตัวนี้ค่อยเรียกใช้งานผ่าน client หรือ edge functions
- โค้ดฝั่ง backend ที่เกี่ยวกับ Supabase ถูกแยกไว้ในโฟลเดอร์ `backend/`

## Supabase

- frontend client และ service layer อยู่ที่ `src/services/supabase`
- migration แรกอยู่ที่ `backend/supabase/migrations/202605040001_initial_schema.sql`
- seed ตัวอย่างอยู่ที่ `backend/supabase/seeds/202605040001_seed_from_mocks.sql`
- ตั้งค่า frontend env จากไฟล์ `.env.example`
- ตอนนี้ service layer ถูกเตรียมไว้แล้ว แต่ยังไม่ได้บังคับให้แทน `src/mocks` อัตโนมัติ เพื่อไม่ให้ flow เดิมพังระหว่างย้ายระบบ
