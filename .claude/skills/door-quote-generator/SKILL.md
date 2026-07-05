---
name: door-quote-generator
description: Build a per-country armored-door quote (spec sheet + prices + container math) as a clean xlsx proforma. Use when the user asks for a quote / عرض سعر / تسعيرة / كوتيشن for a client in Egypt, Jordan, Iraq, Libya or Morocco, giving door sizes and quantities.
---

# Door Quote Generator

## Steps

1. Collect from the user: **country**, **client name**, and **items** (door size in cm, quantity, unit price USD). If a unit price is missing, ask once; if still unknown pass no price and it prints as "TBD".
2. Run (repo root):

```bash
python3 .claude/skills/door-quote-generator/scripts/gen_quote.py \
  --country egypt --client "Cairo Doors Co." \
  --item 90x205:100:115 --item 120x215:60:135
```

`--item` = `WIDTHxHEIGHT:QTY[:UNIT_PRICE_USD]`. Output lands in `quotes/QT-<date>-<country>.xlsx`.

3. Send the xlsx to the user (SendUserFile), then paste a short WhatsApp-ready **Arabic** summary: sizes, qty, unit prices, grand total, containers needed, validity. No fluff.

## Rules

- All specs, prices, doors-per-container and default terms live in `data/country_specs.json`. **Edit the JSON, never hardcode in the script.** Fields marked `EDIT` are placeholders the user should confirm.
- Doors per 40HC container (verified from his calculator): Egypt 167, Jordan 120, Iraq 100, Libya 100, Morocco 100.
- Default terms: EXW Kayseri, 30% deposit, quote valid 15 days, lead time 25–35 days.
- Iraq: custom sizes are common and sometimes priced per m² — still quote per door, but put the m² note in the item description.
- The xlsx prints cleanly to PDF (File → Print → PDF) if the client wants PDF.
