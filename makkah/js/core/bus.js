/* ═══ ناقل الأحداث ═══
   أي عملية حفظ/حذف تبثّ حدثاً هنا، وأي شاشة مفتوحة (خاصة لوحة التحكم)
   تستمع وتعيد تحديث أرقامها لحظياً — هذا ما يحقق «التحديث المباشر بعد كل عملية». */
const bus = new EventTarget();

export function emit(type, detail = {}) {
  bus.dispatchEvent(new CustomEvent(type, { detail }));
}

/** الاستماع لحدث؛ تعيد دالة لإلغاء الاستماع (تُستدعى عند مغادرة الشاشة) */
export function on(type, fn) {
  bus.addEventListener(type, fn);
  return () => bus.removeEventListener(type, fn);
}

/** الاستماع لأي تغيير بيانات كان (data:*) */
export function onAnyData(fn) {
  const handler = (e) => fn(e);
  const types = ['workers','attendance','customers','invoices','payments','suppliers','purchases','spayments',
                 'categories','materials','movements','expenses','settings','activity'];
  types.forEach((t) => bus.addEventListener('data:' + t, handler));
  return () => types.forEach((t) => bus.removeEventListener('data:' + t, handler));
}
