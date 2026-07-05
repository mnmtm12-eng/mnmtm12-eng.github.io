---
name: commission-tracker
description: Running commission ledger — $1000 per container, earned when the client's deposit lands. Use when the user reports a new deal/container, a deposit received, or asks how much commission he's earned / كم عمولتي / سجل العمولات.
---

# Commission Tracker

Rule: **$1000 / container, due when the deposit is received** (rate overridable per deal).

## Commands (run from repo root)

```bash
# New deal (status: pending until deposit arrives)
python3 .claude/skills/commission-tracker/scripts/ledger.py add \
  --client "Abu Karam" --country jordan --containers 2

# Deposit landed -> commission earned
python3 .claude/skills/commission-tracker/scripts/ledger.py set-status --id 1 --status deposit

# Commission actually paid to Mohammad
python3 .claude/skills/commission-tracker/scripts/ledger.py set-status --id 1 --status paid

# Rebuild commission_ledger.xlsx + print totals
python3 .claude/skills/commission-tracker/scripts/ledger.py report
```

`add` also accepts `--date YYYY-MM-DD`, `--rate 1000`, `--note "..."`, `--status deposit` (if the deposit already arrived).

## Statuses

- `pending` — deal agreed, no deposit yet → commission NOT counted.
- `deposit` — deposit received → commission **earned/due**.
- `paid` — commission cash actually in hand.

## Workflow for Claude

1. Parse the user's message into client / country / containers / status; run `add` (or `set-status` for existing deals — check IDs with `report` first).
2. Always finish with `report`, send `commission_ledger.xlsx` (SendUserFile), and give a one-line Arabic summary: earned, collected, pending.
3. Data lives in `data/ledger.json` — append-only via the script; never hand-edit the xlsx (it's rebuilt every report).
