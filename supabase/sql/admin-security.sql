-- ============================================================
-- ความปลอดภัย: แอดมินล็อกอินด้วย Supabase Auth + จำกัดสิทธิ์ในฐานข้อมูล (RLS)
--
-- ใครทำอะไรได้หลังรันไฟล์นี้
--   คนทั่วไป : ดูตารางจอง / จองใหม่ / ยกเลิกด้วยรหัส 6 หลัก (ผ่านฟังก์ชันเดิม)
--   แอดมิน   : ทำได้ทุกอย่าง (แก้ไข ยกเลิก ลบ ล้างข้อมูล ตั้งค่าห้อง/ประกาศ)
--
-- วิธีใช้: Supabase → SQL Editor → New query → วางทั้งไฟล์ → Run (รันซ้ำได้)
-- จากนั้นเพิ่มอีเมลแอดมิน (ทำครั้งเดียว ไม่ต้องใส่อีเมลไว้ในไฟล์นี้):
--   insert into public.admin_users (email) values ('อีเมลแอดมิน@example.com');
-- ============================================================

-- 1) รายชื่ออีเมลที่เป็นแอดมิน (หน้าเว็บอ่าน/แก้ตารางนี้ไม่ได้)
create table if not exists public.admin_users (
  email      text primary key,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;

-- ผู้ที่ล็อกอินอยู่เป็นแอดมินไหม: ต้องมีบัญชีจริง ยืนยันอีเมลแล้ว และอีเมลอยู่ในรายชื่อ
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from auth.users u
      join public.admin_users a on lower(a.email) = lower(u.email)
     where u.id = auth.uid()
       and u.email_confirmed_at is not null
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- 2) เปิดการจำกัดสิทธิ์ตาราง bookings และล้างกฎเก่าทั้งหมด
alter table public.bookings enable row level security;

do $$
declare
  p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'bookings' loop
    execute format('drop policy %I on public.bookings', p.policyname);
  end loop;
end;
$$;

-- ดู: ทุกคน (ตารางจองและค่าตั้งค่าห้อง/ประกาศ ต้องแสดงบนหน้าเว็บ)
create policy bookings_select_all on public.bookings
  for select to anon, authenticated
  using (true);

-- จองใหม่: ทุกคน แต่ต้องเป็นการจองปกติที่รูปแบบข้อมูลถูกต้อง
-- (เลขรายการเป็นตัวเลข / วันที่ YYYY-MM-DD / เวลา HH:MM / จำนวนคนเป็นตัวเลข)
-- จึงสร้างแถวตั้งค่าระบบ หรือแทรกโค้ดผ่านช่องเหล่านี้ไม่ได้
create policy bookings_insert_public on public.bookings
  for insert to anon, authenticated
  with check (
    status = 'approved'
    and id::text ~ '^[0-9]{1,15}$'
    and booking_date::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    and start_time::text ~ '^[0-9]{2}:[0-9]{2}(:00)?$'
    and end_time::text ~ '^[0-9]{2}:[0-9]{2}(:00)?$'
    and coalesce(student_count::text, '') ~ '^[0-9]{0,6}$'
  );

-- แอดมิน: เพิ่ม/แก้/ลบได้ทุกแถว (รวมแถวตั้งค่าห้องและประกาศ)
create policy bookings_insert_admin on public.bookings
  for insert to authenticated
  with check (public.is_admin());

create policy bookings_update_admin on public.bookings
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy bookings_delete_admin on public.bookings
  for delete to authenticated
  using (public.is_admin());

-- 3) ตรวจผล: ควรเห็นกฎ 5 ข้อ และ rls_enabled = true
select c.relrowsecurity as rls_enabled, p.policyname, p.cmd
  from pg_class c
  left join pg_policies p on p.schemaname = 'public' and p.tablename = c.relname
 where c.oid = 'public.bookings'::regclass
 order by p.policyname;
