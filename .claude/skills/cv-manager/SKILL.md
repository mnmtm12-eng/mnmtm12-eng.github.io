---
name: cv-manager
description: Maintain Mohammad's master profile and generate a tailored CV (TR or EN) per target — factory sales rep, export manager, partnership pitch. Use when the user needs a CV / سيرة ذاتية / özgeçmiş for a specific factory or role.
---

# CV Manager

Master data: `data/cv_master.json` — the single source of truth. When the user shares any new fact (new client market, a number, a role), update the JSON first, then generate.

## Generating a CV

1. Ask only: **target** (factory/company + role) and **language** (TR default for factories, EN for international).
2. Tailor ruthlessly: a Kayseri door factory cares about his container volume, markets and client ownership — not generic "skills". Lead with numbers:
   - ~10 containers/month personally sold (Egypt 6, Jordan 2, Iraq 0.5+ and growing)
   - Markets: Egypt, Jordan, Iraq + pipeline in Libya, Morocco, Africa
   - Personal pre-shipment QC on every container
   - Native Arabic, working Turkish, English
3. One page max. Format: header (name, Kayseri, phone/WhatsApp +90 501 549 6017) → 2-line profile → experience (achievement bullets with numbers, newest first) → languages → no photo unless asked, no "references available".
4. Same anti-AI rules as turkish-outreach: human phrasing, no buzzwords (sinerji, proaktif…), TR CVs use sector language (çelik kapı, ihracat, konteyner, müşteri portföyü).
5. Output: clean markdown in `documents/cv-<target>-<lang>.md` + send it. If he needs Word/PDF, the markdown pastes cleanly into Word.
