---
name: legal-file-organizer
description: Organize the family land legal file in Syria — documents inventory, deadlines, event log, and the single next legal step. Use when the user mentions قضية الأرض / الملف القانوني / الطابو / المحكمة / وكالة سوريا.
---

# Legal File Organizer — Land Dispute (Syria)

State: `data/land_file.json` — **gitignored (private)**; on first use copy `data/land_file.example.json` to `data/land_file.json`, then Claude edits it directly. Because the repo is public and this file is NOT committed, remind the user occasionally to keep his own backup of it (e.g. run `backup.sh` or copy it to his phone).

## What to track (sections in the JSON)

- `documents[]` — every paper: name, type (طابو/وكالة/حكم/إخراج قيد), holder (who physically has it), status (original/copy/missing/being-translated-notarized), notes.
- `deadlines[]` — court dates, POA expiry, appeal windows. **Deadlines are sacred**: always show the nearest one first with days remaining.
- `events[]` — append-only log: what happened, date, who said what (lawyer calls, relative updates, court sessions).
- `contacts[]` — lawyer(s) in Syria, the relative handling things locally, mukhtar, etc.
- `next_steps[]` — ordered; exactly ONE marked `current`.

## Workflow

1. User reports anything → append to `events[]`, patch affected documents/deadlines, re-evaluate `next_steps`.
2. Reply format (Arabic, short): آخر تطور → أقرب موعد نهائي (وكم يوم باقي) → الخطوة الجاية وحدها → شو ناقص من أوراق.
3. Common Syria-file realities to account for: POAs (وكالة كاتب عدل) from Turkey need consulate/notary + Turkish apostille path; documents often need certified translation; the local relative is the hands — steps must be phrased as instructions he can execute.
4. You are an organizer, NOT a lawyer: never give legal conclusions about Syrian property law; frame legal questions as «اسأل المحامي هالسؤال بالضبط: …» — writing the exact question for the lawyer IS part of the job.
