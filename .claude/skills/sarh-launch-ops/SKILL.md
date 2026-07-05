---
name: sarh-launch-ops
description: SARH production math — batch/oil calculator, maceration timeline, cost & margin per bottle. Use when the user plans a perfume batch — دفعة عطر / كم زيت بدي / تكلفة القزازة / متى تخلص المعتقة.
---

# SARH Launch Ops

## Batch calculator

```bash
python3 .claude/skills/sarh-launch-ops/scripts/batch_calc.py \
  --bottles 100 --ml 50 --concentration 25 \
  --oil-cost-per-kg 180 --ethanol-cost-per-l 6 \
  --bottle-cost 1.8 --cap-cost 0.5 --box-cost 1.2 --label-cost 0.3 \
  --price 35 [--maceration-weeks 4] [--start 2026-07-05] [--overfill 5]
```

Outputs: oil ml/grams needed (density default 0.93 g/ml for oud-type oils, override with `--oil-density`), ethanol volume, per-bottle cost breakdown, margin %, total batch cost/revenue/profit, and the maceration-ready date.

## Rules

- Concentration guide: EDP 15–20%, extrait/attar-style 20–30%. SARH default 25% (extrait positioning) — confirm per perfume.
- Always add overfill/loss margin (default 5%) — filtering and filling always lose liquid.
- Maceration default 4 weeks dark & cool; Jamr-style heavy oud blends often benefit from 6 — flag it if the perfume is Jamr.
- After the calc, give the user a one-line Arabic verdict: هامش الربح صحي (>60%)، مقبول (40–60%)، خطر (<40%) — pricing for a luxury positioning should not sit under 60%.
- All costs are whatever currency the user gives — don't convert unless asked; just label it.
