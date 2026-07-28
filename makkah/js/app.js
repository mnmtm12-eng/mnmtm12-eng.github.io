/* ═══════════════════════════════════════════════════════════
   مكة — نقطة الانطلاق والموجّه (Router)
   ═══════════════════════════════════════════════════════════
   التنقل بالهاش (#/dashboard ...) — يعمل على أي استضافة ثابتة وداخل PWA.
   لإضافة قسم جديد مستقبلاً:
     1) أنشئ ملفاً في js/features/ يصدّر renderX(container, params)
     2) أضف مساراً في ROUTES ورابطاً في القائمة الجانبية أدناه — لا شيء آخر.
*/
import { ensureDefaultUser, isAuthed, isDefaultCreds, login, logout } from './core/auth.js';
import { Settings, Inventory, Ledger, SALES, PURCH } from './core/repo.js';
import { Backup } from './core/repo.js';
import { startAttendanceScheduler } from './core/attendance.js';
import { onAnyData } from './core/bus.js';
import { esc } from './core/util.js';
import { toast, refreshCurrency } from './ui/components.js';

import { renderDashboard } from './features/dashboard.js';
import { renderWorkers, renderWorkerPage } from './features/workers.js';
import { renderCustomers, renderCustomerPage } from './features/customers.js';
import { renderSuppliers, renderSupplierPage } from './features/suppliers.js';
import { renderInventory, renderMaterialPage } from './features/inventory.js';
import { renderInvoices } from './features/invoices.js';
import { renderReports } from './features/reports.js';
import { renderSettings } from './features/settings.js';
import { mountAssistant } from './features/assistant.js';

/* ── جدول المسارات ── */
const ROUTES = [
  { re: /^\/dashboard$/, title: 'لوحة التحكم', fn: renderDashboard },
  { re: /^\/workers$/, title: 'العمال', fn: renderWorkers },
  { re: /^\/workers\/(.+)$/, title: 'ملف عامل', fn: (c, m) => renderWorkerPage(c, m[1]) },
  { re: /^\/customers$/, title: 'العملاء', fn: renderCustomers },
  { re: /^\/customers\/(.+)$/, title: 'ملف عميل', fn: (c, m) => renderCustomerPage(c, m[1]) },
  { re: /^\/suppliers$/, title: 'الموردون والشركات', fn: renderSuppliers },
  { re: /^\/suppliers\/(.+)$/, title: 'ملف مورد', fn: (c, m) => renderSupplierPage(c, m[1]) },
  { re: /^\/inventory$/, title: 'المخزون', fn: renderInventory },
  { re: /^\/inventory\/material\/(.+)$/, title: 'ملف مادة', fn: (c, m) => renderMaterialPage(c, m[1]) },
  { re: /^\/invoices$/, title: 'الفواتير', fn: renderInvoices },
  { re: /^\/reports$/, title: 'التقارير', fn: renderReports },
  { re: /^\/settings$/, title: 'الإعدادات', fn: renderSettings },
];

const NAV = [
  { path: '/dashboard', ic: '🏠', label: 'لوحة التحكم' },
  { sep: 'الأقسام' },
  { path: '/workers', ic: '👷', label: 'العمال' },
  { path: '/customers', ic: '🤝', label: 'العملاء' },
  { path: '/suppliers', ic: '🏭', label: 'الموردون' },
  { path: '/inventory', ic: '📦', label: 'المخزون' },
  { path: '/invoices', ic: '🧾', label: 'الفواتير' },
  { sep: 'النظام' },
  { path: '/reports', ic: '📊', label: 'التقارير' },
  { path: '/settings', ic: '⚙️', label: 'الإعدادات' },
];

const app = document.getElementById('app');
let cleanup = null;     // دالة تنظيف الشاشة الحالية (إلغاء الاستماع للأحداث)
let shellBuilt = false;
let routeToken = 0;     // رمز لمنع تداخل عمليتي عرض متزامنتين (يمنع تسرّب المستمعين)

/** الانتقال إلى مسار: يعتمد على hashchange، ويعيد العرض يدوياً إن كان المسار نفسه */
function go(hash) {
  if (location.hash === hash) route(); else location.hash = hash;
}

/* ── الثيم ── */
async function applyTheme() {
  const t = localStorage.getItem('makkah.theme') || (await Settings.get('theme')) || 'light';
  document.documentElement.dataset.theme = t;
}
export async function toggleTheme() {
  const cur = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = cur;
  localStorage.setItem('makkah.theme', cur);
  await Settings.set('theme', cur);
}

/* ── شاشة الدخول ── */
async function renderLogin() {
  shellBuilt = false;
  const showHint = await isDefaultCreds();
  app.innerHTML = `
  <div class="login-wrap">
    <div class="login-card">
      <div class="login-logo">مكة</div>
      <h1>مكة</h1>
      <div class="sub">واجهة «المدينة» — نظام إدارة مصنع الأبواب</div>
      <div class="login-err" id="loginErr"></div>
      <form id="loginForm">
        <div class="f-row"><label>اسم المستخدم</label>
          <input class="inp" name="username" autocomplete="username" required></div>
        <div class="f-row"><label>كلمة المرور</label>
          <input class="inp" type="password" name="password" autocomplete="current-password" required></div>
        <button class="btn primary block" type="submit" style="margin-top:6px">تسجيل الدخول</button>
      </form>
      ${showHint ? `<div class="login-hint">الدخول الأول: المستخدم <b>admin</b> وكلمة المرور <b>1234</b><br>غيّرهما من الإعدادات بعد الدخول.</div>` : ''}
    </div>
  </div>`;
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const res = await login(f.get('username').trim(), f.get('password'));
    if (res.ok) { toast('أهلاً بك في «المدينة» 👋', 'ok'); go('#/dashboard'); }
    else { const el = document.getElementById('loginErr'); el.textContent = res.msg; el.style.display = 'block'; }
  });
}

/* ── هيكل التطبيق (يُبنى مرة واحدة بعد الدخول) ── */
function buildShell() {
  if (shellBuilt) return;
  shellBuilt = true;
  app.innerHTML = `
  <div class="shell">
    <div class="overlay" id="overlay"></div>
    <aside class="sidebar" id="sidebar">
      <div class="s-head">
        <div class="s-logo">م</div>
        <div class="s-title"><b>مكة</b><span>واجهة المدينة · إدارة المصنع</span></div>
      </div>
      <nav class="s-nav" id="snav">
        ${NAV.map((n) => n.sep
          ? `<div class="s-sep">${esc(n.sep)}</div>`
          : `<a href="#${n.path}" data-path="${n.path}"><span class="ic">${n.ic}</span>${esc(n.label)}</a>`).join('')}
      </nav>
      <div class="s-foot">مكة v1.0 — يعمل بدون إنترنت</div>
    </aside>
    <div class="main">
      <header class="topbar">
        <button class="icon-btn" id="menuBtn" aria-label="القائمة">☰</button>
        <div class="t-title" id="pageTitle">لوحة التحكم</div>
        <div style="position:relative">
          <button class="icon-btn" id="alertsBtn" aria-label="التنبيهات">🔔<span class="badge" id="alertsBadge" style="display:none">0</span></button>
          <div id="alertsHost"></div>
        </div>
        <button class="icon-btn" id="themeBtn" title="الوضع الفاتح/الداكن">🌓</button>
        <button class="icon-btn" id="logoutBtn" title="تسجيل الخروج">⎋</button>
      </header>
      <div class="content" id="view"></div>
    </div>
  </div>`;

  // قائمة الهاتف
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  const closeMenu = () => { sidebar.classList.remove('open'); overlay.classList.remove('show'); };
  document.getElementById('menuBtn').onclick = () => { sidebar.classList.add('open'); overlay.classList.add('show'); };
  overlay.onclick = closeMenu;
  document.getElementById('snav').addEventListener('click', closeMenu);

  document.getElementById('themeBtn').onclick = toggleTheme;
  document.getElementById('logoutBtn').onclick = () => { logout(); location.hash = ''; route(); };
  document.getElementById('alertsBtn').onclick = toggleAlerts;

  mountAssistant();               // زر المساعد الذكي العائم
  onAnyData(() => refreshAlerts()); // تحديث عدّاد التنبيهات بعد أي عملية
  refreshAlerts();
}

/* ── التنبيهات الذكية ── */
async function computeAlerts() {
  const alerts = [];
  const low = await Inventory.lowStock();
  if (low.length) alerts.push({ ic: '📉', msg: `${low.length} مادة وصلت حد الطلب في المخزون`, go: '#/inventory' });
  const paidMap = await Ledger.paidMap(SALES);
  const invs = await Ledger.listInvoices(SALES);
  const unpaid = invs.filter((i) => (paidMap[i.id] || 0) < i.total).length;
  if (unpaid) alerts.push({ ic: '🧾', msg: `${unpaid} فاتورة بيع غير مسدّدة بالكامل`, go: '#/invoices' });
  const pMap = await Ledger.paidMap(PURCH);
  const purch = await Ledger.listInvoices(PURCH);
  const owe = purch.reduce((s, i) => s + Math.max(0, i.total - (pMap[i.id] || 0)), 0);
  if (owe > 0) alerts.push({ ic: '🏭', msg: `مستحقات للموردين بقيمة ${owe.toLocaleString()}`, go: '#/suppliers' });
  const sd = Number(await Settings.get('salaryDay')) || 1;
  const d = new Date(); const daysLeft = (sd - d.getDate() + 31) % 31;
  if (daysLeft <= 2) alerts.push({ ic: '💰', msg: 'اقترب موعد صرف الرواتب', go: '#/workers' });
  return alerts;
}
async function refreshAlerts() {
  const badge = document.getElementById('alertsBadge');
  if (!badge) return;
  const alerts = await computeAlerts();
  badge.style.display = alerts.length ? 'flex' : 'none';
  badge.textContent = alerts.length;
}
async function toggleAlerts() {
  const host = document.getElementById('alertsHost');
  if (host.innerHTML) { host.innerHTML = ''; return; }
  const alerts = await computeAlerts();
  host.innerHTML = `<div class="alerts-pop">${
    alerts.length
      ? alerts.map((a) => `<div class="al-item" data-go="${a.go}"><span>${a.ic}</span><span>${esc(a.msg)}</span></div>`).join('')
      : '<div class="al-item">لا توجد تنبيهات حالياً ✨</div>'
  }</div>`;
  host.querySelectorAll('[data-go]').forEach((el) => el.onclick = () => { host.innerHTML = ''; location.hash = el.dataset.go; });
}

/* ── الموجّه ── */
async function route() {
  const token = ++routeToken;                       // أي استدعاء لاحق يُبطل هذا العرض
  if (cleanup) { try { cleanup(); } catch {} cleanup = null; }
  if (!isAuthed()) { await renderLogin(); return; }
  buildShell();

  const path = (location.hash.replace(/^#/, '') || '/dashboard');
  const view = document.getElementById('view');
  for (const r of ROUTES) {
    const m = path.match(r.re);
    if (m) {
      document.getElementById('pageTitle').textContent = r.title;
      document.querySelectorAll('#snav a').forEach((a) =>
        a.classList.toggle('active', path === a.dataset.path || path.startsWith(a.dataset.path + '/')));
      view.innerHTML = '';
      const off = await r.fn(view, m);
      // إن بدأ عرض آخر أثناء انتظار هذا العرض، ننظّف فوراً بدل ترك مستمعين معلّقين
      if (token !== routeToken) { try { off && off(); } catch {} return; }
      cleanup = off || null;
      view.scrollTop = 0;
      return;
    }
  }
  go('#/dashboard');
}

/* ── الإقلاع ── */
(async function boot() {
  await ensureDefaultUser();
  await Inventory.seedDefaults();
  await applyTheme();
  await refreshCurrency();
  await Backup.autoBackup();          // نسخة احتياطية تلقائية يومية
  startAttendanceScheduler();          // مولّد الحضور اليومي
  window.addEventListener('hashchange', route);
  route();
  // تسجيل عامل الخدمة (يجعل التطبيق يعمل بدون إنترنت ويُثبَّت كتطبيق)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
})();
