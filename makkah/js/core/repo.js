/* ═══ طبقة منطق العمل (Repositories) ═══
   كل قواعد العمل هنا: الرواتب، الفواتير والدفعات، المخزون وحركاته، الإعدادات، النسخ الاحتياطي.
   الواجهات (features) تستدعي هذه الدوال فقط ولا تلمس قاعدة البيانات مباشرة.
   كل عملية كتابة: تُسجَّل في «سجل النشاط» وتبثّ حدثاً ليتحدّث كل شيء لحظياً. */

import { dbPut, dbGet, dbDel, dbAll, dbIdx, dbRange, dbClear, storeNames } from './db.js';
import { uid, nowISO, today, monthOf, num } from './util.js';
import { emit } from './bus.js';

/* ─────────── الإعدادات ─────────── */
const DEFAULT_SETTINGS = {
  factoryName: 'مصنع مكة للأبواب',
  currency: '$',
  attendanceTime: '08:30',   // وقت إنشاء سجل الحضور اليومي
  salaryDay: 1,              // يوم صرف الرواتب (للتنبيه)
  theme: 'light',
  aiKey: '',                 // مفتاح Claude API لميزات الذكاء الاصطناعي (اختياري)
  aiModel: 'claude-haiku-4-5-20251001',
};

export const Settings = {
  async get(key) {
    const rec = await dbGet('settings', key);
    return rec ? rec.value : DEFAULT_SETTINGS[key];
  },
  async all() {
    const recs = await dbAll('settings');
    const out = { ...DEFAULT_SETTINGS };
    recs.forEach((r) => { out[r.key] = r.value; });
    return out;
  },
  async set(key, value) {
    await dbPut('settings', { key, value });
    emit('data:settings', { key });
  },
};

/* ─────────── سجل النشاط ─────────── */
export const Activity = {
  async log(action, entity, summary) {
    await dbPut('activity', { id: uid(), time: nowISO(), action, entity, summary });
    emit('data:activity');
  },
  async list(limit = 300) {
    const all = await dbAll('activity');
    return all.sort((a, b) => b.time.localeCompare(a.time)).slice(0, limit);
  },
};

/* ─────────── عمليات عامة على السجلات ─────────── */
export async function save(store, obj, label = '') {
  const isNew = !obj.id;
  if (isNew) { obj.id = uid(); obj.createdAt = nowISO(); }
  obj.updatedAt = nowISO();
  await dbPut(store, obj);
  await Activity.log(isNew ? 'إضافة' : 'تعديل', store, label);
  emit('data:' + store, { id: obj.id });
  return obj;
}
export async function removeRec(store, id, label = '') {
  await dbDel(store, id);
  await Activity.log('حذف', store, label);
  emit('data:' + store, { id });
}
export { dbGet as get, dbAll as all, dbIdx as byIndex };

/* ─────────── العمال والحضور ─────────── */
export const Workers = {
  list: async () => (await dbAll('workers')).sort((a, b) => a.name.localeCompare(b.name, 'ar')),
  get: (id) => dbGet('workers', id),
  save: (w) => save('workers', w, 'عامل: ' + w.name),
  async remove(id) {
    // الحذف يشمل سجلات الحضور التابعة للعامل (بعد تأكيد المستخدم في الواجهة)
    const recs = await dbIdx('attendance', 'workerId', id);
    for (const r of recs) await dbDel('attendance', r.id);
    const w = await dbGet('workers', id);
    await removeRec('workers', id, 'عامل: ' + (w ? w.name : id));
    emit('data:attendance');
  },
};

export const Attendance = {
  /** سجلات عامل في شهر (مرتبة تنازلياً بالتاريخ) */
  async month(workerId, month) {
    const recs = await dbIdx('attendance', 'wm', [workerId, month]);
    return recs.sort((a, b) => b.date.localeCompare(a.date));
  },
  byDate: (date) => dbIdx('attendance', 'date', date),
  save: (rec) => save('attendance', rec, 'حضور ' + rec.date),
  remove: (rec) => removeRec('attendance', rec.id, 'حضور ' + rec.date),

  /** الشهور التي لدى العامل سجلات فيها (للأرشيف) */
  async monthsOf(workerId) {
    const recs = await dbIdx('attendance', 'workerId', workerId);
    return [...new Set(recs.map((r) => r.month))].sort().reverse();
  },

  /** ملخص شهر لعامل: حضور/غياب/إضافي/سلف/خصومات + الراتب الحالي.
      الراتب = أيام الحضور × الأجر اليومي + الساعات الإضافية × أجر الساعة − السلف − الخصومات
      ويُعاد حسابه فوراً بعد أي تعديل (لأن العرض يقرأه من هنا دائماً). */
  async summary(workerId, month) {
    const [recs, w] = await Promise.all([this.month(workerId, month), dbGet('workers', workerId)]);
    const s = { present: 0, absent: 0, overtime: 0, advance: 0, deduction: 0, salary: 0, days: recs.length };
    recs.forEach((r) => {
      if (r.status === 'absent') s.absent++; else s.present++;
      s.overtime += num(r.overtime); s.advance += num(r.advance); s.deduction += num(r.deduction);
    });
    const dw = num(w?.dailyWage), or = num(w?.overtimeRate);
    s.salary = s.present * dw + s.overtime * or - s.advance - s.deduction;
    return s;
  },
};

/* ─────────── محرّك الحسابات (مبيعات ومشتريات بنفس المنطق) ───────────
   إعدادان يحدّدان الجداول: SALES للعملاء و PURCH للموردين —
   نفس الكود يدير الفواتير والدفعات وكشوف الحساب للطرفين. */
export const SALES = {
  kind: 'sale',   party: 'customers', inv: 'invoices',  pay: 'payments',
  partyIdx: 'customerId', payInvIdx: 'invoiceId', partyField: 'customerId',
  invField: 'invoiceId', dir: 'out', noKey: 'invoice', noPrefix: 'INV',
  label: 'فاتورة بيع', partyLabel: 'عميل',
};
export const PURCH = {
  kind: 'purchase', party: 'suppliers', inv: 'purchases', pay: 'spayments',
  partyIdx: 'supplierId', payInvIdx: 'purchaseId', partyField: 'supplierId',
  invField: 'purchaseId', dir: 'in', noKey: 'purchase', noPrefix: 'PUR',
  label: 'فاتورة شراء', partyLabel: 'مورد',
};

export const Ledger = {
  /** رقم فاتورة تلقائي متسلسل: INV-2026-0001 */
  async nextNo(cfg) {
    const year = today().slice(0, 4);
    const key = cfg.noKey + '-' + year;
    const rec = (await dbGet('counters', key)) || { key, value: 0 };
    rec.value += 1;
    await dbPut('counters', rec);
    return `${cfg.noPrefix}-${year}-${String(rec.value).padStart(4, '0')}`;
  },

  total: (inv) => (inv.items || []).reduce((s, it) => s + num(it.qty) * num(it.price), 0),

  /** مجموع دفعات فاتورة */
  async paidOf(cfg, invoiceId) {
    const pays = await dbIdx(cfg.pay, cfg.payInvIdx, invoiceId);
    return pays.reduce((s, p) => s + num(p.amount), 0);
  },
  /** خريطة المدفوع لكل الفواتير دفعة واحدة (أداء أفضل للقوائم) */
  async paidMap(cfg) {
    const pays = await dbAll(cfg.pay);
    const map = {};
    pays.forEach((p) => { const k = p[cfg.invField]; if (k) map[k] = (map[k] || 0) + num(p.amount); });
    return map;
  },
  status(total, paid) {
    if (paid <= 0 && total > 0) return 'unpaid';
    if (paid >= total) return 'paid';
    return 'partial';
  },

  /** حفظ فاتورة (جديدة أو معدّلة) + دفعة أولى اختيارية + مزامنة المخزون */
  async saveInvoice(cfg, inv, initialPaid = 0) {
    inv.total = this.total(inv);
    if (!inv.no) inv.no = await this.nextNo(cfg);
    const saved = await save(cfg.inv, inv, `${cfg.label} ${inv.no}`);
    if (num(initialPaid) > 0) {
      await this.addPayment(cfg, { [cfg.partyField]: inv[cfg.partyField], [cfg.invField]: saved.id, amount: num(initialPaid), date: inv.date, note: 'دفعة عند إنشاء الفاتورة' });
    }
    // مزامنة المخزون تلقائياً: شراء = إدخال، بيع = إخراج (فقط للبنود المربوطة بمادة)
    await Inventory.applyRef(cfg.kind, saved.id, inv.items || [], cfg.dir, inv.date);
    return saved;
  },

  async deleteInvoice(cfg, id) {
    const inv = await dbGet(cfg.inv, id);
    // حذف الدفعات المرتبطة وعكس حركات المخزون
    const pays = await dbIdx(cfg.pay, cfg.payInvIdx, id);
    for (const p of pays) await dbDel(cfg.pay, p.id);
    await Inventory.applyRef(cfg.kind, id, [], cfg.dir, today()); // قائمة فارغة = عكس القديم فقط
    await removeRec(cfg.inv, id, `${cfg.label} ${inv ? inv.no : id}`);
    emit('data:' + cfg.pay);
  },

  addPayment(cfg, p) {
    p.date = p.date || today();
    return save(cfg.pay, p, 'دفعة ' + num(p.amount));
  },
  deletePayment: (cfg, p) => removeRec(cfg.pay, p.id, 'دفعة ' + num(p.amount)),

  listInvoices: async (cfg, partyId = null) => {
    const list = partyId ? await dbIdx(cfg.inv, cfg.partyIdx, partyId) : await dbAll(cfg.inv);
    return list.sort((a, b) => (b.date + b.no).localeCompare(a.date + a.no));
  },
  listPayments: async (cfg, partyId) =>
    (await dbIdx(cfg.pay, cfg.partyIdx, partyId)).sort((a, b) => b.date.localeCompare(a.date)),

  /** إحصائيات طرف: إجمالي/مدفوع/متبقٍ/آخر فاتورة/آخر دفعة */
  async partyStats(cfg, partyId) {
    const [invs, pays] = await Promise.all([this.listInvoices(cfg, partyId), this.listPayments(cfg, partyId)]);
    const total = invs.reduce((s, i) => s + num(i.total), 0);
    const paid = pays.reduce((s, p) => s + num(p.amount), 0);
    return {
      count: invs.length, total, paid, due: total - paid,
      lastInvoice: invs[0] || null, lastPayment: pays[0] || null,
    };
  },

  /** حذف طرف (عميل/مورد) مع كل فواتيره ودفعاته */
  async deleteParty(cfg, partyId) {
    const invs = await dbIdx(cfg.inv, cfg.partyIdx, partyId);
    for (const i of invs) await this.deleteInvoice(cfg, i.id);
    const pays = await dbIdx(cfg.pay, cfg.partyIdx, partyId);
    for (const p of pays) await dbDel(cfg.pay, p.id);
    const party = await dbGet(cfg.party, partyId);
    await removeRec(cfg.party, partyId, `${cfg.partyLabel}: ${party ? party.name : partyId}`);
  },

  /** كشف حساب: فواتير + دفعات مرتّبة زمنياً برصيد جارٍ، مع رصيد سابق قبل «من تاريخ» */
  async statement(cfg, partyId, from = '', to = '') {
    const [invs, pays] = await Promise.all([this.listInvoices(cfg, partyId), this.listPayments(cfg, partyId)]);
    const events = [
      ...invs.map((i) => ({ date: i.date, kind: 'inv', ref: i, debit: num(i.total), credit: 0 })),
      ...pays.map((p) => ({ date: p.date, kind: 'pay', ref: p, debit: 0, credit: num(p.amount) })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    let opening = 0; const rows = [];
    for (const e of events) {
      if (from && e.date < from) { opening += e.debit - e.credit; continue; }
      if (to && e.date > to) continue;
      rows.push(e);
    }
    let bal = opening;
    rows.forEach((r) => { bal += r.debit - r.credit; r.balance = bal; });
    return { opening, rows, closing: bal };
  },
};

/* ─────────── المخزون ─────────── */
export const Inventory = {
  categories: async () => (await dbAll('categories')).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  saveCategory: (c) => save('categories', c, 'قسم مخزون: ' + c.name),
  async removeCategory(id) {
    const mats = await dbIdx('materials', 'categoryId', id);
    for (const m of mats) await this.removeMaterial(m.id);
    await removeRec('categories', id, 'قسم مخزون');
  },

  materials: async (categoryId = null) => {
    const list = categoryId ? await dbIdx('materials', 'categoryId', categoryId) : await dbAll('materials');
    return list.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  },
  material: (id) => dbGet('materials', id),
  saveMaterial: (m) => save('materials', m, 'مادة: ' + m.name),
  async removeMaterial(id) {
    const movs = await dbIdx('movements', 'materialId', id);
    for (const mv of movs) await dbDel('movements', mv.id);
    const m = await dbGet('materials', id);
    await removeRec('materials', id, 'مادة: ' + (m ? m.name : id));
    emit('data:movements');
  },

  movements: async (materialId) =>
    (await dbIdx('movements', 'materialId', materialId)).sort((a, b) => b.date.localeCompare(a.date)),

  /** حركة يدوية أو آلية: تُحدّث كمية المادة فوراً */
  async addMovement(mv) {
    const m = await dbGet('materials', mv.materialId);
    if (!m) return null;
    mv.date = mv.date || today();
    const q = num(mv.qty);
    m.qty = num(m.qty) + (mv.type === 'in' ? q : -q);
    await dbPut('materials', m);
    const saved = await save('movements', mv, `${mv.type === 'in' ? 'إدخال' : 'إخراج'} ${m.name} (${q})`);
    emit('data:materials');
    return saved;
  },
  async deleteMovement(mv) {
    // عكس أثر الحركة على الكمية ثم حذفها
    const m = await dbGet('materials', mv.materialId);
    if (m) { m.qty = num(m.qty) + (mv.type === 'in' ? -num(mv.qty) : num(mv.qty)); await dbPut('materials', m); }
    await removeRec('movements', mv.id, 'حركة مخزون');
    emit('data:materials');
  },

  /** مزامنة حركات فاتورة (بيع/شراء): تُعكس الحركات القديمة لنفس المرجع ثم تُسجَّل الجديدة.
      يجعل «التعديل الشامل» آمناً: تعديل الفاتورة يعيد ضبط المخزون تلقائياً. */
  async applyRef(refType, refId, items, dir, date) {
    const old = await dbIdx('movements', 'ref', refId);
    for (const mv of old) await this.deleteMovement(mv);
    for (const it of items) {
      if (!it.materialId || !num(it.qty)) continue;
      await this.addMovement({
        materialId: it.materialId, type: dir, qty: num(it.qty), date,
        party: refType === 'sale' ? 'بيع' : 'شراء', refType, refId,
        note: it.name || '',
      });
    }
  },

  /** المواد التي بلغت حد الطلب (كمية ≤ الحد الأدنى) */
  async lowStock() {
    const mats = await dbAll('materials');
    return mats.filter((m) => num(m.minQty) > 0 && num(m.qty) <= num(m.minQty));
  },

  /** بذر الأقسام الافتراضية أول تشغيل */
  async seedDefaults() {
    const cats = await dbAll('categories');
    if (cats.length) return;
    const names = ['الخشب', 'الصاج', 'البوية', 'الإكسسوارات', 'الزجاج', 'الألمنيوم'];
    for (let i = 0; i < names.length; i++) {
      await dbPut('categories', { id: uid(), name: names[i], order: i });
    }
    emit('data:categories');
  },
};

/* ─────────── المصاريف (لصافي الربح) ─────────── */
export const Expenses = {
  list: async () => (await dbAll('expenses')).sort((a, b) => b.date.localeCompare(a.date)),
  save: (e) => { e.date = e.date || today(); return save('expenses', e, 'مصروف ' + num(e.amount)); },
  remove: (e) => removeRec('expenses', e.id, 'مصروف'),
};

/* ─────────── الصور المرفقة (فواتير الشراء) ─────────── */
export const Images = {
  async put(blob) { const id = uid(); await dbPut('images', { id, blob }); return id; },
  async get(id) { const r = await dbGet('images', id); return r ? r.blob : null; },
  del: (id) => dbDel('images', id),
};

/* ─────────── النسخ الاحتياطي والاستعادة ───────────
   تصدير/استيراد كل البيانات كملف JSON + نسخ تلقائية داخلية (تُحتفظ آخر 7).
   ملاحظة: المزامنة السحابية بين الأجهزة تتطلب خادماً — هذه النقطة جاهزة معمارياً
   (كل البيانات تمرّ من هنا) ويمكن ربطها لاحقاً بأي خدمة تخزين. */
export const Backup = {
  async exportAll() {
    const out = { app: 'makkah', version: 1, time: nowISO(), data: {} };
    for (const s of storeNames()) {
      if (s === 'backups' || s === 'images') continue; // الصور كبيرة — تُستثنى من ملف JSON
      out.data[s] = await dbAll(s);
    }
    return out;
  },
  async importAll(obj) {
    if (!obj || obj.app !== 'makkah' || !obj.data) throw new Error('ملف نسخة احتياطية غير صالح');
    for (const [store, rows] of Object.entries(obj.data)) {
      if (!storeNames().includes(store)) continue;
      await dbClear(store);
      for (const r of rows) await dbPut(store, r);
      emit('data:' + store);
    }
    await Activity.log('استعادة', 'backups', 'استعادة نسخة احتياطية');
  },
  /** نسخة تلقائية داخلية (تعمل عند كل تشغيل — مرة يومياً كحد أقصى) */
  async autoBackup() {
    const key = 'makkah.lastAutoBackup';
    if (localStorage.getItem(key) === today()) return;
    const snap = await this.exportAll();
    await dbPut('backups', { id: uid(), time: nowISO(), snap });
    // الاحتفاظ بآخر 7 نسخ فقط
    const all = (await dbAll('backups')).sort((a, b) => b.time.localeCompare(a.time));
    for (const b of all.slice(7)) await dbDel('backups', b.id);
    localStorage.setItem(key, today());
  },
  list: async () => (await dbAll('backups')).sort((a, b) => b.time.localeCompare(a.time)),
};
