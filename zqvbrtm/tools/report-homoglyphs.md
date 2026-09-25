# Cyrillic homoglyphs found in the PDF

Characters that render like Latin letters but are not. All-caps tokens are repaired (they are acronyms); lowercase ones are preserved because at least one is a deliberate typosquatting example.

| where | found | result | action |
|---|---|---|---|
| q835 explanation | `examplе.com` | `examplе.com` | preserved (lowercase - likely intentional) |
| q988 choice A | `ЕАР` | `EAP` | repaired |
| q1025 choice A | `ВРА` | `BPA` | repaired |
