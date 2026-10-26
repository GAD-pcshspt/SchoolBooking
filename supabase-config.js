// ============================================================
// SUPABASE CONFIGURATION
// ระบบจองใช้สถานที่ โรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัย ปทุมธานี
// ============================================================

// 1. นำ Project URL ที่ได้จาก Supabase Dashboard มาวางในเครื่องหมายคำพูดด้านล่างนี้:
// (ตัด /rest/v1/ ออกให้เป็น Base URL เรียบร้อยครับ)
const SUPABASE_URL = "https://jhewgztpysfikbsqjzfr.supabase.co";

// 2. นำ anon / publishable key ที่ได้จาก Supabase Dashboard มาวางในเครื่องหมายคำพูดด้านล่างนี้:
const SUPABASE_ANON_KEY = "sb_publishable_qV_rFLV8OPN4dQ6th-Kn6w_hvsr5AMs";

// ตรวจสอบว่าได้ตั้งค่า Supabase เรียบร้อยแล้วหรือไม่
const isSupabaseConfigured = Boolean(
  typeof SUPABASE_URL === 'string' &&
  SUPABASE_URL.trim().length > 0 &&
  SUPABASE_URL.startsWith('https://') &&
  !SUPABASE_URL.includes('YOUR_SUPABASE_PROJECT_URL') &&
  typeof SUPABASE_ANON_KEY === 'string' &&
  SUPABASE_ANON_KEY.trim().length > 0 &&
  !SUPABASE_ANON_KEY.includes('YOUR_SUPABASE_ANON_KEY')
);

// สร้าง Supabase Client สำหรับเชื่อมต่อฐานข้อมูล
let supabaseClient = null;

if (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
  if (isSupabaseConfigured) {
    try {
      const cleanUrl = SUPABASE_URL.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
      // การล็อกอินแอดมินเก็บใน sessionStorage: รีเฟรชหน้ายังล็อกอินอยู่ แต่ปิดเบราว์เซอร์แล้วต้องล็อกอินใหม่
      // (กันลืมออกจากระบบบนเครื่องส่วนกลาง)
      supabaseClient = supabase.createClient(cleanUrl, SUPABASE_ANON_KEY.trim(), {
        auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true },
      });
      console.log("✅ Supabase Client Initialized Successfully!");
    } catch (err) {
      console.error("❌ Supabase Init Error:", err);
    }
  }
}
