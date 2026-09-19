/* ═══ المساعد الذكي + البحث الشامل ═══
   يعمل على مستويين:
     1) بحث فوري داخل كل بيانات النظام (عمال، عملاء، موردون، مواد، فواتير) — بدون إنترنت.
     2) إجابة ذكية عبر Claude عند توفر المفتاح: يُرسل ملخص أرقام النظام (لا التفاصيل الحساسة)
        ليجيب عن أسئلة مثل «كم صافي الربح؟» أو «من العمال الغائبون اليوم؟».
   يُركّب مرة واحدة من app.js ويبقى متاحاً في كل الشاشات. */

import { Workers, Attendance, Ledger, SALES, PURCH, Inventory, Expenses } from '../core/repo.js';
import { dbAll } from '../core/db.js';
import { esc, num, fmtNum, today, thisMonth } from '../core/util.js';

/* ── البحث الشامل ── */
async function searchAll(q) {
  if (!q || q.length < 2) return [];
  const [workers, customers, suppliers, materials, invs, purch] = await Promise.all([
    dbAll('workers'), dbAll('customers'), dbAll('suppliers'),
    dbAll('materials'), dbAll('invoices'), dbAll('purchases'),
  ]);
  const hit = (s) => String(s || '').includes(q);
  const out = [];
  workers.filter((w) => hit(w.name) || hit(w.phone)).forEach((w) => out.push({ ic: '👷', t: w.name, s: 'عامل', go: `#/workers/${w.id}` }));
  customers.filter((c) => hit(c.name) || hit(c.phone)).forEach((c) => out.push({ ic: '🤝', t: c.name, s: 'عميل', go: `#/customers/${c.id}` }));
  suppliers.filter((c) => hit(c.name) || hit(c.phone)).forEach((c) => out.push({ ic: '🏭', t: c.name, s: 'مورد', go: `#/suppliers/${c.id}` }));
  materials.filter((m) => hit(m.name) || hit(m.code)).forEach((m) => out.push({ ic: '📦', t: m.name, s: `مادة — الرصيد ${fmtNum(m.qty)}`, go: `#/inventory/material/${m.id}` }));
  invs.filter((i) => hit(i.no)).forEach((i) => out.push({ ic: '🧾', t: 'فاتورة بيع ' + i.no, s: `${fmtNum(i.total)}`, go: '#/invoices' }));
  purch.filter((i) => hit(i.no)).forEach((i) => out.push({ ic: '🧾', t: 'فاتورة شراء ' + i.no, s: `${fmtNum(i.total)}`, go: '#/invoices' }));
  return out.slice(0, 12);
}

/* ── ملخّص أرقام النظام (يُرسل للذكاء الاصطناعي كسياق) ── */
async function snapshot() {
  const [workers, sInv, sPaid, pInv, pPaid, mats, exps, attToday] = await Promise.all([
    Workers.list(), Ledger.listInvoices(SALES), Ledger.paidMap(SALES),
    Ledger.listInvoices(PURCH), Ledger.paidMap(PURCH), Inventory.materials(),
    Expenses.list(), Attendance.byDate(today()),
  ]);
  let salaries = 0;
  for (const w of workers) salaries += (await Attendance.summary(w.id, thisMonth())).salary;
  const sales = sInv.reduce((s, i) => s + num(i.total), 0);
  const purchases = pInv.reduce((s, i) => s + num(i.total), 0);
  const expense = exps.reduce((s, e) => s + num(e.amount), 0);
  const absentNames = [];
  for (const a of attToday) if (a.status === 'absent') {
    const w = workers.find((x) => x.id === a.workerId); if (w) absentNames.push(w.name);
  }
  return {
    التاريخ: today(),
    عدد_العمال: workers.length,
    حاضرون_اليوم: attToday.filter((a) => a.status !== 'absent').length,
    غائبون_اليوم: absentNames,
    رواتب_الشهر: salaries,
    إجمالي_المبيعات: sales,
    إجمالي_المشتريات: purchases,
    المصاريف: expense,
    صافي_الربح: sales - purchases - expense - salaries,
    مستحق_من_العملاء: sInv.reduce((s, i) => s + Math.max(0, num(i.total) - (sPaid[i.id] || 0)), 0),
    مستحق_للموردين: pInv.reduce((s, i) => s + Math.max(0, num(i.total) - (pPaid[i.id] || 0)), 0),
    قيمة_المخزون: mats.reduce((s, m) => s + num(m.qty) * num(m.price), 0),
    مواد_بلغت_حد_الطلب: mats.filter((m) => num(m.minQty) > 0 && num(m.qty) <= num(m.minQty)).map((m) => `${m.name}: ${m.qty}`),
  };
}

/* ── تركيب الزر واللوحة ── */
export function mountAssistant() {
  if (document.getElementById('assistFab')) return;

  const fab = document.createElement('button');
  fab.id = 'assistFab'; fab.className = 'fab'; fab.title = 'المساعد الذكي'; fab.textContent = '✨';
  document.body.appendChild(fab);

  let panel = null;
  fab.onclick = () => {
    if (panel) { panel.remove(); panel = null; return; }
    panel = document.createElement('div');
    panel.className = 'assist-panel';
    panel.innerHTML = `
      <div class="a-head"><span>✨ المساعد الذكي</span><button class="m-close" style="color:#fff">✕</button></div>
      <div class="a-body" id="aBody">
        <div class="a-msg">مرحباً 👋 اكتب اسم عامل أو عميل أو مادة للبحث السريع،<br>
          أو اسألني: «كم صافي الربح؟» · «من الغائبون اليوم؟» · «ما المواد الناقصة؟»</div>
      </div>
      <div class="a-foot">
        <input class="inp" id="aInput" placeholder="ابحث أو اسأل...">
        <button class="btn primary" id="aSend">↵</button>
      </div>`;
    document.body.appendChild(panel);
    panel.querySelector('.m-close').onclick = () => { panel.remove(); panel = null; };

    const body = panel.querySelector('#aBody');
    const input = panel.querySelector('#aInput');
    const add = (html, cls = '') => {
      const d = document.createElement('div');
      d.className = 'a-msg ' + cls; d.innerHTML = html;
      body.appendChild(d); body.scrollTop = body.scrollHeight;
      return d;
    };

    /* بحث فوري أثناء الكتابة */
    let tmr = null;
    input.addEventListener('input', () => {
      clearTimeout(tmr);
      tmr = setTimeout(async () => {
        const q = input.value.trim();
        const old = body.querySelector('#liveHits');
        if (old) old.remove();
        if (q.length < 2) return;
        const hits = await searchAll(q);
        if (!hits.length) return;
        const box = document.createElement('div');
        box.id = 'liveHits';
        box.innerHTML = hits.map((h) =>
          `<div class="a-msg assist-hit" data-go="${h.go}">${h.ic} <b>${esc(h.t)}</b>
            <small style="color:var(--muted)"> — ${esc(h.s)}</small></div>`).join('');
        body.appendChild(box);
        box.querySelectorAll('[data-go]').forEach((el) => el.onclick = () => {
          location.hash = el.dataset.go; panel.remove(); panel = null;
        });
        body.scrollTop = body.scrollHeight;
      }, 250);
    });

    /* سؤال ذكي */
    const send = async () => {
      const q = input.value.trim();
      if (!q) return;
      input.value = '';
      const old = body.querySelector('#liveHits'); if (old) old.remove();
      add(esc(q), 'me');
      const thinking = add('⏳ لحظة...');
      try {
        const { askClaude } = await import('../core/ai.js');
        const snap = await snapshot();
        const ans = await askClaude(
          `بيانات مصنع الأبواب الحالية (JSON):\n${JSON.stringify(snap, null, 1)}\n\nالسؤال: ${q}`,
          { system: 'أنت مساعد إداري لمصنع أبواب اسمه «مكة». أجب بالعربية بإيجاز شديد ودقة، مستنداً إلى الأرقام المعطاة فقط. إن لم تكن البيانات كافية قل ذلك بوضوح.', maxTokens: 500 });
        thinking.innerHTML = esc(ans).replace(/\n/g, '<br>');
      } catch (err) {
        if (String(err.message).includes('NO_KEY')) {
          // بدون مفتاح: نعرض ملخصاً محلياً بدل الاعتذار
          const s = await snapshot();
          thinking.innerHTML = `<b>ملخص سريع (بدون إنترنت):</b><br>
            حاضرون اليوم: ${s.حاضرون_اليوم} · غائبون: ${s.غائبون_اليوم.length ? esc(s.غائبون_اليوم.join('، ')) : 'لا أحد'}<br>
            المبيعات: ${fmtNum(s.إجمالي_المبيعات)} · المشتريات: ${fmtNum(s.إجمالي_المشتريات)}<br>
            صافي الربح: <b>${fmtNum(s.صافي_الربح)}</b><br>
            مستحق من العملاء: ${fmtNum(s.مستحق_من_العملاء)} · للموردين: ${fmtNum(s.مستحق_للموردين)}<br>
            مواد بلغت حد الطلب: ${s.مواد_بلغت_حد_الطلب.length ? esc(s.مواد_بلغت_حد_الطلب.join('، ')) : 'لا شيء'}
            <br><small style="color:var(--muted)">للأسئلة الحرة أضف مفتاح الذكاء الاصطناعي من الإعدادات.</small>`;
        } else {
          thinking.textContent = '⚠️ تعذّر الاتصال: ' + String(err.message).slice(0, 120);
        }
      }
    };
    panel.querySelector('#aSend').onclick = send;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
    input.focus();
  };
}
