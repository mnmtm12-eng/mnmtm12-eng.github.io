/* ═══ قسم العمال ═══
   إضافة عامل بالاسم فقط → صفحة مستقلة لكل عامل بسجل شهري.
   سجل اليوم يُنشأ تلقائياً بالوقت المحدد (انظر core/attendance.js) والجميع «حاضر» افتراضياً.
   تعديل الحالة/الإضافي/السلفة/الخصم/الملاحظة لكل يوم مع زر حفظ لكل صف —
   والراتب يتحدث مباشرة بعد أي حفظ. الأرشيف: اختيار أي شهر سابق مع بحث وتعديل وحذف. */

import { Workers, Attendance } from '../core/repo.js';
import { ensureToday } from '../core/attendance.js';
import { on } from '../core/bus.js';
import { esc, num, fmtNum, today, thisMonth, fmtMonth, fmtDate, monthOf, uid } from '../core/util.js';
import { toast, confirmDlg, openFormModal, tableHTML, money, printDoc } from '../ui/components.js';

/* ── استمارة عامل (إنشاء/تعديل — نفس النافذة) ── */
function workerForm(w = {}) {
  return openFormModal({
    title: w.id ? 'تعديل بيانات العامل' : 'إضافة عامل جديد',
    values: w,
    fieldsHTML: `
      <div class="f-row"><label>اسم العامل <span class="req">*</span></label>
        <input class="inp" name="name" required placeholder="الاسم الكامل"></div>
      <div class="f-grid">
        <div class="f-row"><label>الأجر اليومي</label><input class="inp" name="dailyWage" type="number" step="any" placeholder="0"></div>
        <div class="f-row"><label>أجر الساعة الإضافية</label><input class="inp" name="overtimeRate" type="number" step="any" placeholder="0"></div>
      </div>
      <div class="f-row"><label>رقم الهاتف</label><input class="inp" name="phone"></div>
      <div class="f-row"><label>ملاحظات</label><textarea class="inp" name="notes"></textarea></div>`,
    onOk: async (d) => {
      if (!d.name) { toast('اسم العامل إجباري', 'bad'); return false; }
      await Workers.save({ ...w, name: d.name, dailyWage: num(d.dailyWage), overtimeRate: num(d.overtimeRate), phone: d.phone, notes: d.notes, active: w.active !== false });
      toast(w.id ? 'تم تعديل العامل' : 'تمت إضافة العامل — أُنشئت صفحته الخاصة', 'ok');
    },
  });
}

/* ═══ قائمة العمال ═══ */
export async function renderWorkers(view) {
  view.innerHTML = `
    <div class="page-head">
      <h2>👷 العمال</h2>
      <div class="searchbar"><input class="inp" id="wSearch" placeholder="بحث سريع بالاسم..."></div>
      <button class="btn primary" id="addW">+ عامل جديد</button>
    </div>
    <div class="grid stats" id="wStats" style="margin-bottom:16px"></div>
    <div class="card"><div id="wList"></div></div>`;

  view.querySelector('#addW').onclick = () => workerForm();

  async function refresh() {
    await ensureToday(); // تأكد من إنشاء سجل اليوم عند فتح القسم
    const q = view.querySelector('#wSearch').value.trim();
    const workers = (await Workers.list()).filter((w) => !q || w.name.includes(q));
    const month = thisMonth();

    let present = 0, absent = 0, salaries = 0;
    const rows = [];
    for (const w of workers) {
      const s = await Attendance.summary(w.id, month);
      salaries += s.salary;
      const todayRec = (await Attendance.month(w.id, month)).find((r) => r.date === today());
      if (todayRec) (todayRec.status === 'absent' ? absent++ : present++);
      rows.push(`
        <tr class="clickable" onclick="location.hash='#/workers/${w.id}'">
          <td><b>${esc(w.name)}</b></td>
          <td>${todayRec ? (todayRec.status === 'absent' ? '<span class="chip bad">غائب اليوم</span>' : '<span class="chip ok">حاضر اليوم</span>') : '<span class="chip">—</span>'}</td>
          <td class="num">${s.present}</td>
          <td class="num">${s.absent}</td>
          <td class="num">${fmtNum(s.overtime)}</td>
          <td class="num">${money(s.advance)}</td>
          <td class="num"><b>${money(s.salary)}</b></td>
          <td onclick="event.stopPropagation()">
            <button class="btn sm" data-edit="${w.id}">تعديل</button>
            <button class="btn sm danger" data-del="${w.id}">حذف</button>
          </td>
        </tr>`);
    }

    if (!view.querySelector('#wStats')) return;
    view.querySelector('#wStats').innerHTML = `
      <div class="stat"><div class="v">${workers.length}</div><div class="l">عدد العمال</div></div>
      <div class="stat ok"><div class="v">${present}</div><div class="l">حاضرون اليوم</div></div>
      <div class="stat bad"><div class="v">${absent}</div><div class="l">غائبون اليوم</div></div>
      <div class="stat"><div class="v">${money(salaries)}</div><div class="l">رواتب ${fmtMonth(month)} حتى الآن</div></div>`;

    view.querySelector('#wList').innerHTML = tableHTML(
      ['العامل', 'اليوم', 'حضور الشهر', 'غياب', 'ساعات إضافية', 'سلف', 'الراتب الحالي', ''],
      rows.join(''));

    view.querySelectorAll('[data-edit]').forEach((b) => b.onclick = async () => workerForm(await Workers.get(b.dataset.edit)));
    view.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
      const w = await Workers.get(b.dataset.del);
      if (await confirmDlg(`حذف العامل «${w.name}» وكل سجلات حضوره؟ لا يمكن التراجع.`)) {
        await Workers.remove(w.id); toast('حُذف العامل', 'ok');
      }
    });
  }

  view.querySelector('#wSearch').addEventListener('input', refresh);
  await refresh();
  const off1 = on('data:workers', refresh);
  const off2 = on('data:attendance', refresh);
  return () => { off1(); off2(); };
}

/* ═══ صفحة العامل: السجل الشهري + الأرشيف ═══ */
export async function renderWorkerPage(view, workerId) {
  const w = await Workers.get(workerId);
  if (!w) { view.innerHTML = '<div class="empty">العامل غير موجود</div>'; return; }

  let month = thisMonth();

  view.innerHTML = `
    <div class="page-head">
      <div class="crumb"><a href="#/workers">العمال</a> ← ${esc(w.name)}</div>
      <h2>👷 ${esc(w.name)}</h2>
      <button class="btn" id="editW">✏️ تعديل البيانات</button>
      <button class="btn" id="printW">🖨 طباعة الشهر / PDF</button>
    </div>
    <div class="grid stats" id="wpStats" style="margin-bottom:16px"></div>
    <div class="card">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px">
        <h3 style="margin:0">📅 السجل الشهري</h3>
        <select class="inp" id="monthSel" style="width:auto"></select>
        <span style="color:var(--muted);font-size:.82rem">الأرشيف الكامل — اختر أي شهر سابق للاطلاع أو التعديل</span>
        <span style="flex:1"></span>
        <button class="btn sm" id="addDay">+ إضافة يوم يدوياً</button>
      </div>
      <div id="attTable"></div>
    </div>`;

  view.querySelector('#editW').onclick = async () => workerForm(await Workers.get(workerId));

  async function fillMonths() {
    const months = await Attendance.monthsOf(workerId);
    if (!months.includes(thisMonth())) months.unshift(thisMonth());
    view.querySelector('#monthSel').innerHTML =
      months.map((m) => `<option value="${m}" ${m === month ? 'selected' : ''}>${fmtMonth(m)}</option>`).join('');
  }

  async function refresh() {
    const ww = await Workers.get(workerId);
    const s = await Attendance.summary(workerId, month);
    if (!view.querySelector('#wpStats')) return;
    view.querySelector('#wpStats').innerHTML = `
      <div class="stat ok"><div class="v">${s.present}</div><div class="l">أيام الحضور</div></div>
      <div class="stat bad"><div class="v">${s.absent}</div><div class="l">أيام الغياب</div></div>
      <div class="stat info"><div class="v">${fmtNum(s.overtime)}</div><div class="l">مجموع الساعات الإضافية</div></div>
      <div class="stat warn"><div class="v">${money(s.advance)}</div><div class="l">مجموع السلف</div></div>
      <div class="stat warn"><div class="v">${money(s.deduction)}</div><div class="l">مجموع الخصومات</div></div>
      <div class="stat"><div class="v">${money(s.salary)}</div><div class="l">الراتب حتى الآن (${fmtNum(ww.dailyWage)}/يوم)</div></div>`;

    const recs = await Attendance.month(workerId, month);
    const rows = recs.map((r) => `
      <tr data-id="${r.id}">
        <td class="num"><b>${fmtDate(r.date)}</b></td>
        <td><select class="inp" data-f="status" style="width:auto;padding:6px 10px">
          <option value="present" ${r.status !== 'absent' ? 'selected' : ''}>حاضر</option>
          <option value="absent" ${r.status === 'absent' ? 'selected' : ''}>غائب</option>
        </select></td>
        <td><input class="inp" data-f="overtime" type="number" step="any" value="${num(r.overtime) || ''}" placeholder="0" style="width:80px"></td>
        <td><input class="inp" data-f="advance" type="number" step="any" value="${num(r.advance) || ''}" placeholder="0" style="width:90px"></td>
        <td><input class="inp" data-f="deduction" type="number" step="any" value="${num(r.deduction) || ''}" placeholder="0" style="width:90px"></td>
        <td><input class="inp" data-f="note" value="${esc(r.note || '')}" placeholder="ملاحظة" style="min-width:120px"></td>
        <td style="white-space:nowrap">
          <button class="btn sm primary" data-save>💾 حفظ</button>
          <button class="btn sm danger" data-del>✕</button>
        </td>
      </tr>`).join('');

    view.querySelector('#attTable').innerHTML = recs.length
      ? tableHTML(['اليوم', 'الحالة', 'س. إضافية', 'سلفة', 'خصم', 'ملاحظات', ''], rows, { minWidth: 760 })
      : `<div class="empty"><div class="e-ic">🕗</div>لا سجلات في ${fmtMonth(month)}.<br>
         <small>سجل اليوم يُنشأ تلقائياً عند بلوغ وقت الدوام المحدد في الإعدادات، أو أضف يوماً يدوياً.</small></div>`;

    // حفظ صف واحد: يقرأ حقوله ويحدّث السجل — الراتب يُعاد حسابه فوراً (refresh عبر الحدث)
    view.querySelectorAll('tr[data-id]').forEach((tr) => {
      tr.querySelector('[data-save]').onclick = async () => {
        const rec = recs.find((r) => r.id === tr.dataset.id);
        const g = (f) => tr.querySelector(`[data-f="${f}"]`).value;
        await Attendance.save({ ...rec, status: g('status'), overtime: num(g('overtime')), advance: num(g('advance')), deduction: num(g('deduction')), note: g('note') });
        toast('حُفظ اليوم وتحدّث الراتب', 'ok');
      };
      tr.querySelector('[data-del]').onclick = async () => {
        const rec = recs.find((r) => r.id === tr.dataset.id);
        if (await confirmDlg(`حذف سجل يوم ${fmtDate(rec.date)}؟`)) { await Attendance.remove(rec); }
      };
    });
  }

  view.querySelector('#monthSel').onchange = (e) => { month = e.target.value; refresh(); };

  /* إضافة يوم يدوياً (نسيت تسجيل يوم سابق مثلاً) */
  view.querySelector('#addDay').onclick = () =>
    openFormModal({
      title: 'إضافة سجل يوم',
      fieldsHTML: `<div class="f-row"><label>التاريخ</label><input class="inp" type="date" name="date" value="${today()}"></div>`,
      onOk: async (d) => {
        if (!d.date) return false;
        const exists = (await Attendance.month(workerId, monthOf(d.date))).some((r) => r.date === d.date);
        if (exists) { toast('يوجد سجل لهذا اليوم مسبقاً', 'warn'); return false; }
        await Attendance.save({ id: '', workerId, date: d.date, month: monthOf(d.date), status: 'present', overtime: 0, advance: 0, deduction: 0, note: '' });
        month = monthOf(d.date); await fillMonths(); toast('أُضيف اليوم', 'ok');
      },
    });

  /* طباعة كشف الشهر */
  view.querySelector('#printW').onclick = async () => {
    const s = await Attendance.summary(workerId, month);
    const recs = await Attendance.month(workerId, month);
    await printDoc(`كشف راتب — ${w.name} — ${fmtMonth(month)}`, `
      <h2 style="font-size:15px;margin-bottom:8px">كشف حضور وراتب: ${esc(w.name)} — ${fmtMonth(month)}</h2>
      <table><tr><th>اليوم</th><th>الحالة</th><th>س.إضافية</th><th>سلفة</th><th>خصم</th><th>ملاحظات</th></tr>
      ${recs.map((r) => `<tr><td>${fmtDate(r.date)}</td><td>${r.status === 'absent' ? 'غائب' : 'حاضر'}</td>
        <td>${fmtNum(r.overtime)}</td><td>${fmtNum(r.advance)}</td><td>${fmtNum(r.deduction)}</td><td>${esc(r.note || '')}</td></tr>`).join('')}
      </table>
      <div class="p-total">حضور: ${s.present} يوم · غياب: ${s.absent} · إضافي: ${fmtNum(s.overtime)} ساعة ·
        سلف: ${fmtNum(s.advance)} · خصومات: ${fmtNum(s.deduction)} — <u>الراتب: ${fmtNum(s.salary)}</u></div>`);
  };

  await fillMonths();
  await refresh();
  const off1 = on('data:attendance', refresh);
  const off2 = on('data:workers', refresh);
  return () => { off1(); off2(); };
}
