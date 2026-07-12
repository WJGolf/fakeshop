/* ==========================================================================
   ui.js — โมดัลและ toast แบบมีธีม ใช้แทน prompt()/confirm()/alert() ของเบราว์เซอร์
   โหลดไฟล์นี้หลัง supabaseClient.js และก่อนสคริปต์เฉพาะหน้า (store.js, wallet.js,
   admin-dashboard.js) ที่เรียกใช้ฟังก์ชันเหล่านี้
   ========================================================================== */

let _modalKeyHandler = null;

/** ปิดโมดัลที่เปิดอยู่ (ถ้ามี) */
function closeModal() {
  const overlay = document.querySelector(".modal-overlay");
  if (overlay) overlay.remove();
  if (_modalKeyHandler) {
    document.removeEventListener("keydown", _modalKeyHandler);
    _modalKeyHandler = null;
  }
}

/**
 * เปิดโมดัลเปล่า ๆ ตามโครงที่กำหนด แล้วคืน element ของ overlay ให้ผู้เรียกไปผูก event เอง
 * ส่วนใหญ่ไม่ต้องเรียกตรง ๆ — ใช้ confirmModal() หรือ formModal() แทน
 */
function openModal({ title, bodyHtml, footerHtml, wide = false, onMount }) {
  closeModal();

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-card ${wide ? "modal-wide" : ""}">
      <div class="modal-header">
        <h3>${title}</h3>
        <button type="button" class="modal-close" aria-label="ปิด">✕</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      <div class="modal-footer">${footerHtml}</div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) closeModal();
  });
  overlay.querySelector(".modal-close").addEventListener("click", closeModal);

  _modalKeyHandler = (e) => {
    if (e.key === "Escape") closeModal();
  };
  document.addEventListener("keydown", _modalKeyHandler);

  if (onMount) onMount(overlay);
  return overlay;
}

/**
 * โมดัลยืนยัน แทน confirm() — คืนค่า Promise<boolean>
 */
function confirmModal({ title, message, confirmText = "ยืนยัน", cancelText = "ยกเลิก", danger = false, icon = "❓" }) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      closeModal();
      resolve(result);
    };

    const overlay = openModal({
      title,
      bodyHtml: `
        <div class="modal-icon-row"><span class="icon-badge ${danger ? "danger" : ""}">${icon}</span></div>
        <p>${message}</p>
      `,
      footerHtml: `
        <button type="button" class="btn btn-outline" data-modal-cancel>${cancelText}</button>
        <button type="button" class="btn ${danger ? "btn-danger" : "btn-primary"}" data-modal-confirm>${confirmText}</button>
      `,
    });

    overlay.querySelector("[data-modal-cancel]").addEventListener("click", () => finish(false));
    overlay.querySelector("[data-modal-confirm]").addEventListener("click", () => finish(true));
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) finish(false); });
    document.addEventListener("keydown", function escOnce(e) {
      if (e.key === "Escape") { finish(false); document.removeEventListener("keydown", escOnce); }
    });
  });
}

/**
 * โมดัลกรอกข้อมูล แทน prompt() (รองรับหลายช่อง) — คืนค่า Promise<object|null>
 * fields: [{ id, label, type: 'text'|'number'|'textarea', value, min, max, step, placeholder, required }]
 */
function formModal({ title, message = "", fields, confirmText = "บันทึก", cancelText = "ยกเลิก", wide = false }) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      closeModal();
      resolve(result);
    };

    const fieldsHtml = fields
      .map((f) => {
        if (f.type === "textarea") {
          return `
            <div class="field">
              <label for="modal-${f.id}">${f.label}</label>
              <textarea id="modal-${f.id}" placeholder="${f.placeholder || ""}">${f.value || ""}</textarea>
            </div>`;
        }
        return `
          <div class="field">
            <label for="modal-${f.id}">${f.label}</label>
            <input type="${f.type || "text"}" id="modal-${f.id}"
              value="${f.value ?? ""}"
              ${f.min !== undefined ? `min="${f.min}"` : ""}
              ${f.max !== undefined ? `max="${f.max}"` : ""}
              ${f.step !== undefined ? `step="${f.step}"` : ""}
              placeholder="${f.placeholder || ""}">
          </div>`;
      })
      .join("");

    const overlay = openModal({
      title,
      wide,
      bodyHtml: `${message ? `<p style="text-align:left;">${message}</p>` : ""}<form id="modalForm" onsubmit="return false;">${fieldsHtml}</form>`,
      footerHtml: `
        <button type="button" class="btn btn-outline" data-modal-cancel>${cancelText}</button>
        <button type="button" class="btn btn-primary" data-modal-confirm>${confirmText}</button>
      `,
      onMount: (el) => {
        const firstInput = el.querySelector("input, textarea");
        if (firstInput) { firstInput.focus(); firstInput.select?.(); }
      },
    });

    overlay.querySelector("[data-modal-cancel]").addEventListener("click", () => finish(null));

    const submit = () => {
      const values = {};
      for (const f of fields) {
        const el = document.getElementById(`modal-${f.id}`);
        if (f.required && !el.value.trim()) {
          el.style.borderColor = "var(--rust)";
          el.focus();
          return;
        }
        values[f.id] = el.value;
      }
      finish(values);
    };

    overlay.querySelector("[data-modal-confirm]").addEventListener("click", submit);
    overlay.querySelectorAll("input").forEach((inp) => {
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
    });
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) finish(null); });
  });
}

/**
 * แจ้งเตือนแบบ toast มุมล่างขวา แทน alert()
 */
function toast(message, type = "success", duration = 4000) {
  let stack = document.querySelector(".toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }

  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span class="toast-icon">${type === "error" ? "⚠️" : "✅"}</span><span class="toast-msg">${escapeHtml(message)}</span>`;
  stack.appendChild(el);

  setTimeout(() => {
    el.style.transition = "opacity .2s ease, transform .2s ease";
    el.style.opacity = "0";
    el.style.transform = "translateX(24px)";
    setTimeout(() => el.remove(), 200);
  }, duration);
}
