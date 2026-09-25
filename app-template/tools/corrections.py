"""Manual corrections applied on top of the raw PDF extraction.

Kept separate from extract.py so that re-running the extractor never loses
them. Every entry records why the change was made and what corroborated it.

Nothing here is a guess. A key that cannot be resolved against an outside
source stays as the PDF had it and is listed in UNRESOLVED instead, so it
surfaces in the validation report rather than silently changing.

Empty in the template: the braindump app's corrections name its own question
numbers and would be wrong -- or trip the extractor's safety assert -- against
any other PDF.
"""

# qid -> (pdf_key, corrected_key, reason, corroboration)
#
#   "q0123": (["C"], ["A"],
#             "Why the PDF's key is wrong, in terms of the question itself.",
#             "The outside source that confirms the corrected key."),
#
# The extractor asserts the PDF still keys pdf_key before applying the fix,
# so a correction can never land on a question that has shifted underneath it.
KEY_CORRECTIONS = {}

# qid -> reason. Removed from the shipped bank entirely.
DROPPED = {}

# (qid, qid) -> note. Conflicts checked against outside sources without
# reaching a confident answer. Left exactly as the PDF has them and reported
# on every run.
UNRESOLVED = {}
