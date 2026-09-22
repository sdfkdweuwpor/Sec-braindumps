"""Manual corrections applied on top of the raw PDF extraction.

Kept separate from extract.py so that re-running the extractor never loses
them. Every entry records why the change was made and what corroborated it.

Nothing here is a guess. A key that cannot be resolved against an outside
source stays as the PDF had it and is listed in UNRESOLVED instead, so it
surfaces in the validation report rather than silently changing.
"""

# qid -> (pdf_key, corrected_key, reason, corroboration)
KEY_CORRECTIONS = {
    "q0357": (["C"], ["A"],
              "Duplicate of q0844, which keys A. ARP poisoning during school "
              "state testing is the textbook 'unskilled attacker' scenario -- "
              "freely available tooling, disruption motive, no insider access "
              "implied.",
              "Professor Messer SY0-701 2.1 Threat Actors; corroborating "
              "flashcard/discussion sources agree on 'Unskilled attacker'."),
    "q0513": (["A"], ["C"],
              "Duplicate of q0342, which keys C. SY0-701 objective 1.3 lists "
              "'Backout plan' explicitly as a change-management step; 'Board "
              "review' appears nowhere in the objectives.",
              "CompTIA SY0-701 objective 1.3 component list; Professor Messer "
              "1.3 Change Management."),
    "q0263": (["D"], ["A"],
              "Duplicate of q0465, which keys A. The discriminator is "
              "'low-cost': cheap IoT hardware in infrastructure carries "
              "supply-chain risk (unvetted manufacturers, firmware backdoors, "
              "no patch support). 'Storage of data' is a generic IoT concern "
              "not specific to cost.",
              "SY0-701 objective 3.1 IoT architecture considerations; "
              "corroborating exam discussion agrees on 'Country of origin'."),
}

# qid -> reason. Removed from the shipped bank entirely.
DROPPED = {
    "q0852": "Source corruption: the PDF pairs this stem (migrating to a "
             "single integrated authentication solution) with four choices "
             "belonging to a different question about anomalous user "
             "behaviour, then supplies an explanation rationalising the "
             "mismatch. q0970 is the intact copy of the same question "
             "(choices: FIDO2 passkeys / SMS OTP / SAML federation / PKI "
             "smart cards, key A). Unanswerable as printed.",
}

# Conflicts checked against outside sources without reaching a confident
# answer. Left exactly as the PDF has them and reported every run.
UNRESOLVED = {}
