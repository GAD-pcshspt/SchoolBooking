-- ============================================================
-- กันการจองซ้ำที่ฐานข้อมูล (ด่านสุดท้าย แม้กดจองพร้อมกันหลายเครื่อง)
-- กติกา: ห้องเดียวกัน + วันเดียวกัน + เวลาทับกันแม้บางช่วง = จองไม่ได้
--        จองต่อเวลาพอดี (คนแรกเลิก 15:00 อีกคนเริ่ม 15:00) = จองได้
--        คนละห้อง เวลาเดียวกัน = จองได้
-- วิธีใช้: Supabase → SQL Editor → New query → วางทั้งไฟล์ → Run (รันซ้ำได้)
-- ============================================================

-- รายชื่อห้องจากช่อง room ("ห้อง 101, ห้อง 102") ตัดช่องว่างออกเพื่อเทียบ
create or replace function public.booking_room_keys(p_room text)
returns text[]
language sql
immutable
as $$
  select coalesce(array_agg(k), '{}')
    from (select regexp_replace(trim(x), '\s+', '', 'g') as k
            from unnest(string_to_array(coalesce(p_room, ''), ',')) as x) t
   where k <> '';
$$;

-- 1) ตรวจก่อนบันทึกทุกครั้ง (จองใหม่ / แอดมินแก้ไข)
create or replace function public.prevent_booking_overlap()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_rooms text[];
  v_clash record;
begin
  -- ตรวจเฉพาะรายการที่ยังใช้งาน (ข้ามที่ยกเลิกแล้ว และแถวตั้งค่าระบบ)
  if new.status is distinct from 'approved' then
    return new;
  end if;
  -- แก้ไขแต่ไม่ได้เปลี่ยนห้อง/วัน/เวลา ไม่ต้องตรวจ
  if tg_op = 'UPDATE' and old.status = 'approved'
     and new.room is not distinct from old.room
     and new.booking_date is not distinct from old.booking_date
     and new.start_time is not distinct from old.start_time
     and new.end_time is not distinct from old.end_time then
    return new;
  end if;

  if coalesce(new.start_time, '') = '' or coalesce(new.end_time, '') = '' or new.start_time >= new.end_time then
    raise exception 'invalid_booking_time' using errcode = '22023';
  end if;

  v_rooms := public.booking_room_keys(new.room);
  if cardinality(v_rooms) = 0 then
    return new;
  end if;

  -- ล็อกตามวัน: เครื่องที่กดพร้อมกันในวันเดียวกันต้องรอคิว จึงไม่หลุดซ้อนกัน
  perform pg_advisory_xact_lock(hashtext('booking-date:' || new.booking_date::text));

  select b.id, b.full_name, b.start_time, b.end_time
    into v_clash
    from public.bookings b
   where b.id <> new.id
     and b.status = 'approved'
     and b.booking_date = new.booking_date
     and b.start_time < new.end_time
     and new.start_time < b.end_time
     and public.booking_room_keys(b.room) && v_rooms
   limit 1;

  if found then
    raise exception 'booking_conflict'
      using errcode = '23P01',
            detail = format('ชนกับการจอง #%s เวลา %s–%s', v_clash.id, v_clash.start_time, v_clash.end_time);
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_booking_overlap on public.bookings;
create trigger prevent_booking_overlap
  before insert or update on public.bookings
  for each row execute function public.prevent_booking_overlap();

-- 2) ลบการจองแล้ว ลบรหัสยกเลิก 6 หลักของรายการนั้นด้วย
--    (กันรหัสเก่าค้างไปผูกกับการจองใหม่ที่ได้เลขเดิม)
create or replace function public.cleanup_booking_codes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.booking_codes c where c.booking_id = old.id;
  return old;
end;
$$;

do $$
begin
  if to_regclass('public.booking_codes') is not null then
    execute 'drop trigger if exists cleanup_booking_codes on public.bookings';
    execute 'create trigger cleanup_booking_codes after delete on public.bookings
               for each row execute function public.cleanup_booking_codes()';
    -- เก็บกวาดรหัสที่ค้างจากการล้างข้อมูลครั้งก่อน ๆ
    delete from public.booking_codes c
     where not exists (select 1 from public.bookings b where b.id = c.booking_id);
  end if;
end;
$$;

-- 3) ตรวจข้อมูลเดิม: แสดงคู่การจองที่ซ้อนกันอยู่แล้ว (ถ้าว่าง = ไม่มีปัญหา)
select a.booking_date as "วันที่",
       a.room || ' (#' || a.id || ' ' || a.start_time || '–' || a.end_time || ')' as "การจองที่ 1",
       b.room || ' (#' || b.id || ' ' || b.start_time || '–' || b.end_time || ')' as "การจองที่ 2"
  from public.bookings a
  join public.bookings b
    on a.id < b.id
   and a.status = 'approved' and b.status = 'approved'
   and a.booking_date = b.booking_date
   and a.start_time < b.end_time and b.start_time < a.end_time
   and public.booking_room_keys(a.room) && public.booking_room_keys(b.room)
 order by a.booking_date;
