/* ═══ طبقة البيانات — IndexedDB ═══
   قاعدة بيانات محلية على الجهاز تعمل بدون إنترنت.
   كل «مخزن» (Store) يقابل جدولاً، مع فهارس للاستعلام السريع.
   لإضافة كيان جديد مستقبلاً: أضف سطراً في SCHEMA وارفع DB_VER — الترقية تلقائية دون فقدان بيانات. */

const DB_NAME = 'makkah';
const DB_VER = 1;

/** تعريف المخازن والفهارس */
const SCHEMA = {
  users:      { keyPath: 'username' },
  settings:   { keyPath: 'key' },
  counters:   { keyPath: 'key' },
  workers:    { keyPath: 'id', idx: { name: 'name' } },
  attendance: { keyPath: 'id', idx: { workerId: 'workerId', date: 'date', month: 'month', wm: ['workerId', 'month'] } },
  customers:  { keyPath: 'id', idx: { name: 'name' } },
  invoices:   { keyPath: 'id', idx: { customerId: 'customerId', date: 'date', no: 'no' } },
  payments:   { keyPath: 'id', idx: { customerId: 'customerId', invoiceId: 'invoiceId', date: 'date' } },
  suppliers:  { keyPath: 'id', idx: { name: 'name' } },
  purchases:  { keyPath: 'id', idx: { supplierId: 'supplierId', date: 'date', no: 'no' } },
  spayments:  { keyPath: 'id', idx: { supplierId: 'supplierId', purchaseId: 'purchaseId', date: 'date' } },
  categories: { keyPath: 'id' },
  materials:  { keyPath: 'id', idx: { categoryId: 'categoryId', name: 'name' } },
  movements:  { keyPath: 'id', idx: { materialId: 'materialId', date: 'date', ref: 'refId' } },
  expenses:   { keyPath: 'id', idx: { date: 'date' } },
  images:     { keyPath: 'id' },
  activity:   { keyPath: 'id', idx: { time: 'time' } },
  backups:    { keyPath: 'id', idx: { time: 'time' } },
};

let _db = null;

export function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const [name, def] of Object.entries(SCHEMA)) {
        if (!db.objectStoreNames.contains(name)) {
          const st = db.createObjectStore(name, { keyPath: def.keyPath });
          for (const [iname, kp] of Object.entries(def.idx || {})) st.createIndex(iname, kp);
        }
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

/** تنفيذ عملية على مخزن ضمن معاملة */
function tx(store, mode, fn) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const st = t.objectStore(store);
    const out = fn(st);
    t.oncomplete = () => resolve(out && out._val !== undefined ? out._val : undefined);
    t.onerror = () => reject(t.error);
  }));
}
const wrap = (req, box) => { req.onsuccess = () => { box._val = req.result; }; return box; };

export const dbPut = (store, obj) => tx(store, 'readwrite', (st) => { st.put(obj); });
export const dbDel = (store, key) => tx(store, 'readwrite', (st) => { st.delete(key); });
export const dbClear = (store) => tx(store, 'readwrite', (st) => { st.clear(); });
export const dbGet = (store, key) => tx(store, 'readonly', (st) => wrap(st.get(key), {}));
export const dbAll = (store) => tx(store, 'readonly', (st) => wrap(st.getAll(), {}));
/** كل السجلات المطابقة لقيمة فهرس (مثال: كل حضور عامل في شهر) */
export const dbIdx = (store, index, value) =>
  tx(store, 'readonly', (st) => wrap(st.index(index).getAll(value), {}));
/** استعلام مدى على فهرس (مثال: كل الفواتير بين تاريخين) */
export const dbRange = (store, index, from, to) =>
  tx(store, 'readonly', (st) => wrap(st.index(index).getAll(IDBKeyRange.bound(from, to)), {}));

/** قائمة أسماء المخازن (للنسخ الاحتياطي) */
export const storeNames = () => Object.keys(SCHEMA);
