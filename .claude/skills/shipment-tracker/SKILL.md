---
name: shipment-tracker
description: Track each container order through production → inspection → loading → customs → shipped → arrived, with a status log and xlsx overview. Use when the user mentions a new order going to production, a stage update (بلش الإنتاج / حملنا / وصلت الشحنة), or asks وين صارت الشحنات.
---

# Shipment Tracker

## Stages (in order)

`deposit` → `production` → `inspection` (Mohammad's personal QC) → `loading` → `customs` → `shipped` → `arrived` → `closed` (balance settled)

## Commands (repo root)

```bash
# New shipment
python3 .claude/skills/shipment-tracker/scripts/shipments.py add \
  --client "Abu Karam" --country jordan --containers 2 --eta 2026-08-10

# Stage update (id from report)
python3 .claude/skills/shipment-tracker/scripts/shipments.py stage \
  --id 1 --stage production --note "Factory confirmed, slot 12 days"

# Overview -> shipments.xlsx + console table
python3 .claude/skills/shipment-tracker/scripts/shipments.py report
```

## Workflow for Claude

1. Map the user's words to a stage (بلش الإنتاج=production, فحصتها=inspection, عم نحمّل=loading, طلعت من الجمرك/أبحرت=shipped, وصلت=arrived, قبض الباقي=closed).
2. Every stage change is appended to that shipment's history with date+note — never overwritten.
3. After any change run `report`, send `shipments.xlsx`, and give a one-line Arabic status of ALL open shipments (not just the changed one).
4. When a shipment hits `deposit`, remind the user: commission earned → offer to log it in **commission-tracker**.
5. Data: `data/shipments.json` (script-managed).
