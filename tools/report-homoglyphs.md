# Cyrillic homoglyphs found in the PDF

Characters that render like Latin letters but are not. All-caps tokens are repaired (they are acronyms); lowercase ones are preserved because at least one is a deliberate typosquatting example.

| where | found | result | action |
|---|---|---|---|
| q481 explanation | `examplе.com` | `examplе.com` | preserved (lowercase - likely intentional) |
| q646 choice A | `ЕАР` | `EAP` | repaired |
| q688 choice A | `ВРА` | `BPA` | repaired |
| q958 stem | `В` | `B` | repaired |
