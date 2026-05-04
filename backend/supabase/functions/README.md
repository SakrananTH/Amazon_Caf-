# Supabase Edge Functions

วางแต่ละ function แยกเป็นโฟลเดอร์ เช่น

```text
functions/
  sync-employees/
    index.ts
  inventory-webhook/
    index.ts
```

เหมาะสำหรับ logic ที่ไม่ควรเปิด secret ให้ frontend เรียกตรง
