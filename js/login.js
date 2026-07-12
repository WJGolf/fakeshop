/* ==========================================================================
   login.js — หน้า "เข้าสู่ระบบ" (login.html)
   ใช้บัญชีเดียวกันสำหรับทุกคน (สมาชิก/แอดมิน/เจ้าของร้าน) แล้วพาไปหน้าที่เหมาะสม
   ========================================================================== */

const loginForm = document.getElementById("loginForm");
const loginBtn = document.getElementById("loginBtn");
const alertBox = document.getElementById("alertBox");

function showAlert(message) {
  alertBox.textContent = message;
  alertBox.className = "alert show alert-error";
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  alertBox.className = "alert";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  loginBtn.disabled = true;
  loginBtn.textContent = "กำลังเข้าสู่ระบบ...";

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw new Error("อีเมลหรือรหัสผ่านไม่ถูกต้อง");

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profile && ["admin", "owner"].includes(profile.role)) {
      window.location.href = "admin/dashboard.html";
    } else {
      window.location.href = "profile.html";
    }
  } catch (err) {
    showAlert(err.message || "เข้าสู่ระบบไม่สำเร็จ");
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "เข้าสู่ระบบ";
  }
});
