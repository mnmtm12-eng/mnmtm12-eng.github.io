/* ═══ مركز الفواتير ═══
   كل فواتير البيع والشراء في مكان واحد: بحث، تصفية بالحالة، إنشاء، فتح التفاصيل.
   التفاصيل والتعديل والدفعات تُدار من محرّك الحسابات المشترك (ledger.js). */

import { Ledger, SALES, PURCH } from '../core/repo.js';
import { dbAll } from '../core/db.js';
import { on } from '../core/bus.js';
import { esc, num, fmtDate, exportCSV } from '../core/util.js';
import { tableHTML, statusChip, money, toast } from '../ui/components.js';
import { invoiceForm, invoiceDetail } from './ledger.js';

export async function renderInvoices(view) {
  let mode = 'sale';      // sale | purchase
  let filter = '';        // '' | paid | partial | unpaid

  view.innerHTML = `
    <div class="page-head">
      <h2>🧾 الفواتير</h2>
      <div class="searchbar"><input class="inp" id="iSearch" placeholder="بحث برقم الفاتورة أو الاسم..."></div>
      <button class="btn primary" id="newInv">+ فاتورة جديدة</button>
      <button class="btn" id="csvBtn">⬇ تصدير</button>
    </div>
    <div class="tabs" id="modeTabs">
      <div class="tab active" data-m="sale">فواتير البيع</div>
      <div class="tab" data-m="purchase">فواتير الشراء</div>
    </div>
    <div class="tabs" id="stTabs">
      <div class="tab active" data-s="">الكل</div>
      <div class="tab" data-s="unpaid">غير مدفوعة</div>
      <div class="tab" data-s="partial">مدفوعة جزئياً</div>
      <div class="tab" data-s="paid">مدفوعة</div>
    </div>
    <div class="grid stats" id="iStats" style="margin-bottom:16px"></div>
    <div class="card"><div id="iList"></div></div>`;

  const cfgOf = () => (mode === 'sale' ? SALES : PURCH);
  view.querySelector('#newInv').onclick = () => invoiceForm(cfgOf(), {});

  view.querySelectorAll('#modeTabs .tab').forEach((el) => el.onclick = () => {
    mode = el.dataset.m;
    view.querySelectorAll('#modeTabs .tab').forEach((x) => x.classList.toggle('active', x === el));
    refresh();
  });
  view.querySelectorAll('#stTabs .tab').forEach((el) => el.onclick = () => {
    filter = el.dataset.s;
    view.querySelectorAll('#stTabs .tab').forEach((x) => x.classList.toggle('active', x === el));
    refresh();
  });

  let current = [];
  async function refresh() {
    const cfg = cfgOf();
    const q = view.querySelector('#iSearch').value.trim();
    const [invs, paidMap, parties] = await Promise.all([
      Ledger.listInvoices(cfg), Ledger.paidMap(cfg), dbAll(cfg.party),
    ]);
    const nameOf = (id) => (parties.find((p) => p.id === id) || {}).name || '—';

    current = invs
      .map((i) => ({ ...i, _paid: paidMap[i.id] || 0, _st: Ledger.status(num(i.total), paidMap[i.id] || 0), _party: nameOf(i[cfg.partyField]) }))
      .filter((i) => !filter || i._st === filter)
      .filter((i) => !q || (i.no || '').includes(q) || i._party.includes(q));

    const total = current.reduce((s, i) => s + num(i.total), 0);
    const paid = current.reduce((s, i) => s + i._paid, 0);
    if (!view.querySelector('#iStats')) return;
    view.querySelector('#iStats').innerHTML = `
      <div class="stat"><div class="v">${current.length}</div><div class="l">عدد الفواتير</div></div>
      <div class="stat info"><div class="v">${money(total)}</div><div class="l">الإجمالي</div></div>
      <div class="stat ok"><div class="v">${money(paid)}</div><div class="l">المدفوع</div></div>
      <div class="stat ${total - paid > 0 ? 'bad' : 'ok'}"><div class="v">${money(total - paid)}</div><div class="l">المتبقي</div></div>`;

    view.querySelector('#iList').innerHTML = tableHTML(
      ['رقم الفاتورة', 'التاريخ', cfg.partyLabel === 'عميل' ? 'العميل' : 'المورد', 'البنود', 'الإجمالي', 'المدفوع', 'المتبقي', 'الحالة'],
      current.map((i) => `<tr class="clickable" data-inv="${i.id}">
        <td><b>${esc(i.no)}</b></td><td class="num">${fmtDate(i.date)}</td>
        <td>${esc(i._party)}</td><td class="num">${(i.items || []).length}</td>
        <td class="num">${money(i.total)}</td><td class="num">${money(i._paid)}</td>
        <td class="num"><b>${money(num(i.total) - i._paid)}</b></td>
        <td>${statusChip(i._st)}</td></tr>`).join(''), { minWidth: 820 });

    view.querySelectorAll('[data-inv]').forEach((tr) => tr.onclick = () => invoiceDetail(cfgOf(), tr.dataset.inv));
  }

  view.querySelector('#csvBtn').onclick = () => {
    if (!current.length) { toast('لا بيانات للتصدير', 'warn'); return; }
    exportCSV('invoices.csv', [
      ['رقم الفاتورة', 'التاريخ', 'الجهة', 'الإجمالي', 'المدفوع', 'المتبقي', 'الحالة'],
      ...current.map((i) => [i.no, i.date, i._party, i.total, i._paid, num(i.total) - i._paid,
        i._st === 'paid' ? 'مدفوعة' : i._st === 'partial' ? 'جزئياً' : 'غير مدفوعة']),
    ]);
  };

  view.querySelector('#iSearch').addEventListener('input', refresh);
  await refresh();
  const offs = ['invoices', 'payments', 'purchases', 'spayments', 'customers', 'suppliers'].map((s) => on('data:' + s, refresh));
  return () => offs.forEach((f) => f());
}
