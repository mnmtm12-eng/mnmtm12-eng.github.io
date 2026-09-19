/* ═══ قسم الموردين والشركات ═══
   نفس محرّك الحسابات (ledger.js) بإعداد PURCH، مع إضافتين خاصتين بالموردين:
     • حقل «نوع الشركة» (خشب، صاج، بويا، إكسسوارات، زجاج، ألمنيوم...) مع تبويب تصفية
     • فاتورة الشراء تقبل صورة + قراءة آلية بالذكاء الاصطناعي، وتحدّث المخزون تلقائياً */

import { PURCH } from '../core/repo.js';
import { renderPartyList, renderPartyPage } from './ledger.js';

export const SUPPLIER_TYPES = ['خشب', 'صاج', 'بوية', 'إكسسوارات', 'زجاج', 'ألمنيوم', 'أخرى'];

const TYPE_FIELD = `
  <div class="f-row"><label>نوع الشركة</label>
    <select class="inp" name="type">
      <option value="">— غير محدد —</option>
      ${SUPPLIER_TYPES.map((t) => `<option value="${t}">${t}</option>`).join('')}
    </select></div>`;

const OPTS = {
  icon: '🏭', title: 'الموردون والشركات', listTitle: 'الموردون', route: '/suppliers',
  extraFields: TYPE_FIELD, typeFilter: true,
};

export const renderSuppliers = (view) => renderPartyList(view, PURCH, OPTS);
export const renderSupplierPage = (view, id) => renderPartyPage(view, PURCH, id, OPTS);
