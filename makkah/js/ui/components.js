/* ═══ مكوّنات الواجهة المشتركة ═══
   نوافذ، تنبيهات، تأكيد، جداول، طباعة — تستخدمها كل الشاشات.
   «نظام التعديل الشامل»: openFormModal يُستخدم للإنشاء وللتعديل معاً —
   عند التعديل تُفتح نفس الاستمارة معبأة بالقيم، مع زرّي «موافق» و«إلغاء». */

import { esc, readForm } from '../core/util.js';
import { Settings } from '../core/repo.js';

/* ── تنبيهات Toast ── */
export function toast(msg, type = '') {
  let host = document.getElementById('toasts');
  if (!host) { host = document.createElement('div'); host.id = 'toasts'; document.body.appendChild(host); }
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .4s'; setTimeout(() => el.remove(), 400); }, 2600);
}

/* ── نافذة عامة ── */
export function modal({ title, body, foot = '', wide = false, onOpen }) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `
    <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-label="${esc(title)}">
      <div class="m-head"><h3>${esc(title)}</h3><button class="m-close" aria-label="إغلاق">✕</button></div>
      <div class="m-body"></div>
      ${foot ? `<div class="m-foot">${foot}</div>` : ''}
    </div>`;
  const bodyEl = back.querySelector('.m-body');
  if (typeof body === 'string') bodyEl.innerHTML = body; else bodyEl.appendChild(body);
  const close = () => back.remove();
  back.querySelector('.m-close').onclick = close;
  back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
  document.body.appendChild(back);
  if (onOpen) onOpen(back, close);
  return { root: back, body: bodyEl, close };
}

/* ── تأكيد قبل الحذف/الإجراءات الحساسة ── */
export function confirmDlg(msg, okLabel = 'نعم، متأكد') {
  return new Promise((resolve) => {
    const m = modal({
      title: 'تأكيد',
      body: `<p style="font-size:1rem">${esc(msg)}</p>`,
      foot: `<button class="btn danger" data-ok>🗑 ${esc(okLabel)}</button>
             <button class="btn" data-cancel>إلغاء</button>`,
    });
    m.root.querySelector('[data-ok]').onclick = () => { m.close(); resolve(true); };
    m.root.querySelector('[data-cancel]').onclick = () => { m.close(); resolve(false); };
  });
}

/* ── استمارة إنشاء/تعديل موحّدة (نظام التعديل الشامل) ──
   fieldsHTML: حقول باستخدام name=""  · values: قيم مبدئية للتعديل
   onOk: تُستدعى بالقيم؛ إن أعادت false تبقى النافذة مفتوحة (خطأ تحقق) */
export function openFormModal({ title, fieldsHTML, values = {}, onOk, okLabel = 'موافق', wide = false, onOpen }) {
  const m = modal({
    title, wide,
    body: `<form class="gen-form">${fieldsHTML}</form>`,
    foot: `<button class="btn primary" data-ok>✔ ${esc(okLabel)}</button>
           <button class="btn" data-cancel>إلغاء</button>`,
  });
  const form = m.body.querySelector('form');
  // تعبئة القيم عند التعديل
  Object.entries(values).forEach(([k, v]) => {
    const el = form.querySelector(`[name="${k}"]`);
    if (el) { if (el.type === 'checkbox') el.checked = !!v; else el.value = v ?? ''; }
  });
  const submit = async () => {
    const data = readForm(form);
    const ok = await onOk(data, m);
    if (ok !== false) m.close();
  };
  m.root.querySelector('[data-ok]').onclick = submit;
  m.root.querySelector('[data-cancel]').onclick = m.close;
  form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
  if (onOpen) onOpen(m);
  return m;
}

/* ── جدول جاهز ── */
export function tableHTML(headers, rowsHTML, { minWidth } = {}) {
  if (!rowsHTML) return `<div class="empty"><div class="e-ic">📭</div>لا توجد بيانات بعد</div>`;
  return `<div class="tbl-wrap"><table class="tbl" ${minWidth ? `style="min-width:${minWidth}px"` : ''}>
    <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${rowsHTML}</tbody></table></div>`;
}

/* ── وسم حالة الفاتورة ── */
export function statusChip(st) {
  return st === 'paid' ? '<span class="chip ok">مدفوعة</span>'
    : st === 'partial' ? '<span class="chip warn">مدفوعة جزئياً</span>'
    : '<span class="chip bad">غير مدفوعة</span>';
}

/* ── منتقي فترة (من/إلى + أزرار سريعة) ── */
export function periodPickerHTML(id = 'pp') {
  return `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end" id="${id}">
    <div class="f-row" style="margin:0"><label>من تاريخ</label><input type="date" class="inp" name="from"></div>
    <div class="f-row" style="margin:0"><label>إلى تاريخ</label><input type="date" class="inp" name="to"></div>
    <div style="display:flex;gap:6px">
      <button class="btn sm" data-p="day">اليوم</button>
      <button class="btn sm" data-p="week">أسبوع</button>
      <button class="btn sm" data-p="month">الشهر</button>
      <button class="btn sm" data-p="year">السنة</button>
    </div>
  </div>`;
}

/* ── الطباعة / تصدير PDF ──
   يُملأ #print-root بمستند مطبوع ثم window.print — المستخدم يختار «حفظ PDF». */
export async function printDoc(title, innerHTML) {
  const factory = await Settings.get('factoryName');
  const root = document.getElementById('print-root');
  root.innerHTML = `<div class="print-doc">
    <div class="p-head">
      <h1>${esc(factory)}</h1>
      <div class="p-meta">${esc(title)}<br>${new Date().toLocaleString('ar-EG')}</div>
    </div>
    ${innerHTML}
    <div class="p-foot">أُنشئ بواسطة نظام «مكة» لإدارة مصنع الأبواب</div>
  </div>`;
  window.print();
}

/* ── عملة العرض ── */
import { fmtNum } from '../core/util.js';
let _cur = '$';
export async function refreshCurrency() { _cur = await Settings.get('currency'); return _cur; }
export const cur = () => _cur;
/** تنسيق مبلغ مع العملة: 12,500 $ */
export const money = (n) => `${fmtNum(n)} ${esc(_cur)}`;
