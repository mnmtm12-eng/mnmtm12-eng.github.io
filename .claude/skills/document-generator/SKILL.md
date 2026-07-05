---
name: document-generator
description: Draft bilingual (AR/TR, or EN) business-legal documents — agency/commission agreements, exclusivity letters, powers of attorney, sales contracts. Use when the user asks for a عقد / اتفاقية / وكالة / توكيل / sözleşme / vekaletname.
---

# Document Generator (AR/TR bilingual)

## Templates (in `templates/`)

- `agency-agreement.md` — factory ↔ Mohammad: commission per container, client-ownership clause, SGK/salary terms.
- `sales-contract.md` — Mohammad/exporter ↔ buyer: goods, deposit, delivery, inspection, disputes.

For anything else (POA/vekaletname, exclusivity letter, distributor agreement), draft from scratch using the same two-column bilingual layout.

## Rules

1. **Two-column bilingual layout**: Arabic right, Turkish left (or EN when the counterparty is African/international). Every clause numbered identically in both languages.
2. Always include Mohammad's core protections:
   - **Client-ownership clause**: customers introduced by the agent remain the agent's — this is already in his current contract; never draft an agency agreement without it.
   - Commission **$1000/container, due upon receipt of the client's deposit** (not on delivery).
   - SGK from day one + fixed salary when it's an employment-type agreement.
3. Fill every placeholder you know from context (names, Kayseri, terms); leave `[____]` only for what's genuinely unknown, and list the blanks at the end.
4. **Mandatory footer on every document**: "Draft prepared for negotiation purposes — must be reviewed by a licensed Turkish lawyer / noter before signing." Say the same in Arabic in your reply: هاد مسودة تفاوض، مو بديل عن محامي/نوتر.
5. Output as a clean `.md` file in `documents/` (created if missing) + send it to the user. Keep clauses short — real Turkish commercial contracts are terse.
