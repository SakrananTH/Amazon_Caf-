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

## หมายเหตุ

- GitHub Pages จะ deploy ได้เฉพาะ frontend
- backend จริงจะรันบน Supabase ไม่ได้รันบน GitHub Pages
