/* ==========================================================================
   admin-dashboard.js — หลังร้าน (admin/dashboard.html)
   - ตรวจสิทธิ์ (แอดมิน/เจ้าของร้าน) ก่อนแสดงข้อมูลใด ๆ ทั้งหมด
   - แท็บ "รออนุมัติ": อนุมัติ/ปฏิเสธสินค้าที่ลูกค้าส่งเข้ามา
   - แท็บ "สินค้าทั้งหมด": แก้ไข/ลบสินค้าที่อนุมัติแล้ว
   - แท็บ "หมวดหมู่": เพิ่ม/ลบหมวดหมู่สินค้า
   - แท็บ "สมาชิก": ดูรายชื่อสมาชิกทั้งหมด — เฉพาะเจ้าของร้านเปลี่ยนตำแหน่งได้
   ========================================================================== */

const tabButtons = document.querySelectorAll(".admin-sidebar button[data-tab]");
const panels = document.querySelectorAll(".admin-panel");
const adminEmailLabel = document.getElementById("adminEmailLabel");
const adminRoleBadge = document.getElementById("adminRoleBadge");
const logoutBtn = document.getElementById("logoutBtn");
const membersTabBtn = document.getElementById("membersTabBtn");

let currentCtx = null;
let categoriesCache = [];

logoutBtn.addEventListener("click", async () => {
  await logout("../login.html");
});

/* ---------- Tabs ---------- */

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    panels.forEach((p) => p.style.display = "none");
    document.getElementById(btn.dataset.tab).style.display = "block";

    if (btn.dataset.tab === "panel-pending") loadPending();
    if (btn.dataset.tab === "panel-products") loadAllProducts();
    if (btn.dataset.tab === "panel-topups") loadTopups();
    if (btn.dataset.tab === "panel-orders") loadOrders();
    if (btn.dataset.tab === "panel-categories") loadCategories();
    if (btn.dataset.tab === "panel-members") loadMembers();
  });
});

/* ---------- Categories (shared cache) ---------- */

async function loadCategories() {
  const { data, error } = await supabaseClient
    .from("categories")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) {
    console.error(error.message);
    return;
  }
  categoriesCache = data || [];
  renderCategoryTable();
}

function renderCategoryTable() {
  const body = document.getElementById("categoryTableBody");
  if (categoriesCache.length === 0) {
    body.innerHTML = `<tr><td colspan="2">ยังไม่มีหมวดหมู่ — เพิ่มหมวดหมู่แรกด้านบน</td></tr>`;
    return;
  }
  body.innerHTML = categoriesCache
    .map(
      (c) => `
      <tr>
        <td>${escapeHtml(c.name)}</td>
        <td class="action-group">
          <button class="btn btn-outline btn-small" data-del-cat="${c.id}">ลบ</button>
        </td>
      </tr>`
    )
    .join("");

  body.querySelectorAll("[data-del-cat]").forEach((btn) => {
    btn.addEventListener("click", () => deleteCategory(btn.dataset.delCat));
  });
}

document.getElementById("addCategoryForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("newCategoryName");
  const name = input.value.trim();
  if (!name) return;

  const { error } = await supabaseClient.from("categories").insert({ name });
  if (error) {
    toast("เพิ่มหมวดหมู่ไม่สำเร็จ: " + error.message, "error");
    return;
  }
  input.value = "";
  toast("เพิ่มหมวดหมู่เรียบร้อยแล้ว", "success");
  loadCategories();
});

async function deleteCategory(id) {
  const ok = await confirmModal({
    title: "ลบหมวดหมู่",
    message: "ลบหมวดหมู่นี้? สินค้าที่อยู่ในหมวดนี้จะไม่ถูกลบ แต่จะไม่มีหมวดหมู่",
    confirmText: "ลบหมวดหมู่",
    danger: true,
    icon: "🗑️",
  });
  if (!ok) return;

  const { error } = await supabaseClient.from("categories").delete().eq("id", id);
  if (error) {
    toast("ลบไม่สำเร็จ: " + error.message, "error");
    return;
  }
  toast("ลบหมวดหมู่เรียบร้อยแล้ว", "success");
  loadCategories();
}

/* ---------- Pending approvals ---------- */

async function loadPending() {
  const body = document.getElementById("pendingTableBody");
  body.innerHTML = `<tr><td colspan="6" class="loading-line">กำลังโหลด...</td></tr>`;

  const { data, error } = await supabaseClient
    .from("products")
    .select("id, name, image_url, price, quantity, seller_name, seller_contact, categories(name)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    body.innerHTML = `<tr><td colspan="6">โหลดข้อมูลไม่สำเร็จ: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    body.innerHTML = `<tr><td colspan="6">ไม่มีคำขอลงขายที่รออนุมัติ 🎉</td></tr>`;
    return;
  }

  body.innerHTML = data
    .map((p) => {
      const imgUrl = p.image_url ? getPublicImageUrl(p.image_url) : null;
      return `
      <tr>
        <td>${imgUrl ? `<img class="row-thumb" src="${escapeHtml(imgUrl)}" alt="">` : "-"}</td>
        <td>
          <strong>${escapeHtml(p.name)}</strong><br>
          <span style="color:var(--ink-soft); font-size:12.5px;">${escapeHtml(p.categories?.name || "ไม่ระบุหมวดหมู่")}</span>
        </td>
        <td>${formatBaht(p.price)} · ${Number(p.quantity)} ชิ้น</td>
        <td>${escapeHtml(p.seller_name)}<br><span style="color:var(--ink-soft); font-size:12.5px;">${escapeHtml(p.seller_contact)}</span></td>
        <td><span class="status-badge status-pending">รออนุมัติ</span></td>
        <td class="action-group">
          <button class="btn btn-primary btn-small" data-approve="${p.id}">อนุมัติ</button>
          <button class="btn btn-danger btn-small" data-reject="${p.id}">ปฏิเสธ</button>
        </td>
      </tr>`;
    })
    .join("");

  body.querySelectorAll("[data-approve]").forEach((btn) =>
    btn.addEventListener("click", () => setProductStatus(btn.dataset.approve, "approved", loadPending))
  );
  body.querySelectorAll("[data-reject]").forEach((btn) =>
    btn.addEventListener("click", () => setProductStatus(btn.dataset.reject, "rejected", loadPending))
  );
}

async function setProductStatus(id, status, refreshFn) {
  const { error } = await supabaseClient.from("products").update({ status }).eq("id", id);
  if (error) {
    toast("อัปเดตสถานะไม่สำเร็จ: " + error.message, "error");
    return;
  }
  toast(status === "approved" ? "อนุมัติสินค้าเรียบร้อยแล้ว" : "ปฏิเสธคำขอลงขายเรียบร้อยแล้ว", "success");
  refreshFn();
}

/* ---------- All products (approved catalog management) ---------- */

async function loadAllProducts() {
  const body = document.getElementById("productsTableBody");
  body.innerHTML = `<tr><td colspan="6" class="loading-line">กำลังโหลด...</td></tr>`;

  const { data, error } = await supabaseClient
    .from("products")
    .select("id, name, image_url, price, quantity, status, categories(name)")
    .order("created_at", { ascending: false });

  if (error) {
    body.innerHTML = `<tr><td colspan="6">โหลดข้อมูลไม่สำเร็จ: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    body.innerHTML = `<tr><td colspan="6">ยังไม่มีสินค้าในระบบ</td></tr>`;
    return;
  }

  const statusLabel = { approved: "อนุมัติแล้ว", pending: "รออนุมัติ", rejected: "ปฏิเสธแล้ว" };

  body.innerHTML = data
    .map((p) => {
      const imgUrl = p.image_url ? getPublicImageUrl(p.image_url) : null;
      return `
      <tr>
        <td>${imgUrl ? `<img class="row-thumb" src="${escapeHtml(imgUrl)}" alt="">` : "-"}</td>
        <td><strong>${escapeHtml(p.name)}</strong><br><span style="color:var(--ink-soft); font-size:12.5px;">${escapeHtml(p.categories?.name || "ไม่ระบุหมวดหมู่")}</span></td>
        <td>${formatBaht(p.price)}</td>
        <td>${Number(p.quantity)} ชิ้น</td>
        <td><span class="status-badge status-${p.status}">${statusLabel[p.status] || p.status}</span></td>
        <td class="action-group">
          <button class="btn btn-outline btn-small" data-edit="${p.id}" data-qty="${p.quantity}" data-price="${p.price}">แก้ไข</button>
          <button class="btn btn-danger btn-small" data-remove="${p.id}">ลบ</button>
        </td>
      </tr>`;
    })
    .join("");

  body.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => editProduct(btn.dataset.edit, btn.dataset.qty, btn.dataset.price))
  );
  body.querySelectorAll("[data-remove]").forEach((btn) =>
    btn.addEventListener("click", () => removeProduct(btn.dataset.remove))
  );
}

async function editProduct(id, currentQty, currentPrice) {
  const result = await formModal({
    title: "แก้ไขสินค้า",
    fields: [
      { id: "qty", label: "จำนวนคงเหลือ", type: "number", value: currentQty, min: 0, step: 1, required: true },
      { id: "price", label: "ราคา (บาท)", type: "number", value: currentPrice, min: 0, step: 0.01, required: true },
    ],
    confirmText: "บันทึก",
  });
  if (!result) return;

  const { error } = await supabaseClient
    .from("products")
    .update({ quantity: Number(result.qty), price: Number(result.price) })
    .eq("id", id);

  if (error) {
    toast("บันทึกไม่สำเร็จ: " + error.message, "error");
    return;
  }
  toast("บันทึกข้อมูลสินค้าเรียบร้อยแล้ว", "success");
  loadAllProducts();
}

async function removeProduct(id) {
  const ok = await confirmModal({
    title: "ลบสินค้า",
    message: "ยืนยันการลบสินค้านี้ออกจากระบบ? การลบไม่สามารถย้อนกลับได้",
    confirmText: "ลบสินค้า",
    danger: true,
    icon: "🗑️",
  });
  if (!ok) return;

  const { error } = await supabaseClient.from("products").delete().eq("id", id);
  if (error) {
    toast("ลบไม่สำเร็จ: " + error.message, "error");
    return;
  }
  toast("ลบสินค้าเรียบร้อยแล้ว", "success");
  loadAllProducts();
}

/* ---------- เติมเงิน (topups) ---------- */

async function loadTopups() {
  const body = document.getElementById("topupsTableBody");
  body.innerHTML = `<tr><td colspan="5" class="loading-line">กำลังโหลด...</td></tr>`;

  const { data, error } = await supabaseClient
    .from("topups")
    .select("id, slip_url, amount, status, user_note, created_at, profiles!topups_user_id_fkey(display_name, email)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    body.innerHTML = `<tr><td colspan="5">โหลดข้อมูลไม่สำเร็จ: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    body.innerHTML = `<tr><td colspan="5">ไม่มีคำขอเติมเงินที่รออนุมัติ 🎉</td></tr>`;
    return;
  }

  body.innerHTML = data
    .map((t) => {
      const slipUrl = t.slip_url ? getSlipPublicUrl(t.slip_url) : null;
      return `
      <tr>
        <td>${slipUrl ? `<a href="${escapeHtml(slipUrl)}" target="_blank"><img class="slip-thumb" src="${escapeHtml(slipUrl)}" alt=""></a>` : "-"}</td>
        <td>${escapeHtml(t.profiles?.display_name || "-")}<br><span style="color:var(--ink-soft); font-size:12.5px;">${escapeHtml(t.profiles?.email || "")}</span></td>
        <td>${escapeHtml(t.user_note || "-")}</td>
        <td>${new Date(t.created_at).toLocaleString("th-TH")}</td>
        <td class="action-group">
          <button class="btn btn-primary btn-small" data-approve-topup="${t.id}" data-slip="${t.slip_url || ""}" data-name="${escapeHtml(t.profiles?.display_name || t.profiles?.email || "สมาชิก")}">อนุมัติ</button>
          <button class="btn btn-danger btn-small" data-reject-topup="${t.id}" data-slip="${t.slip_url || ""}">ปฏิเสธ</button>
        </td>
      </tr>`;
    })
    .join("");

  body.querySelectorAll("[data-approve-topup]").forEach((btn) =>
    btn.addEventListener("click", () => approveTopup(btn.dataset.approveTopup, btn.dataset.slip, btn.dataset.name))
  );
  body.querySelectorAll("[data-reject-topup]").forEach((btn) =>
    btn.addEventListener("click", () => rejectTopup(btn.dataset.rejectTopup, btn.dataset.slip))
  );
}

async function approveTopup(id, slipPath, memberName) {
  const step1 = await formModal({
    title: "อนุมัติเติมเงิน",
    message: `กรอกยอดเงินที่ตรวจสอบจากสลิปของ <strong>${escapeHtml(memberName || "สมาชิกคนนี้")}</strong>`,
    fields: [{ id: "amount", label: "ยอดเงิน (บาท)", type: "number", min: 0.01, step: 0.01, placeholder: "0.00", required: true }],
    confirmText: "ถัดไป",
  });
  if (!step1) return;

  const amount = Number(step1.amount);
  if (!amount || amount <= 0) {
    toast("กรุณากรอกยอดเงินให้ถูกต้อง", "error");
    return;
  }

  const ok = await confirmModal({
    title: "ยืนยันการอนุมัติ",
    message: `อนุมัติเติมเงิน <strong>${formatBaht(amount)}</strong> เข้ากระเป๋าของ <strong>${escapeHtml(memberName || "สมาชิกคนนี้")}</strong>?`,
    confirmText: "ยืนยันอนุมัติ",
    icon: "💰",
  });
  if (!ok) return;

  if (slipPath) {
    await supabaseClient.storage.from(SLIP_BUCKET).remove([slipPath]);
  }

  const { error } = await supabaseClient.rpc("approve_topup", { p_topup_id: id, p_amount: amount });
  if (error) {
    toast("อนุมัติไม่สำเร็จ: " + error.message, "error");
    return;
  }
  toast("อนุมัติเติมเงินเรียบร้อยแล้ว", "success");
  loadTopups();
}

async function rejectTopup(id, slipPath) {
  const result = await formModal({
    title: "ปฏิเสธคำขอเติมเงิน",
    fields: [{ id: "reason", label: "เหตุผลที่ปฏิเสธ (ถ้ามี)", type: "textarea", placeholder: "เช่น สลิปไม่ชัดเจน ยอดไม่ตรง" }],
    confirmText: "ปฏิเสธคำขอ",
  });
  if (result === null) return;

  if (slipPath) {
    await supabaseClient.storage.from(SLIP_BUCKET).remove([slipPath]);
  }

  const { error } = await supabaseClient.rpc("reject_topup", { p_topup_id: id, p_note: result.reason || null });
  if (error) {
    toast("ปฏิเสธไม่สำเร็จ: " + error.message, "error");
    return;
  }
  toast("ปฏิเสธคำขอเรียบร้อยแล้ว", "success");
  loadTopups();
}

/* ---------- คำสั่งซื้อ (orders) ---------- */

const ORDER_STATUS_LABEL = {
  pending: "รอยืนยัน",
  confirmed: "ยืนยันแล้ว รอส่งของ",
  cancel_requested: "รออนุมัติยกเลิก",
  completed: "เสร็จสิ้น",
  cancelled: "ยกเลิกแล้ว",
  rejected: "ถูกปฏิเสธ",
};

async function loadOrders() {
  const body = document.getElementById("ordersTableBody");
  body.innerHTML = `<tr><td colspan="7" class="loading-line">กำลังโหลด...</td></tr>`;

  const { data, error } = await supabaseClient
    .from("orders")
    .select(
      "id, product_name, quantity, total_price, status, created_at, buyer:profiles!orders_buyer_id_fkey(display_name,email), seller:profiles!orders_seller_id_fkey(display_name,email)"
    )
    .in("status", ["pending", "confirmed", "cancel_requested"])
    .order("created_at", { ascending: true });

  if (error) {
    body.innerHTML = `<tr><td colspan="7">โหลดข้อมูลไม่สำเร็จ: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    body.innerHTML = `<tr><td colspan="7">ไม่มีคำสั่งซื้อที่ต้องดำเนินการ 🎉</td></tr>`;
    return;
  }

  body.innerHTML = data
    .map((o) => {
      let actions = "-";
      if (o.status === "pending") {
        actions = `
          <button class="btn btn-primary btn-small" data-confirm-order="${o.id}">ยืนยัน (ตัดเงิน+สต๊อก)</button>
          <button class="btn btn-danger btn-small" data-reject-order="${o.id}">ปฏิเสธ</button>`;
      } else if (o.status === "confirmed") {
        actions = `<button class="btn btn-primary btn-small" data-complete-order="${o.id}">ได้รับสินค้าแล้ว (ปล่อยเงิน)</button>`;
      } else if (o.status === "cancel_requested") {
        actions = `
          <button class="btn btn-primary btn-small" data-approve-cancel="${o.id}">อนุมัติยกเลิก (คืนเงิน)</button>
          <button class="btn btn-outline btn-small" data-reject-cancel="${o.id}">ไม่อนุมัติ</button>`;
      }
      return `
      <tr>
        <td>${new Date(o.created_at).toLocaleString("th-TH")}</td>
        <td>${escapeHtml(o.product_name)} × ${Number(o.quantity)}</td>
        <td>${escapeHtml(o.buyer?.display_name || o.buyer?.email || "-")}</td>
        <td>${escapeHtml(o.seller?.display_name || o.seller?.email || "-")}</td>
        <td>${formatBaht(o.total_price)}</td>
        <td><span class="status-badge status-${o.status}">${ORDER_STATUS_LABEL[o.status] || o.status}</span></td>
        <td class="action-group">${actions}</td>
      </tr>`;
    })
    .join("");

  body.querySelectorAll("[data-confirm-order]").forEach((btn) =>
    btn.addEventListener("click", () =>
      runOrderAction("confirm_order", btn.dataset.confirmOrder, {
        title: "ยืนยันคำสั่งซื้อ",
        message: "ยืนยันคำสั่งซื้อนี้? ระบบจะตัดเงินจากกระเป๋าผู้ซื้อและตัดสต๊อกทันที",
        confirmText: "ยืนยันคำสั่งซื้อ",
        icon: "💳",
      })
    )
  );
  body.querySelectorAll("[data-reject-order]").forEach((btn) =>
    btn.addEventListener("click", () =>
      runOrderAction("reject_order", btn.dataset.rejectOrder, {
        title: "ปฏิเสธคำสั่งซื้อ",
        message: "ปฏิเสธคำสั่งซื้อนี้?",
        confirmText: "ปฏิเสธคำสั่งซื้อ",
        danger: true,
        icon: "❌",
      })
    )
  );
  body.querySelectorAll("[data-complete-order]").forEach((btn) =>
    btn.addEventListener("click", () =>
      runOrderAction("complete_order", btn.dataset.completeOrder, {
        title: "ยืนยันรับสินค้าแล้ว",
        message: "ยืนยันว่าผู้ซื้อได้รับสินค้าแล้ว? เงินจะถูกปล่อยเข้ากระเป๋าผู้ขายทันที",
        confirmText: "ยืนยัน ปล่อยเงิน",
        icon: "📦",
      })
    )
  );
  body.querySelectorAll("[data-approve-cancel]").forEach((btn) =>
    btn.addEventListener("click", () =>
      runOrderAction("approve_order_cancel", btn.dataset.approveCancel, {
        title: "อนุมัติยกเลิกคำสั่งซื้อ",
        message: "อนุมัติยกเลิกคำสั่งซื้อนี้? เงินจะคืนเข้ากระเป๋าผู้ซื้อและคืนสต๊อกสินค้า",
        confirmText: "อนุมัติยกเลิก",
        icon: "💸",
      })
    )
  );
  body.querySelectorAll("[data-reject-cancel]").forEach((btn) =>
    btn.addEventListener("click", () =>
      runOrderAction("reject_order_cancel", btn.dataset.rejectCancel, {
        title: "ไม่อนุมัติการยกเลิก",
        message: "ไม่อนุมัติการยกเลิก? คำสั่งซื้อจะกลับไปสถานะยืนยันแล้วตามเดิม",
        confirmText: "ไม่อนุมัติการยกเลิก",
        icon: "↩️",
      })
    )
  );
}

async function runOrderAction(fnName, orderId, { title, message, confirmText, danger = false, icon = "✅" }) {
  const ok = await confirmModal({ title, message, confirmText, danger, icon });
  if (!ok) return;

  const { error } = await supabaseClient.rpc(fnName, { p_order_id: orderId });
  if (error) {
    toast("ดำเนินการไม่สำเร็จ: " + error.message, "error");
    return;
  }
  toast("ดำเนินการเรียบร้อยแล้ว", "success");
  loadOrders();
}

/* ---------- Members / roles ---------- */

async function loadMembers() {
  const body = document.getElementById("membersTableBody");
  body.innerHTML = `<tr><td colspan="4" class="loading-line">กำลังโหลด...</td></tr>`;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, email, display_name, role")
    .order("created_at", { ascending: true });

  if (error) {
    body.innerHTML = `<tr><td colspan="4">โหลดข้อมูลไม่สำเร็จ: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  const isOwner = currentCtx.profile.role === "owner";

  body.innerHTML = (data || [])
    .map((m) => {
      const roleOptions = ["member", "admin", "owner"]
        .map((r) => `<option value="${r}" ${r === m.role ? "selected" : ""}>${ROLE_LABELS[r]}</option>`)
        .join("");

      const isSelf = m.id === currentCtx.user.id;
      const controlsDisabled = !isOwner ? "disabled" : "";

      return `
      <tr>
        <td>${escapeHtml(m.display_name || "-")}${isSelf ? " <span style=\"color:var(--ink-soft); font-size:12px;\">(คุณ)</span>" : ""}</td>
        <td>${escapeHtml(m.email)}</td>
        <td><span class="status-badge role-badge-${m.role}">${ROLE_LABELS[m.role]}</span></td>
        <td class="action-group">
          <select class="role-select" data-role-select="${m.id}" ${controlsDisabled}>${roleOptions}</select>
          <button class="btn btn-primary btn-small" data-save-role="${m.id}" ${controlsDisabled}>บันทึก</button>
        </td>
      </tr>`;
    })
    .join("");

  if (!isOwner) return;

  body.querySelectorAll("[data-save-role]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.saveRole;
      const select = body.querySelector(`[data-role-select="${id}"]`);
      updateMemberRole(id, select.value);
    });
  });
}

async function updateMemberRole(id, newRole) {
  if (id === currentCtx.user.id && newRole !== "owner") {
    const ok = await confirmModal({
      title: "ยืนยันการเปลี่ยนตำแหน่งตัวเอง",
      message: "นี่คือบัญชีของคุณเอง การลดตำแหน่งตัวเองอาจทำให้เข้าหลังร้านไม่ได้อีก ยืนยันหรือไม่?",
      confirmText: "ยืนยันเปลี่ยนตำแหน่ง",
      danger: true,
      icon: "⚠️",
    });
    if (!ok) return;
  }

  const { error } = await supabaseClient.from("profiles").update({ role: newRole }).eq("id", id);
  if (error) {
    toast("เปลี่ยนตำแหน่งไม่สำเร็จ: " + error.message, "error");
    return;
  }
  toast("เปลี่ยนตำแหน่งเรียบร้อยแล้ว", "success");
  loadMembers();
}

/* ---------- Init ---------- */

(async function init() {
  currentCtx = await requireStaff("../login.html");
  if (!currentCtx) return;

  adminEmailLabel.textContent = currentCtx.user.email;
  adminRoleBadge.textContent = ROLE_LABELS[currentCtx.profile.role];
  adminRoleBadge.className = `role-badge role-badge-${currentCtx.profile.role}`;

  if (currentCtx.profile.role === "owner") {
    membersTabBtn.style.display = "block";
  }

  await loadCategories();
  await loadPending();
})();
