/* ═══ قسم المخزون ═══
   أقسام مستقلة (خشب، صاج، بوية، إكسسوارات، زجاج، ألمنيوم + أي قسم جديد).
   لكل مادة صفحة مستقلة تعرض الرصيد وكل الحركات الداخلة والخارجة.
   الحركات الآلية تأتي من فواتير الشراء (إدخال) والبيع (إخراج) عبر Inventory.applyRef،
   ويمكن أيضاً تسجيل حركة يدوية (استخدام في الإنتاج، تالف، جرد...). */

import { Inventory } from '../core/repo.js';
import { on } from '../core/bus.js';
import { esc, num, fmtNum, today, fmtDate, exportCSV } from '../core/util.js';
import { toast, confirmDlg, openFormModal, tableHTML, money, printDoc, periodPickerHTML } from '../ui/components.js';
import { periodRange } from '../core/util.js';

/* ── استمارة مادة ── */
async function materialForm(mat = {}, presetCat = '') {
  const cats = await Inventory.categories();
  return openFormModal({
    title: mat.id ? 'تعديل المادة' : 'إضافة مادة جديدة',
    values: { ...mat, categoryId: mat.categoryId || presetCat },
    fieldsHTML: `
      <div class="f-row"><label>اسم المادة <span class="req">*</span></label><input class="inp" name="name" required></div>
      <div class="f-grid">
        <div class="f-row"><label>القسم <span class="req">*</span></label>
          <select class="inp" name="categoryId">${cats.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
        <div class="f-row"><label>الكود (اختياري)</label><input class="inp" name="code"></div>
      </div>
      <div class="f-grid3">
        <div class="f-row"><label>وحدة القياس</label><input class="inp" name="unit" placeholder="متر، لوح، كغم..."></div>
        <div class="f-row"><label>الكمية الحالية</label><input class="inp" name="qty" type="number" step="any" placeholder="0"></div>
        <div class="f-row"><label>الحد الأدنى</label><input class="inp" name="minQty" type="number" step="any" placeholder="0"></div>
      </div>
      <div class="f-row"><label>سعر الوحدة</label><input class="inp" name="price" type="number" step="any" placeholder="0"></div>
      <div class="f-row"><label>ملاحظات</label><textarea class="inp" name="notes"></textarea></div>`,
    onOk: async (d) => {
      if (!d.name) { toast('اسم المادة إجباري', 'bad'); return false; }
      await Inventory.saveMaterial({ ...mat, ...d, qty: num(d.qty), minQty: num(d.minQty), price: num(d.price) });
      toast(mat.id ? 'حُفظت التعديلات' : 'أُضيفت المادة', 'ok');
    },
  });
}

/* ═══ شاشة المخزون ═══ */
export async function renderInventory(view) {
  let activeCat = '';

  view.innerHTML = `
    <div class="page-head">
      <h2>📦 المخزون</h2>
      <div class="searchbar"><input class="inp" id="mSearch" placeholder="بحث عن مادة..."></div>
      <button class="btn" id="addCat">+ قسم</button>
      <button class="btn primary" id="addMat">+ مادة</button>
    </div>
    <div class="grid stats" id="invStats" style="margin-bottom:16px"></div>
    <div id="lowBox"></div>
    <div class="tabs" id="catTabs"></div>
    <div class="card"><div id="matList"></div></div>
    <div class="card">
      <h3>📑 تقارير المخزون</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn sm" id="repCurrent">الكميات الحالية</button>
        <button class="btn sm" id="repLow">المواد الناقصة</button>
        <button class="btn sm" id="repMoves">حركات بين تاريخين</button>
      </div>
    </div>`;

  view.querySelector('#addMat').onclick = () => materialForm({}, activeCat);
  view.querySelector('#addCat').onclick = () => openFormModal({
    title: 'إضافة قسم مخزون',
    fieldsHTML: `<div class="f-row"><label>اسم القسم <span class="req">*</span></label>
      <input class="inp" name="name" placeholder="مثال: مفصلات، دهانات..."></div>`,
    onOk: async (d) => {
      if (!d.name) return false;
      await Inventory.saveCategory({ name: d.name, order: 99 });
      toast('أُضيف القسم', 'ok');
    },
  });

  async function refresh() {
    const q = view.querySelector('#mSearch').value.trim();
    const [cats, mats] = await Promise.all([Inventory.categories(), Inventory.materials()]);
    const catName = (id) => (cats.find((c) => c.id === id) || {}).name || '—';

    const value = mats.reduce((s, m) => s + num(m.qty) * num(m.price), 0);
    const low = mats.filter((m) => num(m.minQty) > 0 && num(m.qty) <= num(m.minQty));
    if (!view.querySelector('#invStats')) return;
    view.querySelector('#invStats').innerHTML = `
      <div class="stat"><div class="v">${cats.length}</div><div class="l">الأقسام</div></div>
      <div class="stat info"><div class="v">${mats.length}</div><div class="l">عدد المواد</div></div>
      <div class="stat"><div class="v">${money(value)}</div><div class="l">قيمة المخزون</div></div>
      <div class="stat ${low.length ? 'bad' : 'ok'}"><div class="v">${low.length}</div><div class="l">بلغت حد الطلب</div></div>`;

    view.querySelector('#lowBox').innerHTML = low.length ? `
      <div class="card" style="border-color:var(--bad)">
        <h3 style="color:var(--bad)">⚠️ تنبيه: مواد وصلت الحد الأدنى</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${low.map((m) => `<span class="chip bad">${esc(m.name)}: ${fmtNum(m.qty)} ${esc(m.unit || '')}</span>`).join('')}
        </div></div>` : '';

    view.querySelector('#catTabs').innerHTML =
      [`<div class="tab ${!activeCat ? 'active' : ''}" data-c="">الكل</div>`]
        .concat(cats.map((c) => {
          const n = mats.filter((m) => m.categoryId === c.id).length;
          return `<div class="tab ${activeCat === c.id ? 'active' : ''}" data-c="${c.id}">${esc(c.name)} <small>(${n})</small></div>`;
        })).join('');
    view.querySelectorAll('#catTabs .tab').forEach((el) => el.onclick = () => { activeCat = el.dataset.c; refresh(); });

    const list = mats.filter((m) => (!activeCat || m.categoryId === activeCat) &&
      (!q || m.name.includes(q) || (m.code || '').includes(q)));

    view.querySelector('#matList').innerHTML = tableHTML(
      ['المادة', 'القسم', 'الكود', 'الوحدة', 'الكمية', 'الحد الأدنى', 'السعر', 'القيمة', ''],
      list.map((m) => {
        const isLow = num(m.minQty) > 0 && num(m.qty) <= num(m.minQty);
        return `<tr class="clickable ${isLow ? 'low' : ''}" onclick="location.hash='#/inventory/material/${m.id}'">
          <td><b>${esc(m.name)}</b></td><td>${esc(catName(m.categoryId))}</td>
          <td>${esc(m.code || '—')}</td><td>${esc(m.unit || '—')}</td>
          <td class="num"><b>${fmtNum(m.qty)}</b>${isLow ? ' ⚠️' : ''}</td>
          <td class="num">${fmtNum(m.minQty)}</td>
          <td class="num">${fmtNum(m.price)}</td>
          <td class="num">${money(num(m.qty) * num(m.price))}</td>
          <td onclick="event.stopPropagation()">
            <button class="btn sm" data-edit="${m.id}">تعديل</button>
            <button class="btn sm danger" data-del="${m.id}">حذف</button></td></tr>`;
      }).join(''), { minWidth: 900 });

    view.querySelectorAll('[data-edit]').forEach((b) => b.onclick = async () => materialForm(await Inventory.material(b.dataset.edit)));
    view.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
      const m = await Inventory.material(b.dataset.del);
      if (await confirmDlg(`حذف المادة «${m.name}» وكل حركاتها؟`)) { await Inventory.removeMaterial(m.id); toast('حُذفت', 'ok'); }
    });

    /* تقارير */
    view.querySelector('#repCurrent').onclick = () => printDoc('تقرير الكميات الحالية', `
      <h2 style="font-size:15px">الكميات الحالية في المخزون</h2>
      <table><tr><th>المادة</th><th>القسم</th><th>الوحدة</th><th>الكمية</th><th>السعر</th><th>القيمة</th></tr>
      ${mats.map((m) => `<tr><td>${esc(m.name)}</td><td>${esc(catName(m.categoryId))}</td><td>${esc(m.unit || '')}</td>
        <td>${fmtNum(m.qty)}</td><td>${fmtNum(m.price)}</td><td>${fmtNum(num(m.qty) * num(m.price))}</td></tr>`).join('')}
      </table><div class="p-total">قيمة المخزون: ${fmtNum(value)}</div>`);
    view.querySelector('#repLow').onclick = () => printDoc('تقرير المواد الناقصة', `
      <h2 style="font-size:15px">مواد وصلت الحد الأدنى</h2>
      <table><tr><th>المادة</th><th>الكمية</th><th>الحد الأدنى</th><th>النقص</th></tr>
      ${low.map((m) => `<tr><td>${esc(m.name)}</td><td>${fmtNum(m.qty)}</td><td>${fmtNum(m.minQty)}</td>
        <td>${fmtNum(num(m.minQty) - num(m.qty))}</td></tr>`).join('')}</table>`);
    view.querySelector('#repMoves').onclick = () => movesReport();
  }

  /* تقرير الحركات بين تاريخين */
  async function movesReport() {
    const { modal } = await import('../ui/components.js');
    const m = modal({
      title: 'تقرير حركات المخزون', wide: true,
      body: `${periodPickerHTML('mvPP')}<div id="mvBody" style="margin-top:14px"></div>`,
      foot: `<button class="btn" id="mvCsv">⬇ Excel/CSV</button><button class="btn primary" id="mvPrint">🖨 طباعة / PDF</button>`,
    });
    const pp = m.body.querySelector('#mvPP');
    let rows = [];
    async function draw() {
      const from = pp.querySelector('[name=from]').value, to = pp.querySelector('[name=to]').value;
      const [mats, allMoves] = await Promise.all([Inventory.materials(), (await import('../core/db.js')).dbAll('movements')]);
      const nameOf = (id) => (mats.find((x) => x.id === id) || {}).name || '—';
      rows = allMoves.filter((v) => (!from || v.date >= from) && (!to || v.date <= to))
        .sort((a, b) => b.date.localeCompare(a.date));
      m.body.querySelector('#mvBody').innerHTML = tableHTML(['التاريخ', 'المادة', 'النوع', 'الكمية', 'الجهة', 'ملاحظات'],
        rows.map((v) => `<tr><td>${fmtDate(v.date)}</td><td>${esc(nameOf(v.materialId))}</td>
          <td>${v.type === 'in' ? '<span class="chip ok">إدخال</span>' : '<span class="chip bad">إخراج</span>'}</td>
          <td class="num">${fmtNum(v.qty)}</td><td>${esc(v.party || '—')}</td><td>${esc(v.note || '—')}</td></tr>`).join(''));
      m._nameOf = nameOf;
    }
    pp.querySelectorAll('[data-p]').forEach((b) => b.onclick = () => {
      const r = periodRange(b.dataset.p);
      pp.querySelector('[name=from]').value = r.from; pp.querySelector('[name=to]').value = r.to; draw();
    });
    pp.querySelectorAll('input').forEach((i) => i.addEventListener('change', draw));
    m.root.querySelector('#mvPrint').onclick = () => printDoc('تقرير حركات المخزون', `
      <table><tr><th>التاريخ</th><th>المادة</th><th>النوع</th><th>الكمية</th><th>الجهة</th></tr>
      ${rows.map((v) => `<tr><td>${fmtDate(v.date)}</td><td>${esc(m._nameOf(v.materialId))}</td>
        <td>${v.type === 'in' ? 'إدخال' : 'إخراج'}</td><td>${fmtNum(v.qty)}</td><td>${esc(v.party || '')}</td></tr>`).join('')}</table>`);
    m.root.querySelector('#mvCsv').onclick = () => exportCSV('movements.csv',
      [['التاريخ', 'المادة', 'النوع', 'الكمية', 'الجهة', 'ملاحظات'],
       ...rows.map((v) => [v.date, m._nameOf(v.materialId), v.type === 'in' ? 'إدخال' : 'إخراج', v.qty, v.party || '', v.note || ''])]);
    await draw();
  }

  view.querySelector('#mSearch').addEventListener('input', refresh);
  await refresh();
  const offs = ['materials', 'categories', 'movements'].map((s) => on('data:' + s, refresh));
  return () => offs.forEach((f) => f());
}

/* ═══ صفحة المادة ═══ */
export async function renderMaterialPage(view, materialId) {
  const mat = await Inventory.material(materialId);
  if (!mat) { view.innerHTML = '<div class="empty">المادة غير موجودة</div>'; return; }

  view.innerHTML = `
    <div class="page-head">
      <div class="crumb"><a href="#/inventory">المخزون</a> ← ${esc(mat.name)}</div>
      <h2>📦 ${esc(mat.name)}</h2>
      <button class="btn primary" id="addMv">+ حركة يدوية</button>
      <button class="btn" id="edMat">✏️ تعديل المادة</button>
      <button class="btn" id="prMat">🖨 طباعة السجل</button>
    </div>
    <div class="grid stats" id="mpStats" style="margin-bottom:16px"></div>
    <div class="card"><h3>🔄 سجل الحركات</h3><div id="mvList"></div></div>`;

  view.querySelector('#edMat').onclick = async () => materialForm(await Inventory.material(materialId));
  view.querySelector('#addMv').onclick = () => openFormModal({
    title: 'تسجيل حركة مخزون',
    fieldsHTML: `
      <div class="f-grid">
        <div class="f-row"><label>نوع الحركة</label>
          <select class="inp" name="type"><option value="in">إدخال (إضافة للمخزون)</option><option value="out">إخراج (استخدام/بيع)</option></select></div>
        <div class="f-row"><label>الكمية <span class="req">*</span></label><input class="inp" name="qty" type="number" step="any" required></div>
      </div>
      <div class="f-grid">
        <div class="f-row"><label>التاريخ</label><input class="inp" name="date" type="date" value="${today()}"></div>
        <div class="f-row"><label>الجهة</label><input class="inp" name="party" placeholder="إنتاج، تالف، جرد..."></div>
      </div>
      <div class="f-row"><label>ملاحظات</label><input class="inp" name="note"></div>`,
    onOk: async (d) => {
      if (!num(d.qty)) { toast('أدخل كمية', 'bad'); return false; }
      await Inventory.addMovement({ materialId, type: d.type, qty: num(d.qty), date: d.date, party: d.party, note: d.note });
      toast('سُجّلت الحركة وتحدّث الرصيد', 'ok');
    },
  });

  async function refresh() {
    const m = await Inventory.material(materialId);
    const movs = await Inventory.movements(materialId);
    const inQ = movs.filter((v) => v.type === 'in').reduce((s, v) => s + num(v.qty), 0);
    const outQ = movs.filter((v) => v.type === 'out').reduce((s, v) => s + num(v.qty), 0);
    const isLow = num(m.minQty) > 0 && num(m.qty) <= num(m.minQty);

    if (!view.querySelector('#mpStats')) return;
    view.querySelector('#mpStats').innerHTML = `
      <div class="stat ${isLow ? 'bad' : 'ok'}"><div class="v">${fmtNum(m.qty)} ${esc(m.unit || '')}</div>
        <div class="l">الرصيد الحالي${isLow ? ' ⚠️ بلغ الحد الأدنى' : ''}</div></div>
      <div class="stat ok"><div class="v">${fmtNum(inQ)}</div><div class="l">إجمالي الداخل</div></div>
      <div class="stat bad"><div class="v">${fmtNum(outQ)}</div><div class="l">إجمالي الخارج</div></div>
      <div class="stat info"><div class="v">${money(num(m.qty) * num(m.price))}</div><div class="l">قيمة الرصيد</div></div>`;

    view.querySelector('#mvList').innerHTML = tableHTML(['التاريخ', 'النوع', 'الكمية', 'الجهة', 'ملاحظات', ''],
      movs.map((v) => `<tr>
        <td class="num">${fmtDate(v.date)}</td>
        <td>${v.type === 'in' ? '<span class="chip ok">إدخال</span>' : '<span class="chip bad">إخراج</span>'}</td>
        <td class="num"><b>${fmtNum(v.qty)}</b></td>
        <td>${esc(v.party || '—')}</td><td>${esc(v.note || '—')}</td>
        <td>${v.refId ? '<span class="chip info">من فاتورة</span>' : `<button class="btn sm danger" data-delmv="${v.id}">✕</button>`}</td>
      </tr>`).join(''));

    view.querySelectorAll('[data-delmv]').forEach((b) => b.onclick = async () => {
      const mv = movs.find((x) => x.id === b.dataset.delmv);
      if (await confirmDlg('حذف هذه الحركة؟ سيُعدّل الرصيد تلقائياً.')) { await Inventory.deleteMovement(mv); }
    });

    view.querySelector('#prMat').onclick = () => printDoc(`سجل حركة — ${m.name}`, `
      <h2 style="font-size:15px">سجل حركة المادة: ${esc(m.name)}</h2>
      <p style="font-size:11.5px">الرصيد الحالي: ${fmtNum(m.qty)} ${esc(m.unit || '')} · داخل: ${fmtNum(inQ)} · خارج: ${fmtNum(outQ)}</p>
      <table><tr><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>الجهة</th><th>ملاحظات</th></tr>
      ${movs.map((v) => `<tr><td>${fmtDate(v.date)}</td><td>${v.type === 'in' ? 'إدخال' : 'إخراج'}</td>
        <td>${fmtNum(v.qty)}</td><td>${esc(v.party || '')}</td><td>${esc(v.note || '')}</td></tr>`).join('')}</table>`);
  }

  await refresh();
  const offs = ['materials', 'movements'].map((s) => on('data:' + s, refresh));
  return () => offs.forEach((f) => f());
}
