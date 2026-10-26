// ============================================================
// จองหลายวันพร้อมกัน
// ฟอร์มหลักคือ "ต้นแบบ" ทุกวันใช้ข้อมูลต้นแบบ และแก้เฉพาะวันได้ (เก็บเฉพาะช่องที่ต่างจากต้นแบบ)
// ต้องโหลดหลัง app.js และ venues.js
// ============================================================

const MD_OVERRIDE_FIELDS = ['startTime', 'endTime', 'purpose', 'studentCount', 'grade', 'roomLayout'];
const MD_FIELD_LABELS = {
  startTime: 'เวลา', endTime: 'เวลา', purpose: 'วัตถุประสงค์', studentCount: 'จำนวนคน',
  grade: 'กลุ่มผู้ใช้', roomLayout: 'รูปแบบห้อง', roomRaw: 'ห้อง',
};

let bookingMode = 'single';
let multiDays = [];            // [{ date: 'YYYY-MM-DD', overrides: {} }] เรียงตามวันที่
let mdCalYear = new Date().getFullYear();
let mdCalMonth = new Date().getMonth();
let mdRenderTimer = null;

function isMultiDayMode() {
  return bookingMode === 'multi';
}

// ------------------------------------------------------------
// ต้นแบบและข้อมูลรายวัน
// ------------------------------------------------------------
function sortClassroomNames(list) {
  return list.slice().sort((a, b) => (parseInt(a.replace(/\D/g, ''), 10) || 0) - (parseInt(b.replace(/\D/g, ''), 10) || 0));
}

function roomsFromSelection(roomRaw, classrooms) {
  if (!roomRaw) return [];
  if (isClassroomCategory(roomRaw)) return sortClassroomNames(classrooms || []);
  return [roomRaw];
}

function getBookingTemplate() {
  const v = id => ((document.getElementById(id) || {}).value || '').trim();
  const position = v('position');
  const isOther = position === 'อื่น ๆ' || position === 'อื่นๆ' || position.startsWith('อื่น');
  const sel = getFinalRoomSelection();
  return {
    fullName: v('fullName'),
    position: isOther ? v('positionOther') : position,
    department: v('department'),
    roomRaw: document.getElementById('room').value,
    rooms: sel.rooms,
    startTime: v('startTime'),
    endTime: v('endTime'),
    purpose: v('purpose'),
    studentCount: v('studentCount'),
    grade: v('grade'),
    roomLayout: v('roomLayout'),
  };
}

function getEffectiveDay(day, tpl) {
  const o = day.overrides || {};
  const eff = { ...tpl, bookingDate: day.date };
  MD_OVERRIDE_FIELDS.forEach(f => { if (o[f] !== undefined) eff[f] = o[f]; });
  if (o.roomRaw !== undefined) {
    eff.roomRaw = o.roomRaw;
    eff.rooms = roomsFromSelection(o.roomRaw, o.classrooms);
  }
  eff.room = eff.rooms.join(', ');
  return eff;
}

// สถานะของแต่ละวัน: ok / past / invalid / closed / conflict
function evaluateDay(eff, options) {
  if (eff.bookingDate < todayStr()) return { ok: false, kind: 'past', icon: '⛔', msg: 'วันที่ผ่านมาแล้ว' };
  if (!eff.rooms.length) return { ok: false, kind: 'invalid', icon: '⚠️', msg: 'ยังไม่ได้เลือกห้อง' };
  if (!eff.startTime || !eff.endTime) return { ok: false, kind: 'invalid', icon: '⚠️', msg: 'ยังไม่ได้ระบุเวลา' };
  if (eff.startTime >= eff.endTime) return { ok: false, kind: 'invalid', icon: '⚠️', msg: 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม' };
  const closed = eff.rooms.filter(r => isRoomClosedOn(r, eff.bookingDate, options));
  if (closed.length) {
    const c = getActiveRoomClosure(closed[0], options);
    return { ok: false, kind: 'closed', icon: '🔒', msg: `${closed.join(', ')} ปิดให้จอง (${closureReasonText(c)})` };
  }
  const conflict = hasConflict(eff);
  if (conflict) {
    const c = conflict.conflictWith;
    return {
      ok: false, kind: 'conflict', icon: '⚠️',
      msg: `${conflict.conflictingRooms.join(', ')} ชนกับการจองของ ${c.fullName} เวลา ${c.startTime}–${c.endTime} น.`,
    };
  }
  return { ok: true, kind: 'ok', icon: '✅', msg: 'ว่าง จองได้' };
}

function overriddenLabels(day) {
  const o = day.overrides || {};
  return [...new Set(Object.keys(o).filter(k => MD_FIELD_LABELS[k]).map(k => MD_FIELD_LABELS[k]))];
}

// ------------------------------------------------------------
// สลับโหมด วันเดียว / หลายวัน
// ------------------------------------------------------------
function setBookingMode(mode) {
  if (mode === bookingMode) return;
  const dateEl = document.getElementById('bookingDate');

  if (mode === 'single' && multiDays.length > 1 &&
      !confirm(`ต้องการกลับไปจองวันเดียวใช่หรือไม่? วันที่เลือกไว้ ${multiDays.length} วันจะถูกล้าง (เหลือวันแรก)`)) {
    return;
  }

  if (mode === 'multi') {
    // ถ้าเลือกวันไว้แล้วในโหมดวันเดียว ให้เป็นวันแรกของรายการ
    multiDays = dateEl.value && dateEl.value >= todayStr() ? [{ date: dateEl.value, overrides: {} }] : [];
    const base = multiDays.length ? parseDateStr(multiDays[0].date) : new Date();
    mdCalYear = base.getFullYear();
    mdCalMonth = base.getMonth();
    dateEl.value = '';
  } else {
    dateEl.value = multiDays.length ? multiDays[0].date : '';
    multiDays = [];
  }

  bookingMode = mode;
  applyBookingModeUI();
  handleBookingDateChange();
  clearErrors();
}

function applyBookingModeUI() {
  const multi = isMultiDayMode();
  document.getElementById('bmSingle').classList.toggle('active', !multi);
  document.getElementById('bmMulti').classList.toggle('active', multi);
  document.getElementById('bmHint').classList.toggle('hidden', !multi);
  document.getElementById('multiDayPanel').classList.toggle('hidden', !multi);

  const dateField = document.getElementById('bookingDate').closest('.datetime-field');
  if (dateField) dateField.classList.toggle('hidden', multi);
  const row = dateField && dateField.parentElement;
  if (row) row.classList.toggle('md-times-only', multi);

  const startLabel = document.querySelector('label[for="startTime"]');
  const endLabel = document.querySelector('label[for="endTime"]');
  if (startLabel) startLabel.textContent = multi ? 'เวลาเริ่ม (ต้นแบบ)' : 'เวลาเริ่มต้น';
  if (endLabel) endLabel.textContent = multi ? 'เวลาสิ้นสุด (ต้นแบบ)' : 'เวลาสิ้นสุด';

  renderMultiDayPanel();
}

function resetMultiDay() {
  multiDays = [];
  bookingMode = 'single';
  if (document.getElementById('bmSingle')) applyBookingModeUI();
}

function scheduleMultiDayRender() {
  if (!isMultiDayMode()) return;
  clearTimeout(mdRenderTimer);
  mdRenderTimer = setTimeout(renderMultiDayPanel, 120);
}

// ------------------------------------------------------------
// ปฏิทินเลือกหลายวัน + รายการวัน
// ------------------------------------------------------------
function shiftMdMonth(n) {
  mdCalMonth += n;
  if (mdCalMonth < 0) { mdCalMonth = 11; mdCalYear--; }
  if (mdCalMonth > 11) { mdCalMonth = 0; mdCalYear++; }
  renderMultiDayPanel();
}

function toggleMultiDay(dateStr) {
  const idx = multiDays.findIndex(d => d.date === dateStr);
  if (idx >= 0) {
    multiDays.splice(idx, 1);
  } else {
    multiDays.push({ date: dateStr, overrides: {} });
    multiDays.sort((a, b) => a.date.localeCompare(b.date));
  }
  const errEl = document.getElementById('errDateTime');
  if (errEl) errEl.textContent = '';
  renderMultiDayPanel();
}

function removeMultiDay(dateStr) {
  multiDays = multiDays.filter(d => d.date !== dateStr);
  renderMultiDayPanel();
}

function renderMdCalendar(tpl, options) {
  const today = todayStr();
  const first = new Date(mdCalYear, mdCalMonth, 1);
  const daysInMonth = new Date(mdCalYear, mdCalMonth + 1, 0).getDate();
  const selected = new Set(multiDays.map(d => d.date));

  let cells = '';
  for (let i = 0; i < first.getDay(); i++) cells += '<span class="md-cal-cell empty"></span>';
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = toDateStr(new Date(mdCalYear, mdCalMonth, d));
    const isPast = ds < today;
    const isSel = selected.has(ds);
    const closed = !isPast && tpl.rooms.some(r => isRoomClosedOn(r, ds, options));
    const busy = !isPast && tpl.rooms.length > 0 &&
      getActiveBookingsOn(ds).some(b => getRoomsList(b).some(r => tpl.rooms.some(t => roomNamesOverlap(t, r))));
    const cls = ['md-cal-cell', isPast ? 'past' : '', isSel ? 'selected' : '', closed ? 'closed' : '', ds === today ? 'today' : ''].join(' ');
    const title = isPast ? 'วันที่ผ่านมาแล้ว' : closed ? 'ห้องต้นแบบปิดให้จองวันนี้' : busy ? 'ห้องต้นแบบมีการจองบางช่วงในวันนี้' : 'กดเพื่อเลือก/ยกเลิกวันนี้';
    cells += `<button type="button" class="${cls}" ${isPast ? 'disabled' : `onclick="toggleMultiDay('${ds}')"`} title="${title}">
      <span>${d}</span>${closed ? '<i class="md-mark">🔒</i>' : busy ? '<i class="md-dot"></i>' : ''}
    </button>`;
  }

  const now = new Date();
  const atCurrentMonth = mdCalYear === now.getFullYear() && mdCalMonth === now.getMonth();
  return `
    <div class="md-cal">
      <div class="md-cal-head">
        <button type="button" class="btn-cal-nav" onclick="shiftMdMonth(-1)" ${atCurrentMonth ? 'disabled' : ''}>&#8249;</button>
        <span class="md-cal-title">${THAI_MONTHS[mdCalMonth]} ${mdCalYear + 543}</span>
        <button type="button" class="btn-cal-nav" onclick="shiftMdMonth(1)">&#8250;</button>
      </div>
      <div class="md-cal-grid">
        ${THAI_DAYS.map(x => `<span class="md-cal-dow">${x}</span>`).join('')}
        ${cells}
      </div>
      <div class="md-cal-legend">
        <span><i class="lg-sel"></i> เลือกแล้ว</span>
        <span><i class="md-dot"></i> ห้องต้นแบบมีจองบางช่วง</span>
        <span>🔒 ห้องต้นแบบปิด</span>
      </div>
    </div>
  `;
}

function renderMultiDayPanel() {
  const panel = document.getElementById('multiDayPanel');
  if (!panel || !isMultiDayMode()) return;
  const options = getFormOptions();
  const tpl = getBookingTemplate();
  const evaluated = multiDays.map(day => {
    const eff = getEffectiveDay(day, tpl);
    return { day, eff, st: evaluateDay(eff, options) };
  });
  const okCount = evaluated.filter(x => x.st.ok).length;
  const badCount = evaluated.length - okCount;

  const rows = evaluated.map(({ day, eff, st }) => {
    const changed = overriddenLabels(day);
    const o = day.overrides || {};
    return `
      <div class="md-day ${st.ok ? 'ok' : 'bad'} ${changed.length ? 'changed' : ''}">
        <div class="md-day-main">
          <div class="md-day-line">
            <span class="md-day-icon">${st.icon}</span>
            <strong class="md-day-date">${escapeHtml(fmtDay(day.date, true))}</strong>
            <span class="md-day-time ${o.startTime !== undefined || o.endTime !== undefined ? 'diff' : ''}">${escapeHtml(eff.startTime || '--:--')}–${escapeHtml(eff.endTime || '--:--')} น.</span>
            <span class="md-day-room ${o.roomRaw !== undefined ? 'diff' : ''}">📍 ${escapeHtml(eff.room || 'ยังไม่ได้เลือกห้อง')}</span>
            ${changed.length ? `<span class="md-badge">แก้: ${escapeHtml(changed.join(', '))}</span>` : ''}
          </div>
          ${o.purpose !== undefined ? `<div class="md-day-sub">🎯 ${escapeHtml(eff.purpose)}</div>` : ''}
          ${!st.ok ? `<div class="md-day-warn">${escapeHtml(st.msg)}</div>` : ''}
        </div>
        <div class="md-day-actions">
          <button type="button" class="md-act" onclick="openDayEdit('${day.date}')" title="แก้เฉพาะวันนี้">✏️<span>แก้ไข</span></button>
          <button type="button" class="md-act" onclick="openDayEdit('${day.date}', true)" title="คัดลอกข้อมูลของวันนี้ไปวันอื่น">⧉<span>คัดลอก</span></button>
          <button type="button" class="md-act del" onclick="removeMultiDay('${day.date}')" title="ลบวันนี้ออก">✕</button>
        </div>
      </div>
    `;
  }).join('');

  panel.innerHTML = `
    <div class="md-layout">
      ${renderMdCalendar(tpl, options)}
      <div class="md-list">
        <div class="md-summary">
          ${multiDays.length
            ? `เลือกแล้ว <strong>${multiDays.length} วัน</strong> · <span class="ok">✅ ว่าง ${okCount}</span>${badCount ? ` · <span class="bad">⚠️ ต้องแก้ ${badCount}</span>` : ''}`
            : 'ยังไม่ได้เลือกวัน กดวันที่ในปฏิทินเพื่อเพิ่ม'}
        </div>
        ${rows || '<div class="md-empty">📆 กดวันที่ในปฏิทินได้หลายวัน ทุกวันจะใช้ข้อมูลต้นแบบจากฟอร์ม<br>แล้วกด ✏️ เพื่อแก้เฉพาะวันที่ต่างออกไป</div>'}
        ${badCount ? '<div class="md-note">ต้องแก้ให้ว่างครบทุกวันก่อน จึงจะยืนยันการจองได้ (แก้เวลา/ห้อง หรือลบวันนั้นออก)</div>' : ''}
      </div>
    </div>
  `;

  const label = document.getElementById('btnSubmitLabel');
  if (label) label.textContent = multiDays.length ? `ยืนยันการจอง ${multiDays.length} วัน` : 'ยืนยันการจอง';
}

// ------------------------------------------------------------
// หน้าต่างแก้เฉพาะวัน
// ------------------------------------------------------------
let dayEditDate = null;
let dayEditClassrooms = new Set();

function openDayEdit(dateStr, focusCopy = false) {
  const day = multiDays.find(d => d.date === dateStr);
  if (!day) return;
  dayEditDate = dateStr;
  const eff = getEffectiveDay(day, getBookingTemplate());

  document.getElementById('deTitle').textContent = fmtDay(dateStr, true);
  document.getElementById('deStart').value = eff.startTime;
  document.getElementById('deEnd').value = eff.endTime;
  const roomSel = document.getElementById('deRoom');
  roomSel.innerHTML = document.getElementById('room').innerHTML;
  [...roomSel.options].forEach(o => { o.disabled = false; o.textContent = o.textContent.replace(/ — 🔒.*$| \(ปิด .*\)$/, ''); });
  roomSel.value = eff.roomRaw || '';
  dayEditClassrooms = new Set(isClassroomCategory(eff.roomRaw) ? eff.rooms : []);
  document.getElementById('dePurpose').value = eff.purpose;
  document.getElementById('deCount').value = eff.studentCount;
  document.getElementById('deGrade').value = eff.grade;
  document.getElementById('deLayout').value = eff.roomLayout;
  document.getElementById('errDayEdit').textContent = '';

  const others = multiDays.filter(d => d.date !== dateStr);
  document.getElementById('deCopySection').classList.toggle('hidden', others.length === 0);
  document.getElementById('deCopySection').classList.toggle('highlight', focusCopy);
  document.getElementById('deCopyDays').innerHTML = others.map(d => `
    <label class="de-copy-chip"><input type="checkbox" value="${d.date}" /> ${escapeHtml(fmtDay(d.date, true))}</label>
  `).join('');

  renderDayEditClassrooms();
  updateDayEditStatus();
  document.getElementById('dayEditModal').classList.remove('hidden');
  if (focusCopy) {
    setTimeout(() => document.getElementById('deCopySection').scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  }
}

function closeDayEdit() {
  document.getElementById('dayEditModal').classList.add('hidden');
  dayEditDate = null;
}

function onDayEditRoomChange() {
  const val = document.getElementById('deRoom').value;
  if (!isClassroomCategory(val)) dayEditClassrooms.clear();
  renderDayEditClassrooms();
  updateDayEditStatus();
}

function toggleDayEditClassroom(roomName) {
  if (dayEditClassrooms.has(roomName)) dayEditClassrooms.delete(roomName); else dayEditClassrooms.add(roomName);
  renderDayEditClassrooms();
  updateDayEditStatus();
}

function renderDayEditClassrooms() {
  const wrap = document.getElementById('deClassroomPicker');
  const gradeKey = document.getElementById('deRoom').value;
  if (!isClassroomCategory(gradeKey) || !CLASSROOM_ROOMS[gradeKey]) {
    wrap.classList.add('hidden');
    wrap.innerHTML = '';
    return;
  }
  const options = getFormOptions();
  const date = dayEditDate;
  const rooms = CLASSROOM_ROOMS[gradeKey].rooms || [];
  wrap.classList.remove('hidden');
  wrap.innerHTML = `
    <div class="de-cr-grid">
      ${rooms.map(r => {
        const name = `ห้อง ${r}`;
        const on = dayEditClassrooms.has(name);
        const closed = isRoomClosedOn(name, date, options);
        return `<button type="button" class="room-card-btn ${on ? 'checked' : ''} ${closed ? 'closed' : ''}" ${closed && !on ? 'disabled' : ''} data-room="${escapeHtml(name)}" onclick="toggleDayEditClassroom(this.dataset.room)">
          <span class="cr-check-icon">${closed ? '🔒' : on ? '✓' : ''}</span><span>${escapeHtml(name)}</span></button>`;
      }).join('')}
    </div>
    <div class="de-cr-selected">${dayEditClassrooms.size ? `เลือก ${dayEditClassrooms.size} ห้อง: ${escapeHtml(sortClassroomNames([...dayEditClassrooms]).join(', '))}` : 'ยังไม่ได้เลือกห้องเรียน'}</div>
  `;
}

function readDayEditValues() {
  return {
    startTime: document.getElementById('deStart').value,
    endTime: document.getElementById('deEnd').value,
    roomRaw: document.getElementById('deRoom').value,
    classrooms: sortClassroomNames([...dayEditClassrooms]),
    purpose: document.getElementById('dePurpose').value.trim(),
    studentCount: document.getElementById('deCount').value.trim(),
    grade: document.getElementById('deGrade').value.trim(),
    roomLayout: document.getElementById('deLayout').value.trim(),
  };
}

function updateDayEditStatus() {
  if (!dayEditDate) return;
  const vals = readDayEditValues();
  const tpl = getBookingTemplate();
  const eff = { ...tpl, ...vals, bookingDate: dayEditDate, rooms: roomsFromSelection(vals.roomRaw, vals.classrooms) };
  eff.room = eff.rooms.join(', ');
  const st = evaluateDay(eff, getFormOptions());
  const el = document.getElementById('deStatus');
  el.className = `de-status ${st.ok ? 'ok' : 'bad'}`;
  el.textContent = `${st.icon} ${st.msg}`;
}

// เก็บเฉพาะช่องที่ต่างจากต้นแบบ เพื่อให้วันที่ไม่ได้แก้ช่องนั้นยังเปลี่ยนตามต้นแบบ
function buildOverrides(vals, tpl) {
  const o = {};
  MD_OVERRIDE_FIELDS.forEach(f => { if (vals[f] !== tpl[f]) o[f] = vals[f]; });
  const newRooms = roomsFromSelection(vals.roomRaw, vals.classrooms).join('|');
  if (vals.roomRaw !== tpl.roomRaw || newRooms !== tpl.rooms.join('|')) {
    o.roomRaw = vals.roomRaw;
    o.classrooms = vals.classrooms;
  }
  return o;
}

function saveDayEdit() {
  const vals = readDayEditValues();
  const errEl = document.getElementById('errDayEdit');
  if (!vals.startTime || !vals.endTime || vals.startTime >= vals.endTime) {
    errEl.textContent = 'กรุณาระบุเวลาให้ถูกต้อง (เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม)';
    return;
  }
  if (!roomsFromSelection(vals.roomRaw, vals.classrooms).length) {
    errEl.textContent = 'กรุณาเลือกห้อง (ถ้าเป็นห้องเรียน ต้องเลือกอย่างน้อย 1 ห้อง)';
    return;
  }
  const overrides = buildOverrides(vals, getBookingTemplate());
  const targets = [dayEditDate, ...[...document.querySelectorAll('#deCopyDays input:checked')].map(i => i.value)];
  multiDays.forEach(d => {
    if (targets.includes(d.date)) d.overrides = JSON.parse(JSON.stringify(overrides));
  });
  closeDayEdit();
  renderMultiDayPanel();
  showToast(targets.length > 1 ? `💾 บันทึกและคัดลอกไปอีก ${targets.length - 1} วันแล้ว` : '💾 บันทึกการแก้ไขของวันนี้แล้ว', 'success');
}

function resetDayEdit() {
  const day = multiDays.find(d => d.date === dayEditDate);
  if (day) day.overrides = {};
  closeDayEdit();
  renderMultiDayPanel();
  showToast('↺ คืนค่าวันนี้ให้ใช้ข้อมูลต้นแบบแล้ว', 'info');
}

function selectAllCopyDays(on) {
  document.querySelectorAll('#deCopyDays input').forEach(i => { i.checked = on; });
}

// ------------------------------------------------------------
// ยืนยันการจองหลายวัน (เรียกจาก submitBooking ใน app.js หลังตรวจข้อมูลต้นแบบผ่านแล้ว)
// ------------------------------------------------------------
async function submitMultiDayBooking(base) {
  if (!multiDays.length) {
    setError('errDateTime', 'กรุณาเลือกวันที่จากปฏิทินอย่างน้อย 1 วัน');
    document.getElementById('multiDayPanel').scrollIntoView({ behavior: 'smooth', block: 'center' });
    showToast('กรุณาเลือกวันที่จากปฏิทินอย่างน้อย 1 วัน', 'error');
    return;
  }

  const submitBtn = document.getElementById('btnSubmit');
  const originalBtnHtml = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '⏳ กำลังตรวจสอบห้องว่างล่าสุด...';
  if (checkIsGoogleSheetsConfigured()) await fetchGoogleSheetsBookings(true);
  submitBtn.disabled = false;
  submitBtn.innerHTML = originalBtnHtml;

  // ตรวจทุกวันกับข้อมูลล่าสุด ต้องว่างครบทุกวัน
  refreshAllFormOptions();
  const options = getFormOptions();
  const tpl = getBookingTemplate();
  const items = multiDays.map(day => {
    const eff = getEffectiveDay(day, tpl);
    return { eff, st: evaluateDay(eff, options) };
  });
  const bad = items.filter(x => !x.st.ok);
  if (bad.length) {
    renderMultiDayPanel();
    document.getElementById('multiDayPanel').scrollIntoView({ behavior: 'smooth', block: 'center' });
    showToast(`มี ${bad.length} วันที่ยังจองไม่ได้ กรุณาแก้ให้ว่างครบทุกวันก่อน`, 'error');
    return;
  }

  const createdAt = new Date().toISOString();
  let nextId = getNextId();
  const created = items.map(({ eff }) => ({
    id: nextId++,
    createdAt,
    fullName: base.fullName,
    position: base.position,
    department: base.department,
    room: eff.room,
    rooms: eff.rooms,
    purpose: eff.purpose,
    studentCount: eff.studentCount,
    grade: eff.grade,
    bookingDate: eff.bookingDate,
    startTime: eff.startTime,
    endTime: eff.endTime,
    roomLayout: eff.roomLayout,
    status: 'approved',
  }));

  // Supabase: บันทึกทุกวันในคำสั่งเดียว ได้ครบทุกวันหรือไม่ได้เลย (ฐานข้อมูลตรวจซ้ำอีกชั้น)
  if (checkIsSupabaseActive()) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `☁️ กำลังบันทึกการจอง ${created.length} วัน...`;
    const res = await insertBookingsToCloud(created);
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnHtml;
    if (!res.ok) {
      if (res.reason === 'conflict') {
        await fetchGoogleSheetsBookings(true);
        renderMultiDayPanel();
        document.getElementById('multiDayPanel').scrollIntoView({ behavior: 'smooth', block: 'center' });
        showToast('มีบางวันเพิ่งถูกจองไปเมื่อสักครู่ กรุณาตรวจรายการวันแล้วแก้ไขก่อนจองอีกครั้ง', 'error');
      } else {
        showToast('บันทึกการจองไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง', 'error');
      }
      return;
    }
  }

  const bookings = getBookings();
  created.forEach(b => { removeDeletedId(b.id); bookings.push(b); });
  saveBookings(bookings);
  state.lastBookingId = created[0].id;
  state.lastBookingIds = created.map(b => b.id);

  saveLastBookingTemplate({
    fullName: base.fullName, position: base.position, department: base.department, roomRaw: tpl.roomRaw,
    classrooms: tpl.rooms, roomString: tpl.rooms.join(', '), purpose: tpl.purpose, studentCount: tpl.studentCount,
    grade: tpl.grade, startTime: tpl.startTime, endTime: tpl.endTime, roomLayout: tpl.roomLayout,
  });

  if (checkIsSupabaseActive()) {
    await fetchGoogleSheetsBookings(true);
  } else if (checkIsGoogleSheetsConfigured()) {
    submitBtn.disabled = true;
    let failed = 0;
    for (let i = 0; i < created.length; i++) {
      submitBtn.innerHTML = `☁️ กำลังบันทึกไปยังคลาวด์ (${i + 1}/${created.length})...`;
      const ok = await sendGoogleSheetsAction('create', { booking: created[i] });
      if (!ok) failed++;
    }
    await fetchGoogleSheetsBookings(true);
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnHtml;
    if (failed) showToast(`⚠️ บันทึกขึ้นคลาวด์ไม่สำเร็จ ${failed} รายการ (เก็บไว้ในเครื่องแล้ว) กรุณากดรีเฟรชข้อมูล`, 'warning');
  }

  // รหัสเดียวสำหรับทั้งชุด (cancel.js)
  const cancelCode = typeof assignCancelCode === 'function' ? await assignCancelCode(created.map(b => b.id)) : null;
  state.lastCancelCode = cancelCode || null;
  if (typeof renderSuccessCode === 'function') renderSuccessCode(cancelCode);

  document.getElementById('successMessage').innerHTML = `
    จองสำเร็จทั้งหมด <strong>${created.length} วัน</strong>
    <div class="success-days">
      ${created.map(b => `<div>✅ ${escapeHtml(fmtDay(b.bookingDate, true))} · ${escapeHtml(b.startTime)}–${escapeHtml(b.endTime)} น. · ${escapeHtml(b.room)}</div>`).join('')}
    </div>
  `;
  document.getElementById('successModal').classList.remove('hidden');
  queueFlyToCalendar(created);

  clearForm();
  renderCalendar();
  showToast(`ยืนยันการจอง ${created.length} วันเรียบร้อยแล้ว ✅`, 'success');
}

// ใบจองสรุปรวมหลายวันในใบเดียว
function printMultiDaySummary(ids, cancelCode = null) {
  const list = ids.map(id => getBookingById(id)).filter(Boolean).sort((a, b) => a.bookingDate.localeCompare(b.bookingDate));
  if (!list.length) return;
  const b0 = list[0];
  const th = 'border:1px solid #94a3b8;padding:6px 8px;background:#f1f5f9;text-align:left;';
  const td = 'border:1px solid #cbd5e1;padding:6px 8px;vertical-align:top;';
  const html = `
    <div class="slip-print-container">
      <h2>ใบจองสถานที่ (จองหลายวัน)</h2>
      <div class="slip-school">
        โรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัย ปทุมธานี<br>
        ฝ่ายบริหารงานทั่วไป — ระบบจองใช้สถานที่
      </div>
      <table class="slip-table">
        <tr><td class="slip-label">ชื่อ-นามสกุล</td><td>${escapeHtml(b0.fullName)}</td></tr>
        <tr><td class="slip-label">ตำแหน่ง</td><td>${escapeHtml(b0.position || '-')}</td></tr>
        <tr><td class="slip-label">ฝ่ายงาน</td><td>${escapeHtml(b0.department || '-')}</td></tr>
        <tr><td class="slip-label">จำนวนวันที่จอง</td><td><strong>${list.length} วัน</strong> (${escapeHtml(formatDateThai(list[0].bookingDate))} – ${escapeHtml(formatDateThai(list[list.length - 1].bookingDate))})</td></tr>
        <tr><td class="slip-label">วันที่ยื่นจอง</td><td>${formatDateTimeThai(b0.createdAt)}</td></tr>
        ${cancelCode ? `<tr><td class="slip-label">รหัสยกเลิกการจอง</td><td><strong style="font-size:1.3em;letter-spacing:4px;">${escapeHtml(cancelCode)}</strong><br><small>รหัสเดียวใช้ได้ทุกวันในชุดนี้ (เมนู "ยกเลิกการจอง")</small></td></tr>` : ''}
      </table>
      <table style="width:100%;border-collapse:collapse;margin-top:14px;font-size:13px;">
        <thead><tr>
          <th style="${th}">#</th><th style="${th}">วันที่</th><th style="${th}">เวลา</th><th style="${th}">ห้อง</th>
          <th style="${th}">วัตถุประสงค์</th><th style="${th}">ผู้ใช้ห้อง</th><th style="${th}">รูปแบบห้อง</th>
        </tr></thead>
        <tbody>
          ${list.map((b, i) => `<tr>
            <td style="${td}">${i + 1}</td>
            <td style="${td}white-space:nowrap;">${escapeHtml(formatDateThai(b.bookingDate))}</td>
            <td style="${td}white-space:nowrap;">${escapeHtml(b.startTime)}–${escapeHtml(b.endTime)} น.</td>
            <td style="${td}"><strong>${escapeHtml(b.room)}</strong></td>
            <td style="${td}">${escapeHtml(b.purpose || '–')}</td>
            <td style="${td}">${escapeHtml(b.studentCount || '–')} คน${b.grade ? `<br>${escapeHtml(b.grade)}` : ''}</td>
            <td style="${td}">${escapeHtml(b.roomLayout || '–')}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <div style="margin-top:48px;display:flex;justify-content:space-between;gap:40px">
        <div style="text-align:center;flex:1"><div style="width:160px;border-top:1px solid #000;margin:0 auto;padding-top:6px">ผู้จอง</div></div>
        <div style="text-align:center;flex:1"><div style="width:160px;border-top:1px solid #000;margin:0 auto;padding-top:6px">ผู้อนุมัติ</div></div>
      </div>
    </div>`;
  printDoc(html, false, 'ใบจองสถานที่ (หลายวัน)');
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('bookingForm');
  if (form) {
    // ต้นแบบเปลี่ยน → อัปเดตสถานะของทุกวัน
    ['input', 'change', 'click'].forEach(evt => form.addEventListener(evt, scheduleMultiDayRender));
  }
});
