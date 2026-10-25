// ============================================================
// หน้าแรก + หน้าตาเว็บแบบใหม่
// - Hero: รูปสถานที่สลับ (ค่อย ๆ ซูม + จาง)
// - แถบเมนูบน: โปร่งใสทับรูปหน้าแรก เลื่อนลงเป็นสีน้ำเงิน, มือถือเป็นเมนู ☰
// - Live Board: ตารางใช้สถานที่วันนี้ / พรุ่งนี้ / 7 วัน แบบเรียลไทม์
// - อนิเมชันตอนเลื่อนมาเจอ (.reveal) และตัวเลขนับขึ้น
// ต้องโหลดหลัง app.js และ venues.js
// ============================================================

const HERO_IMAGES = [2, 1, 3, 4, 5, 6, 7].map(n => `images/places/place-${n}.jpg`);
const HERO_INTERVAL_MS = 6500;
const REDUCED_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let heroIndex = 0;
let heroTimer = null;
let liveRange = 'today';
let revealObserver = null;
let currentPageName = 'home';

// ------------------------------------------------------------
// HERO SLIDESHOW
// ------------------------------------------------------------
function initHeroSlides() {
  const wrap = document.getElementById('heroSlides');
  const dots = document.getElementById('heroDots');
  if (!wrap || !dots) return;
  wrap.innerHTML = HERO_IMAGES.map((src, i) =>
    `<div class="hero-slide ${i === 0 ? 'active' : ''}" style="background-image:url('${src}')"></div>`
  ).join('');
  dots.innerHTML = HERO_IMAGES.map((_, i) =>
    `<button type="button" class="hero-dot ${i === 0 ? 'active' : ''}" onclick="goHeroSlide(${i}, true)" aria-label="รูปที่ ${i + 1}"><i></i></button>`
  ).join('');
  startHeroTimer();
}

function goHeroSlide(i, manual = false) {
  const slides = document.querySelectorAll('.hero-slide');
  const dots = document.querySelectorAll('.hero-dot');
  if (!slides.length) return;
  const prevIndex = heroIndex;
  heroIndex = (i + slides.length) % slides.length;
  if (heroIndex === prevIndex) return;
  // รูปเดิมค้างไว้ด้านหลัง (prev) ขณะรูปใหม่ค่อย ๆ เปิดขึ้นจากด้านล่างของกรอบโค้ง
  slides.forEach((s, k) => {
    s.classList.toggle('prev', k === prevIndex);
    s.classList.toggle('active', k === heroIndex);
  });
  dots.forEach((d, k) => {
    d.classList.remove('active');
    if (k === heroIndex) { void d.offsetWidth; d.classList.add('active'); } // เริ่มแถบเวลาใหม่
  });
  if (manual) startHeroTimer();
}

function startHeroTimer() {
  clearInterval(heroTimer);
  if (REDUCED_MOTION) return;
  heroTimer = setInterval(() => {
    if (currentPageName === 'home' && !document.hidden) goHeroSlide(heroIndex + 1);
  }, HERO_INTERVAL_MS);
}

// รูปแบนเนอร์หัวหน้าของหน้าอื่น ๆ (สลับรูปตามลำดับหน้า)
function initPageBanners() {
  document.querySelectorAll('.page .page-header').forEach((el, i) => {
    el.style.setProperty('--banner-img', `url('${HERO_IMAGES[(i + 1) % HERO_IMAGES.length]}')`);
  });
}

// ------------------------------------------------------------
// TOP BAR + เมนู
// ------------------------------------------------------------
function updateTopbar() {
  const bar = document.getElementById('topbar');
  if (!bar) return;
  bar.classList.toggle('solid', currentPageName !== 'home' || window.scrollY > 40);
}

function toggleNav(force) {
  const open = typeof force === 'boolean' ? force : !document.body.classList.contains('nav-open');
  document.body.classList.toggle('nav-open', open);
}

function toggleNavDropdown(evt) {
  evt.stopPropagation();
  evt.currentTarget.parentElement.classList.toggle('open');
}

function closeNavDropdowns() {
  document.querySelectorAll('.nav-dropdown.open').forEach(d => d.classList.remove('open'));
}

// เรียกจาก showPage() ใน app.js ทุกครั้งที่เปลี่ยนหน้า
function onPageShown(page, navEl) {
  currentPageName = page;
  document.body.classList.toggle('is-home', page === 'home');
  toggleNav(false);
  closeNavDropdowns();

  const servicesBtn = document.getElementById('navServices');
  if (servicesBtn) servicesBtn.classList.toggle('active', Boolean(navEl && navEl.closest('.nav-drop-menu')));

  placeAnnouncementBar(page);
  window.scrollTo({ top: 0, behavior: 'auto' });
  requestAnimationFrame(updateViewportVar); // ความยาวหน้าเปลี่ยน แถบเลื่อนอาจหาย/โผล่
  updateTopbar();
  if (page === 'home') {
    renderLiveBoard();
    observeReveals();
  }
}

// แถบประกาศ: หน้าแรกอยู่ใต้การ์ดทางลัด, หน้าอื่นอยู่ใต้แบนเนอร์หัวหน้า
function placeAnnouncementBar(page) {
  const bar = document.getElementById('announceBar');
  if (!bar) return;
  if (page === 'home') {
    const slot = document.getElementById('homeAnnounceSlot');
    if (slot && bar.parentElement !== slot) slot.appendChild(bar);
    return;
  }
  const visible = document.querySelector('.page:not(.hidden)');
  if (!visible) return;
  const header = visible.querySelector(':scope > .page-header');
  if (header) header.after(bar);
  else visible.prepend(bar);
}

function scrollToLiveBoard() {
  const el = document.getElementById('liveBoard');
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - 84;
  window.scrollTo({ top, behavior: 'smooth' });
}

// ------------------------------------------------------------
// อนิเมชันตอนเลื่อนมาเจอ
// ------------------------------------------------------------
function observeReveals() {
  const els = document.querySelectorAll('.reveal:not(.in), .home-steps:not(.in)');
  if (!('IntersectionObserver' in window) || REDUCED_MOTION) {
    els.forEach(el => el.classList.add('in'));
    return;
  }
  if (!revealObserver) {
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        revealObserver.unobserve(e.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  }
  els.forEach(el => revealObserver.observe(el));
}

function countUp(el, target) {
  if (!el) return;
  const from = Number(el.dataset.value || 0);
  el.dataset.value = String(target);
  if (REDUCED_MOTION || from === target) { el.textContent = target; return; }
  const start = performance.now();
  const dur = 900;
  const step = now => {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(from + (target - from) * eased);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  // กันกรณีเบราว์เซอร์หยุด requestAnimationFrame (แท็บอยู่เบื้องหลัง) ให้ได้ตัวเลขสุดท้ายเสมอ
  setTimeout(() => { if (el.dataset.value === String(target)) el.textContent = target; }, dur + 150);
}

// ------------------------------------------------------------
// LIVE BOARD
// ------------------------------------------------------------
function setLiveRange(range) {
  liveRange = range;
  document.querySelectorAll('.lb-tab').forEach(t => t.classList.toggle('active', t.dataset.range === range));
  moveTabGlider();
  renderLiveBoard(true);
}

function moveTabGlider() {
  const active = document.querySelector('.lb-tab.active');
  const glider = document.querySelector('.lb-tab-glider');
  if (!active || !glider) return;
  glider.style.width = `${active.offsetWidth}px`;
  glider.style.transform = `translateX(${active.offsetLeft - 4}px)`;
}

function durationText(min) {
  if (min < 60) return `${min} นาที`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} ชม. ${m} นาที` : `${h} ชม.`;
}

function liveItemHtml(b, i, isToday) {
  const s = timeToMin(b.startTime), e = timeToMin(b.endTime);
  const now = nowMinutes();
  let state = 'upcoming', badge = '';
  let progress = '';
  if (isToday && s !== null && e !== null) {
    if (now >= s && now < e) {
      state = 'live';
      const pct = Math.round(((now - s) / (e - s)) * 100);
      badge = `<span class="lb-pill live"><span class="live-dot"></span>กำลังใช้งาน · เหลือ ${durationText(e - now)}</span>`;
      progress = `<div class="lb-progress"><i style="width:${pct}%"></i></div>`;
    } else if (now >= e) {
      state = 'done';
      badge = '<span class="lb-pill done">เสร็จแล้ว</span>';
    } else {
      badge = `<span class="lb-pill soon">อีก ${durationText(s - now)}</span>`;
    }
  }
  const who = [b.fullName, b.grade].filter(Boolean).join(' · ');
  return `
    <button type="button" class="lb-item ${state}" style="--i:${i}" onclick="viewBookingDetail('${escapeHtml(String(b.id))}')">
      <div class="lb-time"><b>${escapeHtml(b.startTime)}</b><small>${escapeHtml(b.endTime)}</small></div>
      <div class="lb-rail"><span></span></div>
      <div class="lb-body">
        <div class="lb-room">📍 ${escapeHtml(b.room)}</div>
        <div class="lb-purpose">${escapeHtml(b.purpose || '–')}</div>
        <div class="lb-who">👤 ${escapeHtml(who)}${b.studentCount ? ` · ${escapeHtml(b.studentCount)} คน` : ''}</div>
        ${progress}
      </div>
      <div class="lb-side">${badge}</div>
    </button>
  `;
}

function renderLiveBoard(animateList = false) {
  const list = document.getElementById('lbList');
  if (!list) return;
  const options = getFormOptions();
  const today = todayStr();
  const now = nowMinutes();
  const todayBookings = getActiveBookingsOn(today).sort((a, b) => a.startTime.localeCompare(b.startTime));

  // ตัวเลขสถิติ (นับเฉพาะห้องประชุม/สถานที่ ไม่รวมห้องเรียนรายห้อง)
  const venues = getAllRoomEntries(options).filter(e => !e.isClassroom).map(e => e.key);
  const liveNow = todayBookings.filter(b => timeToMin(b.startTime) <= now && now < timeToMin(b.endTime));
  const busyRooms = new Set(liveNow.flatMap(b => getRoomsList(b)));
  const closedToday = getAllRoomEntries(options).map(e => e.key).filter(k => isRoomClosedOn(k, today, options));
  const freeNow = venues.filter(v => !isRoomClosedOn(v, today, options) && ![...busyRooms].some(r => roomNamesOverlap(v, r)));

  countUp(document.getElementById('lbStatToday'), todayBookings.length);
  countUp(document.getElementById('lbStatNow'), liveNow.length);
  countUp(document.getElementById('lbStatFree'), freeNow.length);
  countUp(document.getElementById('lbStatClosed'), closedToday.length);
  countUp(document.getElementById('heroNowCount'), liveNow.length);
  countUp(document.getElementById('heroTodayCount'), todayBookings.length);

  const d = parseDateStr(today);
  const dateEl = document.getElementById('lbDate');
  if (dateEl) dateEl.textContent = `${THAI_DAYS[d.getDay()]} ${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;

  const pill = document.getElementById('heroLiveText');
  if (pill) {
    pill.textContent = todayBookings.length
      ? `วันนี้มีการจอง ${todayBookings.length} รายการ · กำลังใช้งาน ${liveNow.length} รายการ`
      : 'วันนี้ยังไม่มีการจอง · ทุกสถานที่พร้อมให้บริการ';
  }

  // รายการตามแท็บ
  let html = '';
  const closedNote = closedToday.length && liveRange === 'today'
    ? `<div class="lb-closed-note">🔒 ปิดให้จองวันนี้: ${escapeHtml(closedToday.slice(0, 6).join(', '))}${closedToday.length > 6 ? ` และอีก ${closedToday.length - 6}` : ''}</div>`
    : '';

  if (liveRange === 'week') {
    let shown = 0, total = 0, i = 0;
    for (let k = 0; k < 7; k++) {
      const date = addDaysStr(today, k);
      const items = getActiveBookingsOn(date).sort((a, b) => a.startTime.localeCompare(b.startTime));
      total += items.length;
      if (!items.length || shown >= 24) continue;
      const take = items.slice(0, 24 - shown);
      shown += take.length;
      html += `<div class="lb-day" style="--i:${i++}">${escapeHtml(fmtDay(date, true))}${k === 0 ? ' <em>วันนี้</em>' : ''}<span>${items.length} รายการ</span></div>`;
      html += take.map(b => liveItemHtml(b, i++, k === 0)).join('');
    }
    if (total > shown) html += `<div class="lb-more">และอีก ${total - shown} รายการ — ดูทั้งหมดในปฏิทินการจอง</div>`;
  } else {
    const date = liveRange === 'today' ? today : addDaysStr(today, 1);
    const items = liveRange === 'today' ? todayBookings : getActiveBookingsOn(date).sort((a, b) => a.startTime.localeCompare(b.startTime));
    html = items.map((b, i) => liveItemHtml(b, i, liveRange === 'today')).join('');
  }

  if (!html) {
    const label = { today: 'วันนี้', tomorrow: 'พรุ่งนี้', week: 'ใน 7 วันข้างหน้า' }[liveRange];
    html = `
      <div class="lb-empty">
        <div class="lb-empty-icon">🎉</div>
        <strong>ยังไม่มีการจอง${label}</strong>
        <span>ทุกสถานที่ว่าง พร้อมให้บริการ</span>
        <button type="button" class="btn-hero primary sm" onclick="showPage('booking')">📝 จองสถานที่</button>
      </div>`;
  }

  list.classList.toggle('animate', animateList || !list.dataset.rendered);
  list.dataset.rendered = '1';
  list.innerHTML = closedNote + html;
  moveTabGlider();
}

function tickClock() {
  const n = new Date();
  const p = x => String(x).padStart(2, '0');
  const el = document.getElementById('lbClock');
  if (el) el.textContent = `${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`;
  const heroClock = document.getElementById('heroClock');
  if (heroClock) heroClock.textContent = `${p(n.getHours())}:${p(n.getMinutes())} น.`;
  const heroDate = document.getElementById('heroDate');
  if (heroDate) heroDate.textContent = `${THAI_DAYS[n.getDay()]} ${n.getDate()} ${THAI_MONTHS[n.getMonth()]}`;
}

// ------------------------------------------------------------
// INIT
// ------------------------------------------------------------
// ความกว้างจอจริงไม่รวมแถบเลื่อน (100vw รวมแถบเลื่อน ทำให้ส่วนเต็มจอล้นแนวนอน)
function updateViewportVar() {
  document.documentElement.style.setProperty('--vw', `${document.documentElement.clientWidth}px`);
}

document.addEventListener('DOMContentLoaded', () => {
  updateViewportVar();
  window.addEventListener('resize', updateViewportVar);
  initHeroSlides();
  initPageBanners();
  window.addEventListener('scroll', updateTopbar, { passive: true });
  window.addEventListener('resize', moveTabGlider);
  document.addEventListener('click', closeNavDropdowns);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { toggleNav(false); closeNavDropdowns(); } });

  tickClock();
  setInterval(tickClock, 1000);
  // สถานะ "กำลังใช้งาน / อีก X นาที" เปลี่ยนตามเวลา
  setInterval(() => { if (currentPageName === 'home' && !document.hidden) renderLiveBoard(); }, 30000);

  showPage('home');
});
