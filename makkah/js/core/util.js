/* ═══ أدوات عامة: تواريخ، أرقام، معرّفات، تهريب نصوص ═══ */

/** معرّف فريد لكل سجل */
export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2));

export const nowISO = () => new Date().toISOString();

/** تاريخ اليوم بصيغة YYYY-MM-DD (بالتوقيت المحلي) */
export function today(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
/** شهر التاريخ بصيغة YYYY-MM */
export const monthOf = (dateStr) => (dateStr || today()).slice(0, 7);
export const thisMonth = () => today().slice(0, 7);

/** تنسيق التاريخ للعرض العربي: 2026/07/27 */
export const fmtDate = (s) => (s ? s.split('-').join('/') : '—');

/** أسماء الشهور للعرض */
const AR_MONTHS = ['كانون الثاني','شباط','آذار','نيسان','أيار','حزيران','تموز','آب','أيلول','تشرين الأول','تشرين الثاني','كانون الأول'];
export function fmtMonth(m) { // m = YYYY-MM
  if (!m) return '—';
  const [y, mo] = m.split('-');
  return `${AR_MONTHS[Number(mo) - 1]} ${y}`;
}

/** تحويل أي مدخل إلى رقم آمن */
export const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };

/** تنسيق المبالغ: 12,500 (العملة تضاف من الإعدادات عند العرض) */
export function fmtNum(n, dec = 0) {
  return num(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: Math.max(dec, 2) });
}

/** تهريب النصوص قبل إدراجها في HTML — يمنع كسر الواجهة أو حقن سكربت */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

/** قراءة قيم نموذج داخل عنصر: كل input/select/textarea له name */
export function readForm(root) {
  const out = {};
  root.querySelectorAll('[name]').forEach((el) => {
    out[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim();
  });
  return out;
}

/** فرق الأيام بين تاريخين */
export const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

/** حدود فترة جاهزة: اليوم/الأسبوع/الشهر/السنة */
export function periodRange(kind) {
  const d = new Date(); const t = today(d);
  if (kind === 'day') return { from: t, to: t };
  if (kind === 'week') { const s = new Date(d); s.setDate(d.getDate() - 6); return { from: today(s), to: t }; }
  if (kind === 'month') return { from: t.slice(0, 8) + '01', to: t };
  if (kind === 'year') return { from: t.slice(0, 5) + '01-01', to: t };
  return { from: '', to: '' };
}

/** تنزيل ملف نصي (CSV/JSON) */
export function downloadText(filename, text, mime = 'text/plain') {
  const blob = new Blob(['﻿' + text], { type: mime + ';charset=utf-8' }); // BOM لدعم العربية في Excel
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

/** تصدير CSV من صفوف مصفوفية */
export function exportCSV(filename, rows) {
  const line = (r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',');
  downloadText(filename, rows.map(line).join('\r\n'), 'text/csv');
}
