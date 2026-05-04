# SQL Migrations

เก็บไฟล์ migration ของ schema เช่น

```sql
create table employees (
  id bigint generated always as identity primary key,
  name text not null
);
```
