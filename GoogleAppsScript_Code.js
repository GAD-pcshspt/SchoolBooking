/**
 * ============================================================
 * ระบบจองใช้สถานที่ โรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัย ปทุมธานี
 * โค้ดสำหรับ Google Apps Script (นำไปวางใน Extensions > Apps Script)
 * ============================================================
 */

const SHEET_NAME = 'Bookings';
const SPREADSHEET_ID = '1ep3wX36onpkwY8SrDc8ujQ6Pvxxo610QZBKEA9i_Mew'; // Google Sheet ID

function getOrCreateSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    const headers = [
      'ID', 'วันที่ยื่นจอง', 'ชื่อ-นามสกุล', 'ตำแหน่ง', 'ฝ่ายงาน',
      'ห้องที่จอง', 'ห้องแบบแยก (JSON)', 'วัตถุประสงค์', 'จำนวนผู้ใช้ห้อง',
      'ระดับชั้น/กลุ่มผู้ใช้', 'วันที่ใช้', 'เวลาเริ่มต้น', 'เวลาสิ้นสุด',
      'รูปแบบการจัดห้อง', 'สถานะ'
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#1e3a5f')
      .setFontColor('#ffffff')
      .setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  }
  return sheet;
}

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'getBookings';
  const sheet = getOrCreateSheet();

  // ตรวจสอบการเชื่อมต่อและฟีเจอร์ที่รองรับ
  if (action === 'ping') {
    return jsonResponse({
      success: true,
      message: 'pong',
      version: '2.1.0',
      features: ['getBookings', 'create', 'cancel', 'update', 'clear']
    });
  }

  if (action === 'getBookings') {
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return jsonResponse({ success: true, bookings: [] });
    }

    const bookings = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0] && row[0] !== 0) continue; // Skip empty rows

      let roomsArr = [];
      try {
        roomsArr = row[6] ? JSON.parse(row[6]) : [];
      } catch (err) {
        roomsArr = row[5] ? row[5].toString().split(',').map(s => s.trim()) : [];
      }

      // Format date strings
      let bDateStr = '';
      if (row[10] instanceof Date) {
        const d = row[10];
        bDateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      } else {
        bDateStr = String(row[10] || '').trim();
      }

      // Format time strings
      let startTimeStr = formatTimeValue(row[11]);
      let endTimeStr = formatTimeValue(row[12]);

      bookings.push({
        id: Number(row[0]) || row[0],
        createdAt: row[1] ? (row[1] instanceof Date ? row[1].toISOString() : String(row[1])) : '',
        fullName: String(row[2] || ''),
        position: String(row[3] || ''),
        department: String(row[4] || ''),
        room: String(row[5] || ''),
        rooms: roomsArr,
        purpose: String(row[7] || ''),
        studentCount: String(row[8] || ''),
        grade: String(row[9] || ''),
        bookingDate: bDateStr,
        startTime: startTimeStr,
        endTime: endTimeStr,
        roomLayout: String(row[13] || ''),
        status: String(row[14] || 'approved')
      });
    }

    return jsonResponse({ success: true, bookings: bookings });
  }

  // ล้างข้อมูลการจองผ่าน GET (Clear Bookings via GET)
  if (action === 'clear') {
    const mode = (e && e.parameter && e.parameter.mode) || '';
    const idsParam = (e && e.parameter && e.parameter.ids) || '';
    const data = sheet.getDataRange().getValues();

    if (mode === 'all') {
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
      }
      return jsonResponse({ success: true, message: 'ล้างข้อมูลทั้งหมดเรียบร้อยแล้ว', count: Math.max(0, lastRow - 1) });
    }

    if (idsParam) {
      const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean);
      const idSet = {};
      for (let k = 0; k < ids.length; k++) {
        idSet[ids[k]] = true;
      }
      let deletedCount = 0;
      for (let i = data.length - 1; i >= 1; i--) {
        const rowId = String(data[i][0] !== null && data[i][0] !== undefined ? data[i][0] : '').trim();
        if (rowId && idSet[rowId]) {
          sheet.deleteRow(i + 1);
          deletedCount++;
        }
      }
      return jsonResponse({ success: true, message: 'ล้างข้อมูลสำเร็จจำนวน ' + deletedCount + ' รายการ', count: deletedCount });
    }

    return jsonResponse({ success: false, message: 'ไม่พบพารามิเตอร์ที่ต้องการล้างข้อมูล' });
  }

  return jsonResponse({ success: false, message: 'Invalid action' });
}

function doPost(e) {
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        payload = {};
      }
    }
    if (!payload.action && e && e.parameter && e.parameter.action) {
      payload.action = e.parameter.action;
      payload.mode = e.parameter.mode;
      if (e.parameter.ids) {
        try {
          payload.ids = JSON.parse(e.parameter.ids);
        } catch (_) {
          payload.ids = e.parameter.ids.split(',').map(s => s.trim());
        }
      }
    }

    const action = payload.action;
    const sheet = getOrCreateSheet();

    // บันทึกการจองใหม่
    if (action === 'create') {
      const b = payload.booking;
      if (!b) return jsonResponse({ success: false, message: 'ไม่มีข้อมูล booking' });
      const roomsJson = JSON.stringify(b.rooms || []);
      sheet.appendRow([
        b.id,
        b.createdAt || new Date().toISOString(),
        b.fullName || '',
        b.position || '',
        b.department || '',
        b.room || '',
        roomsJson,
        b.purpose || '',
        b.studentCount || '',
        b.grade || '',
        b.bookingDate || '',
        b.startTime || '',
        b.endTime || '',
        b.roomLayout || '',
        b.status || 'approved'
      ]);
      return jsonResponse({ success: true, message: 'บันทึกสำเร็จ', booking: b });
    }

    // ยกเลิกการจอง
    if (action === 'cancel') {
      const targetId = String(payload.id !== null && payload.id !== undefined ? payload.id : '').trim();
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        const rowId = String(data[i][0] !== null && data[i][0] !== undefined ? data[i][0] : '').trim();
        if (rowId === targetId) {
          sheet.getRange(i + 1, 15).setValue('cancelled'); // Column 15 คือ สถานะ
          return jsonResponse({ success: true, message: 'ยกเลิกการจองสำเร็จ' });
        }
      }
      return jsonResponse({ success: false, message: 'ไม่พบรายการจองนี้' });
    }

    // แก้ไขการจอง
    if (action === 'update') {
      const b = payload.booking;
      if (!b) return jsonResponse({ success: false, message: 'ไม่มีข้อมูล booking' });
      const targetId = String(b.id !== null && b.id !== undefined ? b.id : '').trim();
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        const rowId = String(data[i][0] !== null && data[i][0] !== undefined ? data[i][0] : '').trim();
        if (rowId === targetId) {
          const rowIdx = i + 1;
          sheet.getRange(rowIdx, 3).setValue(b.fullName || '');
          sheet.getRange(rowIdx, 4).setValue(b.position || '');
          sheet.getRange(rowIdx, 5).setValue(b.department || '');
          sheet.getRange(rowIdx, 6).setValue(b.room || '');
          sheet.getRange(rowIdx, 7).setValue(JSON.stringify(b.rooms || []));
          sheet.getRange(rowIdx, 8).setValue(b.purpose || '');
          sheet.getRange(rowIdx, 9).setValue(b.studentCount || '');
          sheet.getRange(rowIdx, 10).setValue(b.grade || '');
          sheet.getRange(rowIdx, 11).setValue(b.bookingDate || '');
          sheet.getRange(rowIdx, 12).setValue(b.startTime || '');
          sheet.getRange(rowIdx, 13).setValue(b.endTime || '');
          sheet.getRange(rowIdx, 14).setValue(b.roomLayout || '');
          if (b.status) sheet.getRange(rowIdx, 15).setValue(b.status);
          return jsonResponse({ success: true, message: 'แก้ไขสำเร็จ' });
        }
      }
      return jsonResponse({ success: false, message: 'ไม่พบรายการจองนี้' });
    }

    // ล้างข้อมูลการจอง (Clear Bookings)
    if (action === 'clear') {
      const mode = payload.mode || '';
      const ids = payload.ids || [];
      const data = sheet.getDataRange().getValues();

      if (mode === 'all') {
        // ล้างข้อมูลทั้งหมด ยกเว้นหัวตารางแถว 1
        const lastRow = sheet.getLastRow();
        if (lastRow > 1) {
          sheet.deleteRows(2, lastRow - 1);
        }
        return jsonResponse({ success: true, message: 'ล้างข้อมูลทั้งหมดเรียบร้อยแล้ว', count: Math.max(0, lastRow - 1) });
      }

      // ลบเฉพาะรายการที่ระบุ ID (ลบจากล่างขึ้นบนเพื่อป้องกัน index เลื่อน)
      if (Array.isArray(ids) && ids.length > 0) {
        const idSet = {};
        for (let k = 0; k < ids.length; k++) {
          const s = String(ids[k] !== null && ids[k] !== undefined ? ids[k] : '').trim();
          if (s) idSet[s] = true;
        }
        let deletedCount = 0;
        for (let i = data.length - 1; i >= 1; i--) {
          const rowId = String(data[i][0] !== null && data[i][0] !== undefined ? data[i][0] : '').trim();
          if (rowId && idSet[rowId]) {
            sheet.deleteRow(i + 1);
            deletedCount++;
          }
        }
        return jsonResponse({ success: true, message: 'ล้างข้อมูลสำเร็จจำนวน ' + deletedCount + ' รายการ', count: deletedCount });
      }

      return jsonResponse({ success: false, message: 'ไม่พบรายการที่ต้องล้างข้อมูล' });
    }

    return jsonResponse({ success: false, message: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function formatTimeValue(val) {
  if (!val) return '';
  if (val instanceof Date) {
    const hh = String(val.getHours()).padStart(2, '0');
    const mm = String(val.getMinutes()).padStart(2, '0');
    return hh + ':' + mm;
  }
  return String(val).trim();
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
