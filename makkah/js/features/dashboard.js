/* ═══ لوحة التحكم ═══
   أرقام حيّة: تُعاد قراءتها بعد أي عملية في النظام عبر ناقل الأحداث.
   + بطاقات الأقسام + آخر العمليات + مصروف سريع. */

import { Workers, Attendance, Ledger, SALES, PURCH, Inventory, Expenses, Activity } from '../core/repo.js';
import { onAnyData } from '../core/bus.js';
import { esc, today, thisMonth, fmtNum, num, fmtDate } from '../core/util.js';
import { money, toast, openFormModal } from '../ui/components.js';

const MODULES = [
  { path: '/workers', ic: '👷', t: 'العمال', d: 'الحضور والغياب والرواتب' },
  { path: '/customers', ic: '🤝', t: 'العملاء', d: 'الفواتير وكشوف الحساب' },
  { path: '/suppliers', ic: '🏭', t: 'الموردون', d: 'المشتريات والمستحقات' },
  { path: '/inventory', ic: '📦', t: 'المخزون', d: 'المواد والحركات والتنبيهات' },
  { path: '/invoices', ic: '🧾', t: 'الفواتير', d: 'كل فواتير البيع في مكان واحد' },
  { path: '/reports', ic: '📊', t: 'التقارير', d: 'أرباح، مبيعات، حضور، مخزون' },
  { path: '/settings', ic: '⚙️', t: 'الإعدادات', d: 'الحساب، النسخ الاحتياطي، الذكاء الاصطناعي' },
];

export async function renderDashboard(view) {
  view.innerHTML = `
    <div class="grid stats" id="statsGrid"></div>
    <div class="card" style="margin-top:18px">
      <h3>📌 الأقسام</h3>
      <div class="grid cards">
        ${MODULES.map((m) => `
          <div class="mod-card" onclick="location.hash='#${m.path}'">
            <div class="m-ic">${m.ic}</div><h4>${esc(m.t)}</h4><p>${esc(m.d)}</p>
          </div>`).join('')}
      </div>
    </div>
    <div class="grid" style="grid-template-columns:2fr 1fr" id="bottomGrid">
      <div class="card"><h3>🕘 آخر العمليات</h3><div id="lastActs"></div></div>
      <div class="card"><h3>💸 مصروف سريع</h3>
        <p style="color:var(--muted);font-size:.85rem;margin-bottom:10px">مصاريف تشغيلية تدخل في حساب صافي الربح</p>
        <button class="btn primary block" id="addExpense">+ تسجيل مصروف</button>
        <div id="lastExpenses" style="margin-top:12px"></div>
      </div>
    </div>
    <style>@media (max-width:900px){ #bottomGrid { grid-template-columns:1fr; } }</style>`;

  view.querySelector('#addExpense').onclick = () =>
    openFormModal({
      title: 'تسجيل مصروف',
      fieldsHTML: `
        <div class="f-row"><label>المبلغ <span class="req">*</span></label><input class="inp" name="amount" type="number" step="any" required></div>
        <div class="f-row"><label>التاريخ</label><input class="inp" name="date" type="date" value="${today()}"></div>
        <div class="f-row"><label>البيان</label><input class="inp" name="note" placeholder="كهرباء، نقل، صيانة..."></div>`,
      onOk: async (d) => {
        if (!num(d.amount)) { toast('أدخل مبلغاً صحيحاً', 'bad'); return false; }
        await Expenses.save({ amount: num(d.amount), date: d.date, note: d.note });
        toast('سُجّل المصروف', 'ok');
      },
    });

  async function refresh() {
    // حضور اليوم
    const attToday = await Attendance.byDate(today());
    const present = attToday.filter((a) => a.status !== 'absent').length;
    const absent = attToday.length - present;

    // رواتب الشهر الحالي (مجموع رواتب كل العمال حتى اللحظة)
    const workers = await Workers.list();
    let salaries = 0;
    for (const w of workers) salaries += (await Attendance.summary(w.id, thisMonth())).salary;

    // مبيعات ومشتريات ومستحقات
    const [sInvs, sPaid, pInvs, pPaid] = await Promise.all([
      Ledger.listInvoices(SALES), Ledger.paidMap(SALES),
      Ledger.listInvoices(PURCH), Ledger.paidMap(PURCH),
    ]);
    const sales = sInvs.reduce((s, i) => s + num(i.total), 0);
    const purchases = pInvs.reduce((s, i) => s + num(i.total), 0);
    const dueFromCustomers = sInvs.reduce((s, i) => s + Math.max(0, num(i.total) - (sPaid[i.id] || 0)), 0);
    const dueToSuppliers = pInvs.reduce((s, i) => s + Math.max(0, num(i.total) - (pPaid[i.id] || 0)), 0);

    const expenses = (await Expenses.list()).reduce((s, e) => s + num(e.amount), 0);
    const profit = sales - purchases - expenses - salaries;

    const mats = await Inventory.materials();
    const stockValue = mats.reduce((s, m) => s + num(m.qty) * num(m.price), 0);
    const low = (await Inventory.lowStock()).length;

    // حماية: إن غادر المستخدم الشاشة أثناء القراءة، لا نكتب في عناصر لم تعد موجودة
    if (!view.querySelector('#statsGrid')) return;

    view.querySelector('#statsGrid').innerHTML = `
      <div class="stat ok"><div class="v">${present}</div><div class="l">حاضرون اليوم</div></div>
      <div class="stat bad"><div class="v">${absent}</div><div class="l">غائبون اليوم</div></div>
      <div class="stat"><div class="v">${money(salaries)}</div><div class="l">رواتب الشهر حتى الآن</div></div>
      <div class="stat info"><div class="v">${money(sales)}</div><div class="l">إجمالي المبيعات</div></div>
      <div class="stat warn"><div class="v">${money(purchases)}</div><div class="l">إجمالي المشتريات</div></div>
      <div class="stat ${profit >= 0 ? 'ok' : 'bad'}"><div class="v">${money(profit)}</div><div class="l">صافي الربح التقديري</div></div>
      <div class="stat info"><div class="v">${money(dueFromCustomers)}</div><div class="l">مستحق من العملاء</div></div>
      <div class="stat warn"><div class="v">${money(dueToSuppliers)}</div><div class="l">مستحق للموردين</div></div>
      <div class="stat"><div class="v">${money(stockValue)}</div><div class="l">قيمة المخزون</div></div>
      <div class="stat ${low ? 'bad' : 'ok'}"><div class="v">${low}</div><div class="l">مواد بلغت حد الطلب</div></div>`;

    // آخر العمليات
    const acts = (await Activity.list(8));
    view.querySelector('#lastActs').innerHTML = acts.length
      ? acts.map((a) => `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--line);font-size:.88rem">
          <span class="chip gold">${esc(a.action)}</span>
          <span style="flex:1">${esc(a.summary || a.entity)}</span>
          <span style="color:var(--muted);font-size:.78rem">${esc(a.time.slice(0, 16).replace('T', ' '))}</span>
        </div>`).join('')
      : '<div class="empty">لا عمليات بعد</div>';

    const exps = (await Expenses.list()).slice(0, 4);
    view.querySelector('#lastExpenses').innerHTML = exps.map((e) =>
      `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line);font-size:.85rem">
        <span>${esc(e.note || 'مصروف')} <small style="color:var(--muted)">${fmtDate(e.date)}</small></span>
        <b>${money(e.amount)}</b></div>`).join('');
  }

  await refresh();
  // ✨ تحديث لحظي: أي عملية في أي قسم تعيد حساب الأرقام
  return onAnyData(refresh);
}
