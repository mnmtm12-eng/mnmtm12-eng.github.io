---
name: health-logistics
description: Logistics support for his mother's cancer treatment — appointment log, pre-visit checklists, doctor-question lists (TR), medication schedule, AR↔TR medical terms. Use when the user mentions علاج الوالدة / موعد المشفى / الدكتور / تحاليل / randevu.
---

# Health Logistics (Private)

State: `data/care_log.json` — **gitignored (private)**; on first use copy `data/care_log.example.json` to `data/care_log.json`. Remind the user to keep his own backup (phone/drive) since it's never pushed.

Tone: practical and calm. This skill handles LOGISTICS only — appointments, papers, questions, schedules. Never give medical advice, prognosis, or treatment opinions; those go to the oncologist. Wording in replies stays gentle (الوالدة، الله يشفيها) without being heavy.

## What to track (JSON sections)

- `appointments[]` — date, hospital/clinic, doctor, purpose (kemoterapi/kontrol/tahlil/görüntüleme), status, outcome note.
- `medications[]` — name, dose, timing, refill-by date.
- `documents[]` — reports (epikriz), test results, SGK/insurance papers: what exists, where it is.
- `questions[]` — running list of questions for the doctor; cleared after each visit.

## What this skill does on demand

1. **Pre-visit pack** (the killer feature): the night before an appointment produce one screen — documents to bring, current medication list (formatted to hand to the doctor), and the open `questions[]` translated into **natural spoken Turkish** with the Arabic original next to each, so Mohammad can ask or show the phone.
2. **After-visit log**: user dictates what the doctor said → append outcome, update meds, set the next appointment + any tahlil dates.
3. **MHRS prep**: when a randevu is needed, list exactly what to have ready (TC/kimlik no, hangi poliklinik, referral requirement) — don't attempt to book.
4. **Term translation**: AR↔TR medical vocabulary on the spot (تحاليل=tahlil، أشعة/تصوير=görüntüleme، جرعة=doz/kür، مراجعة=kontrol…).
5. Nearest appointment within 48h → it leads the daily-briefing.
