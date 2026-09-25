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
KEY_CORRECTIONS = {
    # The PDF prints a blank "Answer:" line on these four, but its own
    # explanation names the answer each time, and each matches the standard
    # SY0-701 treatment of the topic.
    "q0789": ([], ["D"],
              "Blank key in the PDF. Correlating events across many hosts is "
              "the defining job of a SIEM; the explanation says so.",
              "PDF explanation; SY0-701 4.4 (SIEM: aggregation and correlation)."),
    "q0902": ([], ["D"],
              "Blank key in the PDF. A malicious text message is smishing "
              "(SMS phishing); the explanation says so.",
              "PDF explanation; SY0-701 2.2 message-based vectors (SMS)."),
    "q0913": ([], ["D"],
              "Blank key in the PDF. Host telemetry collected, analysed and "
              "forwarded for correlation is EDR; the explanation says so.",
              "PDF explanation; SY0-701 4.5 EDR/XDR."),
    "q0935": ([], ["A"],
              "Blank key in the PDF. Preserving the requested email through "
              "a litigation hold comes first; the explanation says so.",
              "PDF explanation; SY0-701 4.8 legal hold / e-discovery."),
    # Where the two vendors key the same question differently, the answer
    # below was chosen against CompTIA's definitions; see each explanation.
    "q0219": (['B'], ['A'],
              "'Extended' outage: a UPS lasts minutes; a hot site keeps operations running.",
              "Disagreed with the braindump PDF; settled against SY0-701 definitions and published answer discussions."),
    "q0318": (['C'], ['D'],
              'Requirements ask for no personal use; COBO is the lowest-risk company-owned model.',
              "Disagreed with the braindump PDF; settled against SY0-701 definitions and published answer discussions."),
    "q0702": (['C'], ['D'],
              'Duplicate of q0318; same reasoning, COBO.',
              "Disagreed with the braindump PDF; settled against SY0-701 definitions and published answer discussions."),
    "q0369": (['B'], ['C'],
              'Attacker holds valid credentials, which unlock FDE; remote wipe still protects the data.',
              "Disagreed with the braindump PDF; settled against SY0-701 definitions and published answer discussions."),
    "q0383": (['A'], ['C'],
              'The DRP is executed immediately after a disaster to restore the IT behind essential services.',
              "Disagreed with the braindump PDF; settled against SY0-701 definitions and published answer discussions."),
    "q0396": (['D'], ['B'],
              'No vendor support means no patches, a flaw that cannot be configured away.',
              "Disagreed with the braindump PDF; settled against SY0-701 definitions and published answer discussions."),
    "q0448": (['A'], ['C'],
              'On-premises gives full control of hardware, network and data location.',
              "Disagreed with the braindump PDF; settled against SY0-701 definitions and published answer discussions."),
    "q0493": (['D'], ['B'],
              'Preventing changes is preventive; stopping errors propagating is corrective.',
              "Disagreed with the braindump PDF; settled against SY0-701 definitions and published answer discussions."),
    "q0622": (['D'], ['A'],
              "'Low-cost' points at supply-chain risk (country of origin); data storage is not cost-specific.",
              "Disagreed with the braindump PDF; settled against SY0-701 definitions and published answer discussions."),
    "q0674": (['A', 'D'], ['A', 'B'],
              'A password audit is fixed in the password policy: length and complexity.',
              "Disagreed with the braindump PDF; settled against SY0-701 definitions and published answer discussions."),
    "q0678": (['A'], ['D'],
              'Attestation is the formal confirmation that something is out of scope.',
              "Disagreed with the braindump PDF; settled against SY0-701 definitions and published answer discussions."),
    "q0682": (['D'], ['B'],
              'Cheap IoT devices are the commonest source of plaintext protocols on networks.',
              "Disagreed with the braindump PDF; settled against SY0-701 definitions and published answer discussions."),
    "q0691": (['C'], ['A'],
              'Freely available ARP tools used for disruption: unskilled attacker (see braindump q0357).',
              "Disagreed with the braindump PDF; settled against SY0-701 definitions and published answer discussions."),
    "q0773": (['A', 'C'], ['A', 'D'],
              'HTTPS is TLS again; TLS certificates plus a VPN are two distinct in-transit protections.',
              "Disagreed with the braindump PDF; settled against SY0-701 definitions and published answer discussions."),
    "q0791": (['C'], ['D'],
              'Load balancing keeps the service running through a failure; a backup needs a restore.',
              "Disagreed with the braindump PDF; settled against SY0-701 definitions and published answer discussions."),
}

# qid -> reason. Removed from the shipped bank entirely.
DROPPED = {}

# (qid, qid) -> note. Conflicts checked against outside sources without
# reaching a confident answer. Left exactly as the PDF has them and reported
# on every run.
UNRESOLVED = {}
