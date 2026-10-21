// ============================================================
// LINE Webhook: ใช้หารหัสกลุ่ม (Group ID) สำหรับส่งแจ้งเตือนการจอง
// - เชิญบอทเข้ากลุ่ม → บอทตอบรหัสกลุ่มให้อัตโนมัติ
// - หรือพิมพ์ "groupid" ในกลุ่ม → บอทตอบรหัสกลุ่ม
// การตอบกลับ (reply) ไม่นับโควตาข้อความของ LINE
//
// Secrets ที่ต้องตั้งใน Supabase: LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN
// ต้องปิด "Verify JWT" ของฟังก์ชันนี้ (LINE ไม่ได้ส่ง JWT ของ Supabase มา)
// ============================================================

const encoder = new TextEncoder();

// ตรวจว่าคำขอมาจาก LINE จริง (ลายเซ็น HMAC-SHA256 ด้วย Channel secret)
async function isValidSignature(body: string, signature: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return expected === signature;
}

async function replyText(replyToken: string, text: string, token: string) {
  const res = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
  });
  if (!res.ok) {
    console.error('ตอบกลับไม่สำเร็จ', res.status, await res.text(), '(ถ้าเป็น 401 แปลว่า LINE_CHANNEL_ACCESS_TOKEN ผิด)');
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok');

  const missing = ['LINE_CHANNEL_SECRET', 'LINE_CHANNEL_ACCESS_TOKEN'].filter(k => !Deno.env.get(k));
  if (missing.length) {
    console.error(`ยังไม่ได้ตั้ง Secrets หรือสะกดชื่อไม่ตรง: ${missing.join(', ')}`);
    return new Response(`missing secrets: ${missing.join(', ')}`, { status: 500 });
  }
  const secret = Deno.env.get('LINE_CHANNEL_SECRET')!.trim();
  const token = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')!.trim();

  try {
    const body = await req.text();
    const signature = req.headers.get('x-line-signature') ?? '';
    if (!(await isValidSignature(body, signature, secret))) {
      console.error('ลายเซ็นไม่ตรง: LINE_CHANNEL_SECRET อาจใส่ผิด (ต้องเป็น Channel secret จากแท็บ Basic settings)');
      return new Response('invalid signature', { status: 401 });
    }

    // ปุ่ม Verify ใน LINE Developers จะส่ง events ว่างมา → ตอบ 200 ก็ผ่าน
    const { events = [] } = JSON.parse(body || '{}');
    for (const ev of events) {
      if (ev.source?.type !== 'group' || !ev.replyToken) continue;
      const text = ev.type === 'message' && ev.message?.type === 'text'
        ? String(ev.message.text).trim().toLowerCase()
        : '';
      if (ev.type === 'join' || text === 'groupid') {
        console.log('Group ID:', ev.source.groupId);
        await replyText(
          ev.replyToken,
          `รหัสกลุ่มนี้ (นำไปใส่ใน Supabase Secrets ชื่อ LINE_GROUP_ID):\n${ev.source.groupId}`,
          token,
        );
      }
    }
    return new Response('ok');
  } catch (err) {
    console.error('line-webhook error:', err);
    return new Response('error', { status: 500 });
  }
});
