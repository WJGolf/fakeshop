/* ==========================================================================
   auth.js — ระบบสมาชิก: ดึงโปรไฟล์ปัจจุบัน, ตรวจสิทธิ์, วาดเมนูตามสถานะล็อกอิน
   โหลดไฟล์นี้หลัง supabaseClient.js ในทุกหน้าที่เกี่ยวข้องกับสมาชิก/สิทธิ์
   ========================================================================== */

const ROLE_LABELS = { member: "สมาชิก", admin: "แอดมิน", owner: "เจ้าของร้าน" };

/**
 * คืนค่า { user, profile } ของผู้ใช้ที่ล็อกอินอยู่ หรือ null ถ้ายังไม่ล็อกอิน
 */
async function getCurrentProfile() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return null;

  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("id, email, display_name, phone, role, wallet_balance, created_at")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error || !profile) return null;
  return { user: session.user, profile };
}

/** บังคับต้องล็อกอิน ไม่งั้นเด้งไปหน้า login */
async function requireLogin(redirectTo = "login.html") {
  const ctx = await getCurrentProfile();
  if (!ctx) {
    window.location.href = redirectTo;
    return null;
  }
  return ctx;
}

/** บังคับต้องเป็นแอดมินหรือเจ้าของร้าน ไม่งั้นเด้งออก */
async function requireStaff(redirectTo = "../login.html") {
  const ctx = await getCurrentProfile();
  if (!ctx || !["admin", "owner"].includes(ctx.profile.role)) {
    window.location.href = redirectTo;
    return null;
  }
  return ctx;
}

/** บังคับต้องเป็นเจ้าของร้านเท่านั้น */
async function requireOwner(redirectTo = "../index.html") {
  const ctx = await getCurrentProfile();
  if (!ctx || ctx.profile.role !== "owner") {
    window.location.href = redirectTo;
    return null;
  }
  return ctx;
}

async function logout(redirectTo = "index.html") {
  await supabaseClient.auth.signOut();
  window.location.href = redirectTo;
}

/**
 * วาดลิงก์ในแถบเมนูให้ตรงกับสถานะล็อกอิน
 * navEl = element ของ <nav class="nav-links">
 * basePath = "" สำหรับหน้าระดับบนสุด, "../" สำหรับหน้าใน admin/
 */
async function renderAuthNav(navEl, basePath = "") {
  if (!navEl) return;
  const ctx = await getCurrentProfile();

  const slot = document.createElement("span");
  slot.className = "nav-auth-slot";

  if (!ctx) {
    slot.innerHTML = `
      <a href="${basePath}login.html">เข้าสู่ระบบ</a>
      <a href="${basePath}register.html" class="primary">สมัครสมาชิก</a>
    `;
  } else {
    const staffLink = ["admin", "owner"].includes(ctx.profile.role)
      ? `<a href="${basePath}admin/dashboard.html">หลังร้าน</a>`
      : "";
    slot.innerHTML = `
      <a href="${basePath}wallet.html">💰 ${formatBaht(ctx.profile.wallet_balance)}</a>
      <a href="${basePath}profile.html">👤 ${escapeHtml(ctx.profile.display_name || "โปรไฟล์ของฉัน")}</a>
      ${staffLink}
      <a href="#" id="navLogoutBtn">ออกจากระบบ</a>
    `;
  }

  navEl.appendChild(slot);

  const logoutBtn = slot.querySelector("#navLogoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      await logout(basePath + "index.html");
    });
  }
}
