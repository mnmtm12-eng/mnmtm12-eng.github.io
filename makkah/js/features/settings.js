/* ═══ الإعدادات ═══
   الحساب وكلمة المرور · وقت سجل الحضور اليومي · الوضع الفاتح/الداكن · العملة واسم المصنع
   · مفتاح الذكاء الاصطناعي · النسخ الاحتياطي والاستعادة · سجل النشاط. */

import { Settings, Backup, Activity } from '../core/repo.js';
import { changeCredentials, currentUser } from '../core/auth.js';
import { esc, downloadText, today, fmtDate } from '../core/util.js';
import { toast, confirmDlg, tableHTML, refreshCurrency } from '../ui/components.js';
import { toggleTheme } from '../app.js';

export async function renderSettings(view) {
  const s = await Settings.all();

  view.innerHTML = `
    <div class="page-head"><h2>⚙️ الإعدادات</h2></div>

    <div class="card">
      <h3>🏭 بيانات المصنع</h3>
      <div class="f-grid">
        <div class="f-row"><label>اسم المصنع (يظهر في الطباعة)</label>
          <input class="inp" id="factoryName" value="${esc(s.factoryName)}"></div>
        <div class="f-row"><label>رمز العملة</label><input class="inp" id="currency" value="${esc(s.currency)}"></div>
      </div>
      <button class="btn primary" id="saveFactory">💾 حفظ</button>
    </div>

    <div class="card">
      <h3>🕘 الحضور اليومي</h3>
      <p style="color:var(--muted);font-size:.88rem;margin-bottom:10px">
        عند بلوغ هذا الوقت يُنشئ النظام سجل حضور <b>ذلك اليوم فقط</b> لكل العمال بحالة «حاضر» افتراضياً.</p>
      <div class="f-grid">
        <div class="f-row"><label>وقت إنشاء السجل</label><input class="inp" type="time" id="attTime" value="${esc(s.attendanceTime)}"></div>
        <div class="f-row"><label>يوم صرف الرواتب (للتنبيه)</label>
          <input class="inp" type="number" min="1" max="28" id="salaryDay" value="${esc(s.salaryDay)}"></div>
      </div>
      <button class="btn primary" id="saveAtt">💾 حفظ</button>
    </div>

    <div class="card">
      <h3>🎨 المظهر</h3>
      <p style="color:var(--muted);font-size:.88rem;margin-bottom:10px">الوضع الحالي:
        <b id="curTheme">${document.documentElement.dataset.theme === 'dark' ? 'داكن' : 'فاتح'}</b></p>
      <button class="btn" id="themeToggle">🌓 تبديل الوضع الفاتح / الداكن</button>
    </div>

    <div class="card">
      <h3>🔐 حساب المستخدم</h3>
      <div class="f-grid">
        <div class="f-row"><label>اسم المستخدم</label><input class="inp" id="uName" value="${esc(currentUser() || '')}"></div>
        <div class="f-row"><label>الاسم المعروض</label><input class="inp" id="dName" placeholder="المدير"></div>
      </div>
      <div class="f-grid">
        <div class="f-row"><label>كلمة المرور الحالية <span class="req">*</span></label><input class="inp" type="password" id="curPass"></div>
        <div class="f-row"><label>كلمة المرور الجديدة</label><input class="inp" type="password" id="newPass" placeholder="اتركها فارغة لعدم التغيير"></div>
      </div>
      <button class="btn primary" id="saveCreds">💾 حفظ بيانات الدخول</button>
    </div>

    <div class="card">
      <h3>🤖 الذكاء الاصطناعي</h3>
      <p style="color:var(--muted);font-size:.88rem;margin-bottom:10px">
        يُفعّل قراءة الفواتير المصوّرة تلقائياً والمساعد الذكي. النظام يعمل كاملاً بدونه (إدخال يدوي).
        المفتاح يُحفظ على جهازك فقط.</p>
      <div class="f-row"><label>مفتاح Claude API</label>
        <input class="inp" id="aiKey" type="password" value="${esc(s.aiKey)}" placeholder="sk-ant-..."></div>
      <button class="btn primary" id="saveAI">💾 حفظ</button>
    </div>

    <div class="card">
      <h3>☁️ النسخ الاحتياطي والاستعادة</h3>
      <p style="color:var(--muted);font-size:.88rem;margin-bottom:10px">
        يأخذ النظام نسخة احتياطية داخلية تلقائياً كل يوم (آخر 7 نسخ محفوظة).
        صدّر ملفاً واحفظه في أي مكان (درايف، إيميل، USB) لنقل البيانات بين الأجهزة.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn primary" id="expBtn">⬇ تصدير نسخة كاملة</button>
        <label class="btn">⬆ استعادة من ملف<input type="file" id="impFile" accept="application/json" hidden></label>
      </div>
      <div id="bkList" style="margin-top:14px"></div>
    </div>

    <div class="card">
      <h3>📜 سجل النشاط</h3>
      <div id="actList"></div>
    </div>`;

  /* حفظ بيانات المصنع */
  view.querySelector('#saveFactory').onclick = async () => {
    await Settings.set('factoryName', view.querySelector('#factoryName').value.trim());
    await Settings.set('currency', view.querySelector('#currency').value.trim() || '$');
    await refreshCurrency();
    toast('حُفظت بيانات المصنع', 'ok');
  };

  /* حفظ إعدادات الحضور */
  view.querySelector('#saveAtt').onclick = async () => {
    await Settings.set('attendanceTime', view.querySelector('#attTime').value || '08:30');
    await Settings.set('salaryDay', Number(view.querySelector('#salaryDay').value) || 1);
    toast('حُفظت إعدادات الحضور', 'ok');
  };

  view.querySelector('#themeToggle').onclick = async () => {
    await toggleTheme();
    view.querySelector('#curTheme').textContent = document.documentElement.dataset.theme === 'dark' ? 'داكن' : 'فاتح';
  };

  /* تغيير بيانات الدخول */
  view.querySelector('#saveCreds').onclick = async () => {
    const cp = view.querySelector('#curPass').value;
    if (!cp) { toast('أدخل كلمة المرور الحالية للتأكيد', 'bad'); return; }
    const res = await changeCredentials({
      username: view.querySelector('#uName').value.trim(),
      displayName: view.querySelector('#dName').value.trim(),
      newPassword: view.querySelector('#newPass').value,
      currentPassword: cp,
    });
    if (res.ok) { toast('حُفظت بيانات الدخول', 'ok'); view.querySelector('#curPass').value = ''; view.querySelector('#newPass').value = ''; }
    else toast(res.msg, 'bad');
  };

  view.querySelector('#saveAI').onclick = async () => {
    await Settings.set('aiKey', view.querySelector('#aiKey').value.trim());
    toast('حُفظ المفتاح على جهازك', 'ok');
  };

  /* تصدير / استعادة */
  view.querySelector('#expBtn').onclick = async () => {
    const snap = await Backup.exportAll();
    downloadText(`makkah-backup-${today()}.json`, JSON.stringify(snap), 'application/json');
    toast('صُدّرت النسخة', 'ok');
  };
  view.querySelector('#impFile').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (!(await confirmDlg('الاستعادة ستستبدل كل البيانات الحالية. متابعة؟', 'نعم، استعِد'))) { e.target.value = ''; return; }
    try {
      await Backup.importAll(JSON.parse(await f.text()));
      toast('تمت الاستعادة بنجاح', 'ok');
      setTimeout(() => location.reload(), 900);
    } catch (err) { toast('فشل: ' + err.message, 'bad'); }
    e.target.value = '';
  };

  /* النسخ الداخلية */
  const bks = await Backup.list();
  view.querySelector('#bkList').innerHTML = bks.length
    ? tableHTML(['النسخة التلقائية', 'الوقت', ''],
        bks.map((b) => `<tr><td>نسخة ${fmtDate(b.time.slice(0, 10))}</td>
          <td class="num">${esc(b.time.slice(11, 16))}</td>
          <td><button class="btn sm" data-restore="${b.id}">استعادة</button></td></tr>`).join(''))
    : '<p style="color:var(--muted);font-size:.85rem">لا نسخ داخلية بعد — تُنشأ تلقائياً عند فتح النظام يومياً.</p>';
  view.querySelectorAll('[data-restore]').forEach((b) => b.onclick = async () => {
    if (!(await confirmDlg('استعادة هذه النسخة ستستبدل البيانات الحالية. متابعة؟', 'نعم، استعِد'))) return;
    const bk = bks.find((x) => x.id === b.dataset.restore);
    await Backup.importAll(bk.snap);
    toast('تمت الاستعادة', 'ok'); setTimeout(() => location.reload(), 900);
  });

  /* سجل النشاط */
  const acts = await Activity.list(120);
  view.querySelector('#actList').innerHTML = tableHTML(['الوقت', 'العملية', 'القسم', 'التفاصيل'],
    acts.map((a) => `<tr><td class="num">${esc(a.time.slice(0, 16).replace('T', ' '))}</td>
      <td><span class="chip gold">${esc(a.action)}</span></td>
      <td>${esc(a.entity)}</td><td>${esc(a.summary || '—')}</td></tr>`).join(''));
}
