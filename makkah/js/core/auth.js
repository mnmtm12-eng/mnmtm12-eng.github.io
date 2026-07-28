/* ═══ المصادقة ═══
   مستخدم محلي بكلمة مرور مشفّرة (SHA-256). أول تشغيل ينشئ الحساب الافتراضي:
   المستخدم: admin — كلمة المرور: 1234 (يُطلب تغييرها من الإعدادات). */
import { dbGet, dbPut } from './db.js';

const SESSION_KEY = 'makkah.session';

async function hash(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** إنشاء الحساب الافتراضي إن لم يوجد */
export async function ensureDefaultUser() {
  const u = await dbGet('users', 'admin');
  if (!u) {
    await dbPut('users', { username: 'admin', passHash: await hash('1234'), displayName: 'المدير', mustChange: true });
  }
}

export async function login(username, password) {
  const u = await dbGet('users', username);
  if (!u) return { ok: false, msg: 'اسم المستخدم غير موجود' };
  if (u.passHash !== await hash(password)) return { ok: false, msg: 'كلمة المرور غير صحيحة' };
  localStorage.setItem(SESSION_KEY, username);
  return { ok: true, user: u };
}

export function logout() { localStorage.removeItem(SESSION_KEY); }
export function currentUser() { return localStorage.getItem(SESSION_KEY); }
export const isAuthed = () => !!currentUser();

/** هل ما زالت كلمة المرور الافتراضية؟ (لعرض تلميح الدخول الأول) */
export async function isDefaultCreds() {
  const u = await dbGet('users', 'admin');
  return !!(u && u.mustChange);
}

/** تغيير بيانات الدخول من الإعدادات */
export async function changeCredentials({ username, displayName, newPassword, currentPassword }) {
  const cur = currentUser();
  const u = await dbGet('users', cur);
  if (!u) return { ok: false, msg: 'جلسة غير صالحة' };
  if (u.passHash !== await hash(currentPassword)) return { ok: false, msg: 'كلمة المرور الحالية غير صحيحة' };
  const updated = {
    username: username || u.username,
    displayName: displayName || u.displayName,
    passHash: newPassword ? await hash(newPassword) : u.passHash,
    mustChange: false,
  };
  await dbPut('users', updated);
  if (updated.username !== cur) {
    // إعادة تسمية المستخدم: احتفظنا بالسجل الجديد وحدّثنا الجلسة (السجل القديم يبقى غير مستخدم)
    localStorage.setItem(SESSION_KEY, updated.username);
  }
  return { ok: true };
}
