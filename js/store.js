/* ==========================================================================
   store.js — หน้าร้าน (index.html)
   โหลดหมวดหมู่ + สินค้าที่ "อนุมัติแล้ว" เท่านั้นมาแสดง พร้อมตัวกรองหมวดหมู่
   ========================================================================== */

const gridEl = document.getElementById("productGrid");
const chipRowEl = document.getElementById("chipRow");
const resultCountEl = document.getElementById("resultCount");

let allProducts = [];
let activeCategoryId = "all";

async function loadCategories() {
  const { data, error } = await supabaseClient
    .from("categories")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) {
    console.error("โหลดหมวดหมู่ไม่สำเร็จ:", error.message);
    return [];
  }
  return data || [];
}

async function loadApprovedProducts() {
  const { data, error } = await supabaseClient
    .from("products")
    .select("id, name, image_url, quantity, price, category_id, categories(name)")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("โหลดสินค้าไม่สำเร็จ:", error.message);
    gridEl.innerHTML = `<div class="empty-state"><h3>โหลดสินค้าไม่สำเร็จ</h3><p>${escapeHtml(error.message)}</p></div>`;
    return [];
  }
  return data || [];
}

function renderChips(categories) {
  const chips = [{ id: "all", name: "ทั้งหมด" }, ...categories];
  chipRowEl.innerHTML = chips
    .map(
      (c) =>
        `<button class="chip ${c.id === activeCategoryId ? "active" : ""}" data-id="${c.id}">${escapeHtml(c.name)}</button>`
    )
    .join("");

  chipRowEl.querySelectorAll(".chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeCategoryId = btn.dataset.id;
      chipRowEl.querySelectorAll(".chip").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderProducts();
    });
  });
}

function productCardHtml(p) {
  const imgUrl = p.image_url ? getPublicImageUrl(p.image_url) : null;
  const media = imgUrl
    ? `<img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(p.name)}" loading="lazy">`
    : `<div class="no-image">ไม่มีรูปภาพ</div>`;

  const qty = Number(p.quantity || 0);
  const stockClass = qty <= 3 ? "low" : "";
  const categoryName = p.categories?.name || "ไม่ระบุหมวดหมู่";

  return `
    <article class="product-card">
      <div class="product-media">
        ${media}
        <span class="price-tag">${formatBaht(p.price)}</span>
      </div>
      <div class="product-body">
        <span class="product-category">${escapeHtml(categoryName)}</span>
        <h3 class="product-name">${escapeHtml(p.name)}</h3>
        <div class="product-meta">
          <span class="stock-pill ${stockClass}">คงเหลือ ${qty} ชิ้น</span>
        </div>
        <button class="btn btn-primary btn-small btn-block" data-buy="${p.id}" data-stock="${qty}" data-name="${escapeHtml(p.name)}" data-price="${p.price}" ${qty <= 0 ? "disabled" : ""} style="margin-top:8px;">
          ${qty <= 0 ? "สินค้าหมด" : "สั่งซื้อ"}
        </button>
      </div>
    </article>
  `;
}

/** โมดัลสั่งซื้อ: ปุ่ม +/- ปรับจำนวน พร้อมยอดรวมคำนวณสด — คืนค่า Promise<number|null> */
function openBuyModal({ name, stock, price }) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      closeModal();
      resolve(result);
    };

    const overlay = openModal({
      title: "สั่งซื้อสินค้า",
      bodyHtml: `
        <p><strong>${escapeHtml(name)}</strong><br><span style="font-size:13px;">คงเหลือ ${stock} ชิ้น · ${formatBaht(price)} / ชิ้น</span></p>
        <div class="qty-stepper">
          <button type="button" id="qtyMinus" aria-label="ลดจำนวน">−</button>
          <input type="number" id="qtyInput" value="1" min="1" max="${stock}" inputmode="numeric">
          <button type="button" id="qtyPlus" aria-label="เพิ่มจำนวน">+</button>
        </div>
        <div class="modal-summary-row total">
          <span>ยอดรวม</span>
          <span id="qtyTotal">${formatBaht(price)}</span>
        </div>
      `,
      footerHtml: `
        <button type="button" class="btn btn-outline" data-modal-cancel>ยกเลิก</button>
        <button type="button" class="btn btn-primary" data-modal-confirm>ยืนยันสั่งซื้อ</button>
      `,
    });

    const qtyInput = overlay.querySelector("#qtyInput");
    const totalEl = overlay.querySelector("#qtyTotal");

    const clamp = () => {
      let q = parseInt(qtyInput.value, 10);
      if (!q || q < 1) q = 1;
      if (q > stock) q = stock;
      qtyInput.value = q;
      totalEl.textContent = formatBaht(price * q);
      return q;
    };

    overlay.querySelector("#qtyMinus").addEventListener("click", () => { qtyInput.value = (parseInt(qtyInput.value, 10) || 1) - 1; clamp(); });
    overlay.querySelector("#qtyPlus").addEventListener("click", () => { qtyInput.value = (parseInt(qtyInput.value, 10) || 1) + 1; clamp(); });
    qtyInput.addEventListener("input", clamp);
    qtyInput.focus();
    qtyInput.select();

    overlay.querySelector("[data-modal-cancel]").addEventListener("click", () => finish(null));
    overlay.querySelector("[data-modal-confirm]").addEventListener("click", () => finish(clamp()));
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) finish(null); });
  });
}

async function handleBuyClick(btn) {
  const ctx = await getCurrentProfile();
  if (!ctx) {
    window.location.href = "login.html";
    return;
  }

  const stock = Number(btn.dataset.stock);
  const name = btn.dataset.name;
  const price = Number(btn.dataset.price);

  const qty = await openBuyModal({ name, stock, price });
  if (!qty) return;

  const ok = await confirmModal({
    title: "ยืนยันคำสั่งซื้อ",
    message: `สั่งซื้อ <strong>${escapeHtml(name)}</strong> จำนวน ${qty} ชิ้น รวม <strong>${formatBaht(price * qty)}</strong><br>ระบบจะส่งคำขอให้แอดมินยืนยันก่อน จึงจะตัดเงินจากกระเป๋าของคุณ`,
    confirmText: "ยืนยันสั่งซื้อ",
    icon: "🛒",
  });
  if (!ok) return;

  btn.disabled = true;
  const { error } = await supabaseClient.rpc("place_order", {
    p_product_id: btn.dataset.buy,
    p_quantity: qty,
  });
  btn.disabled = false;

  if (error) {
    toast("สั่งซื้อไม่สำเร็จ: " + error.message, "error");
    return;
  }

  toast("ส่งคำสั่งซื้อเรียบร้อย! รอแอดมินยืนยันคำสั่งซื้อ ดูสถานะได้ที่หน้ากระเป๋าเงิน", "success");
}

function renderProducts() {
  const filtered =
    activeCategoryId === "all"
      ? allProducts
      : allProducts.filter((p) => p.category_id === activeCategoryId);

  resultCountEl.textContent = `พบ ${filtered.length} รายการ`;

  if (filtered.length === 0) {
    gridEl.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <h3>ยังไม่มีสินค้าในหมวดนี้</h3>
        <p>ลองเลือกหมวดหมู่อื่น หรือกลับมาดูใหม่ภายหลัง</p>
      </div>`;
    return;
  }

  gridEl.innerHTML = filtered.map(productCardHtml).join("");

  gridEl.querySelectorAll("[data-buy]").forEach((btn) => {
    btn.addEventListener("click", () => handleBuyClick(btn));
  });
}

async function initStore() {
  gridEl.innerHTML = `<div class="loading-line">กำลังโหลดสินค้า...</div>`;
  renderAuthNav(document.getElementById("navLinks"), "");
  const [categories, products] = await Promise.all([loadCategories(), loadApprovedProducts()]);
  allProducts = products;
  renderChips(categories);
  renderProducts();
}

initStore();
