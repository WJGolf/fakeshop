/* ==========================================================================
   supabaseClient.js
   ตั้งค่าการเชื่อมต่อ Supabase ที่เดียว ไฟล์อื่นทุกไฟล์เรียกใช้ตัวแปร
   `supabaseClient` และค่าคงที่ต่าง ๆ จากไฟล์นี้

   วิธีตั้งค่า:
   1. ไปที่ Supabase Dashboard > Project Settings > API
   2. คัดลอก "Project URL" มาใส่ที่ SUPABASE_URL
   3. คัดลอก "anon public" key มาใส่ที่ SUPABASE_ANON_KEY
   4. ห้ามใช้ "service_role" key ในไฟล์นี้เด็ดขาด (ใช้ฝั่งเซิร์ฟเวอร์เท่านั้น)
   ========================================================================== */

const SUPABASE_URL = "https://xmpkqtayxwiwpsxdvjmp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_SutuQ3RYHpUF-SihVnyjCg_U8lgOnHv";

// ชื่อ bucket ใน Supabase Storage ที่ใช้เก็บรูปสินค้า (ตั้งเป็น public bucket)
const PRODUCT_IMAGE_BUCKET = "product-images";

// ชื่อ bucket ใน Supabase Storage ที่ใช้เก็บสลิปโอนเงิน (ตั้งเป็น public bucket)
const SLIP_BUCKET = "payment-slips";

// ต้องโหลด https://unpkg.com/@supabase/supabase-js@2 ก่อนไฟล์นี้ใน <script> ของ HTML
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * แปลง path ของไฟล์ใน storage bucket ให้เป็น public URL
 */
function getPublicImageUrl(path) {
  if (!path) return null;
  const { data } = supabaseClient.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path);
  return data?.publicUrl || null;
}

/**
 * แปลง path ของไฟล์สลิปใน storage bucket ให้เป็น public URL
 */
function getSlipPublicUrl(path) {
  if (!path) return null;
  const { data } = supabaseClient.storage.from(SLIP_BUCKET).getPublicUrl(path);
  return data?.publicUrl || null;
}

/**
 * จัดรูปแบบราคาเป็นสกุลเงินบาท
 */
function formatBaht(amount) {
  const value = Number(amount || 0);
  return value.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " บาท";
}

/**
 * escape ข้อความก่อนแทรกลง innerHTML เพื่อกัน XSS เบื้องต้น
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
