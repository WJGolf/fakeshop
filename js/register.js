/* ==========================================================================
   register.js — หน้า "สมัครสมาชิก" (register.html)
   สมัครผ่าน Supabase Auth แล้วอัปเดตชื่อที่แสดง/เบอร์ติดต่อลงในโปรไฟล์
   (โปรไฟล์ตัวตั้งต้นถูกสร้างอัตโนมัติโดย trigger ฝั่งฐานข้อมูล role='member')
   ========================================================================== */

const registerForm = document.getElementById("registerForm");
const registerBtn = document.getElementById("registerBtn");
const alertBox = document.getElementById("alertBox");

function showAlert(message, type = "error") {
  alertBox.textContent = message;
  alertBox.className = `alert show alert-${type}`;
}

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  alertBox.className = "alert";

  const displayName = document.getElementById("displayName").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const passwordConfirm = document.getElementById("passwordConfirm").value;

  if (password !== passwordConfirm) {
    showAlert("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
    return;
  }

  registerBtn.disabled = true;
  registerBtn.textContent = "กำลังสมัครสมาชิก...";

  try {
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) throw new Error(error.message);

    // ถ้าโปรเจกต์เปิดให้ยืนยันอีเมลก่อน จะยังไม่มี session ตรงนี้
    if (data.session && data.user) {
      const { error: profileError } = await supabaseClient
        .from("profiles")
        .update({ display_name: displayName || null, phone: phone || null })
        .eq("id", data.user.id);

      if (profileError) console.warn("อัปเดตโปรไฟล์ไม่สำเร็จ:", profileError.message);

      window.location.href = "profile.html";
      return;
    }

    showAlert("สมัครสมาชิกสำเร็จ! กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชี แล้วเข้าสู่ระบบอีกครั้ง", "success");
    registerForm.reset();
  } catch (err) {
    showAlert(err.message || "สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่");
  } finally {
    registerBtn.disabled = false;
    registerBtn.textContent = "สมัครสมาชิก";
  }
});
