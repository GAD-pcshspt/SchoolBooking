// ============================================================
// FIREBASE CONFIGURATION
// ระบบจองใช้สถานที่ โรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัย ปทุมธานี
// ============================================================
// 1. ไปที่ https://console.firebase.google.com
// 2. สร้างโปรเจกต์ใหม่ (เช่น pccpl-booking)
// 3. ไปที่ Project settings > General > Your apps > เพิ่ม Web App (</>)
// 4. นำค่า firebaseConfig ที่ได้มาวางทับด้านล่างนี้ได้เลยครับ:

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// ตรวจสอบว่าได้ตั้งค่า Firebase แล้วหรือไม่
const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== "YOUR_API_KEY" &&
  firebaseConfig.projectId !== "YOUR_PROJECT_ID"
);

let db = null;

if (isFirebaseConfigured && typeof firebase !== 'undefined') {
  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    console.log("✅ Firebase Firestore Connected Successfully!");
  } catch (error) {
    console.error("❌ Firebase init error:", error);
  }
}
