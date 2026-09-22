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
    "q0263": (["D"], ["A"],
              "The discriminator is 'low-cost': cheap IoT hardware in "
              "infrastructure carries supply-chain risk from unvetted "
              "manufacturers. 'Storage of data' is a generic IoT concern not "
              "specific to cost. NOTE: this was originally justified as a "
              "duplicate-key conflict with q0465, which was wrong -- q0465 "
              "shares the stem but offers different choices. The correction "
              "stands on the reasoning below, not on that comparison.",
              "SY0-701 objective 3.1 IoT architecture considerations, plus "
              "corroborating exam discussion. Supporting signal: q0465 poses "
              "the same stem and keys 'Counterfeit products' -- also a "
              "supply-chain answer, not a data-storage one."),
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
UNRESOLVED = {
    ("q0342", "q0513"):
        "Same stem, different choices, so the two are not really duplicates. "
        "q0342 keys C (Backout planning), which objective 1.3 lists "
        "explicitly. q0513 offers Management review / Load testing / "
        "Maintenance notifications / Procedure updates and keys A "
        "(Management review), which maps to the objective's 'approval "
        "process'. Both left as the PDF has them. An earlier correction "
        "here wrongly rewrote q0513's key by comparing answer letters "
        "across differing choice sets; it has been reverted.",
}
