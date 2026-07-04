# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

A personal business-automation toolkit for Mohammad Nima (محمد نعمة), a sales agent for TLT steel doors based in Kayseri, Turkey. It combines:

1. **A lead-generation scraper** ("آلة الحفر" / the digging machine) that finds steel-door importers in target countries and collects their phone numbers and emails.
2. **Interactive CLI business tools** (dashboard, price/commission calculator, invoice generator, WhatsApp outreach helper).
3. **A GitHub Pages site** for the separate صرح (Sarh) perfume business, served from `public/`.

Most code comments, log output, UI text, and commit messages are in Arabic. Keep that convention — new user-facing text and commit messages should be Arabic (historic auto-commits look like `auto: تحديث النتائج 2026-07-04-19:25`).

## Commands

There is no build system, test suite, or linter. Everything is plain Python 3 scripts run directly.

```bash
pip install -r requirements.txt   # requests, beautifulsoup4, ddgs, lxml, openpyxl

# Scraper — one cycle then exit (what CI runs):
python3 search_importers.py --oneshot
python3 search_importers.py --oneshot --country مصر   # restrict to one country

# Scraper — run forever as a background daemon (local machine use):
./start.sh    # nohup daemon; writes runner.pid + runner.log
./stop.sh     # kills the PID from runner.pid
tail -f runner.log

# Interactive tools (all prompt-driven TUIs in Arabic):
python3 dashboard.py          # status of the scraper daemon + collected-numbers stats
python3 door_calculator.py    # door price/commission calc; appends calculator_history.json
python3 invoice_generator.py  # PDF invoices via fpdf into invoices/
python3 whatsapp_bot.py       # builds wa.me outreach links from results.csv
```

Note: the scripts' shebang line is `#!/usr/bin/env /tmp/akva_env2/bin/python3` — a venv that only exists on the owner's machine. Always invoke them with `python3 <script>` rather than executing them directly.

## Architecture

### Scraper data pipeline (`search_importers.py`)

The core loop: for each target country, run a set of hardcoded Arabic/English DuckDuckGo queries (`COUNTRIES` list), fetch each result page, keep it only if ≥2 steel-door keywords match (`is_relevant`) AND at least one phone number is extractable, then persist. All state lives in flat files next to the script:

- `seen_urls.json` — dedupe set of every URL ever scraped; loaded at startup, rewritten each cycle.
- `results.csv` — append-only log of hits (name, country, query, url, phones, emails), UTF-8 with BOM (`utf-8-sig`).
- `contacts.xlsx` — fully rebuilt from `results.csv` every cycle (`rebuild_excel()`), deduped by phone digits. Never hand-edit it; changes will be overwritten.

The other tools read these same files: `dashboard.py` and `whatsapp_bot.py` read `results.csv`; `dashboard.py` and `door_calculator.py` share `calculator_history.json`; `backup.sh` zips the data files.

### GitHub Actions — the important operational fact

- **`.github/workflows/scrape.yml`** runs the scraper (`--oneshot`) every 6 hours and **auto-commits `results.csv`, `seen_urls.json`, and `contacts.xlsx` directly to `main`**. Consequences:
  - `main` moves on its own several times a day — always fetch/pull (or rebase) immediately before pushing.
  - Never hand-edit those three data files in a PR; you'll race the bot and the Excel file is regenerated anyway.
  - Query/keyword tuning happens in the `COUNTRIES` and `STEEL_DOOR_KW` constants in `search_importers.py`.
- **`.github/workflows/pages.yml`** deploys the `public/` directory to GitHub Pages on pushes to `main` that touch `public/**`. Only `public/` is published — nothing else in the repo is web-facing.

### The two websites

- `public/index.html` — the **live** صرح (Sarh) luxury perfume single-page site (Arabic RTL, dark/gold theme, all CSS/JS inline). This is what GitHub Pages serves.
- `sarh_website.html` (repo root) — an earlier draft of the same site. It is **not deployed**; don't edit it expecting site changes.

Keep the perfume business (Sarh site) and the steel-door business separate — that separation is deliberate (see `strategy.md`).

### Reference/data documents

`strategy.md` (marketing plan), `email_drafts.md`, `contacts.csv`, `emails_organized.csv`, and the two `.xlsx` proforma files are the owner's business documents, not code. Don't reformat or "clean up" their content unless asked.
