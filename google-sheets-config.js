// ============================================================
// GOOGLE SHEETS CONFIGURATION
// ระบบจองใช้สถานที่ โรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัย ปทุมธานี
// ============================================================
// นำ Web App URL ที่ได้จากการ Deploy Google Apps Script มาวางในเครื่องหมายคำพูดด้านล่างนี้:
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyMLwIsaxhf0y7t62H2mBzmJvVqM15NUr_d4oJDtZ5n1ZWhz1Q0EI14QTove0X-gS0LjQ/exec";

// ตรวจสอบว่าได้ตั้งค่า Google Apps Script URL แล้วหรือไม่
const isGoogleSheetsConfigured = Boolean(
  typeof GOOGLE_SCRIPT_URL === 'string' &&
  GOOGLE_SCRIPT_URL.trim().length > 0 &&
  GOOGLE_SCRIPT_URL.startsWith("https://script.google.com/macros/s/") &&
  !GOOGLE_SCRIPT_URL.includes("YOUR_SCRIPT_ID")
);
