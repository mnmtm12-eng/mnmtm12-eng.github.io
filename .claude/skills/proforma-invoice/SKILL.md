---
name: proforma-invoice
description: Generate a real-format commercial/proforma invoice (HS codes, EXW, deposit %) as xlsx. Use when the user needs a proforma / بروفورما / فاتورة تصدير for a buyer, with exporter, buyer and item lines.
---

# Proforma Invoice

## Steps

1. Collect: **buyer** (company + city + country), **items**, and any overrides (deposit %, incoterm, currency). Exporter details come from `data/exporter_defaults.json` — if fields still say EDIT, ask the user once and update the JSON so it's never asked again.
2. Run (repo root):

```bash
python3 .claude/skills/proforma-invoice/scripts/make_proforma.py \
  --buyer "ALPHA TRADING LLC | Baghdad, Iraq | +964 770 000 0000" \
  --item "Armored steel door 90x205 cm, laminox:7308.30:100:pcs:120" \
  --item "Armored steel door 120x215 cm:7308.30:50:pcs:140" \
  --deposit 30
```

`--item` = `DESCRIPTION:HS:QTY:UNIT:UNIT_PRICE`. Buyer field uses `|` as line separator. Output: `invoices/PI-<date>-<n>.xlsx`.

3. Send the xlsx (SendUserFile) + one-line Arabic summary (total, deposit amount, balance).

## Facts

- Default HS code for armored steel doors: **7308.30** (doors/windows of iron or steel). SARH perfume would be **3303.00**.
- Default terms: EXW Kayseri, 30% advance deposit, balance before shipment (T/T). Overridable via `--incoterm`, `--deposit`, `--balance-terms`.
- Bank block prints from the JSON; if IBAN/SWIFT are EDIT placeholders the script prints them as-is — remind the user to fill them before sending to a client.
- The xlsx follows real export layout (seller/buyer blocks, PI no, HS column, totals, bank details, signature line) and prints cleanly to PDF.
