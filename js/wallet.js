/* ==========================================================================
   wallet.js — หน้า "กระเป๋าเงินของฉัน" (wallet.html)
   - เติมเงิน: อัปโหลดสลิป ส่งคำขอรออนุมัติ (แอดมินกรอกยอดเองตอนอนุมัติ)
   - คำสั่งซื้อของฉัน (ในฐานะผู้ซื้อ) — ยกเลิกเองได้ถ้ายังไม่ถูกยืนยัน
   - ยอดขายของฉัน (ในฐานะผู้ขาย) — ขอยกเลิก/คืนเงินได้ตอนที่ยืนยันแล้ว (รอแอดมินอนุมัติ)
   ========================================================================== */

const balanceAmountEl = document.getElementById("balanceAmount");
const topupForm = document.getElementById("topupForm");
const slipInput = document.getElementById("slipInput");
const slipDrop = document.getElementById("slipDrop");
const slipPreview = document.getElementById("slipPreview");
const topupSubmitBtn = document.getElementById("topupSubmitBtn");
const topupAlertBox = document.getElementById("topupAlertBox");

const tabButtons = document.querySelectorAll(".wallet-tab");
const panels = document.querySelectorAll(".wallet-panel");

let currentCtx = null;
let selectedSlipFile = null;

const ORDER_STATUS_LABEL = {
  pending: "รอแอดมินยืนยัน",
  confirmed: "ยืนยันแล้ว รอส่งของ",
  cancel_requested: "รออนุมัติการยกเลิก",
  completed: "เสร็จสิ้น",
  cancelled: "ยกเลิกแล้ว",
  rejected: "ถูกปฏิเสธ",
};

const TOPUP_STATUS_LABEL = { pending: "รออนุมัติ", approved: "อนุมัติแล้ว", rejected: "ปฏิเสธแล้ว" };

function showTopupAlert(message, type = "error") {
  topupAlertBox.textContent = message;
  topupAlertBox.className = `alert show alert-${type}`;
}

/* ---------- Tabs ---------- */

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    panels.forEach((p) => (p.style.display = "none"));
    document.getElementById(btn.dataset.panel).style.display = "block";

    if (btn.dataset.panel === "panel-topup") loadMyTopups();
    if (btn.dataset.panel === "panel-orders") loadMyOrders();
    if (btn.dataset.panel === "panel-sales") loadMySales();
  });
});

/* ---------- Topup form ---------- */

slipDrop.addEventListener("click", () => slipInput.click());

slipInput.addEventListener("change", () => {
  const file = slipInput.files?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    showTopupAlert("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
    slipInput.value = "";
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showTopupAlert("ไฟล์รูปภาพต้องมีขนาดไม่เกิน 5MB");
    slipInput.value = "";
    return;
  }

  selectedSlipFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    slipPreview.innerHTML = `<img src="${e.target.result}" alt="ตัวอย่างสลิป">`;
    slipPreview.style.display = "block";
  };
  reader.readAsDataURL(file);
});

async function uploadSlip(file) {
  const ext = file.name.split(".").pop();
  const path = `slips/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabaseClient.storage.from(SLIP_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) throw new Error("อัปโหลดสลิปไม่สำเร็จ: " + error.message);
  return path;
}

topupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  topupAlertBox.className = "alert";

  if (!selectedSlipFile) {
    showTopupAlert("กรุณาแนบรูปสลิปการโอนเงิน");
    return;
  }

  const userNote = document.getElementById("topupNote").value.trim();

  topupSubmitBtn.disabled = true;
  topupSubmitBtn.textContent = "กำลังส่งคำขอ...";

  try {
    const slipPath = await uploadSlip(selectedSlipFile);

    const { error } = await supabaseClient.from("topups").insert({
      user_id: currentCtx.user.id,
      slip_url: slipPath,
      user_note: userNote || null,
      status: "pending",
    });

    if (error) throw new Error(error.message);

    topupForm.reset();
    slipPreview.style.display = "none";
    slipPreview.innerHTML = "";
    selectedSlipFile = null;
    showTopupAlert("ส่งคำขอเติมเงินเรียบร้อย! รอแอดมินตรวจสอบสลิปและอนุมัติยอดเงิน", "success");
    loadMyTopups();
  } catch (err) {
    showTopupAlert(err.message || "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
  } finally {
    topupSubmitBtn.disabled = false;
    topupSubmitBtn.textContent = "ส่งคำขอเติมเงิน";
  }
});

/* ---------- My topups ---------- */

function topupRowHtml(t) {
  const slipUrl = t.slip_url ? getSlipPublicUrl(t.slip_url) : null;
  return `
    <tr>
      <td>${new Date(t.created_at).toLocaleString("th-TH")}</td>
      <td>${slipUrl ? `<a href="${escapeHtml(slipUrl)}" target="_blank"><img class="slip-thumb" src="${escapeHtml(slipUrl)}" alt=""></a>` : "-"}</td>
      <td>${t.amount ? formatBaht(t.amount) : "-"}</td>
      <td><span class="status-badge status-${t.status}">${TOPUP_STATUS_LABEL[t.status] || t.status}</span></td>
      <td>${escapeHtml(t.admin_note || "-")}</td>
    </tr>`;
}

async function loadMyTopups() {
  const body = document.getElementById("myTopupsBody");
  body.innerHTML = `<tr><td colspan="5" class="loading-line">กำลังโหลด...</td></tr>`;

  const { data, error } = await supabaseClient
    .from("topups")
    .select("id, slip_url, amount, status, admin_note, created_at")
    .eq("user_id", currentCtx.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    body.innerHTML = `<tr><td colspan="5">โหลดข้อมูลไม่สำเร็จ: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }
  if (!data || data.length === 0) {
    body.innerHTML = `<tr><td colspan="5">ยังไม่มีประวัติการเติมเงิน</td></tr>`;
    return;
  }
  body.innerHTML = data.map(topupRowHtml).join("");
}

/* ---------- My orders (as buyer) / My sales (as seller) ---------- */

function orderRowHtml(o, role) {
  let actionHtml = "-";
  if (role === "buyer" && o.status === "pending") {
    actionHtml = `<button class="btn btn-outline btn-small" data-cancel-order="${o.id}">ยกเลิก</button>`;
  }
  if (role === "seller" && o.status === "confirmed") {
    actionHtml = `<button class="btn btn-danger btn-small" data-request-cancel="${o.id}">ขอยกเลิก/คืนเงิน</button>`;
  }
  return `
    <tr>
      <td>${new Date(o.created_at).toLocaleString("th-TH")}</td>
      <td>${escapeHtml(o.product_name)}</td>
      <td>${Number(o.quantity)} ชิ้น</td>
      <td>${formatBaht(o.total_price)}</td>
      <td><span class="status-badge status-${o.status}">${ORDER_STATUS_LABEL[o.status] || o.status}</span></td>
      <td>${actionHtml}</td>
    </tr>`;
}

async function loadMyOrders() {
  const body = document.getElementById("myOrdersBody");
  body.innerHTML = `<tr><td colspan="6" class="loading-line">กำลังโหลด...</td></tr>`;

  const { data, error } = await supabaseClient
    .from("orders")
    .select("id, product_name, quantity, total_price, status, created_at")
    .eq("buyer_id", currentCtx.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    body.innerHTML = `<tr><td colspan="6">โหลดข้อมูลไม่สำเร็จ: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }
  if (!data || data.length === 0) {
    body.innerHTML = `<tr><td colspan="6">คุณยังไม่เคยสั่งซื้อสินค้า</td></tr>`;
    return;
  }
  body.innerHTML = data.map((o) => orderRowHtml(o, "buyer")).join("");

  body.querySelectorAll("[data-cancel-order]").forEach((btn) =>
    btn.addEventListener("click", () => cancelOwnOrder(btn.dataset.cancelOrder))
  );
}

async function cancelOwnOrder(id) {
  const ok = await confirmModal({
    title: "ยกเลิกคำสั่งซื้อ",
    message: "ยืนยันยกเลิกคำสั่งซื้อนี้?",
    confirmText: "ยกเลิกคำสั่งซื้อ",
    danger: true,
    icon: "❌",
  });
  if (!ok) return;

  const { error } = await supabaseClient.from("orders").update({ status: "cancelled" }).eq("id", id);
  if (error) {
    toast("ยกเลิกไม่สำเร็จ: " + error.message, "error");
    return;
  }
  toast("ยกเลิกคำสั่งซื้อเรียบร้อยแล้ว", "success");
  loadMyOrders();
}

async function loadMySales() {
  const body = document.getElementById("mySalesBody");
  body.innerHTML = `<tr><td colspan="6" class="loading-line">กำลังโหลด...</td></tr>`;

  const { data, error } = await supabaseClient
    .from("orders")
    .select("id, product_name, quantity, total_price, status, created_at")
    .eq("seller_id", currentCtx.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    body.innerHTML = `<tr><td colspan="6">โหลดข้อมูลไม่สำเร็จ: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }
  if (!data || data.length === 0) {
    body.innerHTML = `<tr><td colspan="6">ยังไม่มีคำสั่งซื้อสำหรับสินค้าของคุณ</td></tr>`;
    return;
  }
  body.innerHTML = data.map((o) => orderRowHtml(o, "seller")).join("");

  body.querySelectorAll("[data-request-cancel]").forEach((btn) =>
    btn.addEventListener("click", () => requestCancel(btn.dataset.requestCancel))
  );
}

async function requestCancel(id) {
  const ok = await confirmModal({
    title: "ขอยกเลิก / คืนเงิน",
    message: "ยืนยันขอยกเลิก/คืนเงินคำสั่งซื้อนี้? ต้องรอแอดมินอนุมัติก่อนเงินจะคืนผู้ซื้อ",
    confirmText: "ส่งคำขอ",
    icon: "💸",
  });
  if (!ok) return;

  const { error } = await supabaseClient.rpc("request_order_cancel", { p_order_id: id });
  if (error) {
    toast("ขอยกเลิกไม่สำเร็จ: " + error.message, "error");
    return;
  }
  toast("ส่งคำขอยกเลิก/คืนเงินเรียบร้อยแล้ว", "success");
  loadMySales();
}

/* ---------- Init ---------- */

(async function init() {
  currentCtx = await requireLogin("login.html");
  if (!currentCtx) return;

  await renderAuthNav(document.getElementById("navLinks"), "");
  balanceAmountEl.textContent = formatBaht(currentCtx.profile.wallet_balance);

  await loadMyTopups();
})();
