/* ============================================================
   APP.JS — ระบบจองใช้สถานที่
   โรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัย ปทุมธานี
   ============================================================ */

'use strict';

// ============================================================
// CONSTANTS
// ============================================================
const ADMIN_USER = 'admin';

const THAI_MONTHS = [
  'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน',
  'พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม',
  'กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'
];
const THAI_DAYS = ['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'];

// Classroom sub-rooms
let CLASSROOM_ROOMS = {
  '__m1': { label: 'ม.1', fullName: 'ห้องเรียน ม.1', rooms: ['101','102','103','104'] },
  '__m2': { label: 'ม.2', fullName: 'ห้องเรียน ม.2', rooms: ['201','202','203','204'] },
  '__m3': { label: 'ม.3', fullName: 'ห้องเรียน ม.3', rooms: ['301','302','303','304'] },
  '__m4': { label: 'ม.4', fullName: 'ห้องเรียน ม.4', rooms: ['401','402','403','404','405','406'] },
  '__m5': { label: 'ม.5', fullName: 'ห้องเรียน ม.5', rooms: ['501','502','503','504','505','506'] },
  '__m6': { label: 'ม.6', fullName: 'ห้องเรียน ม.6', rooms: ['601','602','603','604','605','606'] },
};

// Classroom Multi-Selection State (Set of room names, e.g. "ห้อง 301")
let selectedClassrooms = new Set();
let activeClassroomGrade = '__m1';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================
// STATE
// ============================================================

// ============================================================
// FORM OPTIONS CONFIGURATION & MANAGEMENT (Item 4)
// ============================================================
const FORM_OPTIONS_KEY = 'school_booking_form_options';

const DEFAULT_FORM_OPTIONS = {
  positions: [
    'ครู',
    'ครูผู้ช่วย',
    'พนักงานราชการ',
    'เจ้าหน้าที่'
  ],
  allowOtherPosition: true,
  departments: [
    'ฝ่ายบริหารงานวิชาการ',
    'ฝ่ายบริหารงานงบประมาณ',
    'ฝ่ายบริหารงานกิจการนักเรียนและหอพัก',
    'ฝ่ายบริหารงานทั่วไป',
    'งานบุคคล'
  ],
  venueCategories: [
    {
      id: 'meeting',
      label: '🏢 ห้องประชุม / หอประชุม',
      type: 'single',
      rooms: [
        'บรรยายรวม',
        'หอประชุม 1',
        'หอประชุม 2',
        'ห้องประชุมพระยาสุรินทร์',
        'ห้องประชุมแคแสด',
        'ห้องประชุมสุวรรณภูมิ'
      ]
    },
    {
      id: 'general',
      label: '🏟️ สถานที่อื่น ๆ',
      type: 'single',
      rooms: [
        'โรงอาหาร',
        'โรงยิมชั้น 1',
        'โรงยิมชั้น 2',
        'โดมอเนกประสงค์'
      ]
    },
    {
      id: 'classroom',
      label: '🏫 ห้องเรียน ม.1 ถึง ม.6 (เลือกหลายห้องได้)',
      type: 'classroom_grades',
      grades: {
        '__m1': { label: 'ม.1', fullName: 'ห้องเรียน ม.1', rooms: ['101','102','103','104'] },
        '__m2': { label: 'ม.2', fullName: 'ห้องเรียน ม.2', rooms: ['201','202','203','204'] },
        '__m3': { label: 'ม.3', fullName: 'ห้องเรียน ม.3', rooms: ['301','302','303','304'] },
        '__m4': { label: 'ม.4', fullName: 'ห้องเรียน ม.4', rooms: ['401','402','403','404','405','406'] },
        '__m5': { label: 'ม.5', fullName: 'ห้องเรียน ม.5', rooms: ['501','502','503','504','505','506'] },
        '__m6': { label: 'ม.6', fullName: 'ห้องเรียน ม.6', rooms: ['601','602','603','604','605','606'] }
      }
    }
  ],
  roomLayouts: [
    'โรงภาพยนตร์ (Theater)',
    'ประชุมกลุ่ม / เกาะกลุ่ม (Group Work)',
    'รูปตัว U (U-Shape)',
    'ห้องเรียน (Classroom)',
    'โต๊ะกลม (Round Table)',
    'จัดตามสภาพห้องเดิม'
  ],
  userGroups: [
    'ม.1 ทุกห้อง',
    'ม.2 ทุกห้อง',
    'ม.3 ทุกห้อง',
    'ม.4 ทุกห้อง',
    'ม.5 ทุกห้อง',
    'ม.6 ทุกห้อง',
    'คณะครูและบุคลากร',
    'นักเรียนกลุ่มกิจกรรม'
  ]
};

function getFormOptions() {
  try {
    const raw = localStorage.getItem(FORM_OPTIONS_KEY);
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT_FORM_OPTIONS));
    const parsed = JSON.parse(raw);
    return {
      positions: Array.isArray(parsed.positions) ? parsed.positions : DEFAULT_FORM_OPTIONS.positions,
      allowOtherPosition: typeof parsed.allowOtherPosition === 'boolean' ? parsed.allowOtherPosition : true,
      departments: Array.isArray(parsed.departments) ? parsed.departments : DEFAULT_FORM_OPTIONS.departments,
      venueCategories: Array.isArray(parsed.venueCategories) ? parsed.venueCategories : DEFAULT_FORM_OPTIONS.venueCategories,
      roomLayouts: Array.isArray(parsed.roomLayouts) ? parsed.roomLayouts : DEFAULT_FORM_OPTIONS.roomLayouts,
      userGroups: Array.isArray(parsed.userGroups) ? parsed.userGroups : DEFAULT_FORM_OPTIONS.userGroups,
    };
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_FORM_OPTIONS));
  }
}

function saveFormOptions(opts) {
  localStorage.setItem(FORM_OPTIONS_KEY, JSON.stringify(opts));
  refreshAllFormOptions();
}

function resetFormOptionsToDefault() {
  if (!confirm('ต้องการคืนค่าตัวเลือกหน้าจองทั้งหมดเป็นค่าเริ่มต้นใช่หรือไม่?')) return;
  saveFormOptions(DEFAULT_FORM_OPTIONS);
  renderAdminOptionsManager();
  showToast('🔄 คืนค่าตัวเลือกเริ่มต้นเรียบร้อยแล้ว', 'info');
}

function refreshAllFormOptions() {
  const options = getFormOptions();

  // 1. Populate Positions in booking form
  const posSelect = document.getElementById('position');
  if (posSelect) {
    const curVal = posSelect.value;
    let html = '<option value="">-- เลือกตำแหน่ง --</option>';
    options.positions.forEach(p => {
      html += `<option value="${escapeHtml(p)}" ${p === curVal ? 'selected' : ''}>${escapeHtml(p)}</option>`;
    });
    if (options.allowOtherPosition) {
      const isOther = curVal === 'อื่น ๆ' || curVal === 'อื่นๆ' || (curVal && !options.positions.includes(curVal));
      html += `<option value="อื่น ๆ" ${isOther ? 'selected' : ''}>อื่น ๆ (ระบุ)</option>`;
    }
    posSelect.innerHTML = html;
  }

  // 2. Populate Departments in booking form
  const deptSelect = document.getElementById('department');
  if (deptSelect) {
    const curVal = deptSelect.value;
    let html = '<option value="">-- เลือกฝ่ายงาน --</option>';
    options.departments.forEach(d => {
      html += `<option value="${escapeHtml(d)}" ${d === curVal ? 'selected' : ''}>${escapeHtml(d)}</option>`;
    });
    deptSelect.innerHTML = html;
  }

  // 3. Sync Classroom categories & rooms
  const crCategory = options.venueCategories.find(c => c.type === 'classroom_grades' || c.id === 'classroom');
  if (crCategory && crCategory.grades) {
    CLASSROOM_ROOMS = crCategory.grades;
  }

  // 4. Populate Room in booking form
  const roomSelect = document.getElementById('room');
  if (roomSelect) {
    const curVal = roomSelect.value;
    let html = '<option value="">-- เลือกห้อง/สถานที่ --</option>';
    options.venueCategories.forEach(cat => {
      if (cat.type === 'classroom_grades' && cat.grades) {
        html += `<optgroup label="${escapeHtml(cat.label)}">`;
        Object.keys(cat.grades).forEach(gKey => {
          const g = cat.grades[gKey];
          const rangeTxt = g.rooms && g.rooms.length > 0 ? `(ห้อง ${g.rooms[0]}–${g.rooms[g.rooms.length - 1]})` : '';
          html += `<option value="${escapeHtml(gKey)}" ${gKey === curVal ? 'selected' : ''}>${escapeHtml(g.fullName)} ${rangeTxt}</option>`;
        });
        html += `</optgroup>`;
      } else if (Array.isArray(cat.rooms)) {
        html += `<optgroup label="${escapeHtml(cat.label)}">`;
        cat.rooms.forEach(r => {
          html += `<option value="${escapeHtml(r)}" ${r === curVal ? 'selected' : ''}>${escapeHtml(r)}</option>`;
        });
        html += `</optgroup>`;
      }
    });
    roomSelect.innerHTML = html;
  }

  // 5. Populate Classroom Grade Tabs in selector
  const gradeTabsWrap = document.getElementById('crGradeTabs');
  if (gradeTabsWrap && crCategory && crCategory.grades) {
    const gKeys = Object.keys(crCategory.grades);
    if (!gKeys.includes(activeClassroomGrade) && gKeys.length > 0) {
      activeClassroomGrade = gKeys[0];
    }
    gradeTabsWrap.innerHTML = gKeys.map(k => `
      <button type="button" class="cr-tab ${k === activeClassroomGrade ? 'active' : ''}" data-grade="${k}" onclick="switchClassroomGrade('${k}')">
        ${escapeHtml(crCategory.grades[k].label || k)}
      </button>
    `).join('');
    renderClassroomGrid();
  }

  // 6. Populate Filter Room in Calendar
  const filterRoomSelect = document.getElementById('filterRoom');
  if (filterRoomSelect) {
    const curFilter = filterRoomSelect.value;
    let fHtml = '<option value="">ทุกห้อง / ทุกสถานที่</option>';
    options.venueCategories.forEach(cat => {
      if (cat.type === 'classroom_grades' && cat.grades) {
        Object.keys(cat.grades).forEach(gKey => {
          const g = cat.grades[gKey];
          fHtml += `<optgroup label="🏫 ${escapeHtml(g.fullName)}">`;
          (g.rooms || []).forEach(r => {
            const roomName = `ห้อง ${r}`;
            fHtml += `<option value="${escapeHtml(roomName)}" ${roomName === curFilter ? 'selected' : ''}>${escapeHtml(roomName)}</option>`;
          });
          fHtml += `</optgroup>`;
        });
      } else if (Array.isArray(cat.rooms)) {
        fHtml += `<optgroup label="${escapeHtml(cat.label)}">`;
        cat.rooms.forEach(r => {
          fHtml += `<option value="${escapeHtml(r)}" ${r === curFilter ? 'selected' : ''}>${escapeHtml(r)}</option>`;
        });
        fHtml += `</optgroup>`;
      }
    });
    filterRoomSelect.innerHTML = fHtml;
  }

  // 7. Render Layout Presets
  const layoutPresetsWrap = document.getElementById('layoutPresets');
  if (layoutPresetsWrap) {
    layoutPresetsWrap.innerHTML = (options.roomLayouts || []).map(lay => `
      <span class="preset-chip" onclick="fillPreset('roomLayout', '${escapeHtml(lay)}')" title="คลิกเพื่อเลือก">
        ${escapeHtml(lay)}
      </span>
    `).join('');
  }

  // 8. Render User Group Presets
  const userGroupPresetsWrap = document.getElementById('userGroupPresets');
  if (userGroupPresetsWrap) {
    userGroupPresetsWrap.innerHTML = (options.userGroups || []).map(grp => `
      <span class="preset-chip" onclick="fillPreset('grade', '${escapeHtml(grp)}')" title="คลิกเพื่อเลือก">
        ${escapeHtml(grp)}
      </span>
    `).join('');
  }
}

function fillPreset(fieldId, val) {
  const el = document.getElementById(fieldId);
  if (el) {
    el.value = val;
    el.focus();
  }
}

// ------------------------------------------------------------
// ADMIN: Form Options UI Handlers
// ------------------------------------------------------------
let optActiveSubTab = 'rooms';
let optActiveClassroomGrade = '__m1';

function switchOptSubTab(subTab) {
  optActiveSubTab = subTab;
  ['rooms', 'positions', 'departments', 'layouts'].forEach(t => {
    const tabBtn = document.getElementById(`optTab${t.charAt(0).toUpperCase() + t.slice(1)}`);
    const panel = document.getElementById(`optPanel${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (tabBtn) tabBtn.classList.toggle('active', t === subTab);
    if (panel) panel.classList.toggle('hidden', t !== subTab);
  });
  renderAdminOptionsManager();
}

function renderAdminOptionsManager() {
  const options = getFormOptions();

  // Subpanel: Positions
  const posCount = document.getElementById('optPositionCount');
  if (posCount) posCount.textContent = `${options.positions.length} ตำแหน่ง`;

  const posGrid = document.getElementById('optPositionsGrid');
  if (posGrid) {
    posGrid.innerHTML = options.positions.length ? options.positions.map((p, idx) => `
      <span class="opt-chip">
        <span>${escapeHtml(p)}</span>
        <button type="button" class="opt-chip-delete" onclick="deletePosition(${idx})" title="ลบตำแหน่งนี้">✕</button>
      </span>
    `).join('') : '<span style="color:#9ca3af;font-size:0.85rem;">ยังไม่มีตำแหน่งที่กำหนด</span>';
  }

  const allowOtherPosChk = document.getElementById('optAllowOtherPos');
  if (allowOtherPosChk) {
    allowOtherPosChk.checked = Boolean(options.allowOtherPosition);
  }

  // Subpanel: Departments
  const deptCount = document.getElementById('optDepartmentCount');
  if (deptCount) deptCount.textContent = `${options.departments.length} ฝ่ายงาน`;

  const deptGrid = document.getElementById('optDepartmentsGrid');
  if (deptGrid) {
    deptGrid.innerHTML = options.departments.length ? options.departments.map((d, idx) => `
      <span class="opt-chip">
        <span>${escapeHtml(d)}</span>
        <button type="button" class="opt-chip-delete" onclick="deleteDepartment(${idx})" title="ลบฝ่ายงานนี้">✕</button>
      </span>
    `).join('') : '<span style="color:#9ca3af;font-size:0.85rem;">ยังไม่มีฝ่ายงานที่กำหนด</span>';
  }

  // Subpanel: Layouts & Groups
  const layoutCount = document.getElementById('optLayoutCount');
  if (layoutCount) layoutCount.textContent = `${(options.roomLayouts || []).length} รายการ`;

  const layoutsGrid = document.getElementById('optLayoutsGrid');
  if (layoutsGrid) {
    layoutsGrid.innerHTML = (options.roomLayouts || []).length ? options.roomLayouts.map((l, idx) => `
      <span class="opt-chip">
        <span>${escapeHtml(l)}</span>
        <button type="button" class="opt-chip-delete" onclick="deleteLayoutPreset(${idx})" title="ลบตัวเลือกนี้">✕</button>
      </span>
    `).join('') : '<span style="color:#9ca3af;font-size:0.85rem;">ยังไม่มีตัวเลือก</span>';
  }

  const groupCount = document.getElementById('optGroupCount');
  if (groupCount) groupCount.textContent = `${(options.userGroups || []).length} รายการ`;

  const groupsGrid = document.getElementById('optGroupsGrid');
  if (groupsGrid) {
    groupsGrid.innerHTML = (options.userGroups || []).length ? options.userGroups.map((g, idx) => `
      <span class="opt-chip">
        <span>${escapeHtml(g)}</span>
        <button type="button" class="opt-chip-delete" onclick="deleteGroupPreset(${idx})" title="ลบตัวเลือกนี้">✕</button>
      </span>
    `).join('') : '<span style="color:#9ca3af;font-size:0.85rem;">ยังไม่มีตัวเลือก</span>';
  }

  // Subpanel: Rooms
  const roomsContainer = document.getElementById('optRoomsContainer');
  if (roomsContainer) {
    let html = '';
    options.venueCategories.forEach((cat, catIdx) => {
      if (cat.type === 'classroom_grades' && cat.grades) {
        const gradeKeys = Object.keys(cat.grades);
        if (!gradeKeys.includes(optActiveClassroomGrade) && gradeKeys.length > 0) {
          optActiveClassroomGrade = gradeKeys[0];
        }
        const curGradeData = cat.grades[optActiveClassroomGrade] || { rooms: [] };

        html += `
          <div class="opt-card">
            <div class="opt-card-header">
              <span class="opt-card-title">${escapeHtml(cat.label)} (เลือกหลายห้องพร้อมกัน)</span>
              <span class="opt-card-badge">${gradeKeys.length} ระดับชั้น</span>
            </div>
            <div class="opt-card-body">
              <div class="cr-grade-tabs" style="margin-bottom:14px;">
                ${gradeKeys.map(k => `
                  <button type="button" class="cr-tab ${k === optActiveClassroomGrade ? 'active' : ''}" onclick="switchClassroomOptGrade('${k}')">
                    ${escapeHtml(cat.grades[k].label || k)}
                  </button>
                `).join('')}
              </div>
              <div style="font-size:0.85rem;font-weight:700;color:var(--navy-800);margin-bottom:8px;">
                🏫 ห้องเรียนในระดับ ${escapeHtml(curGradeData.fullName || optActiveClassroomGrade)}:
              </div>
              <div class="opt-chips-grid">
                ${(curGradeData.rooms || []).map(r => `
                  <span class="opt-chip">
                    <span>ห้อง ${escapeHtml(r)}</span>
                    <button type="button" class="opt-chip-delete" onclick="deleteClassroomSubRoom('${optActiveClassroomGrade}', '${r}')" title="ลบห้องนี้">✕</button>
                  </span>
                `).join('')}
              </div>
              <div class="opt-add-group">
                <input type="text" id="newSubRoomInput" class="opt-add-input" placeholder="พิมพ์เลขห้อง... เช่น 105" onkeydown="if(event.key==='Enter'){event.preventDefault();addClassroomSubRoom('${optActiveClassroomGrade}');}" />
                <button type="button" class="btn-opt-add" onclick="addClassroomSubRoom('${optActiveClassroomGrade}')">➕ เพิ่มห้องย่อย</button>
              </div>
            </div>
          </div>
        `;
      } else {
        const roomList = cat.rooms || [];
        html += `
          <div class="opt-card">
            <div class="opt-card-header">
              <span class="opt-card-title">${escapeHtml(cat.label)}</span>
              <div style="display:flex;align-items:center;gap:8px;">
                <span class="opt-card-badge">${roomList.length} สถานที่</span>
                <button type="button" class="opt-chip-delete" onclick="deleteCategory(${catIdx})" title="ลบหมวดหมู่นี้ทั้งหมวด" style="width:24px;height:24px;font-size:0.85rem;">✕</button>
              </div>
            </div>
            <div class="opt-card-body">
              <div class="opt-chips-grid">
                ${roomList.length ? roomList.map((r, rIdx) => `
                  <span class="opt-chip">
                    <span>${escapeHtml(r)}</span>
                    <button type="button" class="opt-chip-delete" onclick="deleteRoom(${catIdx}, ${rIdx})" title="ลบสถานที่นี้">✕</button>
                  </span>
                `).join('') : '<span style="color:#9ca3af;font-size:0.85rem;">ยังไม่มีสถานที่ในหมวดนี้</span>'}
              </div>
              <div class="opt-add-group">
                <input type="text" id="newRoomInput_${catIdx}" class="opt-add-input" placeholder="พิมพ์ชื่อสถานที่ใหม่ในหมวดนี้..." onkeydown="if(event.key==='Enter'){event.preventDefault();addRoomToCategory(${catIdx});}" />
                <button type="button" class="btn-opt-add" onclick="addRoomToCategory(${catIdx})">➕ เพิ่มสถานที่</button>
              </div>
            </div>
          </div>
        `;
      }
    });

    // Add Category Card
    html += `
      <div class="opt-card" style="border:1.5px dashed var(--orange-300);background:var(--orange-50);">
        <div class="opt-card-header" style="background:transparent;border-bottom:none;">
          <span class="opt-card-title" style="color:var(--orange-900);">➕ เพิ่มหมวดหมู่สถานที่ใหม่</span>
        </div>
        <div class="opt-card-body" style="padding-top:0;">
          <div class="opt-add-group" style="max-width:500px;">
            <input type="text" id="newCategoryLabelInput" class="opt-add-input" placeholder="เช่น 🏢 ห้องปฏิบัติการคอมพิวเตอร์" onkeydown="if(event.key==='Enter'){event.preventDefault();addNewCategory();}" />
            <button type="button" class="btn-opt-add" onclick="addNewCategory()">➕ สร้างหมวดหมู่</button>
          </div>
        </div>
      </div>
    `;

    roomsContainer.innerHTML = html;
  }
}

function switchClassroomOptGrade(gradeKey) {
  optActiveClassroomGrade = gradeKey;
  renderAdminOptionsManager();
}

function addNewPosition() {
  const input = document.getElementById('newPositionInput');
  const val = input ? input.value.trim() : '';
  if (!val) { showToast('กรุณากรอกชื่อตำแหน่ง', 'error'); return; }
  const options = getFormOptions();
  if (options.positions.includes(val)) { showToast('มีตำแหน่งนี้อยู่ในรายการแล้ว', 'error'); return; }
  options.positions.push(val);
  saveFormOptions(options);
  if (input) input.value = '';
  renderAdminOptionsManager();
  showToast(`✅ เพิ่มตำแหน่ง "${val}" เรียบร้อย`, 'success');
}

function deletePosition(idx) {
  const options = getFormOptions();
  const removed = options.positions.splice(idx, 1);
  saveFormOptions(options);
  renderAdminOptionsManager();
  showToast(`🗑️ ลบตำแหน่ง "${removed[0]}" เรียบร้อย`, 'info');
}

function toggleAllowOtherPosSetting(val) {
  const options = getFormOptions();
  options.allowOtherPosition = Boolean(val);
  saveFormOptions(options);
  showToast('💾 บันทึกการตั้งค่าตัวเลือก อื่นๆ เรียบร้อย', 'success');
}

function addNewDepartment() {
  const input = document.getElementById('newDepartmentInput');
  const val = input ? input.value.trim() : '';
  if (!val) { showToast('กรุณากรอกชื่อฝ่ายงาน', 'error'); return; }
  const options = getFormOptions();
  if (options.departments.includes(val)) { showToast('มีฝ่ายงานนี้อยู่ในรายการแล้ว', 'error'); return; }
  options.departments.push(val);
  saveFormOptions(options);
  if (input) input.value = '';
  renderAdminOptionsManager();
  showToast(`✅ เพิ่มฝ่ายงาน "${val}" เรียบร้อย`, 'success');
}

function deleteDepartment(idx) {
  const options = getFormOptions();
  const removed = options.departments.splice(idx, 1);
  saveFormOptions(options);
  renderAdminOptionsManager();
  showToast(`🗑️ ลบฝ่ายงาน "${removed[0]}" เรียบร้อย`, 'info');
}

function addRoomToCategory(catIdx) {
  const input = document.getElementById(`newRoomInput_${catIdx}`);
  const val = input ? input.value.trim() : '';
  if (!val) { showToast('กรุณากรอกชื่อสถานที่/ห้อง', 'error'); return; }
  const options = getFormOptions();
  if (!options.venueCategories[catIdx]) return;
  const rooms = options.venueCategories[catIdx].rooms || [];
  if (rooms.includes(val)) { showToast('มีสถานที่นี้อยู่ในหมวดหมู่นี้แล้ว', 'error'); return; }
  rooms.push(val);
  options.venueCategories[catIdx].rooms = rooms;
  saveFormOptions(options);
  if (input) input.value = '';
  renderAdminOptionsManager();
  showToast(`✅ เพิ่มสถานที่ "${val}" เรียบร้อย`, 'success');
}

function deleteRoom(catIdx, roomIdx) {
  const options = getFormOptions();
  if (!options.venueCategories[catIdx]) return;
  const removed = options.venueCategories[catIdx].rooms.splice(roomIdx, 1);
  saveFormOptions(options);
  renderAdminOptionsManager();
  showToast(`🗑️ ลบสถานที่ "${removed[0]}" เรียบร้อย`, 'info');
}

function addNewCategory() {
  const input = document.getElementById('newCategoryLabelInput');
  const val = input ? input.value.trim() : '';
  if (!val) { showToast('กรุณากรอกชื่อหมวดหมู่', 'error'); return; }
  const options = getFormOptions();
  const newCat = {
    id: `custom_${Date.now()}`,
    label: val,
    type: 'single',
    rooms: []
  };
  options.venueCategories.push(newCat);
  saveFormOptions(options);
  if (input) input.value = '';
  renderAdminOptionsManager();
  showToast(`✅ สร้างหมวดหมู่ "${val}" เรียบร้อย`, 'success');
}

function deleteCategory(catIdx) {
  const options = getFormOptions();
  if (!options.venueCategories[catIdx]) return;
  const label = options.venueCategories[catIdx].label;
  if (!confirm(`ต้องการลบหมวดหมู่ "${label}" และสถานที่ทั้งหมดในหมวดหมู่นี้ใช่หรือไม่?`)) return;
  options.venueCategories.splice(catIdx, 1);
  saveFormOptions(options);
  renderAdminOptionsManager();
  showToast(`🗑️ ลบหมวดหมู่ "${label}" เรียบร้อย`, 'info');
}

function addClassroomSubRoom(gradeKey) {
  const input = document.getElementById('newSubRoomInput');
  const val = input ? input.value.trim() : '';
  if (!val) { showToast('กรุณากรอกเลขห้องเรียน', 'error'); return; }
  const options = getFormOptions();
  const crCat = options.venueCategories.find(c => c.type === 'classroom_grades');
  if (!crCat || !crCat.grades || !crCat.grades[gradeKey]) return;
  const rList = crCat.grades[gradeKey].rooms || [];
  if (rList.includes(val)) { showToast('มีเลขห้องนี้อยู่ในระดับนี้แล้ว', 'error'); return; }
  rList.push(val);
  rList.sort((a, b) => parseInt(a) - parseInt(b));
  crCat.grades[gradeKey].rooms = rList;
  saveFormOptions(options);
  if (input) input.value = '';
  renderAdminOptionsManager();
  showToast(`✅ เพิ่มห้อง ${val} เรียบร้อย`, 'success');
}

function deleteClassroomSubRoom(gradeKey, roomNum) {
  const options = getFormOptions();
  const crCat = options.venueCategories.find(c => c.type === 'classroom_grades');
  if (!crCat || !crCat.grades || !crCat.grades[gradeKey]) return;
  crCat.grades[gradeKey].rooms = (crCat.grades[gradeKey].rooms || []).filter(r => r !== roomNum);
  saveFormOptions(options);
  renderAdminOptionsManager();
  showToast(`🗑️ ลบห้อง ${roomNum} เรียบร้อย`, 'info');
}

function addNewLayoutPreset() {
  const input = document.getElementById('newLayoutInput');
  const val = input ? input.value.trim() : '';
  if (!val) { showToast('กรุณากรอกชื่อรูปแบบห้อง', 'error'); return; }
  const options = getFormOptions();
  options.roomLayouts = options.roomLayouts || [];
  if (options.roomLayouts.includes(val)) { showToast('มีตัวเลือกนี้อยู่แล้ว', 'error'); return; }
  options.roomLayouts.push(val);
  saveFormOptions(options);
  if (input) input.value = '';
  renderAdminOptionsManager();
  showToast(`✅ เพิ่มตัวเลือกรูปแบบห้องเรียบร้อย`, 'success');
}

function deleteLayoutPreset(idx) {
  const options = getFormOptions();
  options.roomLayouts.splice(idx, 1);
  saveFormOptions(options);
  renderAdminOptionsManager();
  showToast('🗑️ ลบตัวเลือกเรียบร้อย', 'info');
}

function addNewGroupPreset() {
  const input = document.getElementById('newGroupInput');
  const val = input ? input.value.trim() : '';
  if (!val) { showToast('กรุณากรอกชื่อกลุ่มผู้ใช้', 'error'); return; }
  const options = getFormOptions();
  options.userGroups = options.userGroups || [];
  if (options.userGroups.includes(val)) { showToast('มีตัวเลือกนี้อยู่แล้ว', 'error'); return; }
  options.userGroups.push(val);
  saveFormOptions(options);
  if (input) input.value = '';
  renderAdminOptionsManager();
  showToast(`✅ เพิ่มตัวเลือกกลุ่มผู้ใช้เรียบร้อย`, 'success');
}

function deleteGroupPreset(idx) {
  const options = getFormOptions();
  options.userGroups.splice(idx, 1);
  saveFormOptions(options);
  renderAdminOptionsManager();
  showToast('🗑️ ลบตัวเลือกเรียบร้อย', 'info');
}

function saveAdminOptions() {
  const options = getFormOptions();
  saveFormOptions(options);
  showToast('💾 บันทึกการตั้งค่าตัวเลือกหน้าจองทั้งหมดเรียบร้อยแล้ว', 'success');
}

let state = {
  isAdmin:         false,
  calYear:         new Date().getFullYear(),
  calMonth:        new Date().getMonth(),
  calViewMode:     'scroll',
  optSubTab:       'rooms',
  adminTab:        'approved',
  adminSection:    'manage',
  managePeriodType: 'all',
  currentDetailId: null,
  editingId:       null,
  lastBookingId:   null,
};

// ============================================================
// DATA STORAGE (LocalStorage + Google Sheets Sync)
// ============================================================
let cachedBookings = null;

function getBookings() {
  if (cachedBookings !== null) {
    return cachedBookings;
  }
  try {
    const list = JSON.parse(localStorage.getItem('pccpl_bookings') || '[]');
    cachedBookings = list;
    return list;
  } catch {
    cachedBookings = [];
    return [];
  }
}

function saveBookings(arr) {
  cachedBookings = arr;
  localStorage.setItem('pccpl_bookings', JSON.stringify(arr));
}

// Deleted IDs Tracking (ป้องกันการซิงค์ข้อมูลที่เพิ่งลบกลับคืนมา)
function getDeletedIds() {
  try {
    const list = JSON.parse(localStorage.getItem('pccpl_deleted_ids') || '[]');
    return new Set(Array.isArray(list) ? list.map(id => String(id !== null && id !== undefined ? id : '').trim()).filter(Boolean) : []);
  } catch {
    return new Set();
  }
}

function addDeletedIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return;
  const set = getDeletedIds();
  ids.forEach(id => {
    const s = String(id !== null && id !== undefined ? id : '').trim();
    if (s) set.add(s);
  });
  localStorage.setItem('pccpl_deleted_ids', JSON.stringify([...set]));
}

function removeDeletedId(id) {
  const set = getDeletedIds();
  const s = String(id !== null && id !== undefined ? id : '').trim();
  if (set.has(s)) {
    set.delete(s);
    localStorage.setItem('pccpl_deleted_ids', JSON.stringify([...set]));
  }
}

function clearDeletedIds() {
  localStorage.removeItem('pccpl_deleted_ids');
}

function getNextId() {
  const b = getBookings();
  return b.length === 0 ? 1 : Math.max(...b.map(x => Number(x.id) || 0)) + 1;
}

function getAdminPass() {
  return localStorage.getItem('pccpl_admin_pass') || 'admin1234';
}

function setAdminPass(p) {
  localStorage.setItem('pccpl_admin_pass', p);
}

// Effective Google Sheets URL resolver (uses config or direct fallback)
const HARDCODED_GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyMLwIsaxhf0y7t62H2mBzmJvVqM15NUr_d4oJDtZ5n1ZWhz1Q0EI14QTove0X-gS0LjQ/exec";

function getActiveGoogleScriptUrl() {
  if (typeof GOOGLE_SCRIPT_URL !== 'undefined' && typeof GOOGLE_SCRIPT_URL === 'string' && GOOGLE_SCRIPT_URL.trim().startsWith('https://script.google.com/macros/s/')) {
    return GOOGLE_SCRIPT_URL.trim();
  }
  return HARDCODED_GOOGLE_SCRIPT_URL;
}

function checkIsSupabaseActive() {
  return Boolean(
    typeof supabaseClient !== 'undefined' &&
    supabaseClient !== null &&
    typeof isSupabaseConfigured !== 'undefined' &&
    isSupabaseConfigured
  );
}

function checkIsGoogleSheetsConfigured() {
  if (checkIsSupabaseActive()) return true;
  const url = getActiveGoogleScriptUrl();
  return Boolean(url && url.startsWith('https://script.google.com/macros/s/') && !url.includes('YOUR_SCRIPT_ID'));
}

// ตรวจสอบสถานะและความพร้อมของระบบคลาวด์
async function checkGoogleAppsScriptHealth() {
  if (checkIsSupabaseActive()) {
    return { online: true, version: 'supabase-v2', supportsClear: true };
  }
  if (!checkIsGoogleSheetsConfigured()) return { online: false, reason: 'unconfigured' };
  const scriptUrl = getActiveGoogleScriptUrl();
  try {
    const res = await fetch(`${scriptUrl}?action=ping&_t=${Date.now()}`);
    const data = await res.json();
    if (data && data.success && Array.isArray(data.features) && data.features.includes('clear')) {
      return { online: true, version: data.version || '2.1.0', supportsClear: true };
    }
    return { online: true, supportsClear: false, reason: 'old_version' };
  } catch (err) {
    return { online: false, error: err.message };
  }
}

// Cloud Status Visual Tag Update
function updateCloudStatusBadge(status, text) {
  const badgeEls = document.querySelectorAll('.cloud-status-tag');
  badgeEls.forEach(badge => {
    badge.className = 'cloud-status-tag ' + (status === true ? 'online' : (status === 'syncing' ? 'syncing' : 'offline'));
    badge.innerHTML = (status === true ? '🟢 ' : (status === 'syncing' ? '⏳ ' : '🟠 ')) + text;
  });
}

// Supabase Realtime Listener Flag
let isRealtimeSubscribed = false;
function initSupabaseRealtime() {
  if (isRealtimeSubscribed || !checkIsSupabaseActive()) return;
  try {
    supabaseClient
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, (payload) => {
        console.log('⚡ [Supabase Realtime] Booking change detected:', payload.eventType);
        fetchGoogleSheetsBookings(true);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ [Supabase Realtime] Subscribed successfully!');
          isRealtimeSubscribed = true;
        }
      });
  } catch (err) {
    console.warn('Realtime init error:', err);
  }
}

// Cloud API Sync (Supabase เป็นหลัก, fallback Google Sheets)
async function fetchGoogleSheetsBookings(silent = false) {
  // 1. กรณีใช้ Supabase
  if (checkIsSupabaseActive()) {
    try {
      if (!silent) updateCloudStatusBadge('syncing', 'กำลังดึงข้อมูลจาก Supabase...');
      initSupabaseRealtime();

      const { data, error } = await supabaseClient
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (Array.isArray(data)) {
        if (!silent) console.log(`✅ Loaded ${data.length} bookings from Supabase!`);

        const effectiveBookings = data.map(row => {
          let roomsArr = [];
          try {
            if (Array.isArray(row.rooms)) {
              roomsArr = row.rooms;
            } else if (typeof row.rooms === 'string' && row.rooms.trim()) {
              roomsArr = JSON.parse(row.rooms);
            }
          } catch (_) {
            roomsArr = row.room ? [String(row.room)] : [];
          }

          return {
            id: Number(row.id) || row.id,
            createdAt: row.created_at || row.createdAt || '',
            fullName: String(row.full_name || row.fullName || ''),
            position: String(row.position || ''),
            department: String(row.department || ''),
            room: String(row.room || ''),
            rooms: roomsArr,
            purpose: String(row.purpose || ''),
            studentCount: String(row.student_count || row.studentCount || ''),
            grade: String(row.grade || ''),
            bookingDate: String(row.booking_date || row.bookingDate || ''),
            startTime: String(row.start_time || row.startTime || ''),
            endTime: String(row.end_time || row.endTime || ''),
            roomLayout: String(row.room_layout || row.roomLayout || ''),
            status: String(row.status || 'approved')
          };
        });

        saveBookings(effectiveBookings);
        renderCalendar();
        if (state.isAdmin) renderAdmin();
        updateCloudStatusBadge(true, `ออนไลน์ Supabase (${effectiveBookings.length} รายการ)`);
        return true;
      }
    } catch (err) {
      if (!silent) console.warn("⚠️ Could not fetch from Supabase:", err);
      updateCloudStatusBadge(false, 'ขัดข้องชั่วคราว (ใช้ข้อมูลสำรองในเครื่อง)');
      return false;
    }
  }

  // 2. กรณีใช้ Google Sheets
  const scriptUrl = getActiveGoogleScriptUrl();
  const hasSheet = Boolean(scriptUrl && scriptUrl.startsWith('https://script.google.com/macros/s/') && !scriptUrl.includes('YOUR_SCRIPT_ID'));

  if (!hasSheet) {
    if (typeof isSupabaseConfigured !== 'undefined' && !isSupabaseConfigured) {
      updateCloudStatusBadge(false, 'รอใส่ Supabase Key (ใช้ในเครื่องชั่วคราว)');
    } else {
      updateCloudStatusBadge(false, 'โหมดออฟไลน์ (เฉพาะเครื่องนี้)');
    }
    if (!silent) console.log("ℹ️ Cloud database not configured yet. Using LocalStorage.");
    return false;
  }

  try {
    if (!silent) updateCloudStatusBadge('syncing', 'กำลังดึงข้อมูล...');
    const res = await fetch(`${scriptUrl}?action=getBookings&_t=${Date.now()}`);
    const data = await res.json();
    if (data && data.success && Array.isArray(data.bookings)) {
      if (!silent) console.log(`✅ Loaded ${data.bookings.length} bookings from Google Sheets!`);
      
      const deletedIds = getDeletedIds();
      let effectiveBookings = data.bookings;

      if (deletedIds.size > 0) {
        effectiveBookings = data.bookings.filter(b => {
          const bId = String(b.id !== null && b.id !== undefined ? b.id : '').trim();
          return !deletedIds.has(bId);
        });

        const currentSheetIds = new Set(data.bookings.map(b => String(b.id !== null && b.id !== undefined ? b.id : '').trim()));
        let needsPrune = false;
        deletedIds.forEach(delId => {
          if (!currentSheetIds.has(delId)) {
            deletedIds.delete(delId);
            needsPrune = true;
          }
        });
        if (needsPrune) {
          localStorage.setItem('pccpl_deleted_ids', JSON.stringify([...deletedIds]));
        }
      }

      saveBookings(effectiveBookings);
      renderCalendar();
      if (state.isAdmin) renderAdmin();
      updateCloudStatusBadge(true, `ออนไลน์ Google Sheets (${effectiveBookings.length} รายการ)`);
      return true;
    } else {
      updateCloudStatusBadge(false, 'ดึงข้อมูลไม่สำเร็จ');
    }
  } catch (err) {
    if (!silent) console.warn("⚠️ Could not fetch from Google Sheets:", err);
    updateCloudStatusBadge(false, 'ขัดข้องชั่วคราว (ใช้ข้อมูลสำรองในเครื่อง)');
  }
  return false;
}

async function sendGoogleSheetsAction(action, payload = {}) {
  // 1. ส่งไปยัง Supabase
  if (checkIsSupabaseActive()) {
    try {
      updateCloudStatusBadge('syncing', 'กำลังส่งข้อมูลไป Supabase...');
      
      if (action === 'create') {
        const b = payload.booking;
        const record = {
          id: String(b.id),
          created_at: b.createdAt || new Date().toISOString(),
          full_name: b.fullName || '',
          position: b.position || '',
          department: b.department || '',
          room: b.room || '',
          rooms: b.rooms || [],
          purpose: b.purpose || '',
          student_count: b.studentCount || '',
          grade: b.grade || '',
          booking_date: b.bookingDate || '',
          start_time: b.startTime || '',
          end_time: b.endTime || '',
          room_layout: b.roomLayout || '',
          status: b.status || 'approved'
        };
        const { error } = await supabaseClient.from('bookings').upsert(record);
        if (error) throw error;
        console.log('✅ Supabase [create] upserted successfully!');
        updateCloudStatusBadge(true, 'ออนไลน์ (เชื่อมต่อ Supabase)');
        return true;
      }

      if (action === 'cancel') {
        const targetId = String(payload.id !== null && payload.id !== undefined ? payload.id : '').trim();
        const { error } = await supabaseClient
          .from('bookings')
          .update({ status: 'cancelled' })
          .eq('id', targetId);
        if (error) throw error;
        console.log('✅ Supabase [cancel] updated successfully!');
        updateCloudStatusBadge(true, 'ออนไลน์ (เชื่อมต่อ Supabase)');
        return true;
      }

      if (action === 'update') {
        const b = payload.booking;
        const targetId = String(b.id !== null && b.id !== undefined ? b.id : '').trim();
        const updateRecord = {
          full_name: b.fullName || '',
          position: b.position || '',
          department: b.department || '',
          room: b.room || '',
          rooms: b.rooms || [],
          purpose: b.purpose || '',
          student_count: b.studentCount || '',
          grade: b.grade || '',
          booking_date: b.bookingDate || '',
          start_time: b.startTime || '',
          end_time: b.endTime || '',
          room_layout: b.roomLayout || '',
          status: b.status || 'approved'
        };
        const { error } = await supabaseClient
          .from('bookings')
          .update(updateRecord)
          .eq('id', targetId);
        if (error) throw error;
        console.log('✅ Supabase [update] updated successfully!');
        updateCloudStatusBadge(true, 'ออนไลน์ (เชื่อมต่อ Supabase)');
        return true;
      }
    } catch (err) {
      console.warn(`⚠️ Supabase [${action}] sync error:`, err);
      updateCloudStatusBadge(false, 'บันทึกลง Supabase ไม่สำเร็จ');
      return false;
    }
  }

  // 2. กรณีส่งไปยัง Google Sheets
  const scriptUrl = getActiveGoogleScriptUrl();
  const hasSheet = Boolean(scriptUrl && scriptUrl.startsWith('https://script.google.com/macros/s/') && !scriptUrl.includes('YOUR_SCRIPT_ID'));
  if (!hasSheet) return false;

  try {
    updateCloudStatusBadge('syncing', 'กำลังส่งข้อมูลไป Google Sheets...');
    await fetch(scriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...payload })
    });
    console.log(`✅ Google Sheets [${action}] sent successfully with no-cors!`);
    updateCloudStatusBadge(true, 'ออนไลน์ (เชื่อมต่อ Google Sheets)');
    return true;
  } catch (err) {
    console.warn(`⚠️ Google Sheets [${action}] sync error:`, err);
    updateCloudStatusBadge(false, 'บันทึกลง Google Sheets ไม่สำเร็จ');
    return false;
  }
}

// ล้างข้อมูลใน Cloud (Supabase / Google Sheets)
async function sendGoogleSheetsClear(payload = {}) {
  // 1. จัดการบน Supabase
  if (checkIsSupabaseActive()) {
    updateCloudStatusBadge('syncing', 'กำลังล้างข้อมูลใน Supabase...');
    try {
      const mode = payload.mode || 'selected';
      if (mode === 'all') {
        const { error } = await supabaseClient.from('bookings').delete().neq('id', '___NEVER_MATCH___');
        if (error) throw error;
        updateCloudStatusBadge(true, 'ออนไลน์ (ล้างข้อมูลใน Supabase สำเร็จ)');
        return { success: true, message: 'ล้างข้อมูลทั้งหมดใน Supabase เรียบร้อยแล้ว' };
      } else if (Array.isArray(payload.ids) && payload.ids.length > 0) {
        const strIds = payload.ids.map(x => String(x).trim());
        const { error } = await supabaseClient.from('bookings').delete().in('id', strIds);
        if (error) throw error;
        updateCloudStatusBadge(true, 'ออนไลน์ (ลบข้อมูลใน Supabase สำเร็จ)');
        return { success: true, count: strIds.length, message: `ลบข้อมูลใน Supabase สำเร็จ ${strIds.length} รายการ` };
      }
      return { success: false, message: 'ไม่พบรายการที่ต้องการลบ' };
    } catch (err) {
      console.warn('Supabase clear error:', err);
      updateCloudStatusBadge(false, 'ล้างข้อมูลใน Supabase ไม่สำเร็จ');
      return { success: false, message: err.message };
    }
  }

  // 2. จัดการบน Google Sheets
  const scriptUrl = getActiveGoogleScriptUrl();
  const hasSheet = Boolean(scriptUrl && scriptUrl.startsWith('https://script.google.com/macros/s/') && !scriptUrl.includes('YOUR_SCRIPT_ID'));
  if (!hasSheet) return { success: false, offline: true };

  const mode = payload.mode || 'selected';
  const ids = Array.isArray(payload.ids) ? payload.ids : [];

  updateCloudStatusBadge('syncing', 'กำลังล้างข้อมูลใน Google Sheets...');

  let getResult = null;

  try {
    let getUrl = `${scriptUrl}?action=clear&mode=${encodeURIComponent(mode)}&_t=${Date.now()}`;
    if (mode !== 'all' && ids.length > 0) {
      getUrl += `&ids=${encodeURIComponent(ids.join(','))}`;
    }
    const res = await fetch(getUrl);
    const data = await res.json();
    if (data && typeof data === 'object') {
      getResult = data;
    }
  } catch (getErr) {
    console.warn('GET clear attempt info:', getErr);
  }

  try {
    await fetch(scriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'clear', ...payload })
    });
  } catch (postErr) {
    console.warn('POST clear attempt error:', postErr);
  }

  if (getResult) {
    if (getResult.success) {
      updateCloudStatusBadge(true, 'ออนไลน์ (ล้างข้อมูลใน Google Sheets แล้ว)');
      return { success: true, count: getResult.count, message: getResult.message };
    } else {
      updateCloudStatusBadge(false, 'Google Sheets: สคริปต์ยังไม่รองรับคำสั่งล้างข้อมูล');
      return { success: false, message: getResult.message || 'Apps Script ยังไม่รองรับ action clear' };
    }
  }

  updateCloudStatusBadge(true, 'ออนไลน์ (ส่งคำสั่งไป Google Sheets แล้ว)');
  return { success: true, message: 'ส่งคำสั่งไปยัง Google Sheets แล้ว' };
}

async function manualRefreshData() {
  const btn = document.querySelector('button[onclick="manualRefreshData()"]');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '⏳ กำลังดึงข้อมูล...';
  }

  if (checkIsSupabaseActive()) {
    showToast('กำลังดึงข้อมูลล่าสุดจาก Supabase...', 'info');
    const ok = await fetchGoogleSheetsBookings(false);
    if (ok) {
      showToast('อัปเดตข้อมูลล่าสุดจาก Supabase เรียบร้อยแล้ว ⚡', 'success');
    } else {
      showToast('การเชื่อมต่อ Supabase ขัดข้อง แสดงข้อมูลในเครื่อง', 'warning');
    }
  } else if (checkIsGoogleSheetsConfigured()) {
    showToast('กำลังดึงข้อมูลล่าสุดจาก Google Sheets...', 'info');
    const ok = await fetchGoogleSheetsBookings(false);
    if (ok) {
      showToast('อัปเดตข้อมูลล่าสุดจาก Google Sheets เรียบร้อยแล้ว ✅', 'success');
    } else {
      showToast('การเชื่อมต่อขัดข้อง แสดงข้อมูลในเครื่อง', 'warning');
    }
  } else {
    renderCalendar();
    showToast('รีเฟรชข้อมูลแล้ว (โหมดออฟไลน์)', 'info');
  }

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '🔄 รีเฟรชข้อมูล';
  }
}

// ============================================================
// NAVIGATION
// ============================================================
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));

  const map = {
    booking:  { page: 'pageBooking',  nav: 'navBooking'  },
    calendar: { page: 'pageCalendar', nav: 'navCalendar' },
    admin:    { page: 'pageAdmin',    nav: 'navAdmin'    },
    report:   { page: 'pageAdmin',    nav: 'navReport'   },
  };

  if ((page === 'admin' || page === 'report') && !state.isAdmin) {
    showToast('กรุณาเข้าสู่ระบบ Admin ก่อน', 'error');
    showAdminLogin();
    return;
  }

  const target = map[page] || map['booking'];
  document.getElementById(target.page).classList.remove('hidden');
  const navEl = document.getElementById(target.nav);
  if (navEl) navEl.classList.add('active');

  if (page === 'calendar') {
    renderCalendar();
    fetchGoogleSheetsBookings(true);
  }
  if (page === 'admin') {
    renderAdmin();
    fetchGoogleSheetsBookings(true);
  }
  if (page === 'report') {
    renderAdmin();
    switchSection('report');
    fetchGoogleSheetsBookings(true);
  }
}

// ============================================================
// ADMIN AUTH
// ============================================================
function showAdminLogin() {
  document.getElementById('adminLoginModal').classList.remove('hidden');
  document.getElementById('adminUser').value = '';
  document.getElementById('adminPass').value = '';
  document.getElementById('errLogin').textContent = '';
  setTimeout(() => document.getElementById('adminUser').focus(), 100);
}
function closeAdminLogin() {
  document.getElementById('adminLoginModal').classList.add('hidden');
}
function doAdminLogin() {
  const u = document.getElementById('adminUser').value.trim();
  const p = document.getElementById('adminPass').value.trim();

  if (u === ADMIN_USER && p === getAdminPass()) {
    state.isAdmin = true;
    closeAdminLogin();
    document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
    const btnAdmin = document.getElementById('btnAdminLogin');
    if (btnAdmin) {
      btnAdmin.classList.add('logged-in');
      btnAdmin.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
        </svg>Admin (ออกจากระบบ)`;
      btnAdmin.onclick = doAdminLogout;
    }
    setTimeout(() => {
      const navAdmin = document.getElementById('navAdmin');
      if (navAdmin) {
        navAdmin.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }, 120);
    showToast('เข้าสู่ระบบ Admin สำเร็จ ✅', 'success');
  } else {
    document.getElementById('errLogin').textContent = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
  }
}
function doAdminLogout() {
  state.isAdmin = false;
  document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
  const btnAdmin = document.getElementById('btnAdminLogin');
  if (btnAdmin) {
    btnAdmin.classList.remove('logged-in');
    btnAdmin.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
      </svg>เข้าสู่ระบบ Admin`;
    btnAdmin.onclick = showAdminLogin;
  }
  showPage('booking');
  showToast('ออกจากระบบ Admin แล้ว', 'warning');
}
window.adminLogout = doAdminLogout;
function adminLogout() {
  doAdminLogout();
}

// ============================================================
// CHANGE PASSWORD
// ============================================================
function changePassword() {
  const cur     = document.getElementById('pwdCurrent').value;
  const nw      = document.getElementById('pwdNew').value.trim();
  const confirm = document.getElementById('pwdConfirm').value.trim();
  const errEl   = document.getElementById('errPwd');

  errEl.textContent = '';

  if (cur !== getAdminPass()) {
    errEl.textContent = '❌ รหัสผ่านปัจจุบันไม่ถูกต้อง'; return;
  }
  if (nw.length < 6) {
    errEl.textContent = '❌ รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร'; return;
  }
  if (nw !== confirm) {
    errEl.textContent = '❌ รหัสผ่านใหม่ไม่ตรงกัน'; return;
  }

  setAdminPass(nw);
  document.getElementById('pwdCurrent').value = '';
  document.getElementById('pwdNew').value     = '';
  document.getElementById('pwdConfirm').value  = '';
  showToast('เปลี่ยนรหัสผ่านสำเร็จ ✅', 'success');
}

// ============================================================
// ROOM SELECTION (with classroom multi-selection)
// ============================================================
function isClassroomCategory(val) {
  return typeof val === 'string' && val.startsWith('__m');
}

function handleRoomChange() {
  const room = document.getElementById('room').value;
  const panel = document.getElementById('classroomSelector');
  const errEl = document.getElementById('errRoom');
  if (errEl) errEl.textContent = '';

  if (isClassroomCategory(room)) {
    panel.classList.remove('hidden');
    if (CLASSROOM_ROOMS[room]) {
      activeClassroomGrade = room;
    }
    renderClassroomGrid();
    renderSelectedChips();
  } else {
    panel.classList.add('hidden');
    selectedClassrooms.clear();
    renderSelectedChips();
  }
}

function switchClassroomGrade(gradeKey) {
  activeClassroomGrade = gradeKey;
  renderClassroomGrid();
}

function toggleClassroomRoom(roomNum) {
  const roomName = `ห้อง ${roomNum}`;
  if (selectedClassrooms.has(roomName)) {
    selectedClassrooms.delete(roomName);
  } else {
    selectedClassrooms.add(roomName);
  }
  renderClassroomGrid();
  renderSelectedChips();
}

function selectAllCurrentGrade() {
  const data = CLASSROOM_ROOMS[activeClassroomGrade];
  if (data) {
    data.rooms.forEach(r => selectedClassrooms.add(`ห้อง ${r}`));
    renderClassroomGrid();
    renderSelectedChips();
  }
}

function clearClassroomSelection() {
  selectedClassrooms.clear();
  renderClassroomGrid();
  renderSelectedChips();
}

function removeSelectedClassroom(roomName) {
  selectedClassrooms.delete(roomName);
  renderClassroomGrid();
  renderSelectedChips();
}

function renderClassroomGrid() {
  // Update active tab buttons
  document.querySelectorAll('.cr-tab').forEach(tab => {
    if (tab.getAttribute('data-grade') === activeClassroomGrade) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  const grid = document.getElementById('crRoomsGrid');
  const gradeData = CLASSROOM_ROOMS[activeClassroomGrade];
  if (!gradeData || !grid) return;

  grid.innerHTML = gradeData.rooms.map(r => {
    const roomName = `ห้อง ${r}`;
    const isChecked = selectedClassrooms.has(roomName);
    return `
      <div class="room-card-btn ${isChecked ? 'checked' : ''}" onclick="toggleClassroomRoom('${r}')">
        <span class="cr-check-icon">${isChecked ? '✓' : ''}</span>
        <span>ห้อง ${r}</span>
      </div>
    `;
  }).join('');
}

function renderSelectedChips() {
  const container = document.getElementById('crSelectedChips');
  if (!container) return;

  if (selectedClassrooms.size === 0) {
    container.innerHTML = `<span class="cr-no-selection">ยังไม่ได้เลือกห้อง (คลิกเลือกห้องด้านบน)</span>`;
    return;
  }

  // Sort rooms numerically
  const sorted = Array.from(selectedClassrooms).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.replace(/\D/g, '')) || 0;
    return numA - numB;
  });

  container.innerHTML = sorted.map(r => `
    <span class="cr-chip">
      <span>${r}</span>
      <button type="button" class="cr-chip-remove" onclick="removeSelectedClassroom('${r}')" title="ลบออก">✕</button>
    </span>
  `).join('') + `<span style="font-size:0.78rem;font-weight:700;color:var(--orange-700);margin-left:4px;">(รวม ${selectedClassrooms.size} ห้อง)</span>`;
}

function getFinalRoomSelection() {
  const roomRaw = document.getElementById('room').value;
  if (isClassroomCategory(roomRaw)) {
    const sorted = Array.from(selectedClassrooms).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.replace(/\D/g, '')) || 0;
      return numA - numB;
    });
    return {
      rooms: sorted,
      roomString: sorted.join(', '),
    };
  }
  return {
    rooms: roomRaw ? [roomRaw] : [],
    roomString: roomRaw || '',
  };
}

function getRoomsList(booking) {
  if (!booking) return [];
  if (Array.isArray(booking.rooms) && booking.rooms.length > 0) {
    return booking.rooms;
  }
  if (typeof booking.room === 'string' && booking.room) {
    return booking.room.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

function toggleOtherPosition() {
  const sel   = document.getElementById('position')?.value || '';
  const other = document.getElementById('positionOther');
  if (!other) return;
  if (sel === 'อื่น ๆ' || sel === 'อื่นๆ' || sel.startsWith('อื่น')) {
    other.classList.remove('hidden');
    other.focus();
  } else {
    other.classList.add('hidden');
    other.value = '';
  }
}

function toggleEditOtherPosition() {
  const sel   = document.getElementById('e_position')?.value || '';
  const other = document.getElementById('e_positionOther');
  if (!other) return;
  if (sel === 'อื่น ๆ' || sel === 'อื่นๆ' || sel.startsWith('อื่น')) {
    other.classList.remove('hidden');
    other.focus();
  } else {
    other.classList.add('hidden');
  }
}

// ============================================================
// CONFLICT CHECK — supports multi-room booking conflict detection
// ============================================================
function hasConflict(newBooking, excludeId = null) {
  const bookings = getBookings().filter(b =>
    b.status !== 'cancelled' && b.id !== excludeId
  );
  
  const newRooms = getRoomsList(newBooking);
  if (newRooms.length === 0) return null;

  for (const b of bookings) {
    if (b.bookingDate !== newBooking.bookingDate) continue;

    // Time overlap check: new.end > b.start && new.start < b.end
    if (!(newBooking.endTime <= b.startTime || newBooking.startTime >= b.endTime)) {
      const bRooms = getRoomsList(b);
      // Check shared rooms
      const overlapRooms = newRooms.filter(r1 =>
        bRooms.some(r2 => {
          if (r1 === r2) return true;
          const clean1 = r1.replace(/\s+/g, '');
          const clean2 = r2.replace(/\s+/g, '');
          return clean1 === clean2 || clean1.includes(clean2) || clean2.includes(clean1);
        })
      );

      if (overlapRooms.length > 0) {
        return {
          conflictWith: b,
          conflictingRooms: overlapRooms,
        };
      }
    }
  }
  return null;
}

// ============================================================
// SUBMIT BOOKING (all fields required, auto-approved)
// ============================================================
async function submitBooking(event) {
  event.preventDefault();
  clearErrors();

  const fullName     = document.getElementById('fullName').value.trim();
  const position     = document.getElementById('position').value;
  const posOther     = document.getElementById('positionOther').value.trim();
  const department   = document.getElementById('department').value.trim();
  const roomRaw      = document.getElementById('room').value;
  const purpose      = document.getElementById('purpose').value.trim();
  const studentCount = document.getElementById('studentCount').value.trim();
  const grade        = document.getElementById('grade').value.trim();
  const bookingDate  = document.getElementById('bookingDate').value;
  const startTime    = document.getElementById('startTime').value;
  const endTime      = document.getElementById('endTime').value;
  const roomLayout   = document.getElementById('roomLayout').value.trim();

  let valid = true;
  let firstInvalid = null;

  // 1. Full name
  if (!fullName) {
    setError('errFullName', 'กรุณากรอกชื่อ-นามสกุล');
    setInputError('fullName');
    valid = false;
    if (!firstInvalid) firstInvalid = 'fullName';
  }

  // 2. Position
  const isPosOtherChoice = (position === 'อื่น ๆ' || position === 'อื่นๆ' || position.startsWith('อื่น'));
  if (!position) {
    setError('errPosition', 'กรุณาเลือกตำแหน่ง');
    setInputError('position');
    valid = false;
    if (!firstInvalid) firstInvalid = 'position';
  } else if (isPosOtherChoice && !posOther) {
    setError('errPosition', 'กรุณาระบุตำแหน่งของคุณ');
    setInputError('positionOther');
    valid = false;
    if (!firstInvalid) firstInvalid = 'positionOther';
  }

  // 3. Department
  if (!department) {
    setError('errDepartment', 'กรุณาเลือกฝ่ายงาน');
    setInputError('department');
    valid = false;
    if (!firstInvalid) firstInvalid = 'department';
  }

  // 4. Room
  if (!roomRaw) {
    setError('errRoom', 'กรุณาเลือกห้อง/สถานที่');
    setInputError('room');
    valid = false;
    if (!firstInvalid) firstInvalid = 'room';
  } else if (isClassroomCategory(roomRaw)) {
    if (selectedClassrooms.size === 0) {
      setError('errRoom', 'กรุณาเลือกห้องเรียนอย่างน้อย 1 ห้อง (สามารถคลิกเลือกได้หลายห้อง)');
      valid = false;
      if (!firstInvalid) firstInvalid = 'room';
    }
  }

  // 5. Purpose
  if (!purpose) {
    setError('errPurpose', 'กรุณากรอกวัตถุประสงค์การใช้สถานที่');
    setInputError('purpose');
    valid = false;
    if (!firstInvalid) firstInvalid = 'purpose';
  }

  // 6. Users count (จำนวนผู้ใช้ห้อง)
  if (!studentCount || parseInt(studentCount) <= 0) {
    setError('errStudentCount', 'กรุณากรอกจำนวนผู้ใช้ห้อง (ต้องมากกว่า 0)');
    setInputError('studentCount');
    valid = false;
    if (!firstInvalid) firstInvalid = 'studentCount';
  }

  // 7. Grade / User group
  if (!grade) {
    setError('errGrade', 'กรุณากรอกระดับชั้น หรือกลุ่มผู้ใช้');
    setInputError('grade');
    valid = false;
    if (!firstInvalid) firstInvalid = 'grade';
  }

  // 8. Date & Time
  if (!bookingDate) {
    setError('errDateTime', 'กรุณาเลือกวันที่ใช้สถานที่');
    setInputError('bookingDate');
    valid = false;
    if (!firstInvalid) firstInvalid = 'bookingDate';
  }
  if (!startTime) {
    setError('errDateTime', 'กรุณาระบุเวลาเริ่มต้น');
    setInputError('startTime');
    valid = false;
    if (!firstInvalid) firstInvalid = 'startTime';
  }
  if (!endTime) {
    setError('errDateTime', 'กรุณาระบุเวลาสิ้นสุด');
    setInputError('endTime');
    valid = false;
    if (!firstInvalid) firstInvalid = 'endTime';
  }

  // 9. Room layout
  if (!roomLayout) {
    setError('errRoomLayout', 'กรุณากรอกรูปแบบการจัดห้อง');
    setInputError('roomLayout');
    valid = false;
    if (!firstInvalid) firstInvalid = 'roomLayout';
  }

  if (!valid) {
    if (firstInvalid) {
      const el = document.getElementById(firstInvalid);
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); }
    }
    showToast('กรุณากรอกข้อมูลในช่องที่มีดอกจัน (*) ให้ครบทุกช่อง', 'error');
    return;
  }

  // Time sequence validation (start < end)
  if (startTime >= endTime) {
    setError('errDateTime', '⚠️ เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น');
    setInputError('endTime');
    showToast('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น', 'error');
    return;
  }

  // Past date check
  const today    = new Date(); today.setHours(0,0,0,0);
  const selected = new Date(bookingDate); selected.setHours(0,0,0,0);
  if (selected < today) {
    setError('errDateTime', '⚠️ ไม่สามารถจองวันที่ผ่านมาแล้วได้');
    setInputError('bookingDate');
    showToast('ไม่สามารถจองวันที่ผ่านมาแล้วได้', 'error');
    return;
  }

  const isPosOtherChoiceFinal = (position === 'อื่น ๆ' || position === 'อื่นๆ' || position.startsWith('อื่น'));
  const finalPosition = isPosOtherChoiceFinal ? posOther : position;
  const roomSelection = getFinalRoomSelection();

  const newBooking = {
    id:           getNextId(),
    createdAt:    new Date().toISOString(),
    fullName,
    position:     finalPosition,
    department,
    room:         roomSelection.roomString,
    rooms:        roomSelection.rooms,
    purpose,
    studentCount,
    grade,
    bookingDate,
    startTime,
    endTime,
    roomLayout,
    status:       'approved',
  };

  // Live Cloud Pre-check: Fetch latest from Google Sheets right before checking conflicts!
  const submitBtn = document.getElementById('btnSubmit');
  const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '⏳ กำลังตรวจสอบห้องว่างล่าสุด...';
  }

  if (checkIsGoogleSheetsConfigured()) {
    await fetchGoogleSheetsBookings(true);
  }

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnHtml;
  }

  // Conflict check with live data
  const conflict = hasConflict(newBooking);
  if (conflict) {
    const c = conflict.conflictWith;
    document.getElementById('conflictDetail').innerHTML = `
      <div style="margin-bottom:10px;font-size:1.05rem;font-weight:700;color:#dc2626;">
        ⚠️ ไม่สามารถจองได้! มีการจองซ้ำในห้องต่อไปนี้:
      </div>
      <div style="background:#fee2e2;border-left:4px solid #dc2626;padding:10px 14px;border-radius:8px;margin-bottom:12px;">
        <div style="font-weight:800;color:#991b1b;font-size:0.95rem;">
          📍 ห้องที่ซ้ำ: ${conflict.conflictingRooms.join(', ')}
        </div>
      </div>
      <div style="line-height:2;font-size:0.9rem;color:#374151;">
        <div>📅 วันที่: <strong>${formatDateThai(c.bookingDate)}</strong></div>
        <div>⏰ เวลาที่ถูกจองแล้ว: <strong style="color:#ea580c;">${c.startTime} – ${c.endTime} น.</strong></div>
        <div>👤 ผู้จองเดิม: <strong>${c.fullName}</strong> (${c.position || '–'}) — ${c.department}</div>
        <div>🎯 วัตถุประสงค์: ${c.purpose}</div>
      </div>
      <div style="margin-top:14px;padding-top:10px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:0.85rem;">
        💡 คำแนะนำ: กรุณาเปลี่ยนช่วงเวลา หรือยกเลิกการเลือกห้องที่ติดซ้ำ
      </div>
    `;
    document.getElementById('conflictModal').classList.remove('hidden');
    return;
  }

  // Save locally
  removeDeletedId(newBooking.id);
  const bookings = getBookings();
  bookings.push(newBooking);
  saveBookings(bookings);
  state.lastBookingId = newBooking.id;

  // Sync to Google Sheets
  if (checkIsGoogleSheetsConfigured()) {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '☁️ กำลังบันทึกข้อมูลไปยังคลาวด์...';
    }
    await sendGoogleSheetsAction('create', { booking: newBooking });
    // Pull fresh cloud data immediately to update all views
    await fetchGoogleSheetsBookings(true);
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHtml;
    }
  }

  document.getElementById('successMessage').textContent =
    `จอง "${roomSelection.roomString}" วันที่ ${formatDateThai(bookingDate)} เวลา ${startTime}–${endTime} น. สำเร็จแล้ว!`;
  document.getElementById('successModal').classList.remove('hidden');

  clearForm();
  renderCalendar();
  showToast('ยืนยันการจองเรียบร้อยแล้ว ✅', 'success');
}

// ============================================================
// FORM UTILITIES
// ============================================================
function clearErrors() {
  document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
  document.querySelectorAll('.form-input, .form-select, .form-textarea').forEach(el => el.classList.remove('error'));
}
function setError(elId, msg) {
  const el = document.getElementById(elId);
  if (el) el.textContent = msg;
}
function setInputError(elId) {
  const el = document.getElementById(elId);
  if (el) el.classList.add('error');
}
function clearForm() {
  document.getElementById('bookingForm').reset();
  document.getElementById('positionOther').classList.add('hidden');
  document.getElementById('classroomSelector').classList.add('hidden');
  selectedClassrooms.clear();
  renderSelectedChips();
  clearErrors();
}
function closeSuccess()  { document.getElementById('successModal').classList.add('hidden'); }
function closeConflict() { document.getElementById('conflictModal').classList.add('hidden'); }

function printCurrentBooking() {
  if (!state.lastBookingId) return;
  const b = getBookingById(state.lastBookingId);
  if (b) openPrintPreview(b);
  closeSuccess();
}

// ============================================================
// CALENDAR
// ============================================================
function setCalViewMode(mode) {
  if (mode !== 'list') mode = 'scroll';
  state.calViewMode = mode;
  const btnScroll = document.getElementById('btnViewScroll');
  const btnList   = document.getElementById('btnViewList');
  const gridWrap  = document.getElementById('calendarScrollWrap');
  const listView  = document.getElementById('calendarListView');
  const legend    = document.querySelector('.calendar-legend');
  const hint      = document.getElementById('calMobileHint') || document.querySelector('.cal-mobile-hint');

  if (btnScroll) btnScroll.classList.toggle('active', mode === 'scroll');
  if (btnList) btnList.classList.toggle('active', mode === 'list');

  if (mode === 'list') {
    if (gridWrap) gridWrap.classList.add('hidden');
    if (listView) listView.classList.remove('hidden');
    if (legend) legend.classList.add('hidden');
    if (hint) hint.classList.add('hidden');
    renderCalendarList();
  } else {
    if (gridWrap) {
      gridWrap.classList.remove('hidden');
      gridWrap.classList.remove('cal-mode-fit');
      gridWrap.classList.add('cal-mode-scroll');
    }
    if (listView) listView.classList.add('hidden');
    if (legend) legend.classList.remove('hidden');
    if (hint) hint.classList.remove('hidden');
    renderCalendarGrid();
  }
}

function toggleCalScroll() {
  const wrap = document.getElementById('calendarScrollWrap');
  const btn = document.getElementById('btnToggleCalScroll');
  if (!wrap) return;
  const maxScroll = wrap.scrollWidth - wrap.clientWidth;
  if (wrap.scrollLeft < maxScroll / 2) {
    wrap.scrollTo({ left: wrap.scrollWidth, behavior: 'smooth' });
    if (btn) btn.textContent = '⏪ เลื่อนไปซ้ายสุด';
  } else {
    wrap.scrollTo({ left: 0, behavior: 'smooth' });
    if (btn) btn.textContent = 'เลื่อนไปขวาสุด ⏩';
  }
}

function renderCalendar() {
  const { calYear, calMonth } = state;
  const monthDisplay = document.getElementById('calMonthDisplay');
  if (monthDisplay) {
    monthDisplay.textContent = `${THAI_MONTHS[calMonth]} ${calYear + 543}`;
  }

  const btnFit    = document.getElementById('btnViewFit');
  const btnScroll = document.getElementById('btnViewScroll');
  const btnList   = document.getElementById('btnViewList');
  if (btnFit) btnFit.classList.toggle('active', state.calViewMode === 'fit');
  if (btnScroll) btnScroll.classList.toggle('active', state.calViewMode === 'scroll');
  if (btnList) btnList.classList.toggle('active', state.calViewMode === 'list');

  const gridWrap = document.getElementById('calendarScrollWrap');
  if (gridWrap) {
    gridWrap.classList.toggle('cal-mode-fit', state.calViewMode === 'fit');
    gridWrap.classList.toggle('cal-mode-scroll', state.calViewMode === 'scroll');
  }

  const hint = document.getElementById('calMobileHint') || document.querySelector('.cal-mobile-hint');
  if (hint) {
    hint.classList.toggle('hidden', state.calViewMode === 'fit' || state.calViewMode === 'list');
  }

  if (state.calViewMode === 'list') {
    renderCalendarList();
  } else {
    renderCalendarGrid();
  }
}

function renderCalendarGrid() {
  const { calYear, calMonth } = state;
  const filterRoom = document.getElementById('filterRoom')?.value || '';

  const bookings = getBookings().filter(b => {
    if (!filterRoom) return true;
    const rList = getRoomsList(b);
    if (rList.includes(filterRoom)) return true;
    if (b.room && b.room.includes(filterRoom)) return true;
    const cleanFilter = filterRoom.replace('ห้อง ', '').trim();
    if (rList.some(r => r.includes(cleanFilter))) return true;
    return false;
  });

  const grid = document.getElementById('calendarGrid');
  if (!grid) return;
  grid.innerHTML = '';
  grid.classList.toggle('cal-mode-fit', state.calViewMode === 'fit');
  grid.classList.toggle('cal-mode-scroll', state.calViewMode === 'scroll');

  // Weekday headers
  const header = document.createElement('div');
  header.className = 'cal-weekdays';
  THAI_DAYS.forEach((d, i) => {
    const el = document.createElement('div');
    el.className = `cal-weekday${(i === 0 || i === 6) ? ' weekend' : ''}`;
    el.textContent = d;
    header.appendChild(el);
  });
  grid.appendChild(header);

  const daysGrid = document.createElement('div');
  daysGrid.className = 'cal-days';

  const firstDay = new Date(calYear, calMonth, 1);
  const lastDay  = new Date(calYear, calMonth + 1, 0);
  const startDow = firstDay.getDay();
  const today    = new Date(); today.setHours(0,0,0,0);

  // Prev month padding
  for (let i = 0; i < startDow; i++) {
    const d = new Date(calYear, calMonth, -(startDow - 1 - i));
    daysGrid.appendChild(createDayCell(d, bookings, today, true));
  }
  // Current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    daysGrid.appendChild(createDayCell(new Date(calYear, calMonth, d), bookings, today, false));
  }
  // Next month padding
  const total = startDow + lastDay.getDate();
  const rem   = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let i = 1; i <= rem; i++) {
    daysGrid.appendChild(createDayCell(new Date(calYear, calMonth + 1, i), bookings, today, true));
  }

  grid.appendChild(daysGrid);
}

function renderCalendarList() {
  const { calYear, calMonth } = state;
  const filterRoom = document.getElementById('filterRoom')?.value || '';
  const container = document.getElementById('calendarListView');
  if (!container) return;

  const allBookings = getBookings().filter(b => {
    if (!filterRoom) return true;
    const rList = getRoomsList(b);
    if (rList.includes(filterRoom)) return true;
    if (b.room && b.room.includes(filterRoom)) return true;
    const cleanFilter = filterRoom.replace('ห้อง ', '').trim();
    if (rList.some(r => r.includes(cleanFilter))) return true;
    return false;
  });

  // Filter bookings belonging to this year and month
  const monthBookings = allBookings.filter(b => {
    if (!b.bookingDate) return false;
    const parts = b.bookingDate.split('-');
    if (parts.length < 3) return false;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    return y === calYear && m === calMonth;
  });

  if (monthBookings.length === 0) {
    container.innerHTML = `
      <div class="cal-list-empty">
        <div class="empty-icon" style="font-size:2.8rem;margin-bottom:8px;">📅</div>
        <h4 style="font-size:1.05rem;color:var(--navy-800);margin-bottom:4px;font-weight:700;">ไม่มีรายการจองในเดือนนี้</h4>
        <p style="color:var(--gray-500);font-size:0.85rem;">คุณสามารถเลือกดูเดือนอื่น หรือกดจองสถานที่เพื่อเพิ่มรายการใหม่</p>
      </div>`;
    return;
  }

  // Group by bookingDate
  const groups = {};
  monthBookings.forEach(b => {
    if (!groups[b.bookingDate]) groups[b.bookingDate] = [];
    groups[b.bookingDate].push(b);
  });

  const sortedDates = Object.keys(groups).sort();
  let html = '';

  sortedDates.forEach(dateStr => {
    const d = new Date(dateStr);
    const items = groups[dateStr].sort((a, b) => a.startTime.localeCompare(b.startTime));
    const dow = isNaN(d.getTime()) ? '' : THAI_DAYS[d.getDay()];
    const dateFormatted = formatDateThai(dateStr);

    html += `
      <div class="cal-list-day-group">
        <div class="cal-list-day-header">
          <div class="cal-list-day-title">
            <span>📅</span>
            <strong>${dow ? dow + 'ที่ ' : ''}${dateFormatted}</strong>
          </div>
          <span class="cal-list-day-count">${items.length} รายการ</span>
        </div>
        <div class="cal-list-day-items">
          ${items.map(b => `
            <div class="cal-list-card ${b.status}" onclick="viewBookingDetail(${b.id})">
              <div class="cal-list-card-top">
                <span class="cal-list-room">📍 ${escapeHtml(b.room)}</span>
                <span class="status-badge ${b.status}">${statusLabel(b.status)}</span>
              </div>
              <div class="cal-list-card-meta">
                <span class="cal-list-time">⏰ ${b.startTime}–${b.endTime} น.</span>
                <span class="cal-list-user">👤 ${escapeHtml(b.fullName)} · ${escapeHtml(b.department || '-')}</span>
              </div>
              ${b.purpose ? `<div class="cal-list-purpose">🎯 ${escapeHtml(b.purpose)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function createDayCell(date, bookings, today, otherMonth) {
  const cell    = document.createElement('div');
  const dayStr  = toDateStr(date);
  const dow     = date.getDay();
  const isToday = date.getTime() === today.getTime();

  const dayBookings = bookings.filter(b => b.bookingDate === dayStr);

  cell.className = 'cal-day' +
    (otherMonth ? ' other-month' : '') +
    ((dow === 0 || dow === 6) ? ' weekend' : '') +
    (isToday ? ' today' : '');

  if (!otherMonth) cell.onclick = () => showDayDetail(date, dayBookings);

  const numEl = document.createElement('div');
  numEl.className = 'cal-day-num';
  numEl.textContent = date.getDate();
  cell.appendChild(numEl);

  if (!otherMonth && dayBookings.length > 0) {
    if (state.calViewMode === 'fit') {
      const active = dayBookings.filter(b => b.status === 'approved');
      const cancelled = dayBookings.filter(b => b.status === 'cancelled');
      const wrap = document.createElement('div');
      wrap.className = 'cal-fit-badge-wrap';

      if (active.length > 0) {
        const badge = document.createElement('span');
        badge.className = 'cal-fit-badge booked';
        badge.textContent = `${active.length} รายการ`;
        badge.title = `${active.length} รายการจอง (แตะเพื่อดูรายละเอียด)`;
        wrap.appendChild(badge);
      } else if (cancelled.length > 0) {
        const badge = document.createElement('span');
        badge.className = 'cal-fit-badge cancelled';
        badge.textContent = `ยกเลิก`;
        badge.title = `${cancelled.length} รายการยกเลิก (แตะเพื่อดูรายละเอียด)`;
        wrap.appendChild(badge);
      }
      cell.appendChild(wrap);
    } else {
      const booksEl = document.createElement('div');
      booksEl.className = 'cal-bookings';

      const maxDisplayChips = 4;
      dayBookings
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .slice(0, maxDisplayChips)
        .forEach(b => {
          const chip = document.createElement('div');
          chip.className = `cal-booking-chip ${b.status}`;
          chip.innerHTML = `
            <span class="chip-room">📍 ${escapeHtml(b.room)}</span>
            <span class="chip-meta">⏰ ${b.startTime}–${b.endTime} น. · 👤 ${escapeHtml(b.fullName)}</span>
          `;
          chip.title = `📍 ${b.room}\n👤 ${b.fullName} (${b.position || '–'}) — ${b.department}\n⏰ ${b.startTime}–${b.endTime} น.\n🎯 ${b.purpose}\n\n(แตะเพื่อดูรายละเอียดเต็มและพิมพ์ใบจอง)`;
          chip.onclick = (e) => {
            e.stopPropagation();
            viewBookingDetail(b.id);
          };
          booksEl.appendChild(chip);
        });

      if (dayBookings.length > maxDisplayChips) {
        const more = document.createElement('div');
        more.className = 'cal-more';
        more.textContent = `+${dayBookings.length - maxDisplayChips} รายการ (แตะดูทั้งหมด)`;
        more.title = 'แตะเพื่อดูรายละเอียดการจองทั้งหมดของวันนี้';
        more.onclick = (e) => { e.stopPropagation(); showDayDetail(date, dayBookings); };
        booksEl.appendChild(more);
      }
      cell.appendChild(booksEl);
    }
  }
  return cell;
}

function prevMonth() {
  state.calMonth--;
  if (state.calMonth < 0) { state.calMonth = 11; state.calYear--; }
  renderCalendar();
}
function nextMonth() {
  state.calMonth++;
  if (state.calMonth > 11) { state.calMonth = 0; state.calYear++; }
  renderCalendar();
}

function showDayDetail(date, dayBookings) {
  document.getElementById('dayDetailTitle').textContent =
    `📅 ${THAI_DAYS[date.getDay()]} ${date.getDate()} ${THAI_MONTHS[date.getMonth()]} ${date.getFullYear() + 543}`;

  const body = document.getElementById('dayDetailBody');
  const active = dayBookings.filter(b => b.status !== 'cancelled');

  if (active.length === 0 && dayBookings.length === 0) {
    body.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><p>ไม่มีการจองในวันนี้</p></div>`;
  } else {
    body.innerHTML = dayBookings
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map(b => `
        <div class="day-detail-booking-card" onclick="closeDayDetail(); viewBookingDetail('${b.id}');" style="border:1px solid ${b.status==='cancelled'?'#e5e7eb':'#fed7aa'};border-left:4px solid ${b.status==='cancelled'?'#9ca3af':'#f97316'};border-radius:10px;padding:14px;margin:12px 16px;background:${b.status==='cancelled'?'#f9fafb':'#fff7ed'};cursor:pointer;transition:transform 0.15s,box-shadow 0.15s;" title="แตะเพื่อดูรายละเอียดเต็มและพิมพ์ใบจอง">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <strong style="color:${b.status==='cancelled'?'#6b7280':'#9a3412'};font-size:0.95rem;">📍 ${escapeHtml(b.room)}</strong>
            <span class="status-badge ${b.status}">${statusLabel(b.status)}</span>
          </div>
          <div style="font-size:0.875rem;color:#374151;line-height:2;">
            <div>👤 <strong>${escapeHtml(b.fullName)}</strong> (${escapeHtml(b.position || '–')}) — ${escapeHtml(b.department || '–')}</div>
            <div>⏰ <strong style="color:#ea580c;">${b.startTime} – ${b.endTime} น.</strong></div>
            <div>🎯 ${escapeHtml(b.purpose || '–')}</div>
            ${b.studentCount ? `<div>👥 จำนวนผู้ใช้ห้อง <strong>${b.studentCount}</strong> คน ${b.grade ? `(ชั้น/กลุ่ม ${escapeHtml(b.grade)})` : ''}</div>` : ''}
            ${b.roomLayout ? `<div>📐 รูปแบบการจัดห้อง: ${escapeHtml(b.roomLayout)}</div>` : ''}
          </div>
          <div style="margin-top:10px;display:flex;justify-content:flex-end;">
            <button type="button" class="btn-primary" style="padding:6px 14px;font-size:0.82rem;border-radius:6px;" onclick="event.stopPropagation(); closeDayDetail(); viewBookingDetail('${b.id}');">
              📋 ดูข้อมูลเต็ม / พิมพ์ใบจอง
            </button>
          </div>
        </div>
      `).join('');
  }

  document.getElementById('dayDetailModal').classList.remove('hidden');
}
function closeDayDetail() { document.getElementById('dayDetailModal').classList.add('hidden'); }

// ============================================================
// ADMIN PANEL
// ============================================================
function renderAdmin() {
  renderAdminStats();
  renderAdminTable();
  renderAdminReport();
}

function renderAdminStats() {
  const all       = getBookings();
  const approved  = all.filter(b => b.status === 'approved').length;
  const cancelled = all.filter(b => b.status === 'cancelled').length;

  document.getElementById('adminStats').innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${all.length}</div>
      <div class="stat-label">การจองทั้งหมด</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${approved}</div>
      <div class="stat-label">จองแล้ว</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${cancelled}</div>
      <div class="stat-label">ยกเลิก</div>
    </div>
  `;

  document.getElementById('approvedBadge').textContent = approved;
}

// Admin Section Tabs
function switchSection(section) {
  state.adminSection = section;
  document.querySelectorAll('.section-tab').forEach(el => el.classList.remove('active'));
  const sectEl = document.getElementById(`sect${section.charAt(0).toUpperCase() + section.slice(1)}`);
  if (sectEl) sectEl.classList.add('active');

  document.getElementById('sectionManage')?.classList.add('hidden');
  document.getElementById('sectionReport')?.classList.add('hidden');
  document.getElementById('sectionOptions')?.classList.add('hidden');
  document.getElementById('sectionSettings')?.classList.add('hidden');

  document.getElementById(`section${section.charAt(0).toUpperCase() + section.slice(1)}`)?.classList.remove('hidden');

  if (section === 'manage') renderAdminTable();
  if (section === 'report') initAdminReport();
  if (section === 'options') renderAdminOptionsManager();
}

// Admin sub-tabs
function switchAdminTab(tab) {
  state.adminTab = tab;
  document.querySelectorAll('.admin-tab').forEach(el => el.classList.remove('active'));
  document.getElementById(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`).classList.add('active');
  renderAdminTable();
}

function initAdminManagePeriod() {
  const now = new Date();
  const mSel = document.getElementById('manageMonth');
  const ySel = document.getElementById('manageYear');
  const dInput = document.getElementById('manageDate');
  const wInput = document.getElementById('manageWeek');

  if (mSel && !mSel.options.length) {
    THAI_MONTHS.forEach((m, i) => mSel.add(new Option(m, i)));
    mSel.value = now.getMonth();
  }
  if (ySel && !ySel.options.length) {
    for (let y = now.getFullYear(); y >= now.getFullYear() - 5; y--) {
      ySel.add(new Option(y + 543, y));
    }
    ySel.value = now.getFullYear();
  }
  if (dInput && !dInput.value) {
    dInput.value = toDateStr(now);
  }
  if (wInput && !wInput.value) {
    wInput.value = getIsoWeekString(toDateStr(now));
  }
}

function handleManagePeriodChange() {
  const type = document.getElementById('managePeriodType')?.value || 'all';
  const dWrap = document.getElementById('manageDateWrap');
  const wWrap = document.getElementById('manageWeekWrap');
  const mWrap = document.getElementById('manageMonthWrap');

  if (dWrap) dWrap.classList.toggle('hidden', type !== 'daily');
  if (wWrap) wWrap.classList.toggle('hidden', type !== 'weekly');
  if (mWrap) mWrap.classList.toggle('hidden', type !== 'monthly');

  renderAdminTable();
}

function resetManagePeriod() {
  const typeSel = document.getElementById('managePeriodType');
  if (typeSel) typeSel.value = 'all';
  document.getElementById('manageDateWrap')?.classList.add('hidden');
  document.getElementById('manageWeekWrap')?.classList.add('hidden');
  document.getElementById('manageMonthWrap')?.classList.add('hidden');
  renderAdminTable();
}

function renderAdminTable() {
  initAdminManagePeriod();

  const type = document.getElementById('managePeriodType')?.value || 'all';
  const allBookings = getBookings();

  let periodLabel = 'ทั้งหมด';
  let filtered = allBookings;

  if (type === 'daily') {
    const dVal = document.getElementById('manageDate')?.value || toDateStr(new Date());
    filtered = filtered.filter(b => b.bookingDate === dVal);
    periodLabel = `วันที่ ${formatDateThai(dVal)}`;
  } else if (type === 'weekly') {
    const wVal = document.getElementById('manageWeek')?.value || '';
    if (wVal) {
      filtered = filtered.filter(b => b.bookingDate && getIsoWeekString(b.bookingDate) === wVal);
      periodLabel = `สัปดาห์ที่ ${wVal.replace(/.*-W/, '')}`;
    }
  } else if (type === 'monthly') {
    const m = parseInt(document.getElementById('manageMonth')?.value ?? new Date().getMonth(), 10);
    const y = parseInt(document.getElementById('manageYear')?.value ?? new Date().getFullYear(), 10);
    filtered = filtered.filter(b => {
      if (!b.bookingDate) return false;
      const parts = b.bookingDate.split('-');
      if (parts.length < 3) return false;
      return parseInt(parts[0], 10) === y && (parseInt(parts[1], 10) - 1) === m;
    });
    periodLabel = `เดือน ${THAI_MONTHS[m]} ${y + 543}`;
  }

  // Update badge in period bar
  const badgeEl = document.getElementById('managePeriodBadge');
  if (badgeEl) {
    badgeEl.textContent = `${periodLabel} (${filtered.length} รายการ)`;
  }

  // Update approved tab badge based on active period filter
  const approvedCount = filtered.filter(b => b.status === 'approved').length;
  const appBadge = document.getElementById('approvedBadge');
  if (appBadge) appBadge.textContent = approvedCount;

  // Filter by active admin tab (approved / cancelled)
  const bookings = filtered
    .filter(b => b.status === state.adminTab)
    .sort((a, b) => new Date(b.bookingDate || b.createdAt) - new Date(a.bookingDate || a.createdAt) || (a.startTime || '').localeCompare(b.startTime || ''));

  const body   = document.getElementById('adminBody');
  const empty  = document.getElementById('adminEmpty');

  if (bookings.length === 0) {
    if (body) body.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');

  if (body) {
    body.innerHTML = bookings.map((b, i) => `
      <tr>
        <td style="text-align:center;font-weight:700;">${i + 1}</td>
        <td><strong>${escapeHtml(b.fullName)}</strong></td>
        <td>${escapeHtml(b.position || '-')}</td>
        <td>${escapeHtml(b.department || '-')}</td>
        <td>${escapeHtml(b.room)}</td>
        <td style="text-align:center;">${formatDateThai(b.bookingDate)}</td>
        <td style="text-align:center;white-space:nowrap"><strong>${b.startTime}–${b.endTime} น.</strong></td>
        <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(b.purpose || '')}">${escapeHtml(b.purpose || '-')}</td>
        <td style="font-size:0.78rem;color:#9ca3af;white-space:nowrap;text-align:center;">${formatDateTimeThai(b.createdAt)}</td>
        <td style="text-align:center;">
          <div class="action-btns" style="justify-content:center;">
            <button class="btn-info"  onclick="viewBookingDetail(${b.id})">ดู</button>
            <button class="btn-edit"  onclick="editBooking(${b.id})">✏️</button>
            ${b.status === 'approved'
              ? `<button class="btn-danger" onclick="cancelBooking(${b.id})">❌ ยกเลิก</button>`
              : ''}
            <button class="btn-primary" onclick="openPrintPreview(getBookingById(${b.id}))" style="padding:6px 10px;font-size:0.78rem;">🖨️</button>
          </div>
        </td>
      </tr>
    `).join('');
  }
}

async function cancelBooking(id) {
  if (!confirm('ยืนยันการยกเลิกการจองนี้?')) return;
  const bookings = getBookings();
  const targetIdStr = String(id !== null && id !== undefined ? id : '').trim();
  const idx = bookings.findIndex(b => String(b.id !== null && b.id !== undefined ? b.id : '').trim() === targetIdStr);
  if (idx === -1) return;
  bookings[idx].status      = 'cancelled';
  bookings[idx].cancelledAt = new Date().toISOString();
  saveBookings(bookings);

  showToast('กำลังส่งคำขอยกเลิกไปยังฐานข้อมูล...', 'info');
  renderAdmin();
  renderCalendar();

  if (checkIsGoogleSheetsConfigured()) {
    await sendGoogleSheetsAction('cancel', { id: targetIdStr });
    await fetchGoogleSheetsBookings(true);
  }

  showToast('ยกเลิกการจองแล้ว ⚠️', 'warning');
}

// ============================================================
// BOOKING DETAIL
// ============================================================
function getBookingById(id) {
  const targetIdStr = String(id !== null && id !== undefined ? id : '').trim();
  return getBookings().find(b => String(b.id !== null && b.id !== undefined ? b.id : '').trim() === targetIdStr);
}

function viewBookingDetail(id) {
  const b = getBookingById(id);
  if (!b) return;
  state.currentDetailId = id;

  document.getElementById('bookingDetailBody').innerHTML = `
    <div class="booking-detail-grid">
      <div class="detail-item"><div class="detail-label">ชื่อ-นามสกุล</div><div class="detail-value">${b.fullName}</div></div>
      <div class="detail-item"><div class="detail-label">ตำแหน่ง</div><div class="detail-value">${b.position}</div></div>
      <div class="detail-item"><div class="detail-label">ฝ่ายงาน</div><div class="detail-value">${b.department}</div></div>
      <div class="detail-item"><div class="detail-label">ห้องที่จอง</div><div class="detail-value">${b.room}</div></div>
      <div class="detail-item full"><div class="detail-label">วัตถุประสงค์</div><div class="detail-value">${b.purpose}</div></div>
      <div class="detail-item"><div class="detail-label">วันที่ใช้</div><div class="detail-value">${formatDateThai(b.bookingDate)}</div></div>
      <div class="detail-item"><div class="detail-label">เวลา</div><div class="detail-value">${b.startTime}–${b.endTime} น.</div></div>
      <div class="detail-item"><div class="detail-label">จำนวนผู้ใช้ห้อง</div><div class="detail-value">${b.studentCount || '–'} คน</div></div>
      <div class="detail-item"><div class="detail-label">ระดับชั้น / กลุ่มผู้ใช้</div><div class="detail-value">${b.grade || '–'}</div></div>
      <div class="detail-item full"><div class="detail-label">รูปแบบการจัดห้อง</div><div class="detail-value">${b.roomLayout || '–'}</div></div>
      <div class="detail-item"><div class="detail-label">สถานะ</div><div class="detail-value"><span class="status-badge ${b.status}">${statusLabel(b.status)}</span></div></div>
      <div class="detail-item"><div class="detail-label">วันที่ยื่นจอง</div><div class="detail-value">${formatDateTimeThai(b.createdAt)}</div></div>
    </div>
  `;
  document.getElementById('bookingDetailModal').classList.remove('hidden');
}
function closeBookingDetail() { document.getElementById('bookingDetailModal').classList.add('hidden'); }
function printCurrentDetail() {
  if (!state.currentDetailId) return;
  const b = getBookingById(state.currentDetailId);
  if (b) openPrintPreview(b);
}

// ============================================================
// EDIT BOOKING
// ============================================================
function editBooking(id) {
  const b = getBookingById(id);
  if (!b) return;
  state.editingId = id;

  const options = getFormOptions();
  const deptList = options.departments || [];
  const deptOptionsHtml = deptList.map(d => `<option value="${escapeHtml(d)}" ${b.department === d ? 'selected' : ''}>${escapeHtml(d)}</option>`).join('') +
    (b.department && !deptList.includes(b.department) ? `<option value="${escapeHtml(b.department)}" selected>${escapeHtml(b.department)}</option>` : '');

  const posList = options.positions || [];
  const isPosInList = posList.includes(b.position);
  const isPosOther = Boolean(b.position && !isPosInList);

  let posOptionsHtml = posList.map(p => `<option value="${escapeHtml(p)}" ${b.position === p ? 'selected' : ''}>${escapeHtml(p)}</option>`).join('');
  if (options.allowOtherPosition) {
    posOptionsHtml += `<option value="อื่น ๆ" ${isPosOther ? 'selected' : ''}>อื่น ๆ (ระบุ)</option>`;
  }

  document.getElementById('editBody').innerHTML = `
    <div class="form-group"><label class="form-label required">ชื่อ-นามสกุล</label><input id="e_fullName" class="form-input" value="${escapeHtml(b.fullName)}" /></div>
    <div class="form-group">
      <label class="form-label required">ตำแหน่ง</label>
      <select id="e_position" class="form-select" onchange="toggleEditOtherPosition()">
        <option value="">-- เลือกตำแหน่ง --</option>
        ${posOptionsHtml}
      </select>
      <input type="text" id="e_positionOther" class="form-input mt-8 ${isPosOther ? '' : 'hidden'}" value="${isPosOther ? escapeHtml(b.position) : ''}" placeholder="ระบุตำแหน่ง..." />
    </div>
    <div class="form-group">
      <label class="form-label required">ฝ่ายงาน</label>
      <select id="e_dept" class="form-select">
        <option value="">-- เลือกฝ่ายงาน --</option>
        ${deptOptionsHtml}
      </select>
    </div>
    <div class="form-group"><label class="form-label required">ห้องที่จอง</label><input id="e_room" class="form-input" value="${escapeHtml(b.room)}" /></div>
    <div class="form-group"><label class="form-label required">วัตถุประสงค์</label><textarea id="e_purpose" class="form-textarea" rows="2">${escapeHtml(b.purpose)}</textarea></div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
      <div class="form-group"><label class="form-label required">วันที่</label><input type="date" id="e_date" class="form-input" value="${b.bookingDate}" /></div>
      <div class="form-group"><label class="form-label required">เวลาเริ่ม</label><input type="time" id="e_start" class="form-input" value="${b.startTime}" /></div>
      <div class="form-group"><label class="form-label required">เวลาสิ้นสุด</label><input type="time" id="e_end" class="form-input" value="${b.endTime}" /></div>
    </div>
    <div class="form-group"><label class="form-label required">จำนวนผู้ใช้ห้อง (คน)</label><input id="e_students" class="form-input" type="number" value="${b.studentCount || ''}" /></div>
    <div class="form-group"><label class="form-label required">ระดับชั้น / กลุ่มผู้ใช้</label><input id="e_grade" class="form-input" value="${escapeHtml(b.grade || '')}" /></div>
    <div class="form-group"><label class="form-label required">รูปแบบการจัดห้อง</label><input id="e_layout" class="form-input" value="${escapeHtml(b.roomLayout || '')}" /></div>
  `;
  document.getElementById('editModal').classList.remove('hidden');
}
function closeEdit() { document.getElementById('editModal').classList.add('hidden'); state.editingId = null; }

async function saveEdit() {
  const id = state.editingId;
  if (!id) return;
  const bookings = getBookings();
  const targetIdStr = String(id !== null && id !== undefined ? id : '').trim();
  const idx = bookings.findIndex(b => String(b.id !== null && b.id !== undefined ? b.id : '').trim() === targetIdStr);
  if (idx === -1) return;

  const e_posSel = document.getElementById('e_position')?.value || '';
  const e_posOther = document.getElementById('e_positionOther')?.value.trim() || '';
  const isPosOtherChoice = (e_posSel === 'อื่น ๆ' || e_posSel === 'อื่นๆ' || e_posSel.startsWith('อื่น'));
  const e_finalPos = isPosOtherChoice ? e_posOther : e_posSel;

  const newRoomStr = document.getElementById('e_room').value.trim() || bookings[idx].room;
  const updated = {
    ...bookings[idx],
    fullName:     document.getElementById('e_fullName').value.trim() || bookings[idx].fullName,
    position:     e_finalPos || bookings[idx].position,
    department:   document.getElementById('e_dept').value.trim()     || bookings[idx].department,
    room:         newRoomStr,
    rooms:        getRoomsList({ room: newRoomStr }),
    purpose:      document.getElementById('e_purpose').value.trim()  || bookings[idx].purpose,
    bookingDate:  document.getElementById('e_date').value            || bookings[idx].bookingDate,
    startTime:    document.getElementById('e_start').value           || bookings[idx].startTime,
    endTime:      document.getElementById('e_end').value             || bookings[idx].endTime,
    studentCount: document.getElementById('e_students').value,
    grade:        document.getElementById('e_grade').value,
    roomLayout:   document.getElementById('e_layout').value,
    editedAt:     new Date().toISOString(),
  };

  if (updated.startTime >= updated.endTime) {
    showToast('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น', 'error'); return;
  }

  const conflict = hasConflict(updated, id);
  if (conflict) {
    const c = conflict.conflictWith;
    showToast(`มีการจองซ้ำห้อง ${conflict.conflictingRooms.join(', ')} กับ "${c.fullName}" เวลา ${c.startTime}–${c.endTime} น.`, 'error');
    return;
  }

  bookings[idx] = updated;
  saveBookings(bookings);

  showToast('กำลังบันทึกการแก้ไขไปยังฐานข้อมูล...', 'info');
  renderAdmin();
  renderCalendar();

  if (checkIsGoogleSheetsConfigured()) {
    await sendGoogleSheetsAction('update', { booking: updated });
    await fetchGoogleSheetsBookings(true);
  }

  closeEdit();
  showToast('แก้ไขการจองสำเร็จ ✅', 'success');
}

// ============================================================
// REPORT (daily / weekly / monthly / yearly)
// ============================================================
function initAdminReport() {
  const now     = new Date();
  const mSel    = document.getElementById('reportMonth');
  const ySel    = document.getElementById('reportYear');
  const dateEl  = document.getElementById('reportDate');
  const weekEl  = document.getElementById('reportWeek');

  if (!mSel.options.length) {
    THAI_MONTHS.forEach((m, i) => mSel.add(new Option(m, i)));
    mSel.value = now.getMonth();
  }
  if (!ySel.options.length) {
    for (let y = now.getFullYear(); y >= now.getFullYear() - 5; y--) {
      ySel.add(new Option(y + 543, y));
    }
    ySel.value = now.getFullYear();
  }
  if (!dateEl.value) dateEl.value = toDateStr(now);
  if (!weekEl.value) {
    // Set current week
    const yw = getISOWeekYear(now);
    weekEl.value = `${yw.year}-W${String(yw.week).padStart(2,'0')}`;
  }

  handleReportPeriodChange();
  renderAdminReport();
}

function handleReportPeriodChange() {
  const type = document.getElementById('reportPeriodType').value;
  document.getElementById('reportDateWrap').classList.add('hidden');
  document.getElementById('reportWeekWrap').classList.add('hidden');
  document.getElementById('reportMonthWrap').classList.add('hidden');
  document.getElementById('reportYearSelectWrap').classList.add('hidden');

  if (type === 'daily')   document.getElementById('reportDateWrap').classList.remove('hidden');
  if (type === 'weekly')  document.getElementById('reportWeekWrap').classList.remove('hidden');
  if (type === 'monthly') {
    document.getElementById('reportMonthWrap').classList.remove('hidden');
    document.getElementById('reportYearSelectWrap').classList.remove('hidden');
  }
  if (type === 'yearly')  document.getElementById('reportYearSelectWrap').classList.remove('hidden');
  renderAdminReport();
}

function getReportBookings() {
  const type = document.getElementById('reportPeriodType')?.value || 'monthly';
  const all  = getBookings();

  if (type === 'daily') {
    const d = document.getElementById('reportDate')?.value || toDateStr(new Date());
    return all.filter(b => b.bookingDate === d);
  }
  if (type === 'weekly') {
    const wVal = document.getElementById('reportWeek')?.value || '';
    if (!wVal) return [];
    return all.filter(b => {
      if (!b.bookingDate) return false;
      return getIsoWeekString(b.bookingDate) === wVal;
    });
  }
  if (type === 'monthly') {
    const m = parseInt(document.getElementById('reportMonth')?.value ?? new Date().getMonth(), 10);
    const y = parseInt(document.getElementById('reportYear')?.value  ?? new Date().getFullYear(), 10);
    return all.filter(b => {
      if (!b.bookingDate) return false;
      const parts = b.bookingDate.split('-');
      if (parts.length < 3) return false;
      const bYear = parseInt(parts[0], 10);
      const bMonth = parseInt(parts[1], 10) - 1;
      return bYear === y && bMonth === m;
    });
  }
  if (type === 'yearly') {
    const y = parseInt(document.getElementById('reportYear')?.value ?? new Date().getFullYear(), 10);
    return all.filter(b => {
      if (!b.bookingDate) return false;
      const bYear = parseInt(b.bookingDate.split('-')[0], 10);
      return bYear === y;
    });
  }
  return [];
}

function renderAdminReport() {
  const bookings  = getReportBookings();
  const approved  = bookings.filter(b => b.status === 'approved');
  const cancelled = bookings.filter(b => b.status === 'cancelled');
  const hours     = approved.reduce((s, b) => s + timeDiffHours(b.startTime, b.endTime), 0);

  // Summary cards
  const cards = document.getElementById('reportSummaryCards');
  if (cards) {
    cards.innerHTML = `
      <div class="stat-card"><div class="stat-value">${bookings.length}</div><div class="stat-label">จองทั้งหมด</div></div>
      <div class="stat-card"><div class="stat-value">${approved.length}</div><div class="stat-label">จองสำเร็จ</div></div>
      <div class="stat-card"><div class="stat-value">${cancelled.length}</div><div class="stat-label">ยกเลิก</div></div>
    `;
  }

  // Room summary
  const allRooms = [...new Set(bookings.flatMap(b => {
    const list = getRoomsList(b);
    return list.length > 0 ? list : [b.room];
  }))].sort();
  const roomBody = document.getElementById('reportRoomBody');
  if (roomBody) {
    roomBody.innerHTML = allRooms.length ? allRooms.map(r => {
      const rb  = bookings.filter(b => {
        const list = getRoomsList(b);
        return list.includes(r) || b.room === r;
      });
      const rh  = rb.filter(b => b.status === 'approved').reduce((s, b) => s + timeDiffHours(b.startTime, b.endTime), 0);
      return `<tr>
        <td>${r}</td>
        <td><strong>${rb.length}</strong></td>
        <td>${rh.toFixed(1)} ชม.</td>
        <td>${rb.filter(b => b.status === 'cancelled').length}</td>
      </tr>`;
    }).join('') : `<tr><td colspan="4" style="text-align:center;padding:20px;color:#9ca3af;">ไม่มีข้อมูล</td></tr>`;
  }

  // Detail table
  const detBody = document.getElementById('reportDetailBody');
  if (detBody) {
    detBody.innerHTML = bookings.length ? bookings
      .sort((a, b) => new Date(a.bookingDate) - new Date(b.bookingDate))
      .map((b, i) => `<tr>
        <td style="text-align:center;font-weight:700;">${i + 1}</td>
        <td>${escapeHtml(b.fullName)}</td>
        <td style="text-align:center;">${escapeHtml(b.position || '-')}</td>
        <td style="text-align:center;">${escapeHtml(b.department || '-')}</td>
        <td style="text-align:center;">${escapeHtml(b.room)}</td>
        <td style="text-align:center;">${formatDateThai(b.bookingDate)}</td>
        <td style="text-align:center;white-space:nowrap;">${b.startTime}–${b.endTime} น.</td>
        <td style="text-align:center;"><span class="status-badge ${b.status}">${statusLabel(b.status)}</span></td>
      </tr>`).join('')
      : `<tr><td colspan="8" style="text-align:center;padding:20px;color:#9ca3af;">ไม่มีข้อมูลในช่วงเวลานี้</td></tr>`;
  }
}

function buildReportHTML(bookings, periodLabel) {
  const totalCount     = bookings.length;
  const approvedCount  = bookings.filter(b => b.status === 'approved').length;
  const cancelledCount = bookings.filter(b => b.status === 'cancelled').length;

  // Smart Table calculation (คำนวณขนาดอักษรและระยะห่างอัจฉริยะให้อยู่ในบรรทัดเดียวเสมอ)
  const maxNameLen = Math.max(...bookings.map(b => (b.fullName || '').length), 0);
  const maxDeptLen = Math.max(...bookings.map(b => (b.department || '').length), 0);
  const maxRoomLen = Math.max(...bookings.map(b => (b.room || '').length), 0);
  const rowCount   = bookings.length;

  let fontSizePt = 7.6;
  let cellPadding = '5px 4px';
  if (rowCount > 20 || maxNameLen > 24 || maxDeptLen > 22 || maxRoomLen > 20) {
    fontSizePt = 6.4;
    cellPadding = '3px 2px';
  } else if (rowCount > 12 || maxNameLen > 18 || maxDeptLen > 18 || maxRoomLen > 16) {
    fontSizePt = 7.0;
    cellPadding = '4px 3px';
  }

  // 1. ตารางรายละเอียดการจองทั้งหมด (ตารางแรก)
  const sortedBookings = [...bookings].sort((a, b) => 
    new Date(a.bookingDate) - new Date(b.bookingDate) || (a.startTime || '').localeCompare(b.startTime || '')
  );

  const detailRows = sortedBookings.length ? sortedBookings.map((b, i) => `
    <tr style="height:22px;">
      <td style="text-align:center;font-weight:700;border:1px solid #cbd5e1;padding:${cellPadding};white-space:nowrap;font-size:${fontSizePt}pt;">${i + 1}</td>
      <td style="text-align:left;border:1px solid #cbd5e1;padding:${cellPadding};padding-left:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:${fontSizePt}pt;" title="${escapeHtml(b.fullName)}">${escapeHtml(b.fullName)}</td>
      <td style="text-align:center;border:1px solid #cbd5e1;padding:${cellPadding};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:${fontSizePt}pt;">${escapeHtml(b.position || '-')}</td>
      <td style="text-align:center;border:1px solid #cbd5e1;padding:${cellPadding};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:${fontSizePt}pt;" title="${escapeHtml(b.department || '-')}">${escapeHtml(b.department || '-')}</td>
      <td style="text-align:center;border:1px solid #cbd5e1;padding:${cellPadding};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:${fontSizePt}pt;" title="${escapeHtml(b.room)}">${escapeHtml(b.room)}</td>
      <td style="text-align:center;border:1px solid #cbd5e1;padding:${cellPadding};white-space:nowrap;font-size:${fontSizePt}pt;">${formatDateThai(b.bookingDate)}</td>
      <td style="text-align:center;border:1px solid #cbd5e1;padding:${cellPadding};white-space:nowrap;font-size:${fontSizePt}pt;">${b.startTime}–${b.endTime} น.</td>
      <td style="text-align:center;border:1px solid #cbd5e1;padding:${cellPadding};white-space:nowrap;">
        <span style="display:inline-block;padding:1px 5px;border-radius:3px;font-size:${Math.max(6.2, fontSizePt - 0.4)}pt;font-weight:700;background:${b.status === 'approved' ? '#dcfce7;color:#166534;' : '#fee2e2;color:#991b1b;'}">
          ${statusLabel(b.status)}
        </span>
      </td>
    </tr>
  `).join('') : `<tr><td colspan="8" style="text-align:center;padding:14px;color:#6b7280;border:1px solid #cbd5e1;">ไม่มีข้อมูลการจองในช่วงเวลานี้</td></tr>`;

  // 2. ตารางสรุปการจองแยกตามสถานที่ (ตารางที่สอง)
  const allRooms = [...new Set(bookings.flatMap(b => {
    const list = getRoomsList(b);
    return list.length > 0 ? list : [b.room];
  }))].sort();

  let totalVenueBookings = 0;
  let totalVenueHours = 0;
  let totalVenueCancelled = 0;

  const roomSummaryRows = allRooms.map(r => {
    const rb = bookings.filter(b => {
      const list = getRoomsList(b);
      return list.includes(r) || b.room === r;
    });
    const rh = rb.filter(b => b.status === 'approved').reduce((s, b) => s + timeDiffHours(b.startTime, b.endTime), 0);
    const rc = rb.filter(b => b.status === 'cancelled').length;

    totalVenueBookings += rb.length;
    totalVenueHours += rh;
    totalVenueCancelled += rc;

    return `<tr>
      <td style="text-align:left;border:1px solid #cbd5e1;padding:6px 10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(r)}</td>
      <td style="text-align:center;font-weight:700;border:1px solid #cbd5e1;padding:6px 4px;white-space:nowrap;">${rb.length}</td>
      <td style="text-align:center;border:1px solid #cbd5e1;padding:6px 4px;white-space:nowrap;">${rh.toFixed(1)} ชม.</td>
      <td style="text-align:center;border:1px solid #cbd5e1;padding:6px 4px;white-space:nowrap;color:${rc > 0 ? '#b91c1c' : '#475569'};">${rc}</td>
    </tr>`;
  }).join('');

  const summaryFooterRow = allRooms.length ? `
    <tr style="background:#f1f5f9;font-weight:700;">
      <td style="text-align:left;border:1px solid #cbd5e1;padding:6px 10px;color:#0f2444;">รวมทั้งหมด (${allRooms.length} สถานที่)</td>
      <td style="text-align:center;border:1px solid #cbd5e1;padding:6px 4px;color:#0f2444;">${totalVenueBookings}</td>
      <td style="text-align:center;border:1px solid #cbd5e1;padding:6px 4px;color:#0f2444;">${totalVenueHours.toFixed(1)} ชม.</td>
      <td style="text-align:center;border:1px solid #cbd5e1;padding:6px 4px;color:#b91c1c;">${totalVenueCancelled}</td>
    </tr>
  ` : '';

  return `
    <div style="font-family:'Sarabun','Noto Sans Thai',sans-serif;color:#0f172a;background:#ffffff;box-sizing:border-box;width:100%;max-width:760px;margin:0 auto;padding:2px 0;">
      
      <!-- ================= หน้าที่ 1 : ตารางรายละเอียดการจองทั้งหมด (ตารางแรก) ================= -->
      <div>
        <div style="text-align:center;border-bottom:2px solid #0f2444;padding-bottom:6px;margin-bottom:10px;">
          <h1 style="font-size:13.5pt;font-weight:800;color:#0f2444;margin:0 0 2px;">โรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัย ปทุมธานี</h1>
          <p style="font-size:9pt;color:#475569;margin:0 0 4px;">ฝ่ายบริหารงานทั่วไป — ระบบจองใช้สถานที่</p>
          <div style="display:inline-block;background:#ea580c;color:#ffffff;font-size:8.8pt;font-weight:700;padding:2px 14px;border-radius:12px;margin-top:2px;">รายงานสรุปการใช้สถานที่ (${periodLabel})</div>
        </div>

        <div style="display:flex;justify-content:space-between;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:5px 12px;margin-bottom:10px;font-size:7.8pt;">
          <div>
            <span style="margin-right:12px;">รายการทั้งหมด: <strong style="color:#0f2444;">${totalCount}</strong></span>
            <span style="margin-right:12px;">จองสำเร็จ: <strong style="color:#15803d;">${approvedCount}</strong></span>
            <span>ยกเลิก: <strong style="color:#b91c1c;">${cancelledCount}</strong></span>
          </div>
          <div>ออกรายงานเมื่อ: ${formatDateTimeThai(new Date().toISOString())}</div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin:8px 0 5px;border-bottom:1.5px solid #fdba74;padding-bottom:3px;">
          <span style="font-size:9.2pt;font-weight:700;color:#0f2444;">ตารางที่ 1: รายละเอียดการจองทั้งหมด</span>
          <span style="font-size:7.5pt;color:#64748b;">จำนวน ${sortedBookings.length} รายการ</span>
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:8px;table-layout:fixed;font-size:${fontSizePt}pt;">
          <thead>
            <tr style="background:#0f2444;color:#ffffff;">
              <th style="padding:${cellPadding};text-align:center;border:1px solid #0f2444;width:5%;white-space:nowrap;">ลำดับ</th>
              <th style="padding:${cellPadding};padding-left:6px;text-align:left;border:1px solid #0f2444;width:19%;white-space:nowrap;">ชื่อ-นามสกุล</th>
              <th style="padding:${cellPadding};text-align:center;border:1px solid #0f2444;width:12%;white-space:nowrap;">ตำแหน่ง</th>
              <th style="padding:${cellPadding};text-align:center;border:1px solid #0f2444;width:17%;white-space:nowrap;">ฝ่ายงาน</th>
              <th style="padding:${cellPadding};text-align:center;border:1px solid #0f2444;width:17%;white-space:nowrap;">ห้อง/สถานที่</th>
              <th style="padding:${cellPadding};text-align:center;border:1px solid #0f2444;width:12%;white-space:nowrap;">วันที่ใช้</th>
              <th style="padding:${cellPadding};text-align:center;border:1px solid #0f2444;width:10%;white-space:nowrap;">เวลา</th>
              <th style="padding:${cellPadding};text-align:center;border:1px solid #0f2444;width:8%;white-space:nowrap;">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            ${detailRows}
          </tbody>
        </table>
      </div>

      <!-- ================= PAGE BREAK (แยกสรุปเป็นหน้าถัดไป ไม่รวมหน้าเดียวกัน) ================= -->
      <div class="html2pdf__page-break" style="page-break-before:always;break-before:page;height:0;line-height:0;margin:0;padding:0;"></div>

      <!-- ================= หน้าที่ 2 : ตารางสรุปการจองแยกตามสถานที่ (ตารางที่สอง) & ลายเซ็น ================= -->
      <div style="padding-top:6px;">
        <div style="text-align:center;border-bottom:2px solid #0f2444;padding-bottom:6px;margin-bottom:12px;">
          <h2 style="font-size:12.5pt;font-weight:800;color:#0f2444;margin:0 0 2px;">โรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัย ปทุมธานี</h2>
          <p style="font-size:8.8pt;color:#475569;margin:0 0 3px;">สรุปสถิติการใช้สถานที่แยกตามห้อง/สถานที่ (${periodLabel})</p>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin:8px 0 5px;border-bottom:1.5px solid #fdba74;padding-bottom:3px;">
          <span style="font-size:9.2pt;font-weight:700;color:#0f2444;">ตารางที่ 2: สรุปการจองแยกตามสถานที่</span>
          <span style="font-size:7.5pt;color:#64748b;">รวมทั้งหมด ${allRooms.length} สถานที่</span>
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;table-layout:fixed;font-size:8pt;">
          <thead>
            <tr style="background:#0f2444;color:#ffffff;">
              <th style="padding:6px 10px;text-align:left;border:1px solid #0f2444;width:40%;white-space:nowrap;">ห้อง/สถานที่</th>
              <th style="padding:6px 4px;text-align:center;border:1px solid #0f2444;width:20%;white-space:nowrap;">จำนวนครั้ง</th>
              <th style="padding:6px 4px;text-align:center;border:1px solid #0f2444;width:20%;white-space:nowrap;">ชั่วโมงรวม</th>
              <th style="padding:6px 4px;text-align:center;border:1px solid #0f2444;width:20%;white-space:nowrap;">ยกเลิก</th>
            </tr>
          </thead>
          <tbody>
            ${roomSummaryRows || '<tr><td colspan="4" style="text-align:center;padding:12px;color:#6b7280;border:1px solid #cbd5e1;">ไม่มีข้อมูลการจองแยกตามสถานที่</td></tr>'}
            ${summaryFooterRow}
          </tbody>
        </table>

        <!-- Signature Section -->
        <div style="display:flex;justify-content:space-between;margin-top:40px;padding:0 24px;page-break-inside:avoid;">
          <div style="text-align:center;width:230px;font-size:8.2pt;">
            <div style="border-bottom:1px dotted #475569;height:28px;margin-bottom:8px;"></div>
            <p style="margin:2px 0;">( ............................................................ )</p>
            <p style="margin:2px 0;font-weight:700;color:#0f2444;">ผู้จัดทำรายงาน</p>
            <p style="margin:2px 0;color:#64748b;font-size:7.5pt;">วันที่ ........ / ................ / ............</p>
          </div>
          <div style="text-align:center;width:230px;font-size:8.2pt;">
            <div style="border-bottom:1px dotted #475569;height:28px;margin-bottom:8px;"></div>
            <p style="margin:2px 0;">( ............................................................ )</p>
            <p style="margin:2px 0;font-weight:700;color:#0f2444;">หัวหน้าฝ่ายบริหารงานทั่วไป</p>
            <p style="margin:2px 0;color:#64748b;font-size:7.5pt;">วันที่ ........ / ................ / ............</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function exportReportPDF() {
  const bookings    = getReportBookings();
  const type        = document.getElementById('reportPeriodType')?.value || 'monthly';
  const periodLabel = getPeriodLabel(type);
  const btn         = document.getElementById('btnExportPdf');
  const origBtnText = btn ? btn.innerHTML : '';

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '⏳ กำลังสร้างไฟล์ PDF...';
  }

  showToast('⏳ กำลังสร้างไฟล์รายงาน PDF กรุณารอสักครู่...', 'info');

  const cleanFilename = `รายงานสรุปการใช้สถานที่_${periodLabel.replace(/[/\\:\*\?"<>\|\s]/g, '_')}.pdf`;
  const reportHtml    = buildReportHTML(bookings, periodLabel);

  if (typeof html2pdf !== 'undefined') {
    // ติดตั้งลงใน off-screen container ที่ top:0 left:0 เพื่อป้องกัน scroll offset ไม่ให้เกิดช่องว่างสีขาวด้านบน
    const mount = document.createElement('div');
    mount.id = 'reportPdfMount';
    mount.style.cssText = 'position:fixed;top:0;left:0;width:780px;background:#ffffff;z-index:-99999;opacity:1;pointer-events:none;';
    mount.innerHTML = reportHtml;
    document.body.appendChild(mount);

    const opt = {
      margin:       [8, 8, 8, 8],
      filename:     cleanFilename,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { 
        scale: 2, 
        useCORS: true, 
        logging: false,
        scrollY: 0,
        scrollX: 0,
        windowWidth: 794
      },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak:    { mode: ['css', 'legacy'] }
    };
    try {
      await html2pdf().set(opt).from(mount).save();
      showToast('✅ ดาวน์โหลดรายงาน PDF ลงเครื่องเรียบร้อยแล้ว', 'success');
    } catch (err) {
      console.error('html2pdf generation error, fallback to print window:', err);
      printDoc(reportHtml, true);
    } finally {
      mount.remove();
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origBtnText;
      }
    }
  } else {
    printDoc(reportHtml, true);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origBtnText;
    }
  }
}

function printReportDoc() {
  const bookings    = getReportBookings();
  const type        = document.getElementById('reportPeriodType')?.value || 'monthly';
  const periodLabel = getPeriodLabel(type);
  const reportHtml    = buildReportHTML(bookings, periodLabel);
  printDoc(reportHtml, true);
}

function getPeriodLabel(type) {
  const now = new Date();
  if (type === 'daily') return `วันที่ ${formatDateThai(document.getElementById('reportDate')?.value || toDateStr(now))}`;
  if (type === 'weekly') return `สัปดาห์: ${document.getElementById('reportWeek')?.value || ''}`;
  if (type === 'monthly') {
    const m = parseInt(document.getElementById('reportMonth')?.value ?? now.getMonth());
    const y = parseInt(document.getElementById('reportYear')?.value  ?? now.getFullYear());
    return `ประจำเดือน ${THAI_MONTHS[m]} ${y + 543}`;
  }
  if (type === 'yearly') {
    const y = parseInt(document.getElementById('reportYear')?.value ?? now.getFullYear());
    return `ประจำปี พ.ศ. ${y + 543}`;
  }
  return '';
}

// ============================================================
// PRINT
// ============================================================
function openPrintPreview(b) {
  if (!b) return;
  const html = `
    <div class="slip-print-container">
      <h2>ใบจองสถานที่</h2>
      <div class="slip-school">
        โรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัย ปทุมธานี<br>
        ฝ่ายบริหารงานทั่วไป — ระบบจองใช้สถานที่
      </div>
      <table class="slip-table">
        <tr><td class="slip-label">ชื่อ-นามสกุล</td><td>${escapeHtml(b.fullName)}</td></tr>
        <tr><td class="slip-label">ตำแหน่ง</td><td>${escapeHtml(b.position || '-')}</td></tr>
        <tr><td class="slip-label">ฝ่ายงาน</td><td>${escapeHtml(b.department || '-')}</td></tr>
        <tr><td class="slip-label">ห้องที่จอง</td><td><strong>${escapeHtml(b.room)}</strong></td></tr>
        <tr><td class="slip-label">วัตถุประสงค์</td><td>${escapeHtml(b.purpose || '-')}</td></tr>
        <tr><td class="slip-label">จำนวนผู้ใช้ห้อง</td><td>${b.studentCount || '–'} คน</td></tr>
        <tr><td class="slip-label">ระดับชั้น / กลุ่มผู้ใช้</td><td>${escapeHtml(b.grade || '–')}</td></tr>
        <tr><td class="slip-label">วันที่ใช้</td><td>${formatDateThai(b.bookingDate)}</td></tr>
        <tr><td class="slip-label">เวลา</td><td>${b.startTime}–${b.endTime} น.</td></tr>
        <tr><td class="slip-label">รูปแบบการจัดห้อง</td><td>${escapeHtml(b.roomLayout || '–')}</td></tr>
        <tr><td class="slip-label">สถานะ</td><td>${statusLabel(b.status)}</td></tr>
        <tr><td class="slip-label">วันที่ยื่นจอง</td><td>${formatDateTimeThai(b.createdAt)}</td></tr>
      </table>
      <div style="margin-top:48px;display:flex;justify-content:space-between;gap:40px">
        <div style="text-align:center;flex:1"><div style="width:160px;border-top:1px solid #000;margin:0 auto;padding-top:6px">ผู้จอง</div></div>
        <div style="text-align:center;flex:1"><div style="width:160px;border-top:1px solid #000;margin:0 auto;padding-top:6px">ผู้อนุมัติ</div></div>
      </div>
    </div>`;
  printDoc(html, false);
}

function printDoc(html, isReport = false) {
  const w = window.open('', '_blank', 'width=900,height=700');
  const title = isReport ? 'รายงานสรุปการใช้สถานที่' : 'พิมพ์ใบจองสถานที่';
  w.document.write(`<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: 'Sarabun', sans-serif;
      margin: 0;
      padding: 0;
      color: #0f172a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @page {
      size: A4 portrait;
      margin: 8mm 8mm 10mm 8mm;
    }
    .html2pdf__page-break {
      page-break-before: always !important;
      break-before: page !important;
      height: 0 !important;
      line-height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    /* === REPORT SUMMARY STYLES === */
    .report-print-container {
      width: 100%;
      padding: 6px 4px;
    }
    .report-print-header {
      text-align: center;
      margin-bottom: 8px;
      border-bottom: 2px solid #0f2444;
      padding-bottom: 6px;
    }
    .school-heading {
      font-size: 1.15rem;
      font-weight: 700;
      color: #0f2444;
      margin: 0 0 2px;
      line-height: 1.25;
    }
    .sub-heading {
      font-size: 0.9rem;
      font-weight: 500;
      color: #475569;
      margin: 0 0 4px;
    }
    .report-badge-title {
      display: inline-block;
      background: #0f2444;
      color: #ffffff;
      font-size: 0.82rem;
      font-weight: 700;
      padding: 3px 14px;
      border-radius: 4px;
      margin-top: 2px;
    }
    .report-meta-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      padding: 5px 10px;
      font-size: 7.8pt;
      margin-bottom: 8px;
      border-radius: 4px;
    }
    .meta-item span { color: #64748b; }
    .print-time-txt { color: #64748b; font-style: italic; }

    .report-summary-table {
      width: 100% !important;
      border-collapse: collapse !important;
      table-layout: fixed !important;
      font-size: 8pt !important;
      margin: 4px 0 12px !important;
    }
    .report-summary-table th,
    .report-summary-table td {
      border: 1px solid #94a3b8 !important;
      padding: 3.5px 4px !important;
      vertical-align: middle !important;
      line-height: 1.25 !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      box-sizing: border-box !important;
      height: 22px !important;
      max-height: 22px !important;
    }
    .report-summary-table th {
      background: #0f2444 !important;
      color: #ffffff !important;
      font-weight: 700 !important;
      font-size: 8.2pt !important;
      text-align: center !important;
    }
    .report-summary-table tbody tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .report-summary-table th.col-num,
    .report-summary-table td.col-num {
      width: 6.5% !important;
      text-align: center !important;
      font-weight: 700 !important;
    }
    .report-summary-table th.col-name,
    .report-summary-table td.col-name {
      width: 21.5% !important;
      text-align: left !important;
    }
    .report-summary-table th.col-dept,
    .report-summary-table td.col-dept {
      width: 19% !important;
      text-align: left !important;
    }
    .report-summary-table th.col-room,
    .report-summary-table td.col-room {
      width: 21% !important;
      text-align: left !important;
    }
    .report-summary-table th.col-date,
    .report-summary-table td.col-date {
      width: 13% !important;
      text-align: center !important;
    }
    .report-summary-table th.col-time,
    .report-summary-table td.col-time {
      width: 10.5% !important;
      text-align: center !important;
    }
    .report-summary-table th.col-status,
    .report-summary-table td.col-status {
      width: 8.5% !important;
      text-align: center !important;
    }
    .badge-approved {
      display: inline-block;
      padding: 1px 4px;
      border-radius: 3px;
      font-size: 7.2pt;
      font-weight: 600;
      background: #dcfce7;
      color: #166534;
    }
    .badge-cancelled {
      display: inline-block;
      padding: 1px 4px;
      border-radius: 3px;
      font-size: 7.2pt;
      font-weight: 600;
      background: #fee2e2;
      color: #991b1b;
    }
    .report-signatures-section {
      margin-top: 30px;
      display: flex;
      justify-content: space-between;
      padding: 0 30px;
      page-break-inside: avoid;
    }
    .sig-box {
      text-align: center;
      width: 230px;
    }
    .sig-line {
      border-bottom: 1px dotted #475569;
      height: 24px;
      margin-bottom: 6px;
    }
    .sig-name {
      font-size: 8pt;
      color: #1e293b;
      margin: 2px 0;
    }
    .sig-role {
      font-size: 8pt;
      font-weight: 600;
      color: #0f2444;
      margin: 2px 0;
    }
    .sig-date {
      font-size: 7.5pt;
      color: #64748b;
      margin: 3px 0 0;
    }

    /* === SLIP (SINGLE BOOKING) STYLES === */
    .slip-print-container {
      padding: 16mm;
    }
    .slip-print-container h2 {
      font-size: 1.25rem;
      text-align: center;
      margin-bottom: 6px;
      color: #0f2444;
    }
    .slip-school {
      text-align: center;
      color: #555;
      font-size: 0.9rem;
      margin-bottom: 20px;
      line-height: 1.6;
    }
    .slip-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }
    .slip-table th, .slip-table td {
      border: 1px solid #ccc;
      padding: 8px 12px;
    }
    .slip-table td.slip-label {
      font-weight: 700;
      color: #374151;
      width: 32%;
      background: #f8fafc;
    }
  </style>
</head>
<body>${html}</body>
</html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 600);
}

// ============================================================
// ADMIN CLEAR BOOKINGS MODAL & HANDLERS
// ============================================================
async function openClearDataModal() {
  const modal = document.getElementById('clearDataModal');
  if (!modal) return;
  initClearDataModal();
  modal.classList.remove('hidden');
  updateClearPreview();

  // ตรวจสอบสถานะการเชื่อมต่อฐานข้อมูลสดๆ
  const statusEl = document.getElementById('gasStatusInClearModal');
  if (statusEl) {
    if (checkIsSupabaseActive()) {
      statusEl.innerHTML = '🟢 <strong>Supabase Cloud:</strong> เชื่อมต่อฐานข้อมูล พร้อมลบข้อมูลจริงทันที';
    } else {
      statusEl.innerHTML = '⏳ กำลังตรวจสอบการเชื่อมต่อ...';
      try {
        const health = await checkGoogleAppsScriptHealth();
        if (!checkIsGoogleSheetsConfigured()) {
          statusEl.innerHTML = '⚠️ โหมดออฟไลน์ (ยังไม่ได้ตั้งค่าฐานข้อมูล)';
        } else if (health.supportsClear) {
          statusEl.innerHTML = '🟢 <strong>Google Sheets:</strong> พร้อมรองรับการล้างข้อมูล (v' + (health.version || '2.1.0') + ')';
        } else if (health.online && !health.supportsClear) {
          statusEl.innerHTML = '🟠 <strong>Google Sheets:</strong> ยังเป็นสคริปต์เวอร์ชันเดิม (ต้องอัปเดตเพื่อลบแถวใน Sheet)';
        } else {
          statusEl.innerHTML = '⚪ ไม่สามารถเชื่อมต่อฐานข้อมูลได้ขณะนี้ (ล้างข้อมูลเฉพาะบนเว็บ)';
        }
      } catch (_) {
        statusEl.innerHTML = '⚪ ตรวจสอบการเชื่อมต่อฐานข้อมูลไม่สำเร็จ';
      }
    }
  }
}

function closeClearDataModal() {
  const modal = document.getElementById('clearDataModal');
  if (modal) modal.classList.add('hidden');
}

function openAppsScriptHelpModal() {
  const modal = document.getElementById('appsScriptHelpModal');
  if (modal) modal.classList.remove('hidden');
}

function closeAppsScriptHelpModal() {
  const modal = document.getElementById('appsScriptHelpModal');
  if (modal) modal.classList.add('hidden');
}

function initClearDataModal() {
  // Populate months
  const mSelect = document.getElementById('clearMonthSelect');
  if (mSelect && mSelect.options.length === 0) {
    THAI_MONTHS.forEach((m, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = m;
      if (i === new Date().getMonth()) opt.selected = true;
      mSelect.appendChild(opt);
    });
  }

  // Populate years
  const ySelect = document.getElementById('clearYearSelect');
  if (ySelect && ySelect.options.length === 0) {
    const curYear = new Date().getFullYear();
    for (let y = curYear - 2; y <= curYear + 3; y++) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y + 543;
      if (y === curYear) opt.selected = true;
      ySelect.appendChild(opt);
    }
  }

  // Set default date and week
  const dateInput = document.getElementById('clearDateInput');
  if (dateInput && !dateInput.value) {
    dateInput.value = toDateStr(new Date());
  }

  const weekInput = document.getElementById('clearWeekInput');
  if (weekInput && !weekInput.value) {
    const today = new Date();
    weekInput.value = getIsoWeekString(toDateStr(today));
  }

  // Reset confirmation checkbox and button
  const chk = document.getElementById('chkConfirmClear');
  if (chk) chk.checked = false;
  toggleClearSubmitBtn();
}

function getIsoWeekString(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function onClearScopeChange() {
  const scope = document.querySelector('input[name="clearScope"]:checked')?.value || 'all';
  const mWrap = document.getElementById('clearParamMonthWrap');
  const wWrap = document.getElementById('clearParamWeekWrap');
  const dWrap = document.getElementById('clearParamDateWrap');

  if (mWrap) mWrap.classList.toggle('hidden', scope !== 'monthly');
  if (wWrap) wWrap.classList.toggle('hidden', scope !== 'weekly');
  if (dWrap) dWrap.classList.toggle('hidden', scope !== 'daily');

  updateClearPreview();
}

function getTargetClearBookings() {
  const scope = document.querySelector('input[name="clearScope"]:checked')?.value || 'all';
  const statusFilter = document.getElementById('clearStatusFilter')?.value || 'all';
  const allBookings = getBookings();

  return allBookings.filter(b => {
    // 1. Status filter
    if (statusFilter !== 'all' && b.status !== statusFilter) {
      return false;
    }

    // 2. Scope filter
    if (scope === 'all') {
      return true;
    }

    if (!b.bookingDate) return false;

    if (scope === 'daily') {
      const selectedDate = document.getElementById('clearDateInput')?.value || '';
      return b.bookingDate === selectedDate;
    }

    if (scope === 'weekly') {
      const selectedWeek = document.getElementById('clearWeekInput')?.value || '';
      return getIsoWeekString(b.bookingDate) === selectedWeek;
    }

    if (scope === 'monthly') {
      const selMonth = parseInt(document.getElementById('clearMonthSelect')?.value ?? 0, 10);
      const selYear = parseInt(document.getElementById('clearYearSelect')?.value ?? new Date().getFullYear(), 10);
      const parts = b.bookingDate.split('-');
      if (parts.length < 3) return false;
      const bYear = parseInt(parts[0], 10);
      const bMonth = parseInt(parts[1], 10) - 1;
      return bYear === selYear && bMonth === selMonth;
    }

    return false;
  });
}

function updateClearPreview() {
  const countEl = document.getElementById('clearPreviewCount');
  const textEl = document.getElementById('clearPreviewText');
  const target = getTargetClearBookings();

  if (countEl) {
    countEl.textContent = `${target.length} รายการ`;
  }
  if (textEl) {
    if (target.length === 0) {
      textEl.textContent = 'ไม่พบข้อมูลที่ตรงกับเงื่อนไขที่เลือก';
    } else {
      textEl.textContent = checkIsSupabaseActive()
        ? `รายการที่จะถูกลบออกจากระบบและฐานข้อมูล Supabase`
        : `รายการที่จะถูกลบออกจากระบบและ Google Sheets`;
    }
  }

  toggleClearSubmitBtn();
}

function toggleClearSubmitBtn() {
  const chk = document.getElementById('chkConfirmClear');
  const btn = document.getElementById('btnExecuteClear');
  const target = getTargetClearBookings();

  if (btn) {
    const canSubmit = Boolean(chk && chk.checked && target.length > 0);
    btn.disabled = !canSubmit;
  }
}

async function executeClearBookings() {
  const target = getTargetClearBookings();
  if (target.length === 0) {
    showToast('ไม่มีรายการที่ตรงกับเงื่อนไขที่ต้องล้าง', 'warning');
    return;
  }

  const scope = document.querySelector('input[name="clearScope"]:checked')?.value || 'all';
  const statusFilter = document.getElementById('clearStatusFilter')?.value || 'all';
  const isFullWipe = (scope === 'all' && statusFilter === 'all');
  const targetIds = target.map(b => String(b.id !== null && b.id !== undefined ? b.id : '').trim()).filter(Boolean);
  const targetIdSet = new Set(targetIds);

  const btn = document.getElementById('btnExecuteClear');
  const originalHtml = btn ? btn.innerHTML : '';

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '⏳ กำลังล้างข้อมูล...';
  }

  try {
    // 1. นำข้อมูลออกจากระบบในเครื่องทันที และบันทึก ID ที่ลบลงในแคช
    const currentBookings = getBookings();
    const remaining = isFullWipe ? [] : currentBookings.filter(b => {
      const bId = String(b.id !== null && b.id !== undefined ? b.id : '').trim();
      return !targetIdSet.has(bId);
    });
    saveBookings(remaining);
    addDeletedIds(targetIds);

    // 2. รีเฟรชตารางหน้า Admin และ ปฏิทิน ทันที
    renderAdmin();
    renderCalendar();

    // 3. ซิงค์คำสั่งล้างข้อมูลไปยัง Supabase / Cloud
    let clearResult = null;
    if (checkIsSupabaseActive()) {
      showToast('กำลังลบข้อมูลออกจาก Supabase Cloud...', 'info');
      clearResult = await sendGoogleSheetsClear({
        mode: isFullWipe ? 'all' : 'selected',
        ids: targetIds
      });
    } else if (checkIsGoogleSheetsConfigured()) {
      showToast('กำลังล้างข้อมูลใน Google Sheets...', 'info');
      clearResult = await sendGoogleSheetsClear({
        mode: isFullWipe ? 'all' : 'selected',
        ids: targetIds
      });
    }

    closeClearDataModal();

    if (clearResult && clearResult.success) {
      const dbLabel = checkIsSupabaseActive() ? 'Supabase' : 'Google Sheets';
      showToast(`ล้างข้อมูลทั้งบนเว็บและ ${dbLabel} สำเร็จ (${targetIds.length} รายการ) 🗑️`, 'success');
    } else if (clearResult && !clearResult.success) {
      showToast(`ล้างข้อมูลบนเว็บเรียบร้อยแล้ว (${targetIds.length} รายการ) แต่การลบบนคลาวด์ติดขัด: ${clearResult.message || ''}`, 'warning');
      if (!checkIsSupabaseActive()) {
        openAppsScriptHelpModal();
      }
    } else {
      showToast(`ล้างข้อมูลสำเร็จจำนวน ${targetIds.length} รายการ 🗑️`, 'success');
    }
  } catch (err) {
    console.error('Error executing clear:', err);
    showToast('เกิดข้อผิดพลาดในการล้างข้อมูล', 'danger');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

// ============================================================
// TOAST
// ============================================================
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  t.className = `toast ${type}`;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 3500);
}

// ============================================================
// DATE / TIME UTILITIES
// ============================================================
function toDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function formatDateThai(s) {
  if (!s) return '–';
  const d = new Date(s);
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear()+543}`;
}
function formatDateTimeThai(s) {
  if (!s) return '–';
  const d = new Date(s);
  const pad = n => String(n).padStart(2,'0');
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear()+543} ${pad(d.getHours())}:${pad(d.getMinutes())} น.`;
}
function timeDiffHours(s, e) {
  if (!s || !e) return 0;
  const [sh,sm] = s.split(':').map(Number);
  const [eh,em] = e.split(':').map(Number);
  return ((eh*60+em)-(sh*60+sm))/60;
}
function statusLabel(s) {
  return {approved:'จองแล้ว', cancelled:'ยกเลิก'}[s] || s;
}
function getISOWeekYear(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return {
    year: d.getUTCFullYear(),
    week: Math.ceil((((d - yearStart) / 86400000) + 1) / 7),
  };
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Set min date to today
  const dateInput = document.getElementById('bookingDate');
  if (dateInput) dateInput.min = toDateStr(new Date());

  // Initialize Dynamic Form Options
  refreshAllFormOptions();

  // Expose globals for inline onclick
  window.getBookingById          = getBookingById;
  window.openPrintPreview        = openPrintPreview;
  window.handleRoomChange        = handleRoomChange;
  window.switchClassroomGrade    = switchClassroomGrade;
  window.toggleClassroomRoom      = toggleClassroomRoom;
  window.selectAllCurrentGrade   = selectAllCurrentGrade;
  window.clearClassroomSelection = clearClassroomSelection;
  window.removeSelectedClassroom = removeSelectedClassroom;
  window.manualRefreshData       = manualRefreshData;
  window.toggleOtherPosition     = toggleOtherPosition;
  window.toggleEditOtherPosition = toggleEditOtherPosition;
  window.exportReportPDF         = exportReportPDF;
  window.switchOptSubTab         = switchOptSubTab;
  window.addNewPosition          = addNewPosition;
  window.deletePosition          = deletePosition;
  window.toggleAllowOtherPosSetting = toggleAllowOtherPosSetting;
  window.addNewDepartment       = addNewDepartment;
  window.deleteDepartment       = deleteDepartment;
  window.addRoomToCategory       = addRoomToCategory;
  window.deleteRoom              = deleteRoom;
  window.addNewCategory          = addNewCategory;
  window.deleteCategory          = deleteCategory;
  window.addClassroomSubRoom     = addClassroomSubRoom;
  window.deleteClassroomSubRoom  = deleteClassroomSubRoom;
  window.switchClassroomOptGrade = switchClassroomOptGrade;
  window.addNewLayoutPreset      = addNewLayoutPreset;
  window.deleteLayoutPreset      = deleteLayoutPreset;
  window.addNewGroupPreset       = addNewGroupPreset;
  window.deleteGroupPreset       = deleteGroupPreset;
  window.saveAdminOptions        = saveAdminOptions;
  window.resetFormOptionsToDefault = resetFormOptionsToDefault;
  window.fillPreset              = fillPreset;
  window.handleManagePeriodChange = handleManagePeriodChange;
  window.resetManagePeriod       = resetManagePeriod;
  window.initAdminManagePeriod   = initAdminManagePeriod;
  window.toggleCalScroll         = toggleCalScroll;
  window.viewBookingDetail       = viewBookingDetail;
  window.closeDayDetail          = closeDayDetail;

  // Calendar horizontal scroll listener for toggle button text
  const calWrap = document.getElementById('calendarScrollWrap');
  if (calWrap) {
    calWrap.addEventListener('scroll', () => {
      const btn = document.getElementById('btnToggleCalScroll');
      if (!btn) return;
      const maxScroll = calWrap.scrollWidth - calWrap.clientWidth;
      if (maxScroll <= 10) return;
      if (calWrap.scrollLeft > maxScroll * 0.7) {
        btn.textContent = '⏪ เลื่อนไปซ้ายสุด';
      } else if (calWrap.scrollLeft < maxScroll * 0.3) {
        btn.textContent = 'เลื่อนไปขวาสุด ⏩';
      }
    }, { passive: true });
  }

  // Close modals on overlay click
  ['adminLoginModal','successModal','bookingDetailModal','editModal','conflictModal','clearDataModal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', function(e) {
      if (e.target === this) {
        this.classList.add('hidden');
        if (id === 'editModal') state.editingId = null;
      }
    });
  });
  document.getElementById('dayDetailModal')?.addEventListener('click', function(e) {
    if (e.target === this) closeDayDetail();
  });

  // Report period type change listener
  document.getElementById('reportPeriodType')?.addEventListener('change', handleReportPeriodChange);

  // Load bookings from Cloud on start
  fetchGoogleSheetsBookings();

  // Instant re-sync เมื่อสลับแท็บหรือคลิกกลับมาที่หน้าต่างเบราว์เซอร์
  window.addEventListener('focus', () => fetchGoogleSheetsBookings(true));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) fetchGoogleSheetsBookings(true);
  });

  // Background auto-sync ทุก 8 วินาที (รองรับกรณี WebSocket ติดไฟร์วอลล์โรงเรียน)
  setInterval(() => {
    fetchGoogleSheetsBookings(true);
  }, 8000);

  showPage('booking');
});
