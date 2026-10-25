// ============================================================
// ยกเลิกการจองด้วยรหัส 6 หลัก
// - หลังจองสำเร็จ: สุ่มรหัส แล้วให้ฐานข้อมูลเก็บแบบ hash (RPC set_booking_code)
// - ยกเลิก: ฐานข้อมูลตรวจรหัสเอง ผิดเกิน 5 ครั้งล็อก (RPC verify_booking_code / cancel_bookings_with_code)
// - แจ้งไลน์ตอนยกเลิกทำโดย trigger ในฐานข้อมูล (ไม่ต้องทำในหน้าเว็บ)
// ต้องโหลดหลัง app.js และ venues.js
// ============================================================

const MY_BOOKINGS_KEY = 'school_booking_my_bookings';
const MY_BOOKINGS_MAX = 30;

function isCancelCodeAvailable() {
  return typeof checkIsSupabaseActive === 'function' && checkIsSupabaseActive();
}

function generateCancelCode() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 1000000).padStart(6, '0');
}

// จำว่าเครื่องนี้จองอะไรไว้ (ไม่เก็บรหัส ต้องกรอกรหัสทุกครั้งที่ยกเลิก)
function rememberMyBooking(ids) {
  try {
    const list = JSON.parse(localStorage.getItem(MY_BOOKINGS_KEY) || '[]');
    list.unshift({ ids: ids.map(String), createdAt: new Date().toISOString() });
    localStorage.setItem(MY_BOOKINGS_KEY, JSON.stringify(list.slice(0, MY_BOOKINGS_MAX)));
  } catch (_) {}
}

function getMyBookingEntries() {
  try { return JSON.parse(localStorage.getItem(MY_BOOKINGS_KEY) || '[]'); } catch (_) { return []; }
}

// เรียกหลังบันทึกการจองขึ้นคลาวด์แล้ว
// คืนค่า: รหัส 6 หลัก, false = สร้างรหัสไม่สำเร็จ, null = ไม่ได้ใช้ Supabase (ไม่มีระบบรหัส)
async function assignCancelCode(ids) {
  if (!ids || !ids.length) return null;
  rememberMyBooking(ids);
  if (!isCancelCodeAvailable()) return null;
  const code = generateCancelCode();
  try {
    const { error } = await supabaseClient.rpc('set_booking_code', {
      p_booking_ids: ids.map(String),
      p_code: code,
    });
    if (error) throw error;
    return code;
  } catch (err) {
    console.warn('สร้างรหัสยกเลิกไม่สำเร็จ:', err);
    return false;
  }
}

// กล่องรหัสในหน้าต่าง "จองสำเร็จ"
function renderSuccessCode(code) {
  const box = document.getElementById('successCodeBox');
  if (!box) return;
  if (code === null) {
    box.classList.add('hidden');
    box.innerHTML = '';
    return;
  }
  box.classList.remove('hidden');
  if (code === false) {
    box.innerHTML = `<div class="sc-fail">⚠️ สร้างรหัสยกเลิกการจองไม่สำเร็จ หากต้องการยกเลิกภายหลัง กรุณาติดต่อแอดมิน</div>`;
    return;
  }
  box.innerHTML = `
    <div class="sc-label">🔑 รหัสยกเลิกการจองของคุณ</div>
    <div class="sc-code" aria-label="รหัส ${code}">${code.split('').map(d => `<span>${d}</span>`).join('')}</div>
    <button type="button" class="sc-copy" onclick="copyCancelCode('${code}')">📋 คัดลอกรหัส</button>
    <div class="sc-warning">
      โปรดเซฟใบสรุปการจองและรหัส 6 หลักนี้ไว้<br>
      เพื่อใช้ทำการยกเลิกการจอง (ถ้าจำเป็นต้องยกเลิก)
    </div>
    <div class="sc-hint">กดปุ่ม "พิมพ์ใบจอง" ด้านล่าง แล้วเลือกบันทึกเป็น PDF ได้ (ใบจองมีรหัสนี้อยู่ด้วย) หรือแคปหน้าจอนี้เก็บไว้</div>
  `;
}

async function copyCancelCode(code) {
  try {
    await navigator.clipboard.writeText(code);
    showToast('📋 คัดลอกรหัสแล้ว', 'success');
  } catch (_) {
    showToast(`รหัสของคุณคือ ${code}`, 'info');
  }
}

// ------------------------------------------------------------
// หน้า "ยกเลิกการจอง"
// ------------------------------------------------------------
function isCancellable(b) {
  return b && b.status === 'approved' && b.bookingDate >= todayStr();
}

function cancelRowHtml(b) {
  return `
    <div class="cx-row">
      <div class="cx-row-main">
        <div class="cx-row-title">📍 ${escapeHtml(b.room)}</div>
        <div class="cx-row-sub">📅 ${escapeHtml(fmtDay(b.bookingDate, true))} · ⏰ ${escapeHtml(b.startTime)}–${escapeHtml(b.endTime)} น. · 👤 ${escapeHtml(b.fullName)}</div>
        ${b.purpose ? `<div class="cx-row-sub">🎯 ${escapeHtml(b.purpose)}</div>` : ''}
      </div>
      <button type="button" class="btn-cancel-booking" onclick="openCancelModal('${escapeHtml(String(b.id))}')">❌ ยกเลิก</button>
    </div>
  `;
}

function renderCancelPage() {
  const mine = document.getElementById('myBookingsList');
  if (!mine) return;

  const notice = document.getElementById('cancelUnavailable');
  if (notice) notice.classList.toggle('hidden', isCancelCodeAvailable());

  const seen = new Set();
  const myRows = [];
  getMyBookingEntries().forEach(entry => (entry.ids || []).forEach(id => {
    if (seen.has(id)) return;
    seen.add(id);
    const b = getBookingById(id);
    if (isCancellable(b)) myRows.push(b);
  }));
  myRows.sort((a, b) => (a.bookingDate + a.startTime).localeCompare(b.bookingDate + b.startTime));
  mine.innerHTML = myRows.length
    ? myRows.map(cancelRowHtml).join('')
    : '<p class="announce-empty">ยังไม่มีการจองที่ยกเลิกได้จากเครื่องนี้</p>';

  renderCancelSearch();
}

function renderCancelSearch() {
  const out = document.getElementById('cancelSearchResults');
  const input = document.getElementById('cancelSearchInput');
  if (!out || !input) return;
  const q = input.value.trim().toLowerCase();
  if (q.length < 2) {
    out.innerHTML = '<p class="announce-empty">พิมพ์อย่างน้อย 2 ตัวอักษร</p>';
    return;
  }
  const rows = getBookings()
    .filter(b => isCancellable(b) && String(b.fullName || '').toLowerCase().includes(q))
    .sort((a, b) => (a.bookingDate + a.startTime).localeCompare(b.bookingDate + b.startTime));
  out.innerHTML = rows.length
    ? rows.slice(0, 30).map(cancelRowHtml).join('') + (rows.length > 30 ? `<p class="announce-empty">และอีก ${rows.length - 30} รายการ พิมพ์ชื่อให้ละเอียดขึ้น</p>` : '')
    : '<p class="announce-empty">ไม่พบการจองที่ยกเลิกได้ของชื่อนี้</p>';
}

// ------------------------------------------------------------
// หน้าต่างยกเลิก: กรอกรหัส → เลือกวันที่จะยกเลิก → ยืนยัน
// ------------------------------------------------------------
let cxBookingId = null;
let cxCode = '';
let cxGroup = [];

function openCancelModal(id) {
  const b = getBookingById(id);
  if (!b) return;
  if (!isCancelCodeAvailable()) {
    showToast('ขณะนี้เชื่อมต่อฐานข้อมูลไม่ได้ จึงยกเลิกด้วยรหัสไม่ได้', 'error');
    return;
  }
  closeBookingDetail();
  cxBookingId = String(b.id);
  cxCode = '';
  cxGroup = [];
  document.getElementById('cxSummary').innerHTML = `
    <div><strong>📍 ${escapeHtml(b.room)}</strong></div>
    <div>📅 ${escapeHtml(fmtDay(b.bookingDate, true))} · ⏰ ${escapeHtml(b.startTime)}–${escapeHtml(b.endTime)} น.</div>
    <div>👤 ${escapeHtml(b.fullName)}</div>
  `;
  document.getElementById('cxCode').value = '';
  document.getElementById('cxReason').value = '';
  document.getElementById('errCancel').textContent = '';
  setCancelStep('code');
  document.getElementById('cancelModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('cxCode').focus(), 50);
}

function closeCancelModal() {
  document.getElementById('cancelModal').classList.add('hidden');
  cxBookingId = null;
  cxCode = '';
}

function setCancelStep(step) {
  const isCode = step === 'code';
  document.getElementById('cxStepCode').classList.toggle('hidden', !isCode);
  document.getElementById('cxStepConfirm').classList.toggle('hidden', isCode);
  document.getElementById('btnCxVerify').classList.toggle('hidden', !isCode);
  document.getElementById('btnCxConfirm').classList.toggle('hidden', isCode);
}

function cancelErrorText(res) {
  if (!res) return 'ระบบยกเลิกด้วยรหัสยังไม่พร้อมใช้งาน กรุณาติดต่อแอดมิน';
  if (res.error === 'no_code') return 'การจองนี้ไม่มีรหัสยกเลิก (อาจจองก่อนเปิดใช้ระบบรหัส) กรุณาติดต่อแอดมินเพื่อยกเลิก';
  if (res.error === 'locked') return '🔒 กรอกรหัสผิดเกิน 5 ครั้ง การจองนี้ถูกล็อกการยกเลิกด้วยรหัส กรุณาติดต่อแอดมิน';
  if (res.error === 'wrong_code') return `รหัสไม่ถูกต้อง (เหลือโอกาสอีก ${res.remaining} ครั้ง)`;
  return 'เกิดข้อผิดพลาด กรุณาลองใหม่';
}

async function verifyCancelCode() {
  const errEl = document.getElementById('errCancel');
  const code = document.getElementById('cxCode').value.replace(/\D/g, '');
  errEl.textContent = '';
  if (code.length !== 6) {
    errEl.textContent = 'กรุณากรอกรหัสให้ครบ 6 หลัก';
    return;
  }
  const btn = document.getElementById('btnCxVerify');
  btn.disabled = true;
  try {
    const { data, error } = await supabaseClient.rpc('verify_booking_code', { p_booking_id: cxBookingId, p_code: code });
    if (error) throw error;
    if (!data || !data.ok) {
      errEl.textContent = cancelErrorText(data);
      return;
    }
    cxCode = code;
    cxGroup = Array.isArray(data.bookings) ? data.bookings : [];
    renderCancelChoices();
    setCancelStep('confirm');
  } catch (err) {
    console.warn('verify_booking_code error:', err);
    errEl.textContent = cancelErrorText(null);
  } finally {
    btn.disabled = false;
  }
}

function renderCancelChoices() {
  const today = todayStr();
  const list = document.getElementById('cxList');
  list.innerHTML = `
    ${cxGroup.length > 1 ? `
      <div class="cx-list-head">
        <span>การจองชุดนี้มี ${cxGroup.length} วัน เลือกวันที่ต้องการยกเลิก</span>
        <button type="button" onclick="toggleAllCancelChoices(true)">เลือกทั้งหมด</button>
      </div>` : ''}
    ${cxGroup.map(r => {
      const id = String(r.id);
      const ok = r.status === 'approved' && String(r.booking_date) >= today;
      const note = r.status === 'cancelled' ? 'ยกเลิกแล้ว' : !ok ? 'ผ่านไปแล้ว' : '';
      return `
        <label class="cx-choice ${ok ? '' : 'disabled'}">
          <input type="checkbox" value="${escapeHtml(id)}" ${ok ? '' : 'disabled'} ${ok && id === cxBookingId ? 'checked' : ''} onchange="updateCancelConfirmLabel()" />
          <span>📅 ${escapeHtml(fmtDay(String(r.booking_date), true))} · ${escapeHtml(r.start_time)}–${escapeHtml(r.end_time)} น. · ${escapeHtml(r.room || '')}</span>
          ${note ? `<em>${note}</em>` : ''}
        </label>`;
    }).join('')}
  `;
  updateCancelConfirmLabel();
}

function toggleAllCancelChoices(on) {
  document.querySelectorAll('#cxList input:not(:disabled)').forEach(i => { i.checked = on; });
  updateCancelConfirmLabel();
}

function selectedCancelIds() {
  return [...document.querySelectorAll('#cxList input:checked')].map(i => i.value);
}

function updateCancelConfirmLabel() {
  const n = selectedCancelIds().length;
  const btn = document.getElementById('btnCxConfirm');
  btn.textContent = n ? `❌ ยืนยันยกเลิก ${n} รายการ` : 'เลือกวันที่จะยกเลิก';
  btn.disabled = n === 0;
}

async function confirmCancelWithCode() {
  const ids = selectedCancelIds();
  if (!ids.length) return;
  const errEl = document.getElementById('errCancel');
  const btn = document.getElementById('btnCxConfirm');
  btn.disabled = true;
  btn.textContent = '⏳ กำลังยกเลิก...';
  try {
    const { data, error } = await supabaseClient.rpc('cancel_bookings_with_code', {
      p_booking_id: cxBookingId,
      p_code: cxCode,
      p_ids: ids,
      p_reason: document.getElementById('cxReason').value.trim(),
    });
    if (error) throw error;
    if (!data || !data.ok) {
      errEl.textContent = cancelErrorText(data);
      setCancelStep('code');
      return;
    }

    // อัปเดตในเครื่องทันที แล้วดึงข้อมูลล่าสุดจากคลาวด์
    const bookings = getBookings();
    bookings.forEach(b => { if (ids.includes(String(b.id))) b.status = 'cancelled'; });
    saveBookings(bookings);
    closeCancelModal();
    showToast(`✅ ยกเลิกการจอง ${data.cancelled} รายการแล้ว (แจ้งผู้ดูแลทางไลน์แล้ว)`, 'success');
    renderCalendar();
    renderCancelPage();
    fetchGoogleSheetsBookings(true);
  } catch (err) {
    console.warn('cancel_bookings_with_code error:', err);
    errEl.textContent = cancelErrorText(null);
  } finally {
    updateCancelConfirmLabel();
  }
}

// ปุ่ม "ยกเลิกการจองนี้" ในหน้าต่างรายละเอียดการจอง (เรียกจาก viewBookingDetail ใน app.js)
function updateDetailCancelButton(b) {
  const btn = document.getElementById('btnDetailCancel');
  if (btn) btn.classList.toggle('hidden', !(isCancellable(b) && isCancelCodeAvailable()));
}

function cancelFromDetail() {
  if (state.currentDetailId !== null && state.currentDetailId !== undefined) openCancelModal(state.currentDetailId);
}
