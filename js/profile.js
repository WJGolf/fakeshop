/* ==========================================================================
   profile.js — หน้า "โปรไฟล์ของฉัน" (profile.html)
   แก้ไขชื่อที่แสดง/เบอร์ติดต่อ และแสดงรายการสินค้าที่ผู้ใช้เคยลงขาย
   ========================================================================== */

const profileForm = document.getElementById("profileForm");
const saveBtn = document.getElementById("saveBtn");
const alertBox = document.getElementById("alertBox");
const myListingsEl = document.getElementById("myListings");

function showAlert(message, type = "success") {
  alertBox.textContent = message;
  alertBox.className = `alert show alert-${type}`;
}

const STATUS_LABEL = { approved: "อนุมัติแล้ว", pending: "รออนุมัติ", rejected: "ปฏิเสธแล้ว" };

function listingCardHtml(p) {
  const imgUrl = p.image_url ? getPublicImageUrl(p.image_url) : null;
  return `
    <div class="my-listing-row">
      ${imgUrl ? `<img class="row-thumb" src="${escapeHtml(imgUrl)}" alt="">` : `<div class="row-thumb" style="display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--ink-soft);">ไม่มีรูป</div>`}
      <div style="flex:1;">
        <strong>${escapeHtml(p.name)}</strong><br>
        <span style="color:var(--ink-soft); font-size:13px;">${formatBaht(p.price)} · ${Number(p.quantity)} ชิ้น</span>
      </div>
      <span class="status-badge status-${p.status}">${STATUS_LABEL[p.status] || p.status}</span>
    </div>
  `;
}

async function loadMyListings(userId) {
  const { data, error } = await supabaseClient
    .from("products")
    .select("id, name, image_url, price, quantity, status")
    .eq("seller_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    myListingsEl.innerHTML = `<p style="color:var(--rust);">โหลดรายการไม่สำเร็จ: ${escapeHtml(error.message)}</p>`;
    return;
  }

  if (!data || data.length === 0) {
    myListingsEl.innerHTML = `<p style="color:var(--ink-soft);">คุณยังไม่เคยลงขายสินค้า — <a href="sell.html" style="color:var(--teal-700); font-weight:600;">เริ่มลงขายเลย</a></p>`;
    return;
  }

  myListingsEl.innerHTML = data.map(listingCardHtml).join("");
}

profileForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  alertBox.className = "alert";

  const displayName = document.getElementById("displayName").value.trim();
  const phone = document.getElementById("phone").value.trim();

  saveBtn.disabled = true;
  saveBtn.textContent = "กำลังบันทึก...";

  const { data: { session } } = await supabaseClient.auth.getSession();
  const { error } = await supabaseClient
    .from("profiles")
    .update({ display_name: displayName || null, phone: phone || null })
    .eq("id", session.user.id);

  saveBtn.disabled = false;
  saveBtn.textContent = "บันทึกการเปลี่ยนแปลง";

  if (error) {
    showAlert("บันทึกไม่สำเร็จ: " + error.message, "error");
    return;
  }
  showAlert("บันทึกข้อมูลเรียบร้อยแล้ว", "success");
});

(async function init() {
  const ctx = await requireLogin("login.html");
  if (!ctx) return;

  const navLinks = document.getElementById("navLinks");
  await renderAuthNav(navLinks, "");

  document.getElementById("emailReadonly").value = ctx.profile.email;
  document.getElementById("roleReadonly").value = ROLE_LABELS[ctx.profile.role] || ctx.profile.role;
  document.getElementById("displayName").value = ctx.profile.display_name || "";
  document.getElementById("phone").value = ctx.profile.phone || "";

  await loadMyListings(ctx.user.id);
})();
