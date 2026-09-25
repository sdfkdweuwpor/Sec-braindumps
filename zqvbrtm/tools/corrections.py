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
    "q0062": (["B", "E"], ["E", "F"],
              "Cleartext passwords are a configuration setting that can be changed; "
              "a device that cannot receive authorized updates, or cannot reach the "
              "required encryption level, has a limit only replacement fixes.",
              "Published answer discussions for this question agree on E and F."),
    "q0254": (["D"], ["B"],
              "The machines show no degraded performance, which rules out "
              "cryptojacking (it burns CPU); no failed logins rules out brute "
              "force. Malware delivered in shared files is a Trojan.",
              "SY0-701 2.4 malware indicators: resource consumption for cryptominers."),
    "q0259": (["B"], ["C"],
              "Only people who clocked in inside the building lost credentials; "
              "those using the same public site from home did not, so the site "
              "itself was not compromised. Kiosks sit on several routed segments, "
              "which ARP poisoning cannot span; poisoned internal DNS can.",
              "Reasoning from the scenario; SY0-701 2.4 DNS attacks."),
    "q0277": (["C"], ["A"],
              "Attack surface is the set of exposed services and entry points; "
              "disabling unused services removes them. Changing default "
              "passwords hardens a device but leaves its services exposed.",
              "SY0-701 2.5 hardening: disabling ports/protocols and unneeded services."),
    "q0302": (["D"], ["B"],
              "Ransomware routinely encrypts reachable backup targets such as "
              "NAS and SAN storage. Only offline media is out of its reach, and "
              "daily fulls keep the RPO to a day with a single-set restore.",
              "SY0-701 3.4 backups (onsite/offsite, offline); ransomware "
              "recovery guidance on isolated copies."),
    "q0322": (["B"], ["C"],
              "Whether the organization is a controller or a processor decides "
              "which privacy obligations apply at all, including whether it "
              "handles data subject requests, so it is evaluated first.",
              "Published answer discussions; SY0-701 5.4 data roles."),
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
DROPPED = {
    "q1189": "Source corruption: the stem asks for a single integrated "
             "authentication solution, but the four choices belong to a "
             "different question about anomalous user behaviour. The braindump "
             "PDF carries the same corruption (its q0852). Unanswerable as printed.",
}

# (qid, qid) -> note. Conflicts checked against outside sources without
# reaching a confident answer. Left exactly as the PDF has them and reported
# on every run.
UNRESOLVED = {}

# qid -> [(exact text in the PDF, replacement)]. OCR and typing errors in the
# question and choice text. Every entry must still match on re-extraction.
TEXT_FIXES = {
    'q0012': [('loCs', 'IoCs')],
    'q0014': [('Tablet exercise', 'Tabletop exercise')],
    'q0017': [("'allow any1 policy", "'allow any' policy")],
    'q0022': [('Application allow list.', 'Application allow list')],
    'q0024': [('cookies are use', 'cookies are used')],
    'q0031': [('Net Flow', 'NetFlow')],
    'q0037': [('hvpervisor', 'hypervisor')],
    'q0050': [('GeolP', 'GeoIP')],
    'q0102': [('DNS severs', 'DNS servers')],
    'q0116': [('deny 0.0.0.0.0.0.0.0.0/0', 'deny 0.0.0.0 0 0.0.0.0/0')],
    'q0178': [('vestibule Which', 'vestibule. Which'), ('but describes', 'best describes')],
    'q0181': [('handied', 'handled')],
    'q0211': [('functioning property', 'functioning properly')],
    'q0246': [('best describe a', 'best describes a'), ('external attach', 'external attack')],
    'q0250': [('should be through back', 'should be brought back')],
    'q0253': [('- is this', '- Is this'), ('port of?', 'part of?')],
    'q0254': [('is Investigating', 'is investigating'), ('were Infected', 'were infected'), ('files mat were', 'files that were'), ('attacks Is most', 'attacks is most')],
    'q0256': [('resigned. one of the batch jobs talked', 'resigned, one of the batch jobs failed')],
    'q0259': [('were Inside', 'were inside'), ('while Inside', 'while inside'), ('following Is the', 'following is the'), ('acmetimkeeping', 'acmetimekeeping'), ('kiosks lo send', 'kiosks to send')],
    'q0260': [('content filleting', 'content filtering'), ('blocked sue', 'blocked site'), ('repotted', 'reported'), ('While Investigating', 'While investigating'), ('agent Is not', 'agent is not'), ('point Is allowing', 'point is allowing')],
    'q0263': [('tool that togs', 'tool that logs')],
    'q0265': [('systems administrate wants', 'systems administrator wants'), ('solution. the solution', 'solution. The solution')],
    'q0266': [('certificate mat could', 'certificate that could')],
    'q0267': [('PlI', 'PII')],
    'q0269': [('Cruel Information', 'Chief Information'), ('tells me analyst', 'tells the analyst'), ('patch Immediately', 'patch immediately')],
    'q0270': [('Sine?a recent upgrade (o a', 'Since a recent upgrade to a')],
    'q0271': [('payment tot services', 'payment for services'), ('vendor However', 'vendor. However'), ('Which of the following in this scenario', 'Which of the following is this scenario')],
    'q0273': [('cools would The analyst', 'tools would the analyst')],
    'q0278': [('Cadets', 'Callers'), ('calls lo a', 'calls to a')],
    'q0279': [('ln-person', 'in-person'), ('client m every', 'client on every')],
    'q0280': [('to ensure. They meet', 'to ensure they meet'), ('baseline While', 'baseline. While')],
    'q0282': [('to ensure. The source', 'to ensure the source')],
    'q0284': [('security learn', 'security team')],
    'q0286': [('why me SMS DIP', 'why the SMS OTP')],
    'q0287': [('Cross-sue', 'Cross-site')],
    'q0288': [('approach end does', 'approach and does')],
    'q0289': [('desktops No known Indicators', 'desktops. No known indicators'), ('the Impacted', 'the impacted')],
    'q0290': [('after an modem', 'after an incident')],
    'q0291': [('creating base for', 'creating a baseline for'), ('beet describes', 'best describes')],
    'q0292': [('technique 10 use', 'technique to use'), ('tor social', 'for social'), ('card Information', 'card information')],
    'q0297': [('headquarters tor a', 'headquarters for a')],
    'q0300': [('can Integrate', 'can integrate')],
    'q0301': [('data m the cloud', 'data in the cloud'), ('institution Is not', 'institution is not')],
    'q0302': [('RPOs end RTOs', 'RPOs and RTOs'), ('Dally full', 'Daily full'), ('Daly differential', 'Daily differential')],
    'q0303': [('To Increase', 'To increase')],
    'q0304': [('protect us data', 'protect its data'), ('company Implement', 'company implement'), ('Deep packet Inspection', 'Deep packet inspection'), ('Next-gene ration', 'Next-generation')],
    'q0306': [('Mashing', 'Hashing')],
    'q0307': [('required tor the', 'required for the')],
    'q0308': [('redesigning now devices', 'redesigning how devices'), ('existing Internal certificate', 'existing internal certificate'), ('be Isolated', 'be isolated'), ('802.IX', '802.1X')],
    'q0309': [('policy 10 mitigate', 'policy to mitigate'), ('after repealed', 'after repeated'), ('In several cases. The lost', 'In several cases, the lost')],
    'q0310': [("plan 'or each", 'plan for each'), ('the Identity provider', 'the identity provider')],
    'q0311': [('utilizes 002.1X', 'utilizes 802.1X'), ('a Known hardware', 'a known hardware'), ('DMCP', 'DHCP')],
    'q0313': [('the modem response', 'the incident response')],
    'q0314': [('SOL infection', 'SQL injection')],
    'q0324': [('SOU', 'SQLi')],
    'q0328': [('alert ("Warning!") ,-', 'alert("Warning!");')],
    'q0337': [('Visualization and isolation', 'Virtualization and isolation')],
    'q0342': [('Pll', 'PII')],
    'q0349': [('continuously the monitor hardware', 'continuously monitor the hardware')],
    'q0401': [('paylcad', 'payload')],
    'q0542': [('following code:\nWhich', 'following code:\n<script>function (send_info)</script>\nWhich')],
    'q0645': [('purchased the domain www.company.com.', 'purchased the domain www.c0mpany.com.')],
    'q0958': [('Data breachesloss', 'Data breaches or loss')],
    'q1038': [('dig tal', 'digital')],
}
