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
    "q0459": (["B"], ["C"],
              "The alert, printed in the PDF as a picture, shows the badge PC opening "
              "SMB sessions to eleven servers at once, with some connecting and "
              "some failing. That is session activity, not a run of password guesses.",
              "Transcribed exhibit; published answers for this question give concurrent session usage."),
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
    'q0286': [('why me SMS DIP', 'why the SMS OTP'), ('Generally. SMS OTP', 'Generally, SMS OTP'), ('generate on SMS OTP', 'generate an SMS OTP')],
    'q0287': [('Cross-sue', 'Cross-site'), ('different website Web server logs', 'different website. Web server logs')],
    'q0288': [('approach end does', 'approach and does')],
    'q0289': [('desktops No known Indicators', 'desktops. No known indicators'), ('the Impacted', 'the impacted')],
    'q0290': [('after an modem', 'after an incident')],
    'q0291': [('creating base for', 'creating a baseline for'), ('beet describes', 'best describes')],
    'q0292': [('technique 10 use', 'technique to use'), ('tor social', 'for social'), ('card Information', 'card information')],
    'q0297': [('headquarters tor a', 'headquarters for a'), ('Following the visit a member', 'Following the visit, a member')],
    'q0300': [('can Integrate', 'can integrate')],
    'q0301': [('data m the cloud', 'data in the cloud'), ('institution Is not', 'institution is not')],
    'q0302': [('RPOs end RTOs', 'RPOs and RTOs'), ('Dally full', 'Daily full'), ('Daly differential', 'Daily differential')],
    'q0303': [('To Increase', 'To increase'), ('best describe why', 'best describes why')],
    'q0304': [('protect us data', 'protect its data'), ('company Implement', 'company implement'), ('Deep packet Inspection', 'Deep packet inspection'), ('Next-gene ration', 'Next-generation')],
    'q0306': [('Mashing', 'Hashing')],
    'q0307': [('required tor the', 'required for the')],
    'q0308': [('redesigning now devices', 'redesigning how devices'), ('existing Internal certificate', 'existing internal certificate'), ('be Isolated', 'be isolated'), ('802.IX', '802.1X')],
    'q0309': [('policy 10 mitigate', 'policy to mitigate'), ('after repealed', 'after repeated'), ('In several cases. The lost', 'In several cases, the lost')],
    'q0310': [("plan 'or each", 'plan for each'), ('the Identity provider', 'the identity provider')],
    'q0311': [('utilizes 002.1X', 'utilizes 802.1X'), ('a Known hardware', 'a known hardware'), ('DMCP', 'DHCP')],
    'q0313': [('the modem response', 'the incident response')],
    'q0314': [('SOL infection', 'SQL injection'), ('security breach an analyst', 'security breach, an analyst')],
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
    'q0042': [('IMTTR', 'MTTR')],
    'q0123': [('send the gift cards to following email address', 'send the gift cards to the following email address')],
    'q0165': [('802.1x', '802.1X')],
    'q0251': [('Pass', 'PaaS')],
    'q0272': [('laaS', 'IaaS')],
    'q0285': [('on the company One approach would be to host a part of the Infrastructure', 'on the company. One approach would be to host a part of the infrastructure')],
    'q0293': [('Which of the following in the security administrator most likely', 'Which of the following is the security administrator most likely')],
    'q0294': [('should be Implemented', 'should be implemented')],
    'q0332': [('access badge Which', 'access badge. Which')],
    'q0895': [('a standard users two-year- old password', "a standard user's two-year-old password")],
    'q1152': [('for a company WAR an incident', 'for a company WAF, an incident'), ('observes the following:\nhttps://corporate-A.com/loadimage?filename=../../../etc/ https://corporate-A.com/loadimage?filename=../../../etc/passwd https://corporate-A.com/loadimage?filename=../../../etc/passwd Which', 'observes the following:\n```text\nhttps://corporate-A.com/loadimage?filename=../../../etc/\nhttps://corporate-A.com/loadimage?filename=../../../etc/passwd\nhttps://corporate-A.com/loadimage?filename=../../../etc/passwd\n```\nWhich')],
    'q0032': [('such as $, |, ;. &,', 'such as $, |, ;, &,')],
    'q0348': [('separate log-in. so', 'separate log-in, so')],
    'q0404': [('SIP, H.323. and SRTP', 'SIP, H.323, and SRTP')],
    'q0878': [('guest Wi-Fi. while', 'guest Wi-Fi, while')],
    'q1074': [("network's IDS. which", "network's IDS, which")],
    'q0884': [('following documentations', 'following documents')],
    'q0826': [('Uninterruptable power supply', 'Uninterruptible power supply')],
    'q0583': [('"GET ../../../../etc/passwd" Which', '```text\nGET ../../../../etc/passwd\n```\nWhich')],
    'q0419': [('PS>.\\mimikatz.exe "sekurlsa::pth /user:localadmin /domain:corp- domain.com /ntlm:B4B9B02E1F29A3CF193EAB28C8D617D3F327 Which', '```text\nPS> .\\mimikatz.exe "sekurlsa::pth /user:localadmin /domain:corp-domain.com /ntlm:B4B9B02E1F29A3CF193EAB28C8D617D3F327"\n```\nWhich')],
    'q0812': [('block PH from', 'block PHI from')],
    'q0110': [('discovers the following;', 'discovers the following:')],
    'q0421': [('fshare.int.complia.org', 'fshare.int.comptia.org')],
    'q1200': [('WEB SERVER: 192.168.1.10 DNS SERVER: 192.168.1.20 Which', 'WEB SERVER: 192.168.1.10\nDNS SERVER: 192.168.1.20\nWhich'),
              ('Insert the following rule above rule #1:', 'Insert above rule #1: PERMIT · ICMP · 0.0.0.0 · ANY → 192.168.1.0/24 · ports 53, 80, 443'),
              ('Replace rule #1 with the following:', 'Replace rule #1 with: PERMIT · TCP · 0.0.0.0 · ANY → 192.168.1.0/24 · ports 53, 443'),
              ('Replace rule #2 with the following:', 'Replace rule #2 with: PERMIT · UDP, TCP · 0.0.0.0 · ANY → 192.168.1.20 · port 53'),
              ('Insert the following rule between rule #2 and rule #3:', 'Insert between rules #2 and #3: PERMIT · TCP · 0.0.0.0 · ANY → 192.168.1.20 · port 443')],
}

# qid -> [(anchor, kind, block)]. Exhibits the PDF printed as pictures, which
# text extraction cannot see: logs, tables, code and command output. Each was
# transcribed from the page image. The block goes in right after `anchor`
# (which must occur exactly once) as a fenced block: kind "text" renders as
# monospace output, kind "table" as a table (first row is the header, cells
# split on " | ").
EXHIBITS = {
    "q0039": [("notices the following:", "text",
        "UserID jsmith, password authentication: succeeded, MFA: failed (invalid code)\n"
        "UserID jsmith, password authentication: succeeded, MFA: failed (invalid code)\n"
        "UserID jsmith, password authentication: succeeded, MFA: failed (invalid code)\n"
        "UserID jsmith, password authentication: succeeded, MFA: failed (invalid code)")],
    "q0082": [("vulnerability scanning report:", "text",
        "Server: 192.168.14.6\nService: Telnet\nPort: 23 Protocol: TCP\n"
        "Status: Open Severity: High\nVulnerability: Use of an insecure network protocol"),
              ("performs the following test:", "text",
        "nmap -p 23 192.168.14.6 --script telnet-encryption\n\n"
        "PORT     STATE SERVICE REASON\n23/tcp   open  telnet  syn-ack\n"
        "|  telnet encryption:\n|_ Telnet server supports encryption")],
    "q0110": [("discovers the following:", "table",
        "Keywords | Date and time | Source | Event ID | Task category\n" + "\n".join(
            f"Audit Failure | 09/16/2022 11:13:{s:02d} AM | Microsoft Windows security | 4625 | Logon"
            for s in range(5, 28, 2)))],
    "q0138": [("reviewing the following logs:", "text",
        "[10:00:00 AM] Login rejected - username administrator - password Spring2023\n"
        "[10:00:01 AM] Login rejected - username jsmith - password Spring2023\n"
        "[10:00:01 AM] Login rejected - username guest - password Spring2023\n"
        "[10:00:02 AM] Login rejected - username cpolk - password Spring2023\n"
        "[10:00:03 AM] Login rejected - username fmartin - password Spring2023")],
    "q0211": [("going to the web server:", "table",
        "Date | Time | Source IP | Src port | Flag | Dest IP | Dest port\n"
        "2023-01-25 | 01:45:09.102 | 98.123.45.100 | 4560 | SYN | 100.50.20.7 | 443\n"
        "2023-01-25 | 01:45:09.102 | 95.123.45.101 | 3361 | SYN | 100.50.20.7 | 443\n"
        "2023-01-25 | 01:45:09.102 | 99.123.45.102 | 3662 | SYN | 100.50.20.7 | 443\n"
        "2023-01-25 | 01:45:09.102 | 89.123.45.103 | 5663 | SYN | 100.50.20.7 | 443\n"
        "2023-01-25 | 01:45:09.102 | 98.123.45.104 | 4064 | SYN | 100.50.20.7 | 443\n"
        "2023-01-25 | 01:45:09.102 | 80.123.45.105 | 4365 | SYN | 100.50.20.7 | 443")],
    "q0293": [("recorded in the system:", "table",
        "Host | Account | MD5 password value\n"
        "ACCT-PC-1 | admin | f1bdf5ed1d7ad7ede4e3809bd35644b0\n"
        "HR-PC-1 | admin | d706ab8258fe67c131ebc57a6e28184\n"
        "IT-PC-2 | admin | f8ddb9cbb321d7dfbf6cb059736f0b3d\n"
        "FILE-SRV-1 | admin | f054bbd2f5ebab9cb5571000b2c60c02\n"
        "DB-SRV-1 | admin | 8638f732ba7cf2d95b16979e2725da78")],
    "q0298": [("from the same IP address:", "text",
        "184.168.131.241 - userA - failed authentication\n"
        "184.168.131.241 - userA - failed authentication\n"
        "184.168.131.241 - userB - failed authentication\n"
        "184.168.131.241 - userB - failed authentication\n"
        "184.168.131.241 - userC - failed authentication\n"
        "184.168.131.241 - userC - failed authentication")],
    "q0311": [("is the audit report:", "table",
        "IP address | MAC | Host | Account\n"
        "10.18.04.42 | BE-AC-11-F1-E4-44 | PC-NY | user1\n"
        "10.18.04.38 | EB-AC-11-82-42-F3 | PC-CA | user3\n"
        "10.18.04.59 | 28-BB-5A-11-52-29 | PC-PA | user2\n"
        "10.18.04.58 | 28-BB-5A-F0-E9-D1 | PC-TX | user4\n"
        "10.18.04.22 | EB-AC-11-82-42-F3 | WIN10 | user3\n"
        "10.18.04.26 | BB-28-11-21-A2-73 | PC-NJ | admin")],
    "q0385": [("from the monitoring system:", "table",
        "Server name | IP | Traffic sent | Traffic received | Status\n"
        "File01 | 10.12.14.13 | 2654812 | 23185 | Up\n"
        "DC01 | 10.12.15.2 | 168741 | 65481 | Up\n"
        "Test01 | 10.25.1.3 | 14872 | 654123168 | Down\n"
        "Test02 | 10.25.1.4 | 16941 | 651321685 | Down\n"
        "DC02 | 10.12.15.3 | 32145 | 32158 | Up\n"
        "Finance01 | 10.18.1.14 | 12374 | 6548 | Up")],
    "q0421": [("unusual snippet:", "text",
        "Log from named: post-processed 20230102 0045L\n...\n"
        "qry_source: 124.22.158.37 TCP/53\nqry_dest: 52.165.16.154 TCP/53\n"
        "qry_dest: 10.100.50.5 TCP/53\nqry_type: AXFR\n| zone int.comptia.org\n"
        "------------| www A 10.100.50.21\n------------| dns A 10.100.5.5\n"
        "------------| adds A 10.101.10.10\n------------| fshare A 10.101.10.20\n"
        "------------| sip A 10.100.5.11\n...")],
    "q0442": [("used for backing up data:", "text",
        'IF DATE() = "01/30/2023" THEN BEGIN\n  DROP DATABASE WebShopOnline;\nEND')],
    "q0446": [("following log entries:", "text",
        '67.118.34.157 - - [28/Jul/2022:10:26:59 -0300] "GET /query.php?q=wireless%20headphones / HTTP/1.0" 200 12737\n'
        "132.18.222.103 - - [28/Jul/2022:10:27:10 -0300] \"GET /query.php?q=123';INSERT INTO users VALUES('temp','pass123')# / HTTP/1.0\" 200 935\n"
        '12.45.101.121 - - [28/Jul/2022:10:27:22 -0300] "GET /query.php?q=mp3%20players / HTTP/1.0" 200 14650')],
    "q0459": [("the following details:", "table",
        "Source host | Destination host | Port | Protocol | Action\n" + "\n".join(
            f"FrontDesk1 | {d} | 445 | TCP | {a}" for d, a in [
                ("DC01", "Fail"), ("DC02", "Fail"), ("File1", "Connect"), ("File2", "Connect"),
                ("FDesk2", "Connect"), ("Office1", "Fail"), ("Exchange1", "Fail"), ("Exchange2", "Fail"),
                ("Office3", "Connect"), ("Office4", "Connect"), ("ITSupport11", "Connect")]))],
    "q0531": [("discovers the following:", "text",
        '149.32.228.10 - - [28/Jan/2023:16:32:45 -0300] "GET / HTTP/1.0"\nUser-Agent: ${/bin/sh/ id} 200 397')],
    "q0539": [("information about the server:", "table",
        "Server name | Connections | CPU | Memory | Reads/s | Writes/s\n"
        "FileSev01 | 12 | 99.6% | 97% | 50 KB/s | 100 KB/s")],
    "q0599": [("assessment of network services:", "table",
        "Record | Type | Address | TTL\n@ | A | 192.168.1.1 | 14400\nWWW | CNAME | 192.168.1.1 | 14400"),
              ("changed as follows:", "table",
        "Record | Type | Address | TTL\n@ | A | 233.123.123.23 | 14400\nWWW | CNAME | 233.123.123.23 | 14400")],
    "q0761": [("user's VPN log-ins:", "table",
        "Date | Time | Action | Source IP | City-State-Country\n"
        "2023-01-23 | 08:21:41 | Success | 207.414.201.19 | Chicago-IL-USA\n"
        "2023-01-24 | 08:23:41 | Success | 207.414.201.19 | Chicago-IL-USA\n"
        "2023-01-25 | 08:29:39 | Success | 207.414.201.19 | Chicago-IL-USA\n"
        "2023-01-26 | 08:27:44 | Success | 207.414.201.19 | Chicago-IL-USA\n"
        "2023-01-27 | 08:22:24 | Success | 207.414.201.19 | Chicago-IL-USA\n"
        "2023-01-27 | 09:45:35 | Success | 185.17.106.237 | Rome-Italy\n"
        "2023-01-27 | 09:47:55 | Success | 188.17.105.137 | Rome-Italy\n"
        "2023-01-27 | 09:55:36 | Success | 207.414.201.19 | Chicago-IL-USA\n"
        "2023-01-27 | 16:28:15 | Success | 207.414.201.19 | Chicago-IL-USA")],
    "q0799": [("contains the following logs:", "text",
        "SELECT * FROM users WHERE UserID = 1=1\n"
        "SELECT * FROM users WHERE username = 'admin'--' AND password = 'password'\n"
        "IF 1=1 THEN dbms_lock.sleep(20) ELSE dbms_lock.sleep(0); END IF; END")],
    "q0872": [("one of their salespeople:", "table",
        "Time | IP address | Location | Employee ID | App | Status\n"
        "14:02 | 72.45.38.27 | Atlanta | 25687 | VPN | Success\n"
        "14:04 | 72.45.38.27 | Atlanta | 25687 | Email | Failure\n"
        "14:07 | 58.67.47.48 | Beijing | 25687 | VPN | Success\n"
        "14:15 | 72.45.38.27 | Atlanta | 25687 | Teams | Success")],
    "q0982": [("following SIEM events:", "text",
        "[04-28-2024] 08:00:06 username: bobby successful login location: Toronto, CA src IP: 36.15.36.100\n"
        "[04-28-2024] 08:03:17 username: bobby successful login location: New York, US src IP: 69.97.63.66\n"
        "[04-28-2024] 08:05:02 username: bobby successful login location: Melbourne, AU src IP: 88.55.11.02\n"
        "[04-28-2024] 08:09:17 username: bobby successful login location: Milan, IT src IP: 98.10.22.96\n"
        "[04-28-2024] 08:11:00 username: bobby successful login location: New York, US src IP: 69.97.63.66")],
    "q1029": [("contains the following logs:", "text",
        "GET /image?filename= ../../../etc/passwd\nHost: AcmeInc.web.net\nuseragent: python-request/ 2.27.1\n\n"
        "GET /image?filename= ../../../etc/shadow\nHost: AcmeInc.web.net\nuseragent: python-request/ 2.27.1")],
    "q1071": [("receives the following output:\nThe engineer", "text",
        "C:\\User>tracert 10.100.15.20\nTracing route to [internal.resource.org] 10.100.15.20\n"
        "over a maximum of 30 hops:\n"
        "  1  200 ms  200 ms  200 ms  10.20.10.10\n  2    5 ms    3 ms    3 ms  10.20.10.1\n"
        "  3   20 ms   20 ms   10 ms  10.25.10.10\n  4   10 ms    8 ms   10 ms  10.30.110.1\n"
        "  5    5 ms    6 ms    3 ms  10.100.15.20"),
              ("following output:\nWhich", "text",
        "C:\\Engineer>tracert 10.100.15.20\nTracing route to [internal.resource.org] 10.100.15.20\n"
        "over a maximum of 30 hops:\n"
        "  1    5 ms    3 ms    3 ms  10.20.10.1\n  2   20 ms   20 ms   10 ms  10.25.10.10\n"
        "  3   10 ms    8 ms   10 ms  10.30.110.1\n  4    5 ms    6 ms    3 ms  10.100.15.20")],
    "q1074": [("following log output:", "text", "\n".join(
        f"2025-04-10T14:22:{t} | Source IP: 192.168.15.{101 + i} | Status: Failed | User: JDoe | Action: Login attempt"
        for i, t in enumerate(["01.4532", "02.1122", "02.7835", "03.5637", "04.9474", "05.5673", "06.1573", "07.7462"])))],
    "q1200": [("DNS SERVER: 192.168.1.20", "table",
        "Rule | Action | Protocol | Source IP | Source port | Destination IP | Destination port\n"
        "1 | PERMIT | TCP | 0.0.0.0 | ANY | 192.168.1.10 | 80, 443\n"
        "2 | PERMIT | UDP | 0.0.0.0 | ANY | 192.168.1.20 | 53\n"
        "3 | PERMIT | ICMP | 10.0.0.0/8 | ANY | 192.168.1.0/24 | ANY\n"
        "4 | DENY | ANY | ANY | ANY | ANY | ANY")],
    "q1249": [("in web server logs:", "text",
        '200.17.88.121 [05/May/2025:01:05:18 -0200] "GET /aboutus.htm" 200 3344\n'
        '200.17.88.121 [05/May/2025:01:08:22 -0200] "GET /corporateOrg.htm" 200 4200\n'
        '132.18.62.144 [05/May/2025:01:08:23 -0200] "GET /../../vhosts" 403 502\n'
        '200.17.88.121 [05/May/2025:01:10:33 -0200] "POST /contactUs.asp" 403 512\n'
        "118.19.200.55 [05/May/2025:01:10:45 -0200] \"POST/search\" 200 1212 \"SELECT * FROM company WHERE keyword = 'VP'\"\n"
        '105.86.13.11 [05/May/2025:01:15:45 -0200] "GET /latestContracts.htm" 404 512')],
    "q1259": [("gets the following results:", "table",
        "Vulnerability | Server location | CVSS score\n1 | Internet | 9.8\n2 | Internal | 4.0\n3 | Internet | 4.0\n4 | Internal | 9.8")],
}
