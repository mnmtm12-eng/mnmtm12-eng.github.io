/* ═══ الذكاء الاصطناعي (اختياري) ═══
   يعمل عبر Claude API مباشرة من المتصفح. يتطلب إدخال مفتاح API في الإعدادات.
   الاستخدامات: قراءة الفواتير المصوّرة (OCR) + سؤال المساعد الذكي.
   بدون مفتاح: تبقى كل وظائف النظام تعمل، ويُدخل المستخدم بيانات الفاتورة يدوياً. */

import { Settings } from './repo.js';

/** استدعاء عام لواجهة Claude */
export async function askClaude(content, { system = '', maxTokens = 1500 } = {}) {
  const key = await Settings.get('aiKey');
  if (!key) throw new Error('NO_KEY');
  const model = await Settings.get('aiModel');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      // ضروري للاستدعاء من المتصفح مباشرة (بدون خادم وسيط)
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model, max_tokens: maxTokens,
      system: system || undefined,
      messages: [{ role: 'user', content }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error('AI_ERROR: ' + res.status + ' ' + err.slice(0, 200));
  }
  const data = await res.json();
  return (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
}

/** تحويل صورة إلى Base64 لإرسالها */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/** قراءة فاتورة مصوّرة واستخراج بياناتها كـ JSON للمراجعة قبل الحفظ */
export async function ocrInvoice(blob) {
  const b64 = await blobToBase64(blob);
  const media = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
  const text = await askClaude([
    { type: 'image', source: { type: 'base64', media_type: media, data: b64 } },
    { type: 'text', text:
      'هذه صورة فاتورة. استخرج بياناتها وأعد JSON فقط دون أي نص آخر بهذا الشكل:\n' +
      '{"party":"اسم الجهة (المورد أو العميل)","no":"رقم الفاتورة","date":"YYYY-MM-DD","total":0,' +
      '"items":[{"name":"اسم المادة","qty":0,"price":0}]}\n' +
      'إن تعذّرت قراءة حقل اتركه فارغاً أو صفراً. التاريخ بصيغة ISO. الأرقام أرقاماً لا نصوصاً.' },
  ], { system: 'أنت قارئ فواتير دقيق. أعد JSON صالحاً فقط.', maxTokens: 1200 });

  // انتزاع JSON من الرد (قد يأتي داخل أسوار كود)
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('PARSE_ERROR');
  return JSON.parse(m[0]);
}

export async function hasAI() { return !!(await Settings.get('aiKey')); }
