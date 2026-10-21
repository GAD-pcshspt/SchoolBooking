// ============================================================
// ข้อมูลสถานที่, ประกาศ, ค้นหาห้องว่าง, ตารางเวลา และจองแบบครั้งก่อน
// ใช้ข้อมูลและฟังก์ชันกลางจาก app.js (ต้องโหลดไฟล์นี้หลัง app.js)
// ============================================================

const THAI_MONTHS_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const ANNOUNCE_WINDOW_DAYS = 14;
const ANNOUNCE_DISMISS_KEY = 'school_booking_announce_dismissed';
const LAST_BOOKING_KEY = 'school_booking_last_booking';
const DEFAULT_BOOKING_HOURS = { start: '06:00', end: '21:00' };
const MIN_FREE_MINUTES = 15;

const ANNOUNCE_TYPES = {
  info:    { icon: 'ℹ️', label: 'ข่าวทั่วไป' },
  warning: { icon: '⚠️', label: 'แจ้งเตือน' },
  closure: { icon: '🔒', label: 'ปิด / งดใช้ห้อง' },
};

const EQUIPMENT_PRESETS = [
  'โปรเจกเตอร์', 'จอรับภาพ', 'ไมโครโฟน', 'เครื่องเสียง', 'เครื่องปรับอากาศ',
  'จอ TV', 'คอมพิวเตอร์', 'Wi-Fi', 'ไวท์บอร์ด', 'เวที'
];

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------
function parseDateStr(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function addDaysStr(s, n) {
  const d = parseDateStr(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}
function timeToMin(t) {
  if (!t || typeof t !== 'string' || !t.includes(':')) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}
function minToTime(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}
function nowMinutes() {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}
function todayStr() {
  return toDateStr(new Date());
}
// "จ. 20 ต.ค. 69" (withDow) หรือ "20 ต.ค. 69"
function fmtDay(s, withDow = false) {
  if (!s) return '';
  const d = parseDateStr(s);
  const base = `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]} ${String(d.getFullYear() + 543).slice(-2)}`;
  return withDow ? `${THAI_DAYS[d.getDay()]} ${base}` : base;
}
function fmtRange(start, end) {
  if (!start) return '';
  if (!end || start === end) return fmtDay(start);
  return `${fmtDay(start)} – ${fmtDay(end)}`;
}
function isPageVisible(id) {
  const el = document.getElementById(id);
  return Boolean(el && !el.classList.contains('hidden'));
}

function getBookingHours(options) {
  const h = (options || getFormOptions()).bookingHours || DEFAULT_BOOKING_HOURS;
  let start = timeToMin(h.start);
  let end = timeToMin(h.end);
  if (start === null || end === null || end <= start) {
    start = timeToMin(DEFAULT_BOOKING_HOURS.start);
    end = timeToMin(DEFAULT_BOOKING_HOURS.end);
  }
  return { start, end };
}

// รายชื่อห้องทั้งหมด (ห้องเรียนใช้ชื่อ "ห้อง 101" เหมือนข้อมูลการจอง)
function getAllRoomEntries(options) {
  const list = [];
  (options || getFormOptions()).venueCategories.forEach(cat => {
    if (cat.type === 'classroom_grades' && cat.grades) {
      Object.keys(cat.grades).forEach(gKey => {
        const g = cat.grades[gKey];
        (g.rooms || []).forEach(r => list.push({
          key: `ห้อง ${r}`, catId: cat.id, catLabel: cat.label,
          isClassroom: true, gradeKey: gKey, gradeLabel: g.label || gKey,
        }));
      });
    } else {
      (cat.rooms || []).forEach(r => list.push({
        key: r, catId: cat.id, catLabel: cat.label, isClassroom: false,
      }));
    }
  });
  return list;
}

function findRoomEntry(roomKey, options) {
  return getAllRoomEntries(options).find(e => e.key === roomKey) || null;
}

function getRoomDetails(roomKey, options) {
  return ((options || getFormOptions()).roomDetails || {})[roomKey] || {};
}

// เทียบชื่อห้องแบบเดียวกับ hasConflict() ใน app.js เพื่อให้ "ว่าง" ตรงกับที่ระบบยอมให้จองจริง
function roomNamesOverlap(r1, r2) {
  if (r1 === r2) return true;
  const c1 = r1.replace(/\s+/g, '');
  const c2 = r2.replace(/\s+/g, '');
  return c1 === c2 || c1.includes(c2) || c2.includes(c1);
}

function getActiveBookingsOn(dateStr) {
  return getBookings().filter(b => b.status !== 'cancelled' && b.bookingDate === dateStr);
}

function roomBookingsOn(roomKey, dayBookings) {
  return dayBookings
    .filter(b => getRoomsList(b).some(r => roomNamesOverlap(roomKey, r)))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

// ช่วงเวลาว่าง [startMin, endMin] ภายในเวลาทำการ (ไม่รวมเวลาที่ผ่านไปแล้วของวันนี้)
function getFreeSegments(roomKey, dateStr, options, dayBookings) {
  const today = todayStr();
  if (dateStr < today || isRoomClosedOn(roomKey, dateStr, options)) return [];
  const hours = getBookingHours(options);
  let cur = hours.start;
  if (dateStr === today) cur = Math.max(cur, Math.ceil(nowMinutes() / 15) * 15);

  const busy = roomBookingsOn(roomKey, dayBookings)
    .map(b => [timeToMin(b.startTime), timeToMin(b.endTime)])
    .filter(([s, e]) => s !== null && e !== null && e > s)
    .sort((a, b) => a[0] - b[0]);

  const free = [];
  for (const [s, e] of busy) {
    const segEnd = Math.min(s, hours.end);
    if (segEnd > cur) free.push([cur, segEnd]);
    cur = Math.max(cur, e);
    if (cur >= hours.end) break;
  }
  if (cur < hours.end) free.push([cur, hours.end]);
  return free.filter(([s, e]) => e - s >= MIN_FREE_MINUTES);
}

// สถานะ ณ ตอนนี้ สำหรับการ์ดห้อง
function getRoomNowStatus(roomKey, options, todayBookings) {
  const today = todayStr();
  if (isRoomClosedOn(roomKey, today, options)) {
    const c = getActiveRoomClosure(roomKey, options);
    return {
      kind: 'closed', icon: '🔒', text: `ปิดให้จอง · ${closureReasonText(c)}`,
      sub: c.mode === 'range' ? `ถึง ${fmtDay(c.end)}` : 'จนกว่าจะเปิดอีกครั้ง',
    };
  }
  const now = nowMinutes();
  const list = roomBookingsOn(roomKey, todayBookings);
  const current = list.find(b => timeToMin(b.startTime) <= now && now < timeToMin(b.endTime));
  if (current) {
    return { kind: 'busy', icon: '🔴', text: `ใช้งานอยู่ ถึง ${current.endTime} น.`, sub: current.purpose || '' };
  }
  const next = list.find(b => timeToMin(b.startTime) > now);
  return {
    kind: 'free', icon: '🟢', text: 'ว่างตอนนี้',
    sub: next ? `มีจองถัดไป ${next.startTime} น.` : 'ไม่มีจองต่อจากนี้ในวันนี้',
  };
}

// การปิดแบบช่วงวันที่ที่จะเริ่มภายใน 14 วัน
function getUpcomingClosure(roomKey, options) {
  const c = getActiveRoomClosure(roomKey, options);
  const today = todayStr();
  if (c && c.mode === 'range' && c.start > today && c.start <= addDaysStr(today, ANNOUNCE_WINDOW_DAYS)) return c;
  return null;
}

// ------------------------------------------------------------
// ANNOUNCEMENTS (ประกาศ)
// ------------------------------------------------------------

// รวมประกาศที่แอดมินเขียน + ประกาศปิดห้องที่สร้างอัตโนมัติจาก roomClosures
function getAllAnnouncements(options) {
  const items = [];
  Object.keys(options.roomClosures || {}).forEach(room => {
    const c = getActiveRoomClosure(room, options);
    if (!c) return;
    items.push({
      id: `closure|${room}|${c.mode}|${c.start || ''}|${c.end || ''}|${c.reason || ''}`,
      auto: true, type: 'closure', pinned: false, room,
      title: `${room} ปิดให้จอง`,
      detail: c.reason || '',
      start: c.mode === 'range' ? c.start : '',
      end: c.mode === 'range' ? c.end : '',
    });
  });
  (options.announcements || []).forEach(a => items.push({ ...a, auto: false }));
  return items;
}

function isAnnouncementCurrent(a, today) {
  return (!a.start || a.start <= today) && (!a.end || a.end >= today);
}

function isAnnouncementSoon(a, today) {
  return (!a.end || a.end >= today) && (!a.start || a.start <= addDaysStr(today, ANNOUNCE_WINDOW_DAYS));
}

function sortAnnouncements(list, today) {
  return list.slice().sort((a, b) => {
    if (Boolean(b.pinned) !== Boolean(a.pinned)) return b.pinned ? 1 : -1;
    const ac = isAnnouncementCurrent(a, today), bc = isAnnouncementCurrent(b, today);
    if (ac !== bc) return ac ? -1 : 1;
    return (a.start || '').localeCompare(b.start || '');
  });
}

function announcementWhenText(a, today) {
  if (!a.start && !a.end) return 'ตั้งแต่ตอนนี้ จนกว่าจะเปิดให้จองอีกครั้ง';
  if (isAnnouncementCurrent(a, today)) {
    return a.end && a.end !== a.start ? `วันนี้ – ${fmtDay(a.end)}` : 'วันนี้';
  }
  return fmtRange(a.start, a.end);
}

function renderAnnouncementItem(a, today, compact) {
  const t = ANNOUNCE_TYPES[a.type] || ANNOUNCE_TYPES.info;
  const current = isAnnouncementCurrent(a, today);
  const roomAttr = a.room ? `data-room="${escapeHtml(a.room)}" onclick="openVenueDetail(this.dataset.room)" title="ดูตารางของ ${escapeHtml(a.room)}"` : '';
  // "เร็ว ๆ นี้" เฉพาะที่จะเริ่มภายใน 14 วัน ประกาศที่ไกลกว่านั้นไม่ติดป้าย
  const badge = current
    ? '<span class="announce-badge now">กำลังมีผล</span>'
    : isAnnouncementSoon(a, today) ? '<span class="announce-badge soon">เร็ว ๆ นี้</span>' : '';
  return `
    <div class="announce-item type-${escapeHtml(a.type || 'info')} ${a.room ? 'has-room' : ''}" ${roomAttr}>
      <span class="announce-icon">${a.pinned ? '📌' : t.icon}</span>
      <div class="announce-text">
        <div class="announce-title-line">
          <strong>${escapeHtml(a.title)}</strong>
          ${badge}
          <span class="announce-when">🗓️ ${escapeHtml(announcementWhenText(a, today))}</span>
        </div>
        ${a.detail ? `<div class="announce-detail ${compact ? 'compact' : ''}">${escapeHtml(a.detail)}</div>` : ''}
      </div>
    </div>
  `;
}

function renderAnnouncementBar() {
  const bar = document.getElementById('announceBar');
  if (!bar) return;
  const options = getFormOptions();
  const today = todayStr();
  const list = sortAnnouncements(getAllAnnouncements(options).filter(a => isAnnouncementSoon(a, today)), today);

  if (list.length === 0) {
    bar.classList.add('hidden');
    bar.innerHTML = '';
    return;
  }

  const signature = list.map(a => `${a.id}:${a.updatedAt || ''}`).join(';');
  let dismissed = '';
  try { dismissed = localStorage.getItem(ANNOUNCE_DISMISS_KEY) || ''; } catch (_) {}
  bar.classList.remove('hidden');

  // ผู้ใช้กดซ่อนไว้แล้ว และยังไม่มีประกาศใหม่ → แสดงแบบย่อ
  if (dismissed === signature) {
    bar.className = 'announce-bar collapsed';
    bar.innerHTML = `
      <button type="button" class="announce-collapsed-btn" onclick="openAnnouncementsModal()">
        📢 มีประกาศ ${list.length} รายการ · ดูทั้งหมด
      </button>
    `;
    return;
  }

  // จอเล็กแสดงน้อยลง เพื่อไม่ให้แถบประกาศดันเนื้อหาหลักลงไปไกล
  const maxShow = window.matchMedia && window.matchMedia('(max-width: 600px)').matches ? 2 : 3;
  bar.className = 'announce-bar';
  bar.innerHTML = `
    <div class="announce-head">
      <span class="announce-head-title">📢 ประกาศ</span>
      <div class="announce-head-actions">
        <button type="button" class="announce-link" onclick="openAnnouncementsModal()">ดูทั้งหมด (${list.length}) →</button>
        <button type="button" class="announce-close" onclick="dismissAnnouncementBar()" title="ซ่อนแถบประกาศ (จะแสดงอีกครั้งเมื่อมีประกาศใหม่)">✕</button>
      </div>
    </div>
    <div class="announce-list">
      ${list.slice(0, maxShow).map(a => renderAnnouncementItem(a, today, true)).join('')}
    </div>
    ${list.length > maxShow ? `<button type="button" class="announce-more" onclick="openAnnouncementsModal()">+ อีก ${list.length - maxShow} ประกาศ</button>` : ''}
  `;
  bar.dataset.signature = signature;
}

function dismissAnnouncementBar() {
  const bar = document.getElementById('announceBar');
  try { localStorage.setItem(ANNOUNCE_DISMISS_KEY, (bar && bar.dataset.signature) || ''); } catch (_) {}
  renderAnnouncementBar();
}

// หน้ารวมประกาศ: กำลังมีผล → แยกรายเดือนตามวันเริ่ม → ย้อนหลัง
function openAnnouncementsModal() {
  const options = getFormOptions();
  const today = todayStr();
  const all = getAllAnnouncements(options);
  const pastLimit = addDaysStr(today, -90);

  const current = sortAnnouncements(all.filter(a => isAnnouncementCurrent(a, today)), today);
  const upcoming = all.filter(a => a.start && a.start > today).sort((a, b) => a.start.localeCompare(b.start));
  const past = all.filter(a => a.end && a.end < today && a.end >= pastLimit).sort((a, b) => b.end.localeCompare(a.end));

  const byMonth = {};
  upcoming.forEach(a => {
    const key = a.start.slice(0, 7);
    (byMonth[key] = byMonth[key] || []).push(a);
  });

  let html = '';
  html += `<div class="announce-section"><h4>📌 กำลังมีผลตอนนี้</h4>`;
  html += current.length ? current.map(a => renderAnnouncementItem(a, today)).join('') : '<p class="announce-empty">ไม่มีประกาศที่มีผลอยู่ตอนนี้</p>';
  html += `</div>`;

  Object.keys(byMonth).sort().forEach(key => {
    const [y, m] = key.split('-').map(Number);
    html += `<div class="announce-section"><h4>🗓️ ${THAI_MONTHS[m - 1]} ${y + 543}</h4>`;
    html += byMonth[key].map(a => renderAnnouncementItem(a, today)).join('');
    html += `</div>`;
  });

  if (past.length) {
    html += `
      <details class="announce-section announce-past">
        <summary>🕘 ประกาศย้อนหลัง 90 วัน (${past.length})</summary>
        ${past.map(a => renderAnnouncementItem(a, today)).join('')}
      </details>
    `;
  }

  document.getElementById('announcementsModalBody').innerHTML = html;
  document.getElementById('announcementsModal').classList.remove('hidden');
}

function closeAnnouncementsModal() {
  document.getElementById('announcementsModal').classList.add('hidden');
}

// ------------------------------------------------------------
// ADMIN: ANNOUNCEMENTS
// ------------------------------------------------------------
let announcementEditingId = null;

function renderAdminAnnouncements() {
  const wrap = document.getElementById('optAnnouncementsContainer');
  if (!wrap) return;
  const options = getFormOptions();
  const today = todayStr();
  const list = (options.announcements || []).slice().sort((a, b) => (b.start || '').localeCompare(a.start || ''));
  const autoList = getAllAnnouncements(options).filter(a => a.auto);

  const countEl = document.getElementById('optAnnouncementCount');
  if (countEl) countEl.textContent = `${list.length} ประกาศ`;

  const statusText = a => {
    if (a.end && a.end < today) return '<span class="ann-admin-status past">หมดอายุแล้ว</span>';
    if (isAnnouncementCurrent(a, today)) return '<span class="ann-admin-status now">กำลังแสดง</span>';
    if (isAnnouncementSoon(a, today)) return '<span class="ann-admin-status soon">แสดงในแถบเร็ว ๆ นี้</span>';
    return '<span class="ann-admin-status later">รอแสดง</span>';
  };

  wrap.innerHTML = `
    ${list.length ? list.map(a => {
      const t = ANNOUNCE_TYPES[a.type] || ANNOUNCE_TYPES.info;
      return `
        <div class="ann-admin-row type-${escapeHtml(a.type || 'info')}">
          <div class="ann-admin-main">
            <div class="ann-admin-title">${a.pinned ? '📌 ' : ''}${t.icon} ${escapeHtml(a.title)} ${statusText(a)}</div>
            <div class="ann-admin-meta">
              🗓️ ${escapeHtml(fmtRange(a.start, a.end))} · ${a.room ? `📍 ${escapeHtml(a.room)}` : '🌐 ประกาศทั่วไป'} · ${escapeHtml(t.label)}
            </div>
            ${a.detail ? `<div class="ann-admin-detail">${escapeHtml(a.detail)}</div>` : ''}
          </div>
          <div class="ann-admin-actions">
            <button type="button" class="btn-opt-add" data-id="${escapeHtml(a.id)}" onclick="openAnnouncementEditor(this.dataset.id)">✏️ แก้ไข</button>
            <button type="button" class="opt-chip-delete" data-id="${escapeHtml(a.id)}" onclick="deleteAnnouncement(this.dataset.id)" title="ลบประกาศ">✕</button>
          </div>
        </div>
      `;
    }).join('') : '<p class="announce-empty">ยังไม่มีประกาศ กด "➕ เพิ่มประกาศ" เพื่อสร้างประกาศแรก</p>'}

    <div class="ann-admin-auto">
      <div class="ann-admin-auto-title">🔒 ประกาศปิดห้องอัตโนมัติ (${autoList.length})</div>
      <p>สร้างจากปุ่ม 🔒 ที่ห้องในแท็บ "จัดการห้อง / สถานที่" ไม่ต้องเขียนประกาศซ้ำ และจะหายไปเองเมื่อเปิดห้องหรือพ้นช่วงปิด</p>
      ${autoList.map(a => `<div class="ann-admin-auto-item">${escapeHtml(a.title)} · ${escapeHtml(announcementWhenText(a, today))}${a.detail ? ` · ${escapeHtml(a.detail)}` : ''}</div>`).join('')}
    </div>
  `;
}

function fillRoomSelectOptions(selectEl, includeBlank, blankLabel) {
  const options = getFormOptions();
  const cur = selectEl.value;
  let html = includeBlank ? `<option value="">${escapeHtml(blankLabel)}</option>` : '';
  options.venueCategories.forEach(cat => {
    if (cat.type === 'classroom_grades' && cat.grades) {
      Object.keys(cat.grades).forEach(gKey => {
        const g = cat.grades[gKey];
        html += `<optgroup label="🏫 ${escapeHtml(g.fullName || g.label || gKey)}">`;
        (g.rooms || []).forEach(r => {
          const key = `ห้อง ${r}`;
          html += `<option value="${escapeHtml(key)}">${escapeHtml(key)}</option>`;
        });
        html += `</optgroup>`;
      });
    } else if (Array.isArray(cat.rooms)) {
      html += `<optgroup label="${escapeHtml(cat.label)}">`;
      cat.rooms.forEach(r => { html += `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`; });
      html += `</optgroup>`;
    }
  });
  selectEl.innerHTML = html;
  if ([...selectEl.options].some(o => o.value === cur)) selectEl.value = cur;
}

function openAnnouncementEditor(id) {
  const options = getFormOptions();
  const a = id ? (options.announcements || []).find(x => x.id === id) : null;
  announcementEditingId = a ? a.id : null;
  const today = todayStr();

  const roomSel = document.getElementById('annRoom');
  fillRoomSelectOptions(roomSel, true, '🌐 ประกาศทั่วไป (ไม่ผูกกับห้อง)');

  document.getElementById('annEditTitle').textContent = a ? '✏️ แก้ไขประกาศ' : '📢 เพิ่มประกาศ';
  document.getElementById('annTitle').value = a ? a.title : '';
  document.getElementById('annDetail').value = a ? (a.detail || '') : '';
  document.getElementById('annType').value = a ? (a.type || 'info') : 'info';
  roomSel.value = a ? (a.room || '') : '';
  document.getElementById('annStart').value = a ? a.start : today;
  document.getElementById('annEnd').value = a ? a.end : today;
  document.getElementById('annPinned').checked = Boolean(a && a.pinned);
  document.getElementById('errAnnouncement').textContent = '';
  onAnnouncementTypeChange();
  document.getElementById('announcementEditModal').classList.remove('hidden');
}

function closeAnnouncementEditor() {
  document.getElementById('announcementEditModal').classList.add('hidden');
  announcementEditingId = null;
}

function onAnnouncementTypeChange() {
  const hint = document.getElementById('annClosureHint');
  if (hint) hint.classList.toggle('hidden', document.getElementById('annType').value !== 'closure');
}

function saveAnnouncement() {
  const errEl = document.getElementById('errAnnouncement');
  errEl.textContent = '';
  const title = document.getElementById('annTitle').value.trim();
  const detail = document.getElementById('annDetail').value.trim();
  const type = document.getElementById('annType').value;
  const room = document.getElementById('annRoom').value;
  const start = document.getElementById('annStart').value;
  const end = document.getElementById('annEnd').value || start;
  const pinned = document.getElementById('annPinned').checked;

  if (!title) { errEl.textContent = 'กรุณากรอกหัวข้อประกาศ'; return; }
  if (!start) { errEl.textContent = 'กรุณาเลือกวันที่เริ่ม'; return; }
  if (end < start) { errEl.textContent = 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม'; return; }

  const options = getFormOptions();
  options.announcements = options.announcements || [];
  const record = { title, detail, type, room, start, end, pinned, updatedAt: Date.now() };
  const existing = options.announcements.find(x => x.id === announcementEditingId);
  if (existing) {
    Object.assign(existing, record);
  } else {
    options.announcements.push({ id: `ann_${Date.now()}`, createdAt: Date.now(), ...record });
  }
  options._updatedAt = Date.now();
  saveFormOptions(options);
  closeAnnouncementEditor();
  renderAdminAnnouncements();
  showToast(`📢 บันทึกประกาศ "${title}" และซิงค์ขึ้นคลาวด์เรียบร้อย`, 'success');
}

function deleteAnnouncement(id) {
  const options = getFormOptions();
  const a = (options.announcements || []).find(x => x.id === id);
  if (!a) return;
  if (!confirm(`ต้องการลบประกาศ "${a.title}" ใช่หรือไม่?`)) return;
  options.announcements = options.announcements.filter(x => x.id !== id);
  options._updatedAt = Date.now();
  saveFormOptions(options);
  renderAdminAnnouncements();
  showToast(`🗑️ ลบประกาศ "${a.title}" และซิงค์ขึ้นคลาวด์เรียบร้อย`, 'info');
}

// ------------------------------------------------------------
// ADMIN: BOOKING HOURS (เวลาทำการ)
// ------------------------------------------------------------
function renderBookingHoursSetting() {
  const s = document.getElementById('optHoursStart');
  const e = document.getElementById('optHoursEnd');
  if (!s || !e || document.activeElement === s || document.activeElement === e) return;
  const h = getBookingHours();
  s.value = minToTime(h.start);
  e.value = minToTime(h.end);
}

function saveBookingHours() {
  const start = document.getElementById('optHoursStart').value;
  const end = document.getElementById('optHoursEnd').value;
  if (!start || !end || timeToMin(end) <= timeToMin(start)) {
    showToast('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม', 'error');
    return;
  }
  const options = getFormOptions();
  options.bookingHours = { start, end };
  options._updatedAt = Date.now();
  saveFormOptions(options);
  showToast(`⏰ บันทึกเวลาทำการ ${start}–${end} น. และซิงค์ขึ้นคลาวด์เรียบร้อย`, 'success');
}

// ------------------------------------------------------------
// ADMIN: ROOM DETAILS EDITOR (ข้อมูลห้อง)
// ------------------------------------------------------------
let roomDetailEditingKey = null;
let roomDetailDraft = null;

function openRoomDetailEditorByIndex(catIdx, roomIdx) {
  const cat = getFormOptions().venueCategories[catIdx];
  if (!cat || !cat.rooms || cat.rooms[roomIdx] === undefined) return;
  openRoomDetailEditor(cat.rooms[roomIdx]);
}

function openRoomDetailEditor(roomKey) {
  const d = getRoomDetails(roomKey);
  roomDetailEditingKey = roomKey;
  roomDetailDraft = {
    equipment: Array.isArray(d.equipment) ? d.equipment.slice() : [],
    extra: Array.isArray(d.extra) ? d.extra.map(x => ({ label: x.label || '', value: x.value || '' })) : [],
  };
  document.getElementById('rdRoomName').textContent = roomKey;
  document.getElementById('rdCapacity').value = d.capacity || '';
  document.getElementById('rdLocation').value = d.location || '';
  document.getElementById('rdContact').value = d.contact || '';
  document.getElementById('rdDescription').value = d.description || '';
  document.getElementById('rdRules').value = d.rules || '';
  document.getElementById('rdEquipmentNew').value = '';
  renderRoomDetailEquipment();
  renderRoomDetailExtra();
  document.getElementById('roomDetailModal').classList.remove('hidden');
}

function closeRoomDetailEditor() {
  document.getElementById('roomDetailModal').classList.add('hidden');
  roomDetailEditingKey = null;
  roomDetailDraft = null;
}

function renderRoomDetailEquipment() {
  const wrap = document.getElementById('rdEquipment');
  if (!wrap || !roomDetailDraft) return;
  const all = [...EQUIPMENT_PRESETS, ...roomDetailDraft.equipment.filter(x => !EQUIPMENT_PRESETS.includes(x))];
  wrap.innerHTML = all.map(name => {
    const on = roomDetailDraft.equipment.includes(name);
    return `<button type="button" class="rd-equip-chip ${on ? 'on' : ''}" data-name="${escapeHtml(name)}" onclick="toggleRoomDetailEquipment(this.dataset.name)">${on ? '✓ ' : ''}${escapeHtml(name)}</button>`;
  }).join('');
}

function toggleRoomDetailEquipment(name) {
  const list = roomDetailDraft.equipment;
  const idx = list.indexOf(name);
  if (idx >= 0) list.splice(idx, 1); else list.push(name);
  renderRoomDetailEquipment();
}

function addRoomDetailEquipment() {
  const input = document.getElementById('rdEquipmentNew');
  const val = input.value.trim();
  if (!val) return;
  if (!roomDetailDraft.equipment.includes(val)) roomDetailDraft.equipment.push(val);
  input.value = '';
  renderRoomDetailEquipment();
}

function syncRoomDetailExtraFromInputs() {
  document.querySelectorAll('#rdExtra .rd-extra-row').forEach((row, i) => {
    if (!roomDetailDraft.extra[i]) return;
    roomDetailDraft.extra[i].label = row.querySelector('.rd-extra-label').value;
    roomDetailDraft.extra[i].value = row.querySelector('.rd-extra-value').value;
  });
}

function renderRoomDetailExtra() {
  const wrap = document.getElementById('rdExtra');
  if (!wrap || !roomDetailDraft) return;
  wrap.innerHTML = roomDetailDraft.extra.length ? roomDetailDraft.extra.map((x, i) => `
    <div class="rd-extra-row">
      <input type="text" class="form-input rd-extra-label" placeholder="หัวข้อ เช่น ขนาดห้อง" value="${escapeHtml(x.label)}" />
      <input type="text" class="form-input rd-extra-value" placeholder="รายละเอียด เช่น 12 x 20 เมตร" value="${escapeHtml(x.value)}" />
      <button type="button" class="opt-chip-delete" onclick="removeRoomDetailExtra(${i})" title="ลบหัวข้อนี้">✕</button>
    </div>
  `).join('') : '<p class="rd-extra-empty">ยังไม่มีหัวข้อเพิ่มเติม</p>';
}

function addRoomDetailExtra() {
  syncRoomDetailExtraFromInputs();
  roomDetailDraft.extra.push({ label: '', value: '' });
  renderRoomDetailExtra();
  const inputs = document.querySelectorAll('#rdExtra .rd-extra-label');
  if (inputs.length) inputs[inputs.length - 1].focus();
}

function removeRoomDetailExtra(i) {
  syncRoomDetailExtraFromInputs();
  roomDetailDraft.extra.splice(i, 1);
  renderRoomDetailExtra();
}

function saveRoomDetails() {
  if (!roomDetailEditingKey) return;
  syncRoomDetailExtraFromInputs();
  const capRaw = document.getElementById('rdCapacity').value.trim();
  const capacity = capRaw ? Math.max(0, parseInt(capRaw, 10) || 0) : '';
  const details = {
    capacity,
    location: document.getElementById('rdLocation').value.trim(),
    contact: document.getElementById('rdContact').value.trim(),
    description: document.getElementById('rdDescription').value.trim(),
    rules: document.getElementById('rdRules').value.trim(),
    equipment: roomDetailDraft.equipment.slice(),
    extra: roomDetailDraft.extra
      .map(x => ({ label: x.label.trim(), value: x.value.trim() }))
      .filter(x => x.label || x.value),
  };
  const roomKey = roomDetailEditingKey;
  const options = getFormOptions();
  options.roomDetails = options.roomDetails || {};
  options.roomDetails[roomKey] = details;
  options._updatedAt = Date.now();
  saveFormOptions(options);
  closeRoomDetailEditor();
  if (state.isAdmin && state.adminSection === 'options') renderAdminOptionsManager();
  showToast(`💾 บันทึกข้อมูล "${roomKey}" และซิงค์ขึ้นคลาวด์เรียบร้อย`, 'success');
}

// ------------------------------------------------------------
// PAGE: ข้อมูลสถานที่
// ------------------------------------------------------------
function renderVenueInfoMeta(d) {
  const parts = [];
  if (d.capacity) parts.push(`👥 จุ ${d.capacity} คน`);
  if (d.location) parts.push(`📍 ${escapeHtml(d.location)}`);
  return parts.length ? `<div class="venue-meta">${parts.join('<span class="dot">·</span>')}</div>` : '';
}

function renderVenuesPage() {
  const wrap = document.getElementById('venuesContainer');
  if (!wrap) return;
  const options = getFormOptions();
  const todayBookings = getActiveBookingsOn(todayStr());
  const filterEl = document.getElementById('venueSearchInput');
  const q = filterEl ? filterEl.value.trim().toLowerCase() : '';
  const match = name => !q || name.toLowerCase().includes(q);
  let html = '';

  options.venueCategories.forEach(cat => {
    if (cat.type === 'classroom_grades' && cat.grades) {
      const gradeRows = Object.keys(cat.grades).map(gKey => {
        const g = cat.grades[gKey];
        const pills = (g.rooms || []).map(r => `ห้อง ${r}`).filter(match).map(key => {
          const st = getRoomNowStatus(key, options, todayBookings);
          return `<button type="button" class="venue-pill ${st.kind}" data-room="${escapeHtml(key)}" onclick="openVenueDetail(this.dataset.room)" title="${escapeHtml(st.text)}">${st.icon} ${escapeHtml(key.replace('ห้อง ', ''))}</button>`;
        }).join('');
        return pills ? `<div class="venue-grade-row"><span class="venue-grade-label">${escapeHtml(g.label || gKey)}</span><div class="venue-pills">${pills}</div></div>` : '';
      }).join('');
      if (gradeRows) {
        html += `
          <div class="venue-category">
            <h3 class="venue-cat-title">${escapeHtml(cat.label)}</h3>
            <div class="venue-grades">${gradeRows}</div>
          </div>
        `;
      }
      return;
    }

    const rooms = (cat.rooms || []).filter(match);
    if (!rooms.length) return;
    html += `
      <div class="venue-category">
        <h3 class="venue-cat-title">${escapeHtml(cat.label)} <span class="venue-cat-count">${rooms.length} สถานที่</span></h3>
        <div class="venue-grid">
          ${rooms.map(r => {
            const st = getRoomNowStatus(r, options, todayBookings);
            const d = getRoomDetails(r, options);
            const up = getUpcomingClosure(r, options);
            const eq = Array.isArray(d.equipment) ? d.equipment : [];
            return `
              <div class="venue-card status-${st.kind}" data-room="${escapeHtml(r)}" onclick="openVenueDetail(this.dataset.room)">
                <div class="venue-card-head">
                  <h4>${escapeHtml(r)}</h4>
                  ${state.isAdmin ? `<button type="button" class="venue-edit-btn" data-room="${escapeHtml(r)}" onclick="event.stopPropagation(); openRoomDetailEditor(this.dataset.room)" title="แก้ไขข้อมูลห้อง">✏️</button>` : ''}
                </div>
                <div class="venue-status ${st.kind}">${st.icon} ${escapeHtml(st.text)}</div>
                ${st.sub ? `<div class="venue-status-sub">${escapeHtml(st.sub)}</div>` : ''}
                ${up ? `<div class="venue-upcoming">🗓️ จะปิด ${escapeHtml(fmtRange(up.start, up.end))}${up.reason ? ` · ${escapeHtml(up.reason)}` : ''}</div>` : ''}
                ${renderVenueInfoMeta(d)}
                ${eq.length ? `<div class="venue-equip">${eq.slice(0, 4).map(x => `<span>${escapeHtml(x)}</span>`).join('')}${eq.length > 4 ? `<span class="more">+${eq.length - 4}</span>` : ''}</div>` : ''}
                <div class="venue-card-foot">ดูตารางและประกาศ →</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  });

  wrap.innerHTML = html || '<div class="empty-state"><div class="empty-icon">🔍</div><p>ไม่พบสถานที่ที่ค้นหา</p></div>';
}

// ------------------------------------------------------------
// PAGE: รายละเอียดห้อง (ประกาศของห้อง + ตารางรายสัปดาห์)
// ------------------------------------------------------------
let venueDetailRoom = null;
let venueDetailWeekStart = null;

function getMondayStr(dateStr) {
  const d = parseDateStr(dateStr);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return toDateStr(d);
}

function openVenueDetail(roomKey) {
  if (!roomKey) return;
  closeAnnouncementsModal();
  venueDetailRoom = roomKey;
  venueDetailWeekStart = getMondayStr(todayStr());
  showPage('venueDetail');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function shiftVenueWeek(n) {
  venueDetailWeekStart = n === 0 ? getMondayStr(todayStr()) : addDaysStr(venueDetailWeekStart, n * 7);
  renderVenueDetail();
}

function renderVenueDetail() {
  const wrap = document.getElementById('venueDetailContainer');
  if (!wrap || !venueDetailRoom) return;
  const options = getFormOptions();
  const roomKey = venueDetailRoom;
  const entry = findRoomEntry(roomKey, options);
  if (!entry) {
    wrap.innerHTML = '<div class="empty-state"><div class="empty-icon">❓</div><p>ไม่พบสถานที่นี้ อาจถูกลบออกจากระบบแล้ว</p></div>';
    return;
  }
  const today = todayStr();
  const st = getRoomNowStatus(roomKey, options, getActiveBookingsOn(today));
  const d = entry.isClassroom ? {} : getRoomDetails(roomKey, options);
  const eq = Array.isArray(d.equipment) ? d.equipment : [];
  const extra = Array.isArray(d.extra) ? d.extra : [];

  const infoRows = [];
  if (d.capacity) infoRows.push(['👥 ความจุ', `${d.capacity} คน`]);
  if (d.location) infoRows.push(['📍 ที่ตั้ง', escapeHtml(d.location)]);
  if (d.contact) infoRows.push(['📞 ผู้ดูแล', escapeHtml(d.contact)]);
  extra.forEach(x => infoRows.push([escapeHtml(x.label), escapeHtml(x.value)]));

  const roomAnnouncements = sortAnnouncements(
    getAllAnnouncements(options).filter(a => a.room === roomKey && (!a.end || a.end >= today)),
    today
  );

  const weekStart = venueDetailWeekStart || getMondayStr(today);
  const weekEnd = addDaysStr(weekStart, 6);
  const rows = [];
  for (let i = 0; i < 7; i++) {
    const date = addDaysStr(weekStart, i);
    rows.push({ roomKey, date, label: fmtDay(date, true), isToday: date === today });
  }

  const restoreScroll = keepTimelineScroll(wrap, `week|${roomKey}|${weekStart}`);
  wrap.innerHTML = `
    <button type="button" class="btn-back" onclick="showPage('venues')">← กลับไปหน้าข้อมูลสถานที่</button>

    <div class="vd-header">
      <div>
        <div class="vd-cat">${escapeHtml(entry.isClassroom ? `${entry.catLabel.split('(')[0].trim()} · ${entry.gradeLabel}` : entry.catLabel)}</div>
        <h2 class="vd-title">${escapeHtml(roomKey)}</h2>
        <div class="venue-status ${st.kind}">${st.icon} ${escapeHtml(st.text)}${st.sub ? ` <span class="vd-status-sub">· ${escapeHtml(st.sub)}</span>` : ''}</div>
      </div>
      <div class="vd-actions">
        <button type="button" class="btn-primary" data-room="${escapeHtml(roomKey)}" onclick="prefillBooking(this.dataset.room)">📝 จองห้องนี้</button>
        ${state.isAdmin && !entry.isClassroom ? `<button type="button" class="btn-secondary" data-room="${escapeHtml(roomKey)}" onclick="openRoomDetailEditor(this.dataset.room)">✏️ แก้ไขข้อมูลห้อง</button>` : ''}
        ${state.isAdmin ? `<button type="button" class="btn-secondary" data-room="${escapeHtml(roomKey)}" onclick="showRoomClosureModal(this.dataset.room)">🔒 ปิด/เปิดการจอง</button>` : ''}
      </div>
    </div>

    ${(infoRows.length || eq.length || d.description || d.rules) ? `
      <div class="vd-card">
        <h3 class="vd-card-title">📋 ข้อมูลห้อง</h3>
        ${d.description ? `<p class="vd-desc">${escapeHtml(d.description)}</p>` : ''}
        ${infoRows.length ? `<div class="vd-info-grid">${infoRows.map(([k, v]) => `<div class="vd-info-k">${k}</div><div class="vd-info-v">${v}</div>`).join('')}</div>` : ''}
        ${eq.length ? `<div class="vd-equip-title">🎤 อุปกรณ์</div><div class="venue-equip">${eq.map(x => `<span>${escapeHtml(x)}</span>`).join('')}</div>` : ''}
        ${d.rules ? `<div class="vd-equip-title">📜 ระเบียบการใช้</div><p class="vd-rules">${escapeHtml(d.rules)}</p>` : ''}
      </div>
    ` : ''}

    <div class="vd-card">
      <h3 class="vd-card-title">📢 ประกาศของห้องนี้</h3>
      ${roomAnnouncements.length
        ? roomAnnouncements.map(a => renderAnnouncementItem(a, today)).join('')
        : '<p class="announce-empty">ไม่มีประกาศสำหรับห้องนี้</p>'}
    </div>

    <div class="vd-card">
      <div class="vd-week-head">
        <h3 class="vd-card-title">📅 ตารางการใช้ห้อง</h3>
        <div class="vd-week-nav">
          <button type="button" class="btn-cal-nav" onclick="shiftVenueWeek(-1)" title="สัปดาห์ก่อน">&#8249;</button>
          <span class="vd-week-label">${escapeHtml(fmtRange(weekStart, weekEnd))}</span>
          <button type="button" class="btn-cal-nav" onclick="shiftVenueWeek(1)" title="สัปดาห์ถัดไป">&#8250;</button>
          <button type="button" class="btn-cal-list-today" onclick="shiftVenueWeek(0)">📌 สัปดาห์นี้</button>
        </div>
      </div>
      ${renderTimelineHTML(rows, options)}
    </div>
  `;
  restoreScroll();
}

// ------------------------------------------------------------
// TIMELINE (ใช้ร่วมกัน: ตารางรายสัปดาห์ของห้อง และตารางรายวันแยกห้องในปฏิทิน)
// ------------------------------------------------------------
function renderTimelineHTML(rows, options, extraFooter = '') {
  const hours = getBookingHours(options);
  const span = hours.end - hours.start;
  const pct = min => ((Math.min(Math.max(min, hours.start), hours.end) - hours.start) / span) * 100;
  const today = todayStr();
  const now = nowMinutes();
  const dayCache = {};
  const dayBookings = date => (dayCache[date] = dayCache[date] || getActiveBookingsOn(date));

  const ticks = [];
  for (let m = Math.ceil(hours.start / 60) * 60; m <= hours.end; m += 60) ticks.push(m);
  const tickLines = ticks.map(m => `<span class="tl-tick" style="left:${pct(m)}%"></span>`).join('');

  const rowHtml = rows.map(row => {
    // span ด้านในเป็น sticky เพื่อให้ข้อความค้างอยู่ทางซ้ายตอนเลื่อนตารางแนวนอน
    if (row.groupLabel) {
      return `<div class="tl-group"><span>${escapeHtml(row.groupLabel)}</span></div>`;
    }
    if (row.note) {
      return `<div class="tl-note"><span>${escapeHtml(row.note)}</span></div>`;
    }
    const { roomKey, date } = row;
    const closed = isRoomClosedOn(roomKey, date, options);
    const closure = closed ? getActiveRoomClosure(roomKey, options) : null;
    const isPastDay = date < today;

    const blocks = roomBookingsOn(roomKey, dayBookings(date)).map(b => {
      const s = timeToMin(b.startTime), e = timeToMin(b.endTime);
      if (s === null || e === null || e <= hours.start || s >= hours.end) return '';
      const left = pct(s), width = Math.max(pct(e) - left, 0.8);
      const tip = `${b.startTime}–${b.endTime} น. · ${b.purpose || ''}${b.department ? ` (${b.department})` : ''}`;
      return `<div class="tl-block" style="left:${left}%;width:${width}%" title="${escapeHtml(tip)}" onclick="event.stopPropagation(); viewBookingDetail('${escapeHtml(String(b.id))}')"><span>${escapeHtml(b.startTime)}–${escapeHtml(b.endTime)} ${escapeHtml(b.purpose || '')}</span></div>`;
    }).join('');

    let past = '';
    if (isPastDay) past = '<div class="tl-past" style="width:100%"></div>';
    else if (date === today && now > hours.start) past = `<div class="tl-past" style="width:${pct(now)}%"></div>`;
    const nowLine = date === today && now > hours.start && now < hours.end ? `<div class="tl-now" style="left:${pct(now)}%"></div>` : '';
    // ข้อความซ้ำหลายจุด เพื่อให้มองเห็นบนมือถือไม่ว่าจะเลื่อนตารางไปช่วงไหน (จอใหญ่แสดงแค่อันแรก)
    const closedText = `🔒 ${escapeHtml(closureReasonText(closure || {}))}`;
    const closedLayer = closed
      ? `<div class="tl-closed"><span>${closedText}</span><span class="rep">${closedText}</span><span class="rep">${closedText}</span></div>`
      : '';

    return `
      <div class="tl-row ${row.isToday ? 'is-today' : ''}">
        <div class="tl-label" ${row.labelRoomLink ? `data-room="${escapeHtml(roomKey)}" onclick="openVenueDetail(this.dataset.room)" title="ดูรายละเอียดห้อง"` : ''}>
          ${escapeHtml(row.label)}${row.isToday ? ' <span class="tl-today-badge">วันนี้</span>' : ''}
        </div>
        <div class="tl-track ${closed ? 'closed' : ''} ${isPastDay ? 'past-day' : ''}" data-room="${escapeHtml(roomKey)}" data-date="${escapeHtml(date)}" onclick="onTimelineTrackClick(event, this)" title="${closed ? 'ปิดให้จอง' : isPastDay ? 'วันที่ผ่านมาแล้ว' : 'กดที่ช่องว่างเพื่อจองช่วงเวลานี้'}">
          ${tickLines}${past}${blocks}${closedLayer}${nowLine}
        </div>
      </div>
    `;
  }).join('');

  // ป้ายชั่วโมงแรก/สุดท้ายชิดขอบ ไม่ให้ถูกตัดครึ่ง
  const header = ticks.map(m => {
    const edge = m <= hours.start ? 'edge-start' : m >= hours.end ? 'edge-end' : '';
    return `<span class="tl-hour ${edge}" style="left:${pct(m)}%">${String(m / 60).padStart(2, '0')}</span>`;
  }).join('');

  return `
    <div class="tl-scroll-hint">↔️ เลื่อนตารางซ้าย-ขวาเพื่อดูเวลาทั้งวัน</div>
    <div class="tl-scroll">
      <div class="tl-wrap">
        <div class="tl-row tl-header-row">
          <div class="tl-label"></div>
          <div class="tl-header">${header}</div>
        </div>
        ${rowHtml}
      </div>
    </div>
    <div class="tl-legend">
      <span><i class="lg-free"></i> ว่าง (กดเพื่อจอง)</span>
      <span><i class="lg-busy"></i> มีการจองแล้ว</span>
      <span><i class="lg-closed"></i> ปิดให้จอง</span>
      <span><i class="lg-past"></i> เวลาที่ผ่านไปแล้ว</span>
      <span class="tl-legend-hours">⏰ เวลาทำการ ${minToTime(hours.start)}–${minToTime(hours.end)} น.</span>
    </div>
    ${extraFooter}
  `;
}

// เรียกก่อนเปลี่ยน innerHTML ของกล่องที่มีตาราง แล้วเรียกฟังก์ชันที่คืนมาหลังเปลี่ยน:
// ถ้ายังเป็นตารางชุดเดิม (key เดิม) คงตำแหน่งเลื่อนเดิมไว้, ถ้าเป็นชุดใหม่ เลื่อนไปที่เวลาปัจจุบัน
function keepTimelineScroll(container, key) {
  const prev = container.querySelector('.tl-scroll');
  const prevLeft = prev && container.dataset.tlKey === key ? prev.scrollLeft : null;
  return () => {
    container.dataset.tlKey = key;
    const scroller = container.querySelector('.tl-scroll');
    const scrollable = Boolean(scroller && scroller.scrollWidth > scroller.clientWidth);
    // แสดงคำแนะนำ "เลื่อนซ้าย-ขวา" เฉพาะเมื่อตารางกว้างเกินจอจริง
    container.querySelectorAll('.tl-scroll-hint').forEach(h => { h.style.display = scrollable ? 'block' : 'none'; });
    if (!scrollable) return;
    if (prevLeft !== null) { scroller.scrollLeft = prevLeft; return; }
    const nowEl = scroller.querySelector('.tl-now');
    if (!nowEl) return;
    const x = nowEl.getBoundingClientRect().left - scroller.getBoundingClientRect().left + scroller.scrollLeft;
    scroller.scrollLeft = Math.max(0, x - scroller.clientWidth * 0.45);
  };
}

function onTimelineTrackClick(evt, el) {
  const options = getFormOptions();
  const roomKey = el.dataset.room;
  const date = el.dataset.date;
  if (isRoomClosedOn(roomKey, date, options)) {
    const c = getActiveRoomClosure(roomKey, options);
    showToast(`🔒 ${roomKey} ปิดให้จองในวันนี้ (${closureReasonText(c)})`, 'error');
    return;
  }
  const rect = el.getBoundingClientRect();
  const hours = getBookingHours(options);
  const minute = hours.start + ((evt.clientX - rect.left) / rect.width) * (hours.end - hours.start);
  const seg = getFreeSegments(roomKey, date, options, getActiveBookingsOn(date))
    .find(([s, e]) => minute >= s && minute < e);
  if (!seg) {
    showToast('ช่วงเวลานี้จองไม่ได้ (ผ่านไปแล้ว หรือมีการจองอยู่)', 'error');
    return;
  }
  let start = Math.max(seg[0], Math.floor(minute / 30) * 30);
  if (seg[1] - start < MIN_FREE_MINUTES) start = seg[0];
  const end = Math.min(start + 60, seg[1]);
  prefillBooking(roomKey, date, minToTime(start), minToTime(end));
}

// ปฏิทิน: มุมมองตารางรายวันแยกห้อง
function openTimelineForDate(dateStr) {
  state.calTimelineDate = dateStr;
  setCalViewMode('timeline');
}

function shiftTimelineDate(n) {
  state.calTimelineDate = n === 0 ? todayStr() : addDaysStr(state.calTimelineDate || todayStr(), n);
  renderCalendarTimeline();
}

function handleTimelineDateInput(val) {
  if (!val) return;
  state.calTimelineDate = val;
  renderCalendarTimeline();
}

function renderCalendarTimeline() {
  const wrap = document.getElementById('calendarTimelineView');
  if (!wrap) return;
  const options = getFormOptions();
  const date = state.calTimelineDate || todayStr();
  state.calTimelineDate = date;
  const filterRoom = (document.getElementById('filterRoom') || {}).value || '';
  const dayBookings = getActiveBookingsOn(date);

  const rows = [];
  options.venueCategories.forEach(cat => {
    if (cat.type === 'classroom_grades' && cat.grades) {
      // ห้องเรียนมีจำนวนมาก แสดงเฉพาะห้องที่มีจองหรือปิดในวันนั้น
      const keys = getAllRoomEntries(options)
        .filter(e => e.isClassroom && e.catId === cat.id)
        .map(e => e.key)
        .filter(k => !filterRoom || k === filterRoom);
      const shown = keys.filter(k => roomBookingsOn(k, dayBookings).length || isRoomClosedOn(k, date, options));
      if (!keys.length) return;
      rows.push({ groupLabel: cat.label.split('(')[0].trim() });
      shown.forEach(k => rows.push({ roomKey: k, date, label: k, labelRoomLink: true }));
      if (!filterRoom) {
        rows.push({ note: shown.length ? `ห้องเรียนอื่น ๆ อีก ${keys.length - shown.length} ห้อง ว่างทั้งวัน` : `ห้องเรียนทั้ง ${keys.length} ห้อง ว่างทั้งวัน` });
      } else if (!shown.length) {
        rows.push({ roomKey: filterRoom, date, label: filterRoom, labelRoomLink: true });
      }
      return;
    }
    const rooms = (cat.rooms || []).filter(r => !filterRoom || r === filterRoom);
    if (!rooms.length) return;
    rows.push({ groupLabel: cat.label });
    rooms.forEach(r => rows.push({ roomKey: r, date, label: r, labelRoomLink: true }));
  });

  const d = parseDateStr(date);
  const restoreScroll = keepTimelineScroll(wrap, `day|${date}|${filterRoom}`);
  wrap.innerHTML = `
    <div class="tl-toolbar">
      <button type="button" class="btn-cal-nav" onclick="shiftTimelineDate(-1)" title="วันก่อนหน้า">&#8249;</button>
      <input type="date" class="cal-list-date-input" value="${date}" onchange="handleTimelineDateInput(this.value)" />
      <button type="button" class="btn-cal-nav" onclick="shiftTimelineDate(1)" title="วันถัดไป">&#8250;</button>
      <button type="button" class="btn-cal-list-today" onclick="shiftTimelineDate(0)">📌 วันนี้</button>
      <span class="tl-toolbar-label">${THAI_DAYS[d.getDay()]} ${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543} · มีการจอง ${dayBookings.length} รายการ</span>
    </div>
    ${rows.length ? renderTimelineHTML(rows, options) : '<div class="empty-state"><div class="empty-icon">🔍</div><p>ไม่พบห้องตามตัวกรอง</p></div>'}
  `;
  restoreScroll();
}

// ------------------------------------------------------------
// PAGE: ค้นหาห้องว่าง
// ------------------------------------------------------------
let searchActiveTab = 'time';
let searchInitialized = false;

function switchSearchTab(tab) {
  searchActiveTab = tab;
  document.getElementById('searchTabTime').classList.toggle('active', tab === 'time');
  document.getElementById('searchTabRoom').classList.toggle('active', tab === 'room');
  document.getElementById('searchPanelTime').classList.toggle('hidden', tab !== 'time');
  document.getElementById('searchPanelRoom').classList.toggle('hidden', tab !== 'room');
}

function renderSearchPage() {
  const options = getFormOptions();
  fillRoomSelectOptions(document.getElementById('srRoom'), false);
  if (searchInitialized) return;
  searchInitialized = true;

  const today = todayStr();
  const hours = getBookingHours(options);
  const startMin = Math.min(Math.max(Math.ceil((nowMinutes() + 1) / 60) * 60, hours.start), hours.end - 60);
  document.getElementById('stDate').value = today;
  document.getElementById('stDate').min = today;
  document.getElementById('stStart').value = minToTime(startMin);
  document.getElementById('stEnd').value = minToTime(Math.min(startMin + 60, hours.end));
  document.getElementById('srFrom').value = today;
  document.getElementById('srFrom').min = today;
  document.getElementById('srTo').value = addDaysStr(today, 6);
  document.getElementById('srTo').min = today;
}

function prefillFromEl(el) {
  prefillBooking(el.dataset.room, el.dataset.date, el.dataset.start, el.dataset.end);
}

function bookBtnAttrs(roomKey, date, s, e) {
  return `data-room="${escapeHtml(roomKey)}" data-date="${escapeHtml(date)}" data-start="${minToTime(s)}" data-end="${minToTime(e)}" onclick="prefillFromEl(this)"`;
}

function runTimeSearch() {
  const out = document.getElementById('stResults');
  const options = getFormOptions();
  const date = document.getElementById('stDate').value;
  const s = timeToMin(document.getElementById('stStart').value);
  const e = timeToMin(document.getElementById('stEnd').value);
  const people = parseInt(document.getElementById('stPeople').value, 10) || 0;
  const today = todayStr();

  if (!date || s === null || e === null) { out.innerHTML = '<p class="search-error">กรุณาเลือกวันที่และเวลาให้ครบ</p>'; return; }
  if (e <= s) { out.innerHTML = '<p class="search-error">เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม</p>'; return; }
  if (date < today || (date === today && s < Math.floor(nowMinutes() / 15) * 15)) {
    out.innerHTML = '<p class="search-error">วันหรือเวลาที่เลือกผ่านไปแล้ว</p>'; return;
  }

  const dayBookings = getActiveBookingsOn(date);
  const avail = [], partial = [], unavail = [];

  getAllRoomEntries(options).forEach(entry => {
    const key = entry.key;
    const d = entry.isClassroom ? {} : getRoomDetails(key, options);
    if (isRoomClosedOn(key, date, options)) {
      unavail.push({ entry, reason: `🔒 ปิด: ${closureReasonText(getActiveRoomClosure(key, options))}` });
      return;
    }
    if (people && d.capacity && Number(d.capacity) < people) {
      unavail.push({ entry, reason: `👥 จุได้ ${d.capacity} คน` });
      return;
    }
    // ถ้าช่วงที่ค้นหาอยู่นอกเวลาทำการ ให้คิดว่างเฉพาะจากการจองที่ชนกันจริง
    const overlapping = roomBookingsOn(key, dayBookings).filter(b => timeToMin(b.startTime) < e && timeToMin(b.endTime) > s);
    if (!overlapping.length) { avail.push({ entry, d }); return; }

    const free = [];
    let cur = s;
    overlapping.forEach(b => {
      const bs = timeToMin(b.startTime), be = timeToMin(b.endTime);
      if (bs > cur) free.push([cur, bs]);
      cur = Math.max(cur, be);
    });
    if (cur < e) free.push([cur, e]);
    const usable = free.filter(([a, b]) => b - a >= MIN_FREE_MINUTES);
    const busyText = `มีจอง ${overlapping.map(b => `${b.startTime}–${b.endTime}`).join(', ')}`;
    if (usable.length) partial.push({ entry, d, free: usable, busyText });
    else unavail.push({ entry, reason: busyText });
  });

  const roomLine = ({ entry, d }) => {
    const meta = [];
    if (d && d.capacity) meta.push(`👥 ${d.capacity} คน`);
    if (d && d.location) meta.push(`📍 ${escapeHtml(d.location)}`);
    return `<strong>${escapeHtml(entry.key)}</strong>${meta.length ? ` <span class="sr-meta">${meta.join(' · ')}</span>` : ''}`;
  };
  const detailBtn = key => `<button type="button" class="btn-sr-link" data-room="${escapeHtml(key)}" onclick="openVenueDetail(this.dataset.room)">ดูตาราง</button>`;

  // ห้องเรียนที่ว่างแสดงเป็นชิปแยกตามชั้น เพื่อไม่ให้รายการยาวเกินไป
  const availRooms = avail.filter(x => !x.entry.isClassroom);
  const availClass = avail.filter(x => x.entry.isClassroom);
  const classByGrade = {};
  availClass.forEach(x => { (classByGrade[x.entry.gradeLabel] = classByGrade[x.entry.gradeLabel] || []).push(x.entry.key); });

  let html = `<div class="sr-summary">ผลการค้นหา ${escapeHtml(fmtDay(date, true))} เวลา ${minToTime(s)}–${minToTime(e)} น.${people ? ` · ${people} คน` : ''}</div>`;

  html += `<div class="sr-group avail"><h4>✅ ว่างตลอดช่วงเวลา (${avail.length})</h4>`;
  html += availRooms.map(x => `
    <div class="sr-row">
      <div class="sr-row-main">${roomLine(x)}</div>
      <div class="sr-row-actions"><button type="button" class="btn-sr-book" ${bookBtnAttrs(x.entry.key, date, s, e)}>📝 จองห้องนี้</button>${detailBtn(x.entry.key)}</div>
    </div>
  `).join('');
  Object.keys(classByGrade).forEach(g => {
    html += `
      <div class="sr-row sr-class-row">
        <div class="sr-row-main"><strong>🏫 ห้องเรียน ${escapeHtml(g)}</strong></div>
        <div class="sr-class-chips">${classByGrade[g].map(k => `<button type="button" class="slot-chip" ${bookBtnAttrs(k, date, s, e)} title="จอง ${escapeHtml(k)}">${escapeHtml(k.replace('ห้อง ', ''))}</button>`).join('')}</div>
      </div>
    `;
  });
  if (!avail.length) html += '<p class="announce-empty">ไม่มีห้องที่ว่างตลอดช่วงเวลานี้</p>';
  html += `</div>`;

  if (partial.length) {
    html += `<div class="sr-group partial"><h4>⚠️ ว่างบางช่วง (${partial.length})</h4>`;
    html += partial.map(x => `
      <div class="sr-row">
        <div class="sr-row-main">${roomLine(x)}<div class="sr-sub">${escapeHtml(x.busyText)}</div></div>
        <div class="sr-row-actions">
          ${x.free.map(([a, b]) => `<button type="button" class="slot-chip" ${bookBtnAttrs(x.entry.key, date, a, b)}>🟢 ${minToTime(a)}–${minToTime(b)}</button>`).join('')}
          ${detailBtn(x.entry.key)}
        </div>
      </div>
    `).join('');
    html += `</div>`;
  }

  if (unavail.length) {
    html += `
      <details class="sr-group unavail">
        <summary>❌ ไม่ว่าง / จองไม่ได้ (${unavail.length})</summary>
        ${unavail.map(x => `<div class="sr-row muted"><div class="sr-row-main"><strong>${escapeHtml(x.entry.key)}</strong><div class="sr-sub">${escapeHtml(x.reason)}</div></div></div>`).join('')}
      </details>
    `;
  }
  out.innerHTML = html;
}

function runRoomSearch() {
  const out = document.getElementById('srResults');
  const options = getFormOptions();
  const roomKey = document.getElementById('srRoom').value;
  let from = document.getElementById('srFrom').value;
  const to = document.getElementById('srTo').value;
  const minDur = parseInt(document.getElementById('srDuration').value, 10) || 60;
  const today = todayStr();

  if (!roomKey || !from || !to) { out.innerHTML = '<p class="search-error">กรุณาเลือกห้องและช่วงวันที่ให้ครบ</p>'; return; }
  if (to < today) { out.innerHTML = '<p class="search-error">ช่วงวันที่ที่เลือกผ่านไปแล้ว</p>'; return; }
  if (from < today) from = today;
  if (to < from) { out.innerHTML = '<p class="search-error">วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม</p>'; return; }
  const days = Math.round((parseDateStr(to) - parseDateStr(from)) / 86400000) + 1;
  if (days > 31) { out.innerHTML = '<p class="search-error">ค้นหาได้ครั้งละไม่เกิน 31 วัน</p>'; return; }

  let daysHtml = '';
  let freeDays = 0;

  for (let i = 0; i < days; i++) {
    const date = addDaysStr(from, i);
    const dayBookings = getActiveBookingsOn(date);
    const booked = roomBookingsOn(roomKey, dayBookings).length;
    let slots;
    if (isRoomClosedOn(roomKey, date, options)) {
      slots = `<span class="slot-closed">🔒 ปิดให้จอง · ${escapeHtml(closureReasonText(getActiveRoomClosure(roomKey, options)))}</span>`;
    } else {
      const segs = getFreeSegments(roomKey, date, options, dayBookings).filter(([a, b]) => b - a >= minDur);
      if (segs.length) freeDays++;
      slots = segs.length
        ? segs.map(([a, b]) => `<button type="button" class="slot-chip" ${bookBtnAttrs(roomKey, date, a, Math.min(a + Math.max(minDur, 60), b))} title="กดเพื่อจองช่วงนี้">🟢 ${minToTime(a)}–${minToTime(b)}</button>`).join('')
        : '<span class="slot-none">❌ ไม่มีช่วงว่างพอ</span>';
    }
    daysHtml += `
      <div class="sr-day ${date === today ? 'is-today' : ''}">
        <div class="sr-day-label">${escapeHtml(fmtDay(date, true))}${booked ? `<span class="sr-day-count">มีจอง ${booked}</span>` : ''}</div>
        <div class="sr-day-slots">${slots}</div>
      </div>
    `;
  }

  const durText = minDur >= 60 ? `${minDur / 60} ชั่วโมง` : `${minDur} นาที`;
  out.innerHTML = `
    <div class="sr-summary">
      ${escapeHtml(roomKey)} · ${escapeHtml(fmtRange(from, to))} · ช่วงว่างอย่างน้อย ${durText}
      <button type="button" class="btn-sr-link" data-room="${escapeHtml(roomKey)}" onclick="openVenueDetail(this.dataset.room)">ดูตารางรายสัปดาห์</button>
    </div>
    <div class="sr-freedays">ว่างพอให้จอง ${freeDays} จาก ${days} วัน · กดช่วงเวลาเพื่อไปหน้าจอง</div>
    ${daysHtml}
  `;
}

// ------------------------------------------------------------
// กรอกหน้าจองล่วงหน้า (จากตาราง / ผลค้นหา / หน้ารายละเอียดห้อง)
// ------------------------------------------------------------
function selectRoomInBookingForm(roomKey, options) {
  const roomSel = document.getElementById('room');
  if (!roomSel || !roomKey) return false;
  const entry = findRoomEntry(roomKey, options);
  if (!entry) return false;
  if (entry.isClassroom) {
    roomSel.value = entry.gradeKey;
    handleRoomChange();
    activeClassroomGrade = entry.gradeKey;
    selectedClassrooms.clear();
    selectedClassrooms.add(roomKey);
    renderClassroomGrid();
    renderSelectedChips();
  } else {
    roomSel.value = roomKey;
    handleRoomChange();
  }
  return true;
}

function prefillBooking(roomKey, date, startTime, endTime) {
  const options = getFormOptions();
  showPage('booking');
  // กรอกจากตาราง/ผลค้นหาเป็นการจองวันเดียวเสมอ
  if (date && typeof isMultiDayMode === 'function' && isMultiDayMode()) resetMultiDay();
  if (date) {
    document.getElementById('bookingDate').value = date;
    refreshAllFormOptions();
  }
  selectRoomInBookingForm(roomKey, options);
  if (startTime) document.getElementById('startTime').value = startTime;
  if (endTime) document.getElementById('endTime').value = endTime;
  validateSelectedRoomsOpen();

  const target = document.getElementById(document.getElementById('fullName').value ? 'purpose' : 'fullName');
  if (target) { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); target.focus({ preventScroll: true }); }
  const parts = [roomKey, date ? fmtDay(date, true) : '', startTime && endTime ? `${startTime}–${endTime} น.` : ''].filter(Boolean);
  showToast(`📝 กรอกให้แล้ว: ${parts.join(' · ')} กรุณากรอกข้อมูลที่เหลือ`, 'success');
}

// ------------------------------------------------------------
// จองแบบครั้งก่อน (เก็บเฉพาะในเครื่องนี้)
// ------------------------------------------------------------
function saveLastBookingTemplate(t) {
  try { localStorage.setItem(LAST_BOOKING_KEY, JSON.stringify(t)); } catch (_) {}
  renderLastBookingBar();
}

function getLastBookingTemplate() {
  try { return JSON.parse(localStorage.getItem(LAST_BOOKING_KEY) || 'null'); } catch (_) { return null; }
}

function renderLastBookingBar() {
  const bar = document.getElementById('lastBookingBar');
  if (!bar) return;
  const t = getLastBookingTemplate();
  if (!t) { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  document.getElementById('lastBookingSummary').textContent =
    [t.roomString, t.purpose, t.startTime && t.endTime ? `${t.startTime}–${t.endTime} น.` : ''].filter(Boolean).join(' · ');
}

function setSelectIfExists(id, value) {
  const el = document.getElementById(id);
  if (!el || !value) return false;
  if (![...el.options].some(o => o.value === value)) return false;
  el.value = value;
  return true;
}

function applyLastBooking() {
  const t = getLastBookingTemplate();
  if (!t) return;
  const options = getFormOptions();
  const warnings = [];

  document.getElementById('fullName').value = t.fullName || '';

  // ตำแหน่ง: ถ้าไม่มีในรายการแล้ว ใช้ "อื่น ๆ (ระบุ)"
  if (!setSelectIfExists('position', t.position)) {
    if (t.position && setSelectIfExists('position', 'อื่น ๆ')) {
      toggleOtherPosition();
      document.getElementById('positionOther').value = t.position;
    } else if (t.position) {
      warnings.push('ตำแหน่ง');
    }
  } else {
    toggleOtherPosition();
  }
  if (!setSelectIfExists('department', t.department) && t.department) warnings.push('ฝ่ายงาน');

  // ห้อง: ห้องเดี่ยว หรือห้องเรียนหลายห้อง
  const roomSel = document.getElementById('room');
  if (t.roomRaw && setSelectIfExists('room', t.roomRaw)) {
    handleRoomChange();
    if (isClassroomCategory(t.roomRaw)) {
      const valid = getAllRoomEntries(options).filter(e => e.isClassroom).map(e => e.key);
      selectedClassrooms.clear();
      (t.classrooms || []).filter(k => valid.includes(k)).forEach(k => selectedClassrooms.add(k));
      renderClassroomGrid();
      renderSelectedChips();
    }
  } else if (t.roomRaw) {
    roomSel.value = '';
    handleRoomChange();
    warnings.push('ห้อง');
  }

  document.getElementById('purpose').value = t.purpose || '';
  document.getElementById('studentCount').value = t.studentCount || '';
  document.getElementById('grade').value = t.grade || '';
  document.getElementById('startTime').value = t.startTime || '';
  document.getElementById('endTime').value = t.endTime || '';
  document.getElementById('roomLayout').value = t.roomLayout || '';

  clearErrors();
  validateSelectedRoomsOpen();
  const dateEl = document.getElementById('bookingDate');
  dateEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  dateEl.focus({ preventScroll: true });

  if (warnings.length) {
    showToast(`กรอกข้อมูลจากครั้งก่อนแล้ว แต่${warnings.join(', ')}เดิมไม่มีในระบบแล้ว กรุณาเลือกใหม่`, 'warning');
  } else {
    showToast('⭐ กรอกข้อมูลจากการจองครั้งก่อนแล้ว กรุณาเลือกวันที่', 'success');
  }
}

// ------------------------------------------------------------
// REFRESH HOOK (เรียกจาก app.js เมื่อข้อมูลการจองหรือตัวเลือกเปลี่ยน)
// ------------------------------------------------------------
function refreshVenueViews() {
  renderAnnouncementBar();
  renderLastBookingBar();
  if (typeof renderMultiDayPanel === 'function') renderMultiDayPanel();
  if (isPageVisible('pageCancel') && typeof renderCancelPage === 'function') renderCancelPage();
  if (isPageVisible('pageVenues')) renderVenuesPage();
  if (isPageVisible('pageVenueDetail')) renderVenueDetail();
  if (isPageVisible('pageSearch')) {
    fillRoomSelectOptions(document.getElementById('srRoom'), false);
    if (document.getElementById('stResults').innerHTML.trim() && searchActiveTab === 'time') runTimeSearch();
    if (document.getElementById('srResults').innerHTML.trim() && searchActiveTab === 'room') runRoomSearch();
  }
  if (state.isAdmin && state.adminSection === 'options') renderAdminAnnouncements();
}

document.addEventListener('DOMContentLoaded', () => {
  refreshVenueViews();
  // อัปเดตสถานะ "ว่างตอนนี้ / ใช้งานอยู่" และเส้นเวลาปัจจุบันทุก 1 นาที
  setInterval(() => {
    renderAnnouncementBar();
    if (isPageVisible('pageVenues')) renderVenuesPage();
    if (isPageVisible('pageVenueDetail')) renderVenueDetail();
    if (isPageVisible('pageCalendar') && state.calViewMode === 'timeline') renderCalendarTimeline();
  }, 60000);
});
