/* ═══ محرّك الحسابات المشترك (واجهة) ═══
   يخدم قسمي «العملاء» و«الموردين» بنفس الكود عبر إعداد cfg (SALES أو PURCH):
     • قائمة الأطراف + بحث + إضافة/تعديل/حذف
     • صفحة الطرف: إحصائيات + فواتير + دفعات + كشف حساب
     • استمارة فاتورة ببنود ديناميكية وربط بالمخزون وتتبّع التسليم
     • دفعات جزئية/كاملة مع تحديث الرصيد فوراً
     • طباعة/PDF للفاتورة وكشف الحساب
   customers.js و suppliers.js مجرد أغلفة رفيعة فوق هذا الملف. */

import { Ledger, Inventory, Images, save, removeRec } from '../core/repo.js';
import { dbGet, dbAll } from '../core/db.js';
import { on } from '../core/bus.js';
import { esc, num, fmtNum, today, fmtDate } from '../core/util.js';
import { toast, confirmDlg, openFormModal, modal, tableHTML, statusChip, money, printDoc, periodPickerHTML, cur } from '../ui/components.js';
import { periodRange } from '../core/util.js';

/* ─────────── استمارة الطرف (عميل/مورد) ─────────── */
export function partyForm(cfg, party = {}, extraFields = '') {
  return openFormModal({
    title: party.id ? `تعديل بيانات ال${cfg.partyLabel}` : `إضافة ${cfg.partyLabel} جديد`,
    values: party,
    fieldsHTML: `
      <div class="f-row"><label>الاسم <span class="req">*</span></label>
        <input class="inp" name="name" required placeholder="${cfg === undefined ? '' : 'اسم ' + cfg.partyLabel}"></div>
      ${extraFields}
      <div class="f-grid">
        <div class="f-row"><label>رقم الهاتف</label><input class="inp" name="phone" placeholder="اختياري"></div>
        <div class="f-row"><label>العنوان</label><input class="inp" name="address" placeholder="اختياري"></div>
      </div>
      <div class="f-row"><label>ملاحظات</label><textarea class="inp" name="notes" placeholder="اختياري"></textarea></div>`,
    onOk: async (d) => {
      if (!d.name) { toast('الاسم إجباري', 'bad'); return false; }
      await save(cfg.party, { ...party, ...d }, `${cfg.partyLabel}: ${d.name}`);
      toast(party.id ? 'تم التعديل' : `تمت إضافة ال${cfg.partyLabel} — أُنشئت صفحته الخاصة`, 'ok');
    },
  });
}

/* ─────────── قائمة الأطراف ─────────── */
export async function renderPartyList(view, cfg, opts = {}) {
  const { icon, title, route, extraFields = '', typeFilter = false } = opts;

  view.innerHTML = `
    <div class="page-head">
      <h2>${icon} ${esc(title)}</h2>
      <div class="searchbar"><input class="inp" id="pSearch" placeholder="بحث بالاسم أو رقم الهاتف..."></div>
      <button class="btn primary" id="addP">+ ${esc(cfg.partyLabel)} جديد</button>
    </div>
    <div class="grid stats" id="pStats" style="margin-bottom:16px"></div>
    ${typeFilter ? '<div class="tabs" id="typeTabs"></div>' : ''}
    <div class="card"><div id="pList"></div></div>`;

  view.querySelector('#addP').onclick = () => partyForm(cfg, {}, extraFields);
  let activeType = '';

  async function refresh() {
    const q = view.querySelector('#pSearch').value.trim();
    const [parties, invs, pays] = await Promise.all([dbAll(cfg.party), dbAll(cfg.inv), dbAll(cfg.pay)]);

    // تجميع الإجماليات لكل طرف دفعة واحدة (أسرع من استعلام لكل طرف)
    const agg = {};
    parties.forEach((p) => { agg[p.id] = { total: 0, paid: 0, count: 0, last: '' }; });
    invs.forEach((i) => { const a = agg[i[cfg.partyField]]; if (a) { a.total += num(i.total); a.count++; if (i.date > a.last) a.last = i.date; } });
    pays.forEach((p) => { const a = agg[p[cfg.partyField]]; if (a) a.paid += num(p.amount); });

    if (typeFilter) {
      const types = [...new Set(parties.map((p) => p.type).filter(Boolean))];
      view.querySelector('#typeTabs').innerHTML =
        [`<div class="tab ${!activeType ? 'active' : ''}" data-t="">الكل</div>`]
          .concat(types.map((t) => `<div class="tab ${activeType === t ? 'active' : ''}" data-t="${esc(t)}">${esc(t)}</div>`)).join('');
      view.querySelectorAll('#typeTabs .tab').forEach((el) => el.onclick = () => { activeType = el.dataset.t; refresh(); });
    }

    const list = parties
      .filter((p) => !q || (p.name || '').includes(q) || (p.phone || '').includes(q))
      .filter((p) => !activeType || p.type === activeType)
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'));

    const totalAll = list.reduce((s, p) => s + agg[p.id].total, 0);
    const paidAll = list.reduce((s, p) => s + agg[p.id].paid, 0);
    if (!view.querySelector('#pStats')) return;
    view.querySelector('#pStats').innerHTML = `
      <div class="stat"><div class="v">${list.length}</div><div class="l">عدد ال${esc(title)}</div></div>
      <div class="stat info"><div class="v">${money(totalAll)}</div><div class="l">${cfg.kind === 'sale' ? 'إجمالي المبيعات' : 'إجمالي المشتريات'}</div></div>
      <div class="stat ok"><div class="v">${money(paidAll)}</div><div class="l">المدفوع</div></div>
      <div class="stat ${totalAll - paidAll > 0 ? 'bad' : 'ok'}"><div class="v">${money(totalAll - paidAll)}</div>
        <div class="l">${cfg.kind === 'sale' ? 'مستحق من العملاء' : 'مستحق للموردين'}</div></div>`;

    view.querySelector('#pList').innerHTML = tableHTML(
      ['الاسم', ...(typeFilter ? ['النوع'] : []), 'الهاتف', 'الفواتير', 'الإجمالي', 'المدفوع', 'المتبقي', 'آخر فاتورة', ''],
      list.map((p) => {
        const a = agg[p.id];
        return `<tr class="clickable" onclick="location.hash='#${route}/${p.id}'">
          <td><b>${esc(p.name)}</b></td>
          ${typeFilter ? `<td>${p.type ? `<span class="chip gold">${esc(p.type)}</span>` : '—'}</td>` : ''}
          <td>${esc(p.phone || '—')}</td>
          <td class="num">${a.count}</td>
          <td class="num">${money(a.total)}</td>
          <td class="num">${money(a.paid)}</td>
          <td class="num"><b style="color:${a.total - a.paid > 0 ? 'var(--bad)' : 'var(--ok)'}">${money(a.total - a.paid)}</b></td>
          <td class="num">${a.last ? fmtDate(a.last) : '—'}</td>
          <td onclick="event.stopPropagation()">
            <button class="btn sm" data-edit="${p.id}">تعديل</button>
            <button class="btn sm danger" data-del="${p.id}">حذف</button>
          </td></tr>`;
      }).join(''), { minWidth: 860 });

    view.querySelectorAll('[data-edit]').forEach((b) => b.onclick = async () =>
      partyForm(cfg, await dbGet(cfg.party, b.dataset.edit), extraFields));
    view.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
      const p = await dbGet(cfg.party, b.dataset.del);
      if (await confirmDlg(`حذف «${p.name}» مع كل فواتيره ودفعاته؟ لا يمكن التراجع.`)) {
        await Ledger.deleteParty(cfg, p.id); toast('تم الحذف', 'ok');
      }
    });
  }

  view.querySelector('#pSearch').addEventListener('input', refresh);
  await refresh();
  const offs = [cfg.party, cfg.inv, cfg.pay].map((s) => on('data:' + s, refresh));
  return () => offs.forEach((f) => f());
}

/* ─────────── استمارة الفاتورة (إنشاء/تعديل) ─────────── */
export async function invoiceForm(cfg, { invoice = null, partyId = '' } = {}) {
  const isEdit = !!invoice;
  const [parties, materials] = await Promise.all([dbAll(cfg.party), Inventory.materials()]);
  const inv = invoice || { [cfg.partyField]: partyId, date: today(), items: [], no: '' };
  const matOpts = (sel) => `<option value="">— بدون ربط —</option>` +
    materials.map((m) => `<option value="${m.id}" ${sel === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('');

  const rowHTML = (it = {}) => `
    <tr>
      <td><input class="inp it-name" value="${esc(it.name || '')}" placeholder="اسم المنتج"></td>
      <td><select class="inp it-mat">${matOpts(it.materialId)}</select></td>
      <td><input class="inp it-qty" type="number" step="any" value="${it.qty ?? ''}" placeholder="0" style="width:80px"></td>
      <td><input class="inp it-price" type="number" step="any" value="${it.price ?? ''}" placeholder="0" style="width:95px"></td>
      <td><input class="inp it-deliv" type="number" step="any" value="${it.delivered ?? 0}" style="width:80px"></td>
      <td class="num it-sum">0</td>
      <td><button type="button" class="btn sm danger it-del">✕</button></td>
    </tr>`;

  const m = modal({
    title: isEdit ? `تعديل ${cfg.label} ${esc(inv.no)}` : `${cfg.label} جديدة`,
    wide: true,
    body: `
      <div class="f-grid3">
        <div class="f-row"><label>رقم الفاتورة</label>
          <input class="inp" id="fNo" value="${esc(inv.no || '')}" placeholder="يُولَّد تلقائياً"></div>
        <div class="f-row"><label>التاريخ</label><input class="inp" type="date" id="fDate" value="${esc(inv.date || today())}"></div>
        <div class="f-row"><label>ال${cfg.partyLabel} <span class="req">*</span></label>
          <select class="inp" id="fParty">${parties.map((p) => `<option value="${p.id}" ${inv[cfg.partyField] === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
      </div>
      ${cfg.kind === 'purchase' ? `
      <div class="card" style="background:var(--surface2);box-shadow:none;margin-bottom:14px">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <label class="btn sm">📷 صورة الفاتورة<input type="file" id="fImg" accept="image/*" capture="environment" hidden></label>
          <button type="button" class="btn sm primary" id="ocrBtn">🤖 قراءة الصورة تلقائياً</button>
          <span id="imgName" style="font-size:.82rem;color:var(--muted)">${inv.imageId ? 'توجد صورة مرفقة' : 'لم تُرفق صورة'}</span>
        </div>
        <div id="ocrMsg" style="font-size:.82rem;color:var(--muted);margin-top:8px"></div>
      </div>` : ''}
      <h4 style="margin:6px 0 8px;font-size:.95rem">البنود</h4>
      <div class="tbl-wrap"><table class="tbl" style="min-width:680px">
        <thead><tr><th>المنتج</th><th>ربط بالمخزون</th><th>الكمية</th><th>السعر</th><th>${cfg.kind === 'sale' ? 'المسلَّم' : 'المستلَم'}</th><th>الإجمالي</th><th></th></tr></thead>
        <tbody id="itemsBody">${(inv.items || []).map(rowHTML).join('') || rowHTML()}</tbody>
      </table></div>
      <button type="button" class="btn sm" id="addRow" style="margin-top:10px">+ إضافة بند</button>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:12px;border-top:1px solid var(--line)">
        <b style="font-size:1.05rem">الإجمالي: <span id="grandTotal">0</span> ${esc(cur())}</b>
        ${isEdit ? '' : `<div class="f-row" style="margin:0"><label>المدفوع الآن</label>
          <input class="inp" id="fPaid" type="number" step="any" placeholder="0" style="width:140px"></div>`}
      </div>
      <div class="f-row" style="margin-top:12px"><label>ملاحظات</label><input class="inp" id="fNotes" value="${esc(inv.notes || '')}"></div>`,
    foot: `<button class="btn primary" id="okBtn">✔ ${isEdit ? 'موافق — حفظ التعديلات' : 'حفظ الفاتورة'}</button>
           <button class="btn" id="cancelBtn">إلغاء</button>`,
  });

  const body = m.body;
  const itemsBody = body.querySelector('#itemsBody');
  let imageBlob = null;

  const recalc = () => {
    let g = 0;
    itemsBody.querySelectorAll('tr').forEach((tr) => {
      const s = num(tr.querySelector('.it-qty').value) * num(tr.querySelector('.it-price').value);
      tr.querySelector('.it-sum').textContent = fmtNum(s);
      g += s;
    });
    body.querySelector('#grandTotal').textContent = fmtNum(g);
  };
  const wire = (tr) => {
    tr.querySelector('.it-del').onclick = () => { tr.remove(); if (!itemsBody.children.length) addRow(); recalc(); };
    tr.querySelectorAll('input').forEach((i) => i.addEventListener('input', recalc));
  };
  const addRow = (it) => { itemsBody.insertAdjacentHTML('beforeend', rowHTML(it)); wire(itemsBody.lastElementChild); recalc(); };
  itemsBody.querySelectorAll('tr').forEach(wire);
  recalc();
  body.querySelector('#addRow').onclick = () => addRow();

  /* قراءة الفاتورة المصوّرة بالذكاء الاصطناعي (للموردين) */
  if (cfg.kind === 'purchase') {
    const fileInp = body.querySelector('#fImg');
    fileInp.onchange = () => {
      imageBlob = fileInp.files[0] || null;
      body.querySelector('#imgName').textContent = imageBlob ? imageBlob.name : 'لم تُرفق صورة';
    };
    body.querySelector('#ocrBtn').onclick = async () => {
      const msg = body.querySelector('#ocrMsg');
      if (!imageBlob) { msg.textContent = '⚠️ اختر صورة الفاتورة أولاً.'; return; }
      msg.textContent = '⏳ جاري قراءة الفاتورة...';
      try {
        const { ocrInvoice } = await import('../core/ai.js');
        const data = await ocrInvoice(imageBlob);
        // تُعرض النتائج للمراجعة والتعديل قبل الحفظ (لا تُحفظ تلقائياً)
        if (data.no) body.querySelector('#fNo').value = data.no;
        if (data.date) body.querySelector('#fDate').value = data.date;
        if (Array.isArray(data.items) && data.items.length) {
          itemsBody.innerHTML = '';
          data.items.forEach((it) => addRow({ name: it.name, qty: num(it.qty), price: num(it.price) }));
        }
        // مطابقة اسم المورد إن وُجد
        if (data.party) {
          const match = parties.find((p) => (p.name || '').includes(data.party) || data.party.includes(p.name));
          if (match) body.querySelector('#fParty').value = match.id;
        }
        recalc();
        msg.innerHTML = '✅ تمت القراءة — <b>راجع البيانات وعدّلها قبل الحفظ</b>' + (data.party ? ` (الجهة المقروءة: ${esc(data.party)})` : '');
      } catch (err) {
        msg.textContent = String(err.message).includes('NO_KEY')
          ? '⚠️ ميزة القراءة تحتاج مفتاح الذكاء الاصطناعي — أضفه من الإعدادات. يمكنك الإدخال يدوياً الآن.'
          : '⚠️ تعذّرت القراءة: ' + esc(String(err.message).slice(0, 120));
      }
    };
  }

  body.querySelector('#cancelBtn')?.remove();
  m.root.querySelector('#cancelBtn') && (m.root.querySelector('#cancelBtn').onclick = m.close);
  m.root.querySelector('#okBtn').onclick = async () => {
    const items = [...itemsBody.querySelectorAll('tr')].map((tr) => ({
      name: tr.querySelector('.it-name').value.trim(),
      materialId: tr.querySelector('.it-mat').value,
      qty: num(tr.querySelector('.it-qty').value),
      price: num(tr.querySelector('.it-price').value),
      delivered: num(tr.querySelector('.it-deliv').value),
    })).filter((it) => it.name || it.qty);
    if (!items.length) { toast('أضف بنداً واحداً على الأقل', 'bad'); return; }
    const partySel = body.querySelector('#fParty').value;
    if (!partySel) { toast(`اختر ال${cfg.partyLabel}`, 'bad'); return; }

    if (imageBlob) inv.imageId = await Images.put(imageBlob);
    const payload = {
      ...inv,
      [cfg.partyField]: partySel,
      no: body.querySelector('#fNo').value.trim(),
      date: body.querySelector('#fDate').value || today(),
      notes: body.querySelector('#fNotes').value.trim(),
      items,
    };
    const paidNow = isEdit ? 0 : num(body.querySelector('#fPaid')?.value);
    await Ledger.saveInvoice(cfg, payload, paidNow);
    toast(isEdit ? 'حُفظت التعديلات وتحدّثت الحسابات' : 'أُنشئت الفاتورة', 'ok');
    m.close();
  };
  return m;
}

/* ─────────── تفاصيل الفاتورة ─────────── */
export async function invoiceDetail(cfg, invoiceId) {
  const inv = await dbGet(cfg.inv, invoiceId);
  if (!inv) return;
  const party = await dbGet(cfg.party, inv[cfg.partyField]);

  async function build(m) {
    const pays = (await dbAll(cfg.pay)).filter((p) => p[cfg.invField] === invoiceId)
      .sort((a, b) => b.date.localeCompare(a.date));
    const total = num(inv.total), paid = pays.reduce((s, p) => s + num(p.amount), 0);
    const st = Ledger.status(total, paid);

    m.body.innerHTML = `
      <div class="grid stats" style="margin-bottom:14px">
        <div class="stat"><div class="v">${money(total)}</div><div class="l">إجمالي الفاتورة</div></div>
        <div class="stat ok"><div class="v">${money(paid)}</div><div class="l">المدفوع</div></div>
        <div class="stat ${total - paid > 0 ? 'bad' : 'ok'}"><div class="v">${money(total - paid)}</div><div class="l">المتبقي</div></div>
        <div class="stat info"><div class="v" style="font-size:1rem;padding-top:6px">${statusChip(st)}</div><div class="l">الحالة</div></div>
      </div>
      <p style="color:var(--muted);font-size:.88rem;margin-bottom:10px">
        ال${cfg.partyLabel}: <b style="color:var(--text)">${esc(party?.name || '—')}</b> ·
        التاريخ: ${fmtDate(inv.date)} ${inv.notes ? '· ' + esc(inv.notes) : ''}</p>

      <h4 style="font-size:.95rem;margin:12px 0 6px">البنود وتتبّع ${cfg.kind === 'sale' ? 'التسليم' : 'الاستلام'}</h4>
      <div class="tbl-wrap"><table class="tbl" style="min-width:600px">
        <thead><tr><th>المنتج</th><th>المطلوب</th><th>السعر</th><th>الإجمالي</th>
          <th>${cfg.kind === 'sale' ? 'المسلَّم' : 'المستلَم'}</th><th>المتبقي</th></tr></thead>
        <tbody>${(inv.items || []).map((it, i) => `
          <tr><td>${esc(it.name || '—')}</td>
            <td class="num">${fmtNum(it.qty)}</td>
            <td class="num">${fmtNum(it.price)}</td>
            <td class="num">${fmtNum(num(it.qty) * num(it.price))}</td>
            <td><input class="inp dlv" data-i="${i}" type="number" step="any" value="${num(it.delivered)}" style="width:80px"></td>
            <td class="num"><b>${fmtNum(num(it.qty) - num(it.delivered))}</b></td></tr>`).join('')}
        </tbody></table></div>
      <button class="btn sm primary" id="saveDlv" style="margin-top:8px">💾 حفظ الكميات ${cfg.kind === 'sale' ? 'المسلَّمة' : 'المستلَمة'}</button>

      <h4 style="font-size:.95rem;margin:18px 0 6px">الدفعات</h4>
      ${pays.length ? tableHTML(['التاريخ', 'المبلغ', 'ملاحظة', ''],
        pays.map((p) => `<tr><td>${fmtDate(p.date)}</td><td class="num">${money(p.amount)}</td>
          <td>${esc(p.note || '—')}</td>
          <td><button class="btn sm danger" data-delpay="${p.id}">✕</button></td></tr>`).join(''))
        : '<p style="color:var(--muted);font-size:.88rem">لا دفعات بعد.</p>'}
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        <button class="btn primary" id="addPay">＋ تسجيل دفعة</button>
        <button class="btn" id="editInv">✏️ تعديل الفاتورة</button>
        <button class="btn" id="printInv">🖨 طباعة / PDF</button>
        ${inv.imageId ? '<button class="btn" id="viewImg">🖼 صورة الفاتورة</button>' : ''}
        <button class="btn danger" id="delInv">🗑 حذف</button>
      </div>`;

    m.body.querySelector('#saveDlv').onclick = async () => {
      m.body.querySelectorAll('.dlv').forEach((el) => { inv.items[Number(el.dataset.i)].delivered = num(el.value); });
      await save(cfg.inv, inv, `تحديث تسليم ${inv.no}`);
      toast('حُفظت الكميات', 'ok'); build(m);
    };
    m.body.querySelector('#addPay').onclick = () => openFormModal({
      title: 'تسجيل دفعة',
      fieldsHTML: `
        <p style="color:var(--muted);font-size:.88rem;margin-bottom:10px">المتبقي على الفاتورة: <b>${money(total - paid)}</b></p>
        <div class="f-row"><label>المبلغ <span class="req">*</span></label><input class="inp" name="amount" type="number" step="any" value="${total - paid > 0 ? total - paid : ''}" required></div>
        <div class="f-row"><label>التاريخ</label><input class="inp" name="date" type="date" value="${today()}"></div>
        <div class="f-row"><label>ملاحظة</label><input class="inp" name="note" placeholder="نقداً / تحويل..."></div>`,
      onOk: async (d) => {
        if (!num(d.amount)) { toast('أدخل مبلغاً', 'bad'); return false; }
        await Ledger.addPayment(cfg, { [cfg.partyField]: inv[cfg.partyField], [cfg.invField]: invoiceId, amount: num(d.amount), date: d.date, note: d.note });
        toast('سُجّلت الدفعة وتحدّث الرصيد', 'ok'); build(m);
      },
    });
    m.body.querySelectorAll('[data-delpay]').forEach((b) => b.onclick = async () => {
      const p = pays.find((x) => x.id === b.dataset.delpay);
      if (await confirmDlg('حذف هذه الدفعة؟')) { await Ledger.deletePayment(cfg, p); build(m); }
    });
    m.body.querySelector('#editInv').onclick = async () => { m.close(); await invoiceForm(cfg, { invoice: await dbGet(cfg.inv, invoiceId) }); };
    m.body.querySelector('#delInv').onclick = async () => {
      if (await confirmDlg(`حذف ${cfg.label} ${inv.no} وكل دفعاتها؟ سيُعكس أثرها على المخزون.`)) {
        await Ledger.deleteInvoice(cfg, invoiceId); toast('حُذفت الفاتورة', 'ok'); m.close();
      }
    };
    m.body.querySelector('#printInv').onclick = () => printInvoice(cfg, inv, party, paid);
    const vi = m.body.querySelector('#viewImg');
    if (vi) vi.onclick = async () => {
      const blob = await Images.get(inv.imageId);
      if (!blob) { toast('الصورة غير متاحة', 'warn'); return; }
      const url = URL.createObjectURL(blob);
      modal({ title: 'صورة الفاتورة', wide: true, body: `<img src="${url}" style="width:100%;border-radius:10px">` });
    };
  }

  const m = modal({ title: `${cfg.label} ${esc(inv.no)}`, wide: true, body: '<div></div>' });
  await build(m);
  return m;
}

/* ─────────── طباعة فاتورة ─────────── */
export function printInvoice(cfg, inv, party, paid) {
  const total = num(inv.total);
  printDoc(`${cfg.label} ${inv.no}`, `
    <h2 style="font-size:15px;margin-bottom:6px">${cfg.label} رقم ${esc(inv.no)}</h2>
    <p style="font-size:12px">ال${cfg.partyLabel}: <b>${esc(party?.name || '—')}</b>
      ${party?.phone ? ' · هاتف: ' + esc(party.phone) : ''} · التاريخ: ${fmtDate(inv.date)}</p>
    <table><tr><th>#</th><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr>
      ${(inv.items || []).map((it, i) => `<tr><td>${i + 1}</td><td>${esc(it.name || '')}</td>
        <td>${fmtNum(it.qty)}</td><td>${fmtNum(it.price)}</td><td>${fmtNum(num(it.qty) * num(it.price))}</td></tr>`).join('')}
    </table>
    <div class="p-total">الإجمالي: ${fmtNum(total)} ${esc(cur())} · المدفوع: ${fmtNum(paid)} · المتبقي: ${fmtNum(total - paid)}</div>
    ${inv.notes ? `<p style="font-size:11px;margin-top:6px">ملاحظات: ${esc(inv.notes)}</p>` : ''}`);
}

/* ─────────── كشف الحساب ─────────── */
export async function statementModal(cfg, partyId) {
  const party = await dbGet(cfg.party, partyId);
  const m = modal({
    title: `كشف حساب — ${esc(party.name)}`, wide: true,
    body: `${periodPickerHTML('stPP')}<div id="stBody" style="margin-top:14px"></div>`,
    foot: `<button class="btn primary" id="stPrint">🖨 طباعة / PDF</button>`,
  });
  const pp = m.body.querySelector('#stPP');
  const getRange = () => ({ from: pp.querySelector('[name=from]').value, to: pp.querySelector('[name=to]').value });

  async function draw() {
    const { from, to } = getRange();
    const st = await Ledger.statement(cfg, partyId, from, to);
    m.body.querySelector('#stBody').innerHTML = `
      <div class="grid stats" style="margin-bottom:12px">
        <div class="stat"><div class="v">${money(st.opening)}</div><div class="l">الرصيد السابق</div></div>
        <div class="stat ${st.closing > 0 ? 'bad' : 'ok'}"><div class="v">${money(st.closing)}</div><div class="l">الرصيد الحالي</div></div>
      </div>
      ${tableHTML(['التاريخ', 'البيان', 'مدين (فاتورة)', 'دائن (دفعة)', 'الرصيد'],
        st.rows.map((r) => `<tr>
          <td>${fmtDate(r.date)}</td>
          <td>${r.kind === 'inv' ? `${cfg.label} ${esc(r.ref.no || '')}` : 'دفعة' + (r.ref.note ? ' — ' + esc(r.ref.note) : '')}</td>
          <td class="num">${r.debit ? fmtNum(r.debit) : '—'}</td>
          <td class="num">${r.credit ? fmtNum(r.credit) : '—'}</td>
          <td class="num"><b>${fmtNum(r.balance)}</b></td></tr>`).join(''))}`;
    return st;
  }
  pp.querySelectorAll('[data-p]').forEach((b) => b.onclick = () => {
    const r = periodRange(b.dataset.p);
    pp.querySelector('[name=from]').value = r.from; pp.querySelector('[name=to]').value = r.to; draw();
  });
  pp.querySelectorAll('input').forEach((i) => i.addEventListener('change', draw));
  m.root.querySelector('#stPrint').onclick = async () => {
    const { from, to } = getRange();
    const st = await Ledger.statement(cfg, partyId, from, to);
    printDoc(`كشف حساب — ${party.name}`, `
      <h2 style="font-size:15px">كشف حساب: ${esc(party.name)}</h2>
      <p style="font-size:11.5px">${from || to ? `الفترة: ${fmtDate(from) || '—'} إلى ${fmtDate(to) || '—'}` : 'كل الفترات'} ·
        الرصيد السابق: ${fmtNum(st.opening)}</p>
      <table><tr><th>التاريخ</th><th>البيان</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr>
        ${st.rows.map((r) => `<tr><td>${fmtDate(r.date)}</td>
          <td>${r.kind === 'inv' ? cfg.label + ' ' + esc(r.ref.no || '') : 'دفعة'}</td>
          <td>${r.debit ? fmtNum(r.debit) : ''}</td><td>${r.credit ? fmtNum(r.credit) : ''}</td>
          <td>${fmtNum(r.balance)}</td></tr>`).join('')}
      </table>
      <div class="p-total">الرصيد الحالي: ${fmtNum(st.closing)} ${esc(cur())}</div>`);
  };
  await draw();
  return m;
}

/* ─────────── صفحة الطرف ─────────── */
export async function renderPartyPage(view, cfg, partyId, opts = {}) {
  const { icon, route, listTitle, extraFields = '' } = opts;
  const party = await dbGet(cfg.party, partyId);
  if (!party) { view.innerHTML = '<div class="empty">السجل غير موجود</div>'; return; }

  view.innerHTML = `
    <div class="page-head">
      <div class="crumb"><a href="#${route}">${esc(listTitle)}</a> ← ${esc(party.name)}</div>
      <h2>${icon} ${esc(party.name)} ${party.type ? `<span class="chip gold">${esc(party.type)}</span>` : ''}</h2>
      <button class="btn primary" id="newInv">+ ${esc(cfg.label)}</button>
      <button class="btn" id="stBtn">📄 كشف الحساب</button>
      <button class="btn" id="edP">✏️ تعديل</button>
    </div>
    <p style="color:var(--muted);font-size:.88rem;margin:-8px 0 14px">
      ${party.phone ? '📞 ' + esc(party.phone) : ''} ${party.address ? ' · 📍 ' + esc(party.address) : ''}
      ${party.notes ? ' · ' + esc(party.notes) : ''}</p>
    <div class="grid stats" id="ppStats" style="margin-bottom:16px"></div>
    <div class="card"><h3>🧾 الفواتير</h3><div id="ppInvs"></div></div>
    <div class="card"><h3>💵 الدفعات</h3><div id="ppPays"></div></div>`;

  view.querySelector('#newInv').onclick = () => invoiceForm(cfg, { partyId });
  view.querySelector('#stBtn').onclick = () => statementModal(cfg, partyId);
  view.querySelector('#edP').onclick = async () => partyForm(cfg, await dbGet(cfg.party, partyId), extraFields);

  async function refresh() {
    const s = await Ledger.partyStats(cfg, partyId);
    const paidMap = await Ledger.paidMap(cfg);
    if (!view.querySelector('#ppStats')) return;
    view.querySelector('#ppStats').innerHTML = `
      <div class="stat"><div class="v">${s.count}</div><div class="l">عدد الفواتير</div></div>
      <div class="stat info"><div class="v">${money(s.total)}</div><div class="l">${cfg.kind === 'sale' ? 'إجمالي المبيعات' : 'إجمالي المشتريات'}</div></div>
      <div class="stat ok"><div class="v">${money(s.paid)}</div><div class="l">المدفوع</div></div>
      <div class="stat ${s.due > 0 ? 'bad' : 'ok'}"><div class="v">${money(s.due)}</div><div class="l">الرصيد المتبقي</div></div>
      <div class="stat"><div class="v" style="font-size:1rem">${s.lastInvoice ? fmtDate(s.lastInvoice.date) : '—'}</div>
        <div class="l">آخر ${cfg.kind === 'sale' ? 'عملية بيع' : 'فاتورة'}</div></div>
      <div class="stat"><div class="v" style="font-size:1rem">${s.lastPayment ? fmtDate(s.lastPayment.date) : '—'}</div><div class="l">آخر دفعة</div></div>`;

    const invs = await Ledger.listInvoices(cfg, partyId);
    view.querySelector('#ppInvs').innerHTML = tableHTML(
      ['رقم الفاتورة', 'التاريخ', 'البنود', 'الإجمالي', 'المدفوع', 'المتبقي', 'الحالة'],
      invs.map((i) => {
        const p = paidMap[i.id] || 0;
        return `<tr class="clickable" data-inv="${i.id}">
          <td><b>${esc(i.no)}</b></td><td class="num">${fmtDate(i.date)}</td>
          <td class="num">${(i.items || []).length}</td>
          <td class="num">${money(i.total)}</td><td class="num">${money(p)}</td>
          <td class="num"><b>${money(num(i.total) - p)}</b></td>
          <td>${statusChip(Ledger.status(num(i.total), p))}</td></tr>`;
      }).join(''), { minWidth: 720 });
    view.querySelectorAll('[data-inv]').forEach((tr) => tr.onclick = () => invoiceDetail(cfg, tr.dataset.inv));

    const pays = await Ledger.listPayments(cfg, partyId);
    view.querySelector('#ppPays').innerHTML = tableHTML(['التاريخ', 'المبلغ', 'ملاحظة'],
      pays.map((p) => `<tr><td>${fmtDate(p.date)}</td><td class="num">${money(p.amount)}</td><td>${esc(p.note || '—')}</td></tr>`).join(''));
  }

  await refresh();
  const offs = [cfg.party, cfg.inv, cfg.pay].map((s) => on('data:' + s, refresh));
  return () => offs.forEach((f) => f());
}
