---
name: daily-briefing
description: One-screen morning briefing — pulls the Notion command center (if connected) plus all local trackers (shipments, commissions, company setup, legal file) into today's tasks + what changed. Use on بريفنغ / شو عندي اليوم / daily brief / صباح الخير شو الوضع.
---

# Daily Briefing

Goal: ONE screen, Arabic, no scrolling. Never dump raw data.

## Sources (read in this order, skip what's unavailable)

1. **Notion command center**: ToolSearch "notion" → if Notion tools connect, search for the command-center page/database and pull today's + overdue items. If Notion is unavailable, say so in one word (بدون نوشن اليوم) and continue — never block on it.
2. **Local trackers** (always available, offline):
   - `shipment-tracker/data/shipments.json` — open shipments + stage ages (flag anything stuck >7 days in one stage).
   - `commission-tracker/data/ledger.json` — pending deposits (money waiting on someone else).
   - `company-setup-tracker/data/checklist.json` — the single next company step.
   - `legal-file-organizer/data/land_file.json` — nearest deadline (if the file exists).
   - `health-logistics/data/care_log.json` — next appointment (if the file exists). Handle privately and gently; first item in the brief if within 48h.

## Output format (exactly this, Arabic)

```
📅 <التاريخ> — الملخص
🔥 اليوم (٣ أشياء كحد أقصى، الأهم أولاً)
⏳ مستحقات ناطرة غيرك (عرابين، ردود مصانع)
📦 الشحنات: سطر واحد لكل شحنة مفتوحة
🏢 الشركة: الخطوة الجاية فقط
⚠️ شو تغيّر من مبارح / شو عالق
```

Rules: max ~15 lines total. If a section is empty, omit it. "اليوم" items must be actions Mohammad can finish today, not projects. End with one question only if something genuinely needs his decision.
