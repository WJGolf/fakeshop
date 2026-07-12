/* ==========================================================================
   sell.js — หน้า "ลงขายของฉัน" (sell.html)
   ต้องล็อกอินก่อนจึงลงขายได้ ผู้ใช้กรอกข้อมูลสินค้า อัปโหลดรูป
   แล้วส่งเป็นสถานะ "pending" ผูกกับบัญชีผู้ขาย (seller_id) รอแอดมินอนุมัติ
   ========================================================================== */

const sellForm = document.getElementById("sellForm");
const categorySelect = document.getElementById("categorySelect");
const fileInput = document.getElementById("imageInput");
const fileDrop = document.getElementById("fileDrop");
const filePreview = document.getElementById("filePreview");
const submitBtn = document.getElementById("submitBtn");
const alertBox = document.getElementById("alertBox");

let selectedFile = null;
let currentCtx = null;

function showAlert(message, type = "error") {
  alertBox.textContent = message;
  alertBox.className = `alert show alert-${type}`;
  alertBox.scrollIntoView({ behavior: "smooth", block: "center" });
}

function hideAlert() {
  alertBox.className = "alert";
}

async function loadCategoriesIntoSelect() {
  const { data, error } = await supabaseClient
    .from("categories")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) {
    showAlert("โหลดหมวดหมู่ไม่สำเร็จ: " + error.message);
    return;
  }

  categorySelect.innerHTML =
    `<option value="" disabled selected>เลือกหมวดหมู่สินค้า</option>` +
    (data || []).map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
}

fileDrop.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    showAlert("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
    fileInput.value = "";
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showAlert("ไฟล์รูปภาพต้องมีขนาดไม่เกิน 5MB");
    fileInput.value = "";
    return;
  }

  selectedFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    filePreview.innerHTML = `<img src="${e.target.result}" alt="ตัวอย่างรูปสินค้า">`;
    filePreview.style.display = "block";
  };
  reader.readAsDataURL(file);
});

async function uploadImage(file) {
  const ext = file.name.split(".").pop();
  const path = `pending/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabaseClient.storage.from(PRODUCT_IMAGE_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) throw new Error("อัปโหลดรูปไม่สำเร็จ: " + error.message);
  return path;
}

sellForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert();

  const name = document.getElementById("productName").value.trim();
  const description = document.getElementById("productDescription").value.trim();
  const price = document.getElementById("productPrice").value;
  const quantity = document.getElementById("productQuantity").value || 1;
  const categoryId = categorySelect.value;
  const sellerName = document.getElementById("sellerName").value.trim();
  const sellerContact = document.getElementById("sellerContact").value.trim();

  if (!name || !price || !categoryId || !sellerName || !sellerContact) {
    showAlert("กรุณากรอกข้อมูลที่มีเครื่องหมาย * ให้ครบถ้วน");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "กำลังส่งคำขอ...";

  try {
    let imagePath = null;
    if (selectedFile) {
      imagePath = await uploadImage(selectedFile);
    }

    const { error } = await supabaseClient.from("products").insert({
      name,
      description,
      price: Number(price),
      quantity: Number(quantity),
      category_id: categoryId,
      seller_id: currentCtx.user.id,
      seller_name: sellerName,
      seller_contact: sellerContact,
      image_url: imagePath,
      status: "pending",
    });

    if (error) throw new Error(error.message);

    sellForm.reset();
    document.getElementById("sellerName").value = currentCtx.profile.display_name || "";
    document.getElementById("sellerContact").value = currentCtx.profile.phone || "";
    filePreview.style.display = "none";
    filePreview.innerHTML = "";
    selectedFile = null;
    showAlert("ส่งคำขอลงขายเรียบร้อยแล้ว! รอแอดมินตรวจสอบและอนุมัติ", "success");
  } catch (err) {
    showAlert(err.message || "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "ส่งคำขอลงขาย";
  }
});

(async function init() {
  currentCtx = await requireLogin("login.html");
  if (!currentCtx) return;

  await renderAuthNav(document.getElementById("navLinks"), "");

  // เติมชื่อ/ช่องทางติดต่อจากโปรไฟล์ให้อัตโนมัติ (แก้ไขได้)
  document.getElementById("sellerName").value = currentCtx.profile.display_name || "";
  document.getElementById("sellerContact").value = currentCtx.profile.phone || "";

  await loadCategoriesIntoSelect();
})();
