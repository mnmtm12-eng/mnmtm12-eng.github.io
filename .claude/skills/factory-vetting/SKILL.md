---
name: factory-vetting
description: Due-diligence on a Turkish door factory — web research into founding year, VKN/registry, export markets, complaints, certificates, then a RED/YELLOW/GREEN verdict. Use when the user names a factory to check — افحصلي مصنع / هل هذا المصنع موثوق / factory check.
---

# Factory Vetting (Due Diligence)

Input: factory name (+ city if known). Output: filled checklist + verdict, saved to `vetting/<factory>-<date>.md` and summarized in Arabic.

## Research protocol (WebSearch/WebFetch — do ALL that apply)

1. **Official site**: "<name> çelik kapı" — real domain? catalogue? factory photos vs stock images?
2. **Registry**: search "<name> MERSİS", "<name> ticaret sicil", "<name> vergi kimlik" — founding year, legal name, VKN if surfaced.
3. **Exports**: "<name> export / ihracat", importyeti/volza-style customs-data mentions, presence in Arab/African markets, fair participation (büyükşehir fuar, Big 5 etc.).
4. **Complaints**: "<name> şikayet", şikayetvar.com, Google Maps reviews — pattern-read: non-delivery / quality / late shipment complaints weigh heaviest.
5. **Certificates**: TSE, ISO 9001, CE, fire-rating claims — verifiable or just logos on the site?
6. **Physical reality**: Google Maps — actual factory building in an OSB (organized industrial zone)? Employee count on LinkedIn?

## Verdict rules

- **GREEN**: ≥5 years old + verifiable exports + real factory + certificates + no complaint pattern.
- **YELLOW**: solid but gaps (young company, thin export history, unverifiable certs). List exactly what to verify **in person** — Mohammad is in Kayseri and can visit.
- **RED**: any of — no registry trace / no physical factory / non-delivery complaint pattern / identity mismatch between site and legal entity. Say plainly: لا تتعامل.

## Report format (`vetting/<factory>-YYYY-MM-DD.md`)

```
# <Factory> — Due Diligence — <date>
Verdict: GREEN/YELLOW/RED (one-line reason)
| Check | Finding | Source |
... (the 6 protocol rows)
## In-person checklist (if YELLOW)
## Sources
```

Findings without a source URL are marked "unverified" — never present a guess as a fact. Finish with a 3-line Arabic summary + the verdict.
