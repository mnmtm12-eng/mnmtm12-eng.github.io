/* ═══ قسم العملاء ═══
   غلاف رفيع فوق محرّك الحسابات المشترك (ledger.js) بإعداد SALES.
   كل شيء جاهز: فواتير بيع، دفعات جزئية، كشف حساب، تتبّع التسليم، طباعة PDF. */

import { SALES } from '../core/repo.js';
import { renderPartyList, renderPartyPage } from './ledger.js';

const OPTS = { icon: '🤝', title: 'العملاء', listTitle: 'العملاء', route: '/customers' };

export const renderCustomers = (view) => renderPartyList(view, SALES, OPTS);
export const renderCustomerPage = (view, id) => renderPartyPage(view, SALES, id, OPTS);
