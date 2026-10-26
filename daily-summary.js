// ============================================================
// สรุปการจองรายวันเป็นรูปภาพ (หน้าปฏิทิน: ขยายเต็ม / รายการจอง)
// วาดด้วย Canvas เอง (ไม่ใช้ html2canvas) เพื่อให้สระ/วรรณยุกต์ภาษาไทยวางถูกตำแหน่ง
// คอลัมน์เหมือนรายงาน export: ลำดับ · ชื่อผู้จอง · ห้อง · วัตถุประสงค์ · จำนวน · กลุ่มผู้ใช้ · เวลา
// ============================================================

let dsDate = '';
let dsBlobUrl = null;
let dsBlob = null;

const DS = {
  width: 1240,
  pad: 48,
  font: "'IBM Plex Sans Thai', 'Prompt', 'Noto Sans Thai', sans-serif",
  head: "'Prompt', 'IBM Plex Sans Thai', 'Noto Sans Thai', sans-serif",
  ink: '#0f1d42',
  muted: '#64748b',
  line: '#e2e8f0',
  // [หัวคอลัมน์, ความกว้าง (0 = ที่เหลือ), จัดวาง]
  cols: [
    ['ลำดับ', 70, 'center'],
    ['ชื่อผู้จอง', 210, 'left'],
    ['ห้อง / สถานที่', 190, 'left'],
    ['วัตถุประสงค์', 0, 'left'],
    ['จำนวน', 80, 'center'],
    ['กลุ่มผู้ใช้', 140, 'left'],
    ['เวลา', 164, 'center'],
  ],
};

function openDailySummary() {
  const today = toDateStr(new Date());
  // เริ่มที่วันที่กำลังดูในมุมมองรายการ ถ้าไม่ได้เลือกวัน ใช้วันนี้
  dsDate = state.calListSelectedDate || today;
  const input = document.getElementById('dsDateInput');
  if (input) input.value = dsDate;
  document.getElementById('dailySummaryModal').classList.remove('hidden');
  renderDailySummary();
}

function closeDailySummary() {
  document.getElementById('dailySummaryModal').classList.add('hidden');
}

function shiftDailySummary(days) {
  const d = new Date(`${dsDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  dsDate = toDateStr(d);
  document.getElementById('dsDateInput').value = dsDate;
  renderDailySummary();
}

function onDailySummaryDateChange(val) {
  if (!val) return;
  dsDate = val;
  renderDailySummary();
}

async function renderDailySummary() {
  const preview = document.getElementById('dsPreview');
  const btnDl = document.getElementById('btnDsDownload');
  const btnShare = document.getElementById('btnDsShare');
  preview.innerHTML = '<div class="ds-loading">⏳ กำลังสร้างรูปสรุป...</div>';
  btnDl.disabled = true;
  if (btnShare) btnShare.classList.add('hidden');

  const date = dsDate;
  const items = getBookings()
    .filter(b => b.bookingDate === date && b.status === 'approved')
    .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

  try {
    if (document.fonts && document.fonts.load) {
      await Promise.all([
        document.fonts.load(`600 30px ${DS.head}`),
        document.fonts.load(`400 18px ${DS.font}`),
        document.fonts.load(`600 18px ${DS.font}`),
      ]);
    }
    let logo = await dsLoadImage('logo รร ดี.png');
    let canvas = drawDailySummary(date, items, logo);
    let blob = await dsCanvasToBlob(canvas);
    // เปิดไฟล์จากเครื่อง (file://) รูปโลโก้ทำให้ส่งออกไม่ได้ → วาดใหม่โดยไม่ใส่โลโก้
    if (!blob && logo) {
      canvas = drawDailySummary(date, items, null);
      blob = await dsCanvasToBlob(canvas);
    }
    if (date !== dsDate) return; // ผู้ใช้เปลี่ยนวันระหว่างวาด
    if (!blob) throw new Error('export failed');

    if (dsBlobUrl) URL.revokeObjectURL(dsBlobUrl);
    dsBlob = blob;
    dsBlobUrl = URL.createObjectURL(blob);
    preview.innerHTML = `<img src="${dsBlobUrl}" alt="สรุปการจองวันที่ ${escapeHtml(formatDateThai(date))}" />`;
    btnDl.disabled = false;
    if (btnShare && dsCanShareFile()) btnShare.classList.remove('hidden');
  } catch (err) {
    console.warn('Daily summary error:', err);
    preview.innerHTML = '<div class="ds-loading">⚠️ สร้างรูปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</div>';
  }
}

function dsFileName() {
  return `สรุปการจองสถานที่_${dsDate}.png`;
}

function downloadDailySummary() {
  if (!dsBlobUrl) return;
  const a = document.createElement('a');
  a.href = dsBlobUrl;
  a.download = dsFileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  showToast('ดาวน์โหลดรูปสรุปแล้ว 🖼️', 'success');
}

function dsCanShareFile() {
  if (!dsBlob || !navigator.canShare) return false;
  try {
    return navigator.canShare({ files: [new File([dsBlob], dsFileName(), { type: 'image/png' })] });
  } catch {
    return false;
  }
}

async function shareDailySummary() {
  if (!dsBlob) return;
  try {
    await navigator.share({
      files: [new File([dsBlob], dsFileName(), { type: 'image/png' })],
      title: `สรุปการจองสถานที่ ${formatDateThai(dsDate)}`,
    });
  } catch (err) {
    if (err && err.name !== 'AbortError') showToast('แชร์ไม่สำเร็จ ลองกดดาวน์โหลดแทน', 'warning');
  }
}

function dsLoadImage(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function dsCanvasToBlob(canvas) {
  return new Promise(resolve => {
    try {
      canvas.toBlob(b => resolve(b), 'image/png');
    } catch {
      resolve(null);
    }
  });
}

// ตัดข้อความเป็นบรรทัดตามความกว้าง (ภาษาไทยไม่มีเว้นวรรค จึงตัดตามคำด้วย Intl.Segmenter)
function dsWrap(ctx, text, maxWidth) {
  const str = String(text || '–').replace(/\s+/g, ' ').trim() || '–';
  let parts;
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    parts = [...new Intl.Segmenter('th', { granularity: 'word' }).segment(str)].map(s => s.segment);
  } else {
    parts = str.split(/(\s+)/);
  }
  const lines = [];
  let line = '';
  parts.forEach(part => {
    const test = line + part;
    if (ctx.measureText(test).width <= maxWidth || !line) {
      line = test;
      // คำเดียวยาวเกินช่อง: ตัดเป็นตัวอักษร
      while (ctx.measureText(line).width > maxWidth && line.length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && ctx.measureText(line.slice(0, cut)).width > maxWidth) cut--;
        lines.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    } else {
      lines.push(line.trimEnd());
      line = part.trimStart();
    }
  });
  if (line) lines.push(line.trimEnd());
  return lines.length ? lines : ['–'];
}

function dsRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawDailySummary(date, items, logo) {
  const { width: W, pad } = DS;
  const tableW = W - pad * 2;
  const fixed = DS.cols.reduce((s, c) => s + c[1], 0);
  const widths = DS.cols.map(c => c[1] || tableW - fixed);
  const cellPadX = 12;
  const lineH = 26;
  const headerH = 168;
  const theadH = 50;

  // วัดความสูงแต่ละแถวก่อน (ต้องใช้ context จริงในการวัด)
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = `400 18px ${DS.font}`;
  const rows = items.map((b, i) => {
    const cells = [
      String(i + 1),
      b.fullName,
      b.room,
      b.purpose || '–',
      b.studentCount ? `${b.studentCount}` : '–',
      b.grade || '–',
      `${b.startTime}–${b.endTime} น.`,
    ];
    const lines = cells.map((t, c) => (c === 0 || c === 6) ? [t] : dsWrap(measure, t, widths[c] - cellPadX * 2));
    const h = Math.max(...lines.map(l => l.length)) * lineH + 24;
    return { lines, h };
  });
  const bodyH = rows.length ? rows.reduce((s, r) => s + r.h, 0) : 120;
  const H = headerH + 36 + theadH + bodyH + 96;

  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.textBaseline = 'middle';

  // พื้นหลัง
  ctx.fillStyle = '#f4f6fb';
  ctx.fillRect(0, 0, W, H);

  // หัวรายงาน: แถบน้ำเงินไล่เฉด
  const grad = ctx.createLinearGradient(0, 0, W, headerH);
  grad.addColorStop(0, '#0f1d42');
  grad.addColorStop(0.6, '#1e3a8a');
  grad.addColorStop(1, '#2563eb');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, headerH);
  ctx.fillStyle = '#f97316';
  ctx.fillRect(0, headerH - 6, W, 6);

  let textX = pad;
  if (logo) {
    const lh = 88;
    const lw = lh * (logo.naturalWidth / logo.naturalHeight || 1);
    ctx.fillStyle = '#ffffff';
    dsRoundRect(ctx, pad, 34, lw + 20, lh + 12, 18);
    ctx.fill();
    ctx.drawImage(logo, pad + 10, 40, lw, lh);
    textX = pad + lw + 44;
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 34px ${DS.head}`;
  ctx.fillText('สรุปการจองสถานที่ประจำวัน', textX, 62);
  const d = new Date(`${date}T00:00:00`);
  ctx.fillStyle = '#fdba74';
  ctx.font = `500 24px ${DS.head}`;
  ctx.fillText(`วัน${THAI_DAY_NAMES[d.getDay()]}ที่ ${formatDateThai(date)}`, textX, 104);
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  ctx.font = `400 16px ${DS.font}`;
  ctx.fillText('งานอาคารและสถานที่ ฝ่ายบริหารงานทั่วไป · โรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัย ปทุมธานี', textX, 138);

  // จำนวนรายการ (มุมขวา)
  const countText = `${items.length} รายการ`;
  ctx.font = `600 20px ${DS.head}`;
  const cw = ctx.measureText(countText).width + 40;
  ctx.fillStyle = 'rgba(255,255,255,.14)';
  dsRoundRect(ctx, W - pad - cw, 46, cw, 44, 22);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(countText, W - pad - cw / 2, 69);

  // การ์ดตาราง
  const tableY = headerH + 36;
  const tableH = theadH + bodyH;
  ctx.save();
  ctx.shadowColor = 'rgba(15, 29, 66, .10)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = '#ffffff';
  dsRoundRect(ctx, pad, tableY, tableW, tableH, 18);
  ctx.fill();
  ctx.restore();
  ctx.save();
  dsRoundRect(ctx, pad, tableY, tableW, tableH, 18);
  ctx.clip();

  // หัวตาราง
  ctx.fillStyle = '#eef2ff';
  ctx.fillRect(pad, tableY, tableW, theadH);
  ctx.font = `600 17px ${DS.head}`;
  ctx.fillStyle = DS.ink;
  let x = pad;
  DS.cols.forEach((c, i) => {
    ctx.textAlign = c[2];
    const tx = c[2] === 'center' ? x + widths[i] / 2 : x + cellPadX;
    ctx.fillText(c[0], tx, tableY + theadH / 2 + 1);
    x += widths[i];
  });

  // แถวข้อมูล
  let y = tableY + theadH;
  if (!rows.length) {
    ctx.textAlign = 'center';
    ctx.fillStyle = DS.muted;
    ctx.font = `400 20px ${DS.font}`;
    ctx.fillText('ไม่มีรายการจองสถานที่ในวันนี้', W / 2, y + bodyH / 2);
  }
  rows.forEach((r, ri) => {
    if (ri % 2) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(pad, y, tableW, r.h);
    }
    ctx.fillStyle = DS.line;
    ctx.fillRect(pad, y, tableW, 1);
    let cx = pad;
    r.lines.forEach((lines, ci) => {
      const align = DS.cols[ci][2];
      ctx.textAlign = align;
      const bold = ci === 1 || ci === 2 || ci === 6;
      ctx.font = `${bold ? 600 : 400} 18px ${DS.font}`;
      ctx.fillStyle = ci === 6 ? '#c2410c' : ci === 0 ? '#94a3b8' : DS.ink;
      const blockH = lines.length * lineH;
      const startY = y + (r.h - blockH) / 2 + lineH / 2;
      lines.forEach((ln, li) => {
        const tx = align === 'center' ? cx + widths[ci] / 2 : cx + cellPadX;
        ctx.fillText(ln, tx, startY + li * lineH);
      });
      cx += widths[ci];
    });
    y += r.h;
  });
  ctx.restore();

  // ท้ายรูป
  const now = new Date();
  ctx.textAlign = 'left';
  ctx.fillStyle = DS.muted;
  ctx.font = `400 15px ${DS.font}`;
  ctx.fillText(`ข้อมูล ณ ${formatDateThai(toDateStr(now))} เวลา ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} น. · ระบบจองสถานที่ งานอาคารและสถานที่`, pad, H - 44);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#2563eb';
  ctx.font = `600 15px ${DS.head}`;
  ctx.fillText('เฉพาะรายการที่จองอยู่ (ไม่รวมที่ยกเลิก)', W - pad, H - 44);

  return canvas;
}

window.openDailySummary = openDailySummary;
window.closeDailySummary = closeDailySummary;
window.shiftDailySummary = shiftDailySummary;
window.onDailySummaryDateChange = onDailySummaryDateChange;
window.downloadDailySummary = downloadDailySummary;
window.shareDailySummary = shareDailySummary;
