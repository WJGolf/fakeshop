/* ==========================================================================
   forgot-password.js — หน้า "ขอรีเซ็ตรหัสผ่าน" (forgot-password.html)
   ผู้ใช้ที่ลืมรหัสผ่าน (ยังล็อกอินไม่ได้) ส่งคำขอเข้ามาที่นี่ — ไม่ต้องล็อกอิน
   แอดมิน/เจ้าของร้านจะเห็นคำขอในหลังร้าน แล้วตั้งรหัสผ่านใหม่ให้ จากนั้นติดต่อ
   กลับไปแจ้งรหัสผ่านใหม่ทางช่องทางที่ผู้ใช้ระบุไว้ (ไม่ได้ส่งอีเมลอัตโนมัติ)
   ========================================================================== */

const forgotForm = document.getElementById("forgotForm");
const sendBtn = document.getElementById("sendBtn");
const alertBox = document.getElementById("alertBox");

function showAlert(message, type = "error") {
  alertBox.textContent = message;
  alertBox.className = `alert show alert-${type}`;
}

forgotForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  alertBox.className = "alert";

  const email = document.getElementById("email").value.trim();
  const contact = document.getElementById("contact").value.trim();
  const note = document.getElementById("note").value.trim();

  if (!email || !contact) {
    showAlert("กรุณากรอกอีเมลและช่องทางติดต่อกลับให้ครบถ้วน");
    return;
  }

  sendBtn.disabled = true;
  sendBtn.textContent = "กำลังส่งคำขอ...";

  const { error } = await supabaseClient.from("password_reset_requests").insert({
    email,
    contact,
    note: note || null,
  });

  sendBtn.disabled = false;
  sendBtn.textContent = "ส่งคำขอรีเซ็ตรหัสผ่าน";

  if (error) {
    showAlert("ส่งคำขอไม่สำเร็จ: " + error.message);
    return;
  }

  forgotForm.reset();
  showAlert("ส่งคำขอเรียบร้อยแล้ว! แอดมินจะตรวจสอบและติดต่อกลับไปทางช่องทางที่คุณระบุพร้อมรหัสผ่านใหม่", "success");
});
