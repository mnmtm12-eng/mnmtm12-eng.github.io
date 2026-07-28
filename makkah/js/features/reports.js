/* ═══ التقارير الشاملة ═══
   تقارير: الأرباح والخسائر · المبيعات · المشتريات · العمال والرواتب · الحضور · المخزون
   مع تصفية بفترة (يوم/أسبوع/شهر/سنة أو تاريخين) وتصدير PDF (طباعة) وExcel (CSV). */

import { Workers, Attendance, Ledger, SALES, PURCH, Inventory, Expenses } from '../core/repo.js';
import { dbAll } from '../core/db.js';
import { esc, num, fmtNum, fmtDate, thisMonth, monthOf, periodRange, exportCSV } from '../core/util.js';
import { tableHTML, money, printDoc, periodPickerHTML, toast, cur } from '../ui/components.js';

const REPORTS = [
  { id: 'pl', ic: '📈', name: 'الأرباح والخسائر' },
  { id: 'sales', ic: '🤝', name: 'المبيعات' },
  { id: 'purchases', ic: '🏭', name: 'المشتريات' },
  { id: 'salaries', ic: '💰', name: 'الرواتب' },
  { id: 'attendance', ic: '🕘', name: 'الحضور والغياب' },
  { id: 'stock', ic: '📦', name: 'المخزون' },
];

export async function renderReports(view) {
  let active = 'pl';
  let range = periodRange('month');

  view.innerHTML = `
    <div class="page-head"><h2>📊 التقارير</h2></div>
    <div class="card">
      ${periodPickerHTML('rPP')}
    </div>
    <div class="tabs" id="repTabs">
      ${REPORTS.map((r) => `<div class="tab ${r.id === active ? 'active' : ''}" data-r="${r.id}">${r.ic} ${r.name}</div>`).join('')}
    </div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">
        <h3 id="repTitle" style="margin:0"></h3>
        <div style="display:flex;gap:8px">
          <button class="btn sm" id="csvBtn">⬇ Excel/CSV</button>
          <button class="btn sm primary" id="pdfBtn">🖨 طباعة / PDF</button>
        </div>
      </div>
      <div id="repBody"></div>
    </div>`;

  const pp = view.querySelector('#rPP');
  pp.querySelector('[name=from]').value = range.from;
  pp.querySelector('[name=to]').value = range.to;
  pp.querySelectorAll('[data-p]').forEach((b) => b.onclick = () => {
    range = periodRange(b.dataset.p);
    pp.querySelector('[name=from]').value = range.from; pp.querySelector('[name=to]').value = range.to; draw();
  });
  pp.querySelectorAll('input').forEach((i) => i.addEventListener('change', () => {
    range = { from: pp.querySelector('[name=from]').value, to: pp.querySelector('[name=to]').value }; draw();
  }));
  view.querySelectorAll('#repTabs .tab').forEach((el) => el.onclick = () => {
    active = el.dataset.r;
    view.querySelectorAll('#repTabs .tab').forEach((x) => x.classList.toggle('active', x === el));
    draw();
  });

  const inRange = (d) => (!range.from || d >= range.from) && (!range.to || d <= range.to);
  let csvRows = [], printHTML = '', repName = '';

  async function draw() {
    const meta = REPORTS.find((r) => r.id === active);
    repName = meta.name;
    view.querySelector('#repTitle').textContent = `${meta.ic} ${meta.name} — ${fmtDate(range.from) || 'البداية'} إلى ${fmtDate(range.to) || 'اليوم'}`;
    const body = view.querySelector('#repBody');

    /* ── الأرباح والخسائر ── */
    if (active === 'pl') {
      const [sInv, pInv, exps, workers] = await Promise.all([
        Ledger.listInvoices(SALES), Ledger.listInvoices(PURCH), Expenses.list(), Workers.list(),
      ]);
      const sales = sInv.filter((i) => inRange(i.date)).reduce((s, i) => s + num(i.total), 0);
      const purch = pInv.filter((i) => inRange(i.date)).reduce((s, i) => s + num(i.total), 0);
      const expense = exps.filter((e) => inRange(e.date)).reduce((s, e) => s + num(e.amount), 0);
      // الرواتب: تُحسب لأشهر الفترة
      const months = [...new Set([monthOf(range.from || thisMonth() + '-01'), monthOf(range.to || thisMonth() + '-01')])];
      let salaries = 0;
      for (const w of workers) for (const mm of months) salaries += (await Attendance.summary(w.id, mm)).salary;
      const net = sales - purch - expense - salaries;

      csvRows = [['البند', 'المبلغ'], ['المبيعات', sales], ['المشتريات', purch], ['المصاريف', expense], ['الرواتب', salaries], ['صافي الربح', net]];
      const rowsHTML = `
        <tr><td>إجمالي المبيعات</td><td class="num" style="color:var(--ok)">${money(sales)}</td></tr>
        <tr><td>إجمالي المشتريات</td><td class="num" style="color:var(--bad)">− ${money(purch)}</td></tr>
        <tr><td>المصاريف التشغيلية</td><td class="num" style="color:var(--bad)">− ${money(expense)}</td></tr>
        <tr><td>الرواتب</td><td class="num" style="color:var(--bad)">− ${money(salaries)}</td></tr>
        <tr style="background:var(--surface2)"><td><b>صافي الربح</b></td>
          <td class="num"><b style="color:${net >= 0 ? 'var(--ok)' : 'var(--bad)'};font-size:1.1rem">${money(net)}</b></td></tr>`;
      body.innerHTML = `<div class="grid stats" style="margin-bottom:14px">
          <div class="stat ok"><div class="v">${money(sales)}</div><div class="l">المبيعات</div></div>
          <div class="stat warn"><div class="v">${money(purch)}</div><div class="l">المشتريات</div></div>
          <div class="stat bad"><div class="v">${money(expense + salaries)}</div><div class="l">مصاريف + رواتب</div></div>
          <div class="stat ${net >= 0 ? 'ok' : 'bad'}"><div class="v">${money(net)}</div><div class="l">صافي الربح</div></div>
        </div>${tableHTML(['البند', 'المبلغ'], rowsHTML)}`;
      printHTML = `<table><tr><th>البند</th><th>المبلغ</th></tr>
        <tr><td>المبيعات</td><td>${fmtNum(sales)}</td></tr><tr><td>المشتريات</td><td>${fmtNum(purch)}</td></tr>
        <tr><td>المصاريف</td><td>${fmtNum(expense)}</td></tr><tr><td>الرواتب</td><td>${fmtNum(salaries)}</td></tr></table>
        <div class="p-total">صافي الربح: ${fmtNum(net)} ${esc(cur())}</div>`;
      return;
    }

    /* ── المبيعات / المشتريات ── */
    if (active === 'sales' || active === 'purchases') {
      const cfg = active === 'sales' ? SALES : PURCH;
      const [invs, paidMap, parties] = await Promise.all([Ledger.listInvoices(cfg), Ledger.paidMap(cfg), dbAll(cfg.party)]);
      const nameOf = (id) => (parties.find((p) => p.id === id) || {}).name || '—';
      const list = invs.filter((i) => inRange(i.date));
      const total = list.reduce((s, i) => s + num(i.total), 0);
      const paid = list.reduce((s, i) => s + (paidMap[i.id] || 0), 0);

      csvRows = [['رقم الفاتورة', 'التاريخ', 'الجهة', 'الإجمالي', 'المدفوع', 'المتبقي'],
        ...list.map((i) => [i.no, i.date, nameOf(i[cfg.partyField]), i.total, paidMap[i.id] || 0, num(i.total) - (paidMap[i.id] || 0)])];
      body.innerHTML = `<div class="grid stats" style="margin-bottom:14px">
          <div class="stat"><div class="v">${list.length}</div><div class="l">عدد الفواتير</div></div>
          <div class="stat info"><div class="v">${money(total)}</div><div class="l">الإجمالي</div></div>
          <div class="stat ok"><div class="v">${money(paid)}</div><div class="l">المحصّل</div></div>
          <div class="stat bad"><div class="v">${money(total - paid)}</div><div class="l">المتبقي</div></div>
        </div>${tableHTML(['رقم', 'التاريخ', 'الجهة', 'الإجمالي', 'المدفوع', 'المتبقي'],
          list.map((i) => `<tr><td>${esc(i.no)}</td><td class="num">${fmtDate(i.date)}</td>
            <td>${esc(nameOf(i[cfg.partyField]))}</td><td class="num">${money(i.total)}</td>
            <td class="num">${money(paidMap[i.id] || 0)}</td>
            <td class="num">${money(num(i.total) - (paidMap[i.id] || 0))}</td></tr>`).join(''))}`;
      printHTML = `<table><tr><th>رقم</th><th>التاريخ</th><th>الجهة</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th></tr>
        ${list.map((i) => `<tr><td>${esc(i.no)}</td><td>${fmtDate(i.date)}</td><td>${esc(nameOf(i[cfg.partyField]))}</td>
          <td>${fmtNum(i.total)}</td><td>${fmtNum(paidMap[i.id] || 0)}</td>
          <td>${fmtNum(num(i.total) - (paidMap[i.id] || 0))}</td></tr>`).join('')}</table>
        <div class="p-total">الإجمالي: ${fmtNum(total)} · المحصّل: ${fmtNum(paid)} · المتبقي: ${fmtNum(total - paid)}</div>`;
      return;
    }

    /* ── الرواتب ── */
    if (active === 'salaries') {
      const workers = await Workers.list();
      const month = monthOf(range.to || range.from || thisMonth() + '-01');
      const rows = [];
      let tot = 0;
      for (const w of workers) {
        const s = await Attendance.summary(w.id, month);
        tot += s.salary;
        rows.push({ name: w.name, ...s });
      }
      csvRows = [['العامل', 'حضور', 'غياب', 'س.إضافية', 'سلف', 'خصومات', 'الراتب'],
        ...rows.map((r) => [r.name, r.present, r.absent, r.overtime, r.advance, r.deduction, r.salary])];
      body.innerHTML = `<p style="color:var(--muted);font-size:.88rem;margin-bottom:10px">شهر: <b>${month}</b> — الرواتب تُحسب شهرياً</p>
        <div class="grid stats" style="margin-bottom:14px">
          <div class="stat"><div class="v">${workers.length}</div><div class="l">عدد العمال</div></div>
          <div class="stat"><div class="v">${money(tot)}</div><div class="l">إجمالي الرواتب</div></div>
        </div>${tableHTML(['العامل', 'حضور', 'غياب', 'س.إضافية', 'سلف', 'خصومات', 'الراتب'],
          rows.map((r) => `<tr><td><b>${esc(r.name)}</b></td><td class="num">${r.present}</td><td class="num">${r.absent}</td>
            <td class="num">${fmtNum(r.overtime)}</td><td class="num">${money(r.advance)}</td>
            <td class="num">${money(r.deduction)}</td><td class="num"><b>${money(r.salary)}</b></td></tr>`).join(''))}`;
      printHTML = `<table><tr><th>العامل</th><th>حضور</th><th>غياب</th><th>س.إضافية</th><th>سلف</th><th>خصومات</th><th>الراتب</th></tr>
        ${rows.map((r) => `<tr><td>${esc(r.name)}</td><td>${r.present}</td><td>${r.absent}</td><td>${fmtNum(r.overtime)}</td>
          <td>${fmtNum(r.advance)}</td><td>${fmtNum(r.deduction)}</td><td>${fmtNum(r.salary)}</td></tr>`).join('')}</table>
        <div class="p-total">إجمالي الرواتب: ${fmtNum(tot)} ${esc(cur())}</div>`;
      return;
    }

    /* ── الحضور ── */
    if (active === 'attendance') {
      const [workers, all] = await Promise.all([Workers.list(), dbAll('attendance')]);
      const nameOf = (id) => (workers.find((w) => w.id === id) || {}).name || '—';
      const list = all.filter((a) => inRange(a.date)).sort((a, b) => b.date.localeCompare(a.date));
      const present = list.filter((a) => a.status !== 'absent').length;
      csvRows = [['التاريخ', 'العامل', 'الحالة', 'س.إضافية', 'سلفة', 'خصم', 'ملاحظات'],
        ...list.map((a) => [a.date, nameOf(a.workerId), a.status === 'absent' ? 'غائب' : 'حاضر', a.overtime, a.advance, a.deduction, a.note || ''])];
      body.innerHTML = `<div class="grid stats" style="margin-bottom:14px">
          <div class="stat ok"><div class="v">${present}</div><div class="l">أيام حضور</div></div>
          <div class="stat bad"><div class="v">${list.length - present}</div><div class="l">أيام غياب</div></div>
        </div>${tableHTML(['التاريخ', 'العامل', 'الحالة', 'س.إضافية', 'سلفة', 'خصم'],
          list.slice(0, 400).map((a) => `<tr><td class="num">${fmtDate(a.date)}</td><td>${esc(nameOf(a.workerId))}</td>
            <td>${a.status === 'absent' ? '<span class="chip bad">غائب</span>' : '<span class="chip ok">حاضر</span>'}</td>
            <td class="num">${fmtNum(a.overtime)}</td><td class="num">${fmtNum(a.advance)}</td>
            <td class="num">${fmtNum(a.deduction)}</td></tr>`).join(''))}`;
      printHTML = `<table><tr><th>التاريخ</th><th>العامل</th><th>الحالة</th><th>س.إضافية</th><th>سلفة</th><th>خصم</th></tr>
        ${list.map((a) => `<tr><td>${fmtDate(a.date)}</td><td>${esc(nameOf(a.workerId))}</td>
          <td>${a.status === 'absent' ? 'غائب' : 'حاضر'}</td><td>${fmtNum(a.overtime)}</td>
          <td>${fmtNum(a.advance)}</td><td>${fmtNum(a.deduction)}</td></tr>`).join('')}</table>`;
      return;
    }

    /* ── المخزون ── */
    if (active === 'stock') {
      const [mats, cats] = await Promise.all([Inventory.materials(), Inventory.categories()]);
      const catName = (id) => (cats.find((c) => c.id === id) || {}).name || '—';
      const value = mats.reduce((s, m) => s + num(m.qty) * num(m.price), 0);
      const low = mats.filter((m) => num(m.minQty) > 0 && num(m.qty) <= num(m.minQty));
      csvRows = [['المادة', 'القسم', 'الوحدة', 'الكمية', 'الحد الأدنى', 'السعر', 'القيمة'],
        ...mats.map((m) => [m.name, catName(m.categoryId), m.unit || '', m.qty, m.minQty, m.price, num(m.qty) * num(m.price)])];
      body.innerHTML = `<div class="grid stats" style="margin-bottom:14px">
          <div class="stat"><div class="v">${mats.length}</div><div class="l">عدد المواد</div></div>
          <div class="stat info"><div class="v">${money(value)}</div><div class="l">قيمة المخزون</div></div>
          <div class="stat ${low.length ? 'bad' : 'ok'}"><div class="v">${low.length}</div><div class="l">بلغت حد الطلب</div></div>
        </div>${tableHTML(['المادة', 'القسم', 'الكمية', 'الحد الأدنى', 'السعر', 'القيمة'],
          mats.map((m) => `<tr class="${num(m.minQty) > 0 && num(m.qty) <= num(m.minQty) ? 'low' : ''}">
            <td><b>${esc(m.name)}</b></td><td>${esc(catName(m.categoryId))}</td>
            <td class="num">${fmtNum(m.qty)} ${esc(m.unit || '')}</td><td class="num">${fmtNum(m.minQty)}</td>
            <td class="num">${fmtNum(m.price)}</td><td class="num">${money(num(m.qty) * num(m.price))}</td></tr>`).join(''))}`;
      printHTML = `<table><tr><th>المادة</th><th>القسم</th><th>الكمية</th><th>الحد الأدنى</th><th>السعر</th><th>القيمة</th></tr>
        ${mats.map((m) => `<tr><td>${esc(m.name)}</td><td>${esc(catName(m.categoryId))}</td><td>${fmtNum(m.qty)}</td>
          <td>${fmtNum(m.minQty)}</td><td>${fmtNum(m.price)}</td><td>${fmtNum(num(m.qty) * num(m.price))}</td></tr>`).join('')}</table>
        <div class="p-total">قيمة المخزون: ${fmtNum(value)} ${esc(cur())}</div>`;
    }
  }

  view.querySelector('#pdfBtn').onclick = () =>
    printDoc(`${repName} — ${fmtDate(range.from) || ''} إلى ${fmtDate(range.to) || ''}`,
      `<h2 style="font-size:15px">${esc(repName)}</h2>
       <p style="font-size:11px">الفترة: ${fmtDate(range.from) || 'البداية'} إلى ${fmtDate(range.to) || 'اليوم'}</p>${printHTML}`);
  view.querySelector('#csvBtn').onclick = () => {
    if (!csvRows.length) { toast('لا بيانات', 'warn'); return; }
    exportCSV(`${active}-report.csv`, csvRows);
  };

  await draw();
}
