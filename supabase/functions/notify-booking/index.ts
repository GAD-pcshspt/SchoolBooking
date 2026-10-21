// ============================================================
// แจ้งเตือนการจองใหม่เข้ากลุ่มไลน์
// เรียกโดย Supabase Database Webhook (INSERT บนตาราง bookings)
//
// การจองหลายวันบันทึกเป็นหลายแถวที่มี created_at และ full_name เดียวกัน
// ฟังก์ชันจะรอสักครู่ แล้วให้แถวที่ id น้อยที่สุดเป็นตัวส่งข้อความสรุปรวมครั้งเดียว
// (ประหยัดโควตา LINE ซึ่งนับตามจำนวนสมาชิกในกลุ่มต่อ 1 ข้อความ)
//
// Secrets: LINE_CHANNEL_ACCESS_TOKEN, LINE_GROUP_ID, NOTIFY_WEBHOOK_SECRET
// (SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY มีให้อัตโนมัติ)
// ปิด "Verify JWT" ของฟังก์ชันนี้ แล้วใช้ header x-webhook-secret ยืนยันแทน
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const WAIT_FOR_SIBLINGS_MS = 8000;
const THAI_DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

type BookingRow = {
  id: string;
  full_name: string;
  position: string | null;
  department: string | null;
  room: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  purpose: string | null;
  student_count: string | null;
  grade: string | null;
  status: string;
  created_at: string;
};

// "2026-10-22" → "พ. 22 ต.ค. 2569"
function thaiDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${THAI_DAYS[dow]} ${d} ${THAI_MONTHS[m - 1]} ${y + 543}`;
}

// "60" + "คณะครู" → "60 คน (คณะครู)"
function usersText(r: BookingRow): string {
  const count = r.student_count ? `${r.student_count} คน` : '-';
  return r.grade ? `${count} (${r.grade})` : count;
}

// title เช่น "📢 มีการจองสถานที่ใหม่" (จองหลายวันจะต่อท้ายด้วยจำนวนวัน)
function buildMessage(rows: BookingRow[], title = '📢 มีการจองสถานที่ใหม่'): string {
  const first = rows[0];
  const who = `👤 ผู้จอง: ${first.full_name}`;

  if (rows.length === 1) {
    return [
      title,
      who,
      `📍 สถานที่: ${first.room || '-'}`,
      `📅 วันที่: ${thaiDate(first.booking_date)}`,
      `⏰ เวลา: ${first.start_time}–${first.end_time} น.`,
      `👥 ผู้ใช้ห้อง: ${usersText(first)}`,
      `🎯 วัตถุประสงค์: ${first.purpose || '-'}`,
    ].join('\n');
  }

  // จองหลายวัน: ข้อมูลที่เหมือนกันทุกวันแสดงครั้งเดียวด้านบน ที่ต่างกันแสดงใต้แต่ละวัน
  const samePurpose = rows.every(r => (r.purpose || '') === (first.purpose || ''));
  const sameUsers = rows.every(r => usersText(r) === usersText(first));
  const lines = rows.map((r, i) =>
    `${i + 1}) ${thaiDate(r.booking_date)} · ${r.start_time}–${r.end_time} น. · ${r.room || '-'}` +
    (sameUsers ? '' : `\n    👥 ${usersText(r)}`) +
    (samePurpose ? '' : `\n    🎯 ${r.purpose || '-'}`),
  );
  return [
    `${title} (${rows.length} วัน)`,
    who,
    ...(sameUsers ? [`👥 ผู้ใช้ห้อง: ${usersText(first)}`] : []),
    ...(samePurpose ? [`🎯 วัตถุประสงค์: ${first.purpose || '-'}`] : []),
    ...lines,
  ].join('\n');
}

async function pushToLine(text: string) {
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${(Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN') ?? '').trim()}`,
    },
    body: JSON.stringify({
      to: (Deno.env.get('LINE_GROUP_ID') ?? '').trim(),
      messages: [{ type: 'text', text: text.slice(0, 5000) }],
    }),
  });
  if (!res.ok) console.error('LINE push failed', res.status, await res.text());
  else console.log('LINE push sent');
}

async function notify(record: BookingRow) {
  await new Promise(resolve => setTimeout(resolve, WAIT_FOR_SIBLINGS_MS));

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data, error } = await supabase
    .from('bookings')
    .select('id, full_name, position, department, room, booking_date, start_time, end_time, purpose, student_count, grade, status, created_at')
    .eq('created_at', record.created_at)
    .eq('full_name', record.full_name)
    .eq('status', 'approved');
  if (error) console.error('Load sibling bookings failed', error);

  const rows: BookingRow[] = data && data.length ? data : [record];
  const minId = Math.min(...rows.map(r => Number(r.id)));
  if (Number(record.id) !== minId) return; // แถวอื่นในชุดเดียวกันเป็นคนส่งแล้ว

  rows.sort((a, b) => (a.booking_date + a.start_time).localeCompare(b.booking_date + b.start_time));
  await pushToLine(buildMessage(rows));
}

Deno.serve(async (req) => {
  const missing = ['LINE_CHANNEL_ACCESS_TOKEN', 'LINE_GROUP_ID', 'NOTIFY_WEBHOOK_SECRET'].filter(k => !Deno.env.get(k));
  if (missing.length) {
    console.error(`ยังไม่ได้ตั้ง Secrets หรือสะกดชื่อไม่ตรง: ${missing.join(', ')}`);
    return new Response(`missing secrets: ${missing.join(', ')}`, { status: 500 });
  }
  if ((req.headers.get('x-webhook-secret') ?? '').trim() !== Deno.env.get('NOTIFY_WEBHOOK_SECRET')!.trim()) {
    console.error('x-webhook-secret ไม่ตรงกับ NOTIFY_WEBHOOK_SECRET (เช็ก HTTP Headers ใน Database Webhook)');
    return new Response('unauthorized', { status: 401 });
  }

  const payload = await req.json().catch(() => null);

  // ยกเลิกการจอง (จาก trigger notify_line_on_cancel: 1 คำสั่ง = 1 ข้อความ ไม่ต้องรอรวมชุด)
  if (payload?.type === 'CANCEL' && Array.isArray(payload.records) && payload.records.length) {
    const rows = (payload.records as BookingRow[]).filter(r => !String(r.id).startsWith('__'));
    if (!rows.length) return new Response('skipped');
    const reason = String(payload.reason || '').trim();
    const by = payload.cancelled_by === 'owner' ? 'ผู้จอง (ยืนยันด้วยรหัส 6 หลัก)' : 'แอดมิน';
    const text = [
      buildMessage(rows, '❌ ยกเลิกการจอง'),
      ...(reason ? [`💬 เหตุผล: ${reason}`] : []),
      `🙋 ยกเลิกโดย: ${by}`,
    ].join('\n');
    await pushToLine(text);
    return new Response('cancel notified');
  }

  const record = payload?.record as BookingRow | undefined;

  // เฉพาะการจองใหม่ที่อนุมัติแล้ว (ข้ามแถวตั้งค่าระบบ __site_form_options__)
  if (payload?.type !== 'INSERT' || !record || record.status !== 'approved' || String(record.id).startsWith('__')) {
    return new Response('skipped');
  }

  // ตอบ webhook ทันที แล้วทำงานต่อเบื้องหลัง
  EdgeRuntime.waitUntil(notify(record));
  return new Response('queued');
});
