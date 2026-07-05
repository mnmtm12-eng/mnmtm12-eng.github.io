---
name: company-setup-tracker
description: Track the Şahıs Şirketi setup end-to-end (Vergi Dairesi → Mali Müşavir → bank → e-fatura → İhracatçı Birliği/OAİB) with statuses and the single next step. Use when the user mentions company paperwork — الشركة / şirket / vergi / mali müşavir / وين وصلنا بالشركة.
---

# Şahıs Şirketi Setup Tracker

State lives in `data/checklist.json` — Claude edits it directly (set `status`, `date`, `note`). Statuses: `todo` / `in_progress` / `done` / `blocked`.

## Workflow

1. On any update from the user, patch the matching step in the JSON.
2. Then answer with exactly: ✅ ما خلص، 🔄 شو قيد التنفيذ، and **➡️ الخطوة الوحيدة الجاية** (one step, with what documents to bring — never dump the whole list).
3. If a step is `blocked`, surface the blocker first.
4. Steps/order below are the standard flow for a foreigner opening a şahıs şirketi in Türkiye — the user's mali müşavir has final word; when he corrects a step, update the JSON permanently (add/remove/reorder allowed).

## Standard flow (mirrors data/checklist.json)

1. Documents ready: passport + notarized translation, ikamet (residence permit), vergi numarası (tax number from Vergi Dairesi or İnteraktif Vergi Dairesi), rental contract or address proof.
2. Hire **Mali Müşavir** (accountant) — signs off the application, handles monthly filings (~fixed monthly fee, agree it up front).
3. Company registration via mali müşavir / İnteraktif Vergi Dairesi → **vergi levhası** issued.
4. **İmza beyannamesi** (signature declaration) at the notary.
5. Open **business bank account** (TRY + USD; USD account is essential for export deposits).
6. **e-Fatura / e-Arşiv** activation (mali müşavir does it) — needed to invoice legally.
7. **Bağ-Kur** registration (self-employment social security) — note interaction with any SGK employment; ask mali müşavir which applies.
8. For export under his own company: **İhracatçı Birliği membership (e.g. OAİB)** + customs broker (gümrük müşaviri) relationship.
9. Optional later: trademark registration for MN STEEL DOOR / SARH (Türk Patent).
