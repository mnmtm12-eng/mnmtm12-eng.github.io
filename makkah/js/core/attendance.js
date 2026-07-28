/* ═══ مولّد سجل الحضور اليومي ═══
   القاعدة: لا يُنشأ حضور الشهر مسبقاً أبداً.
   عند بلوغ الوقت المحدد في الإعدادات (افتراضياً 08:30 صباحاً) يُنشأ سجل «ذلك اليوم فقط»
   لكل عامل نشط وحالته الافتراضية «حاضر». المستخدم يغيّر من غاب فقط ويضغط حفظ.
   ملاحظة: التطبيق محلي بلا خادم، لذا يتحقق عند فتح التطبيق وكل دقيقة أثناء عمله. */

import { dbIdx, dbPut } from './db.js';
import { uid, today, monthOf, nowISO } from './util.js';
import { Settings, Workers, Activity } from './repo.js';
import { emit } from './bus.js';

let timer = null;

/** إنشاء سجلات اليوم إذا حان الوقت ولم تُنشأ بعد */
export async function ensureToday() {
  const t = await Settings.get('attendanceTime'); // "08:30"
  const now = new Date();
  const [hh, mm] = String(t || '08:30').split(':').map(Number);
  const reached = now.getHours() > hh || (now.getHours() === hh && now.getMinutes() >= mm);
  if (!reached) return 0;

  const date = today();
  const existing = await dbIdx('attendance', 'date', date);
  const have = new Set(existing.map((r) => r.workerId));
  const workers = (await Workers.list()).filter((w) => w.active !== false);

  let created = 0;
  for (const w of workers) {
    if (have.has(w.id)) continue;
    await dbPut('attendance', {
      id: uid(), workerId: w.id, date, month: monthOf(date),
      status: 'present', overtime: 0, advance: 0, deduction: 0, note: '',
      createdAt: nowISO(), updatedAt: nowISO(),
    });
    created++;
  }
  if (created) {
    await Activity.log('تلقائي', 'attendance', `إنشاء سجل حضور اليوم ${date} لـ ${created} عامل`);
    emit('data:attendance');
  }
  return created;
}

/** تشغيل المولّد: فحص فوري ثم كل دقيقة (يغطي أيضاً بداية الشهر الجديد تلقائياً
    لأن كل سجل يحمل مفتاح شهره، فالأشهر السابقة تبقى أرشيفاً كاملاً) */
export function startAttendanceScheduler() {
  ensureToday();
  if (timer) clearInterval(timer);
  timer = setInterval(ensureToday, 60 * 1000);
}
