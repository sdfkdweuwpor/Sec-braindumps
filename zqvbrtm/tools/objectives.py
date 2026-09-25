"""Canonical CompTIA Security+ SY0-701 domain and objective data.

Single source of truth for both extract.py and validate.py, and the generator
for data/domains.js -- so the Python and JS views can never drift.

Objective titles verified against multiple published copies of the official
exam objectives (Sept 2026).
"""

DOMAINS = {
    1: {"title": "General Security Concepts", "weight": 12},
    2: {"title": "Threats, Vulnerabilities, and Mitigations", "weight": 22},
    3: {"title": "Security Architecture", "weight": 18},
    4: {"title": "Security Operations", "weight": 28},
    5: {"title": "Security Program Management and Oversight", "weight": 20},
}

# objective -> (domain, title, inference keywords)
# Keywords are scored by word count, so multi-word phrases outrank generic
# single words. Keep them lowercase.
OBJECTIVES = {
"1.1": (1, "Compare and contrast various types of security controls", [
    "security control", "control category", "technical control", "managerial control",
    "operational control", "physical control", "preventive", "deterrent", "detective control",
    "corrective", "compensating control", "directive control", "types of controls",
    "control type", "describe these types of controls",
    "managerial", "operational", "technical", "physical", "security category", "control category", "belongs to", "categories does"]),
"1.2": (1, "Summarize fundamental security concepts", [
    "confidentiality", "integrity and availability", "cia triad", "non-repudiation",
    "authentication, authorization, and accounting", "aaa", "authenticating people",
    "authenticating systems", "authorization model", "gap analysis", "zero trust",
    "control plane", "data plane", "policy engine", "policy administrator",
    "policy enforcement point", "adaptive identity", "threat scope reduction",
    "implicit trust zone", "honeypot", "honeynet", "honeyfile", "honeytoken", "deception",
    "bollard", "access control vestibule", "mantrap", "fencing", "video surveillance",
    "security guard", "access badge", "infrared sensor", "pressure sensor",
    "microwave sensor", "ultrasonic sensor",
    "honeyfile", "honeytoken", "decoy", "fake account", "false file", "canary", "deceptive", "lure"]),
"1.3": (1, "Explain the importance of change management processes and the impact to security", [
    "change management", "change advisory", "approval process", "impact analysis",
    "backout plan", "maintenance window", "standard operating procedure",
    "test results", "restricted activity", "allow list", "deny list", "version control",
    "updating diagrams", "updating policies", "change request", "change ticket",
    "stakeholder", "service restart", "application restart", "legacy application",
    "dependencies",
    "design review", "change control", "change control process", "design review process", "approval", "documented process",
    "change freeze", "freeze", "maintenance window"]),
"1.4": (1, "Explain the importance of using appropriate cryptographic solutions", [
    "public key infrastructure", "pki", "public key", "private key", "key escrow",
    "full-disk encryption", "partition encryption", "file encryption", "volume encryption",
    "database encryption", "record encryption", "transport encryption",
    "asymmetric", "symmetric", "key exchange", "key length", "key generation",
    "trusted platform module", "tpm", "hardware security module", "hsm",
    "key management system", "secure enclave", "obfuscation", "steganography",
    "tokenization", "data masking", "hashing", "salting", "digital signature",
    "key stretching", "blockchain", "open public ledger", "certificate authority",
    "certificate revocation list", "crl", "ocsp", "self-signed certificate",
    "root of trust", "certificate signing request", "wildcard certificate",
    "cryptographic", "encryption algorithm", "cipher",
    "encryption level", "volume", "partition", "full disk", "full-disk", "encrypt all data", "certificate", "key pair",
    "escrow", "rotation", "key rotation", "decryption key", "key availability"]),

"2.1": (2, "Compare and contrast common threat actors and motivations", [
    "threat actor", "nation-state", "unskilled attacker", "script kiddie", "hacktivist",
    "insider threat", "organized crime", "shadow it", "advanced persistent threat",
    "attacker motivation", "data exfiltration", "espionage", "service disruption",
    "blackmail", "financial gain", "philosophical", "revenge", "ethical hacker",
    "internal threat actor", "external threat actor", "level of sophistication",
    "resources/funding", "war",
    "motivator", "motivation", "extortion", "fear", "ideological", "ethical", "does this describe", "chaos"]),
"2.2": (2, "Explain common threat vectors and attack surfaces", [
    "threat vector", "attack surface", "message-based", "phishing email", "smishing",
    "vishing", "instant messaging", "image-based attack", "file-based attack",
    "voice call", "removable device", "removable media", "usb drive", "vulnerable software",
    "client-based", "agentless", "unsupported system", "unsecure network",
    "open service port", "default credential", "supply chain attack",
    "managed service provider", "social engineering", "phishing", "misinformation",
    "disinformation", "impersonation", "business email compromise", "pretexting",
    "watering hole", "brand impersonation", "typosquatting", "spear phishing", "whaling"]),
"2.3": (2, "Explain various types of vulnerabilities", [
    "vulnerability", "memory injection", "buffer overflow", "race condition",
    "time-of-check", "time-of-use", "malicious update", "sql injection", "sqli",
    "cross-site scripting", "xss", "firmware vulnerability", "end-of-life",
    "legacy system", "virtualization vulnerability", "vm escape", "resource reuse",
    "cloud-specific", "misconfiguration", "side loading", "jailbreaking", "zero-day",
    "unpatched", "hardware vulnerability", "web-based vulnerability",
    "large language model", "llm", "hallucination", "bias", "prompt injection", "artificial intelligence", "machine learning", "model training"]),
"2.4": (2, "Given a scenario, analyze indicators of malicious activity", [
    "indicator", "ransomware", "trojan", "worm", "spyware", "bloatware", "virus",
    "keylogger", "logic bomb", "rootkit", "malware", "brute force", "rfid cloning",
    "environmental attack", "distributed denial-of-service", "ddos", "amplified",
    "reflected", "dns attack", "wireless attack", "on-path", "credential replay",
    "malicious code", "privilege escalation", "request forgery", "directory traversal",
    "downgrade attack", "collision", "birthday attack", "password spraying",
    "account lockout", "concurrent session usage", "blocked content",
    "impossible travel", "resource consumption", "resource inaccessibility",
    "out-of-cycle logging", "missing logs", "replay attack", "injection attack",
    "footprinting", "dns sinkhole", "sinkhole", "beaconing", "command and control", "c2", "lateral movement", "exfiltrating"]),
"2.5": (2, "Explain the purpose of mitigation techniques used to secure the enterprise", [
    "segmentation", "access control list", "application allow list", "isolation",
    "patching", "least privilege", "configuration enforcement", "decommissioning",
    "hardening", "endpoint detection and response", "host-based firewall",
    "host-based intrusion prevention", "disabling ports", "disabling protocols",
    "default password change", "removal of unnecessary software", "mitigate this",
    "best mitigate", "mitigation technique", "port security",
    "acl", "hids", "nips", "nids", "host-based", "network-based"]),

"3.1": (3, "Compare and contrast security implications of different architecture models", [
    "architecture model", "cloud responsibility matrix", "shared responsibility",
    "hybrid considerations", "infrastructure as code", "serverless", "microservices",
    "physical isolation", "air-gapped", "logical segmentation",
    "software-defined networking", "sdn", "on-premises", "centralized", "decentralized",
    "containerization", "container", "virtualization", "internet of things", "iot",
    "industrial control system", "scada", "real-time operating system", "rtos",
    "embedded system", "ease of deployment", "ease of recovery", "patch availability",
    "inability to patch", "scalability", "responsiveness", "risk transference",
    "compute requirement", "architecture considerations",
    "hybrid cloud", "public cloud", "private cloud", "community cloud", "platform as a service", "paas", "infrastructure as a service", "iaas", "software as a service", "saas", "ics network", "cloud deployment", "cloud environment", "cloud model", "enterprise network"]),
"3.2": (3, "Given a scenario, apply security principles to secure enterprise infrastructure", [
    "device placement", "security zone", "fail-open", "fail-closed", "failure mode",
    "active vs passive", "inline", "tap/monitor", "jump server", "proxy server",
    "intrusion prevention system", "intrusion detection system", "load balancer",
    "802.1x", "extensible authentication protocol", "eap", "web application firewall",
    "waf", "unified threat management", "utm", "next-generation firewall", "ngfw",
    "layer 4 firewall", "layer 7 firewall", "virtual private network", "vpn",
    "remote access", "tunneling", "transport layer security", "ipsec", "sd-wan",
    "secure access service edge", "sase", "network appliance", "secure infrastructure",
    "screened subnet",
    "acl", "access control list", "hids", "nips", "nids", "dmz", "network segmentation", "external attack", "perimeter"]),
"3.3": (3, "Compare and contrast concepts and strategies to protect data", [
    "data type", "regulated data", "trade secret", "intellectual property",
    "legal information", "financial information", "human-readable",
    "non-human-readable", "data classification", "sensitive data", "confidential data",
    "public data", "restricted data", "private data", "critical data", "data at rest",
    "data in transit", "data in use", "data sovereignty", "geolocation",
    "geographic restriction", "data masking", "protect data", "classify",
    "classification level", "data state",
    "classification", "confidential", "restricted", "proprietary", "classify the data", "data label"]),
"3.4": (3, "Explain the importance of resilience and recovery in security architecture", [
    "high availability", "load balancing", "clustering", "hot site", "cold site",
    "warm site", "geographic dispersion", "platform diversity", "multi-cloud",
    "continuity of operations", "capacity planning", "tabletop exercise", "fail over",
    "failover", "parallel processing", "onsite backup", "offsite backup",
    "backup frequency", "snapshot", "replication", "journaling", "generator",
    "uninterruptible power supply", "ups", "resilience", "recovery", "redundancy",
    "redundant", "disaster recovery", "restore"]),

"4.1": (4, "Given a scenario, apply common security techniques to computing resources", [
    "secure baseline", "hardening target", "site survey", "heat map",
    "mobile device management", "mdm", "bring your own device", "byod",
    "corporate-owned, personally enabled", "cope", "choose your own device", "cyod",
    "wpa3", "radius", "wireless security setting", "input validation", "secure cookie",
    "static code analysis", "code signing", "sandboxing", "application security",
    "deployment model", "cellular", "wi-fi", "bluetooth", "harden"]),
"4.2": (4, "Explain the security implications of proper hardware, software, and data asset management", [
    "asset management", "acquisition", "procurement process", "asset tracking",
    "inventory", "enumeration", "disposal", "decommissioning", "sanitization",
    "destruction", "certificate of destruction", "data retention", "asset ownership",
    "asset classification", "media sanitization", "degaussing", "shredding", "wiping"]),
"4.3": (4, "Explain various activities associated with vulnerability management", [
    "vulnerability scan", "vulnerability management", "static analysis",
    "dynamic analysis", "package monitoring", "threat feed",
    "open-source intelligence", "osint", "dark web", "penetration testing",
    "responsible disclosure", "bug bounty", "false positive", "false negative",
    "true positive", "true negative", "common vulnerability scoring system", "cvss",
    "common vulnerabilities and exposures", "cve", "exposure factor",
    "environmental variable", "risk tolerance", "compensating control",
    "exceptions and exemptions", "rescanning", "remediation", "vulnerability response",
    "prioritize", "patching",
    "nessus", "nmap", "wireshark", "netcat", "openvas", "metasploit", "burp suite", "scanning tool", "credentialed scan", "port scan"]),
"4.4": (4, "Explain security alerting and monitoring concepts and tools", [
    "log aggregation", "alerting", "archiving", "alert response", "quarantine",
    "alert tuning", "security content automation protocol", "scap", "benchmark",
    "agent-based monitoring", "agentless monitoring",
    "security information and event management", "siem", "antivirus",
    "data loss prevention", "dlp", "simple network management protocol", "snmp trap",
    "netflow", "vulnerability scanner", "monitoring computing resources",
    "monitor", "dashboard alert"]),
"4.5": (4, "Given a scenario, modify enterprise capabilities to enhance security", [
    "firewall rule", "access list", "ids signature", "ips signature", "web filter",
    "centralized proxy", "url scanning", "content categorization", "block rule",
    "reputation", "group policy", "selinux", "secure protocol", "protocol selection",
    "port selection", "dns filtering", "domain-based message authentication", "dmarc",
    "domainkeys identified mail", "dkim", "sender policy framework", "spf",
    "email gateway", "file integrity monitoring", "network access control", "nac",
    "extended detection and response", "xdr", "user behavior analytics",
    "operating system security", "email security"]),
"4.6": (4, "Given a scenario, implement and maintain identity and access management", [
    "provisioning user account", "de-provisioning", "permission assignment",
    "identity proofing", "federation", "single sign-on", "sso",
    "lightweight directory access protocol", "ldap", "oauth",
    "security assertions markup language", "saml", "openid", "attestation",
    "mandatory access control", "discretionary access control", "role-based access",
    "rule-based access", "attribute-based access", "time-of-day restriction",
    "multifactor authentication", "mfa", "biometric", "hard authentication token",
    "soft authentication token", "security key", "something you know",
    "something you have", "something you are", "somewhere you are", "password policy",
    "password complexity", "password reuse", "password expiration", "password age",
    "password manager", "passwordless", "privileged access management",
    "just-in-time permission", "password vaulting", "ephemeral credential",
    "least privilege", "access control model", "identity and access management"]),
"4.7": (4, "Explain the importance of automation and orchestration related to secure operations", [
    "automation", "orchestration", "scripting", "user provisioning",
    "resource provisioning", "guard rail", "security group", "ticket creation",
    "escalation", "continuous integration", "application programming interface", "api",
    "enforcing baseline", "standard infrastructure configuration", "workforce multiplier",
    "technical debt", "ongoing supportability", "single point of failure", "playbook automation",
    "automate", "automated"]),
"4.8": (4, "Explain appropriate incident response activities", [
    "incident response", "preparation", "detection", "containment", "eradication",
    "lessons learned", "root cause analysis", "threat hunting", "digital forensics",
    "legal hold", "chain of custody", "acquisition", "preservation", "e-discovery",
    "incident response plan", "incident response process", "forensic", "simulation exercise",
    "post-incident", "post-incident review", "root cause", "incident review", "after an incident", "tabletop"]),
"4.9": (4, "Given a scenario, use data sources to support an investigation", [
    "firewall log", "application log", "endpoint log", "os-specific security log",
    "ips log", "ids log", "network log", "metadata", "automated report",
    "packet capture", "log data", "support an investigation", "investigate",
    "review the logs", "log file", "dashboard",
    "which of the following logs", "logs would", "log would", "reviewing the logs", "log source", "syslog", "audit log",
    "web server log", "ip address", "log entries", "entries in", "following entries", "server logs"]),

"5.1": (5, "Summarize elements of effective security governance", [
    "governance", "acceptable use policy", "aup", "information security policy",
    "business continuity policy", "disaster recovery policy",
    "software development lifecycle", "sdlc", "password standard",
    "access control standard", "physical security standard", "encryption standard",
    "onboarding", "offboarding", "playbook", "regulatory consideration",
    "governance structure", "audit committee", "board", "data owner",
    "data controller", "data processor", "data custodian", "data steward",
    "roles and responsibilities", "guideline", "procedure", "policy",
    "business continuity plan", "bcp", "disaster recovery plan", "drp", "incident response plan", "irp", "communication plan", "continuity of operations plan", "coop", "plan should"]),
"5.2": (5, "Explain elements of the risk management process", [
    "risk identification", "risk assessment", "ad hoc", "recurring",
    "qualitative risk", "quantitative risk", "single loss expectancy", "sle",
    "annualized loss expectancy", "ale", "annualized rate of occurrence", "aro",
    "probability", "likelihood", "exposure factor", "risk register",
    "key risk indicator", "risk owner", "risk threshold", "risk tolerance",
    "risk appetite", "expansionary", "conservative", "neutral", "risk transfer",
    "risk acceptance", "risk avoidance", "risk mitigation", "risk reporting",
    "business impact analysis", "recovery time objective", "rto",
    "recovery point objective", "rpo", "mean time to repair", "mttr",
    "mean time between failures", "mtbf", "cyber insurance", "risk analysis",
    "risk management strategy",
    "residual risk", "inherent risk", "risk avoidance", "appetite", "threshold", "register", "residual", "inherent", "loss expectancy"]),
"5.3": (5, "Explain the processes associated with third-party risk assessment and management", [
    "vendor assessment", "right-to-audit", "evidence of internal audits",
    "independent assessment", "supply chain analysis", "vendor selection",
    "due diligence", "conflict of interest", "service-level agreement", "sla",
    "memorandum of agreement", "moa", "memorandum of understanding", "mou",
    "master service agreement", "msa", "statement of work", "sow", "work order",
    "non-disclosure agreement", "nda", "business partners agreement", "bpa",
    "vendor monitoring", "questionnaire", "rules of engagement", "third-party",
    "vendor", "supplier", "agreement type",
    "contractor", "outsourcing", "external partner"]),
"5.4": (5, "Summarize elements of effective security compliance", [
    "compliance reporting", "non-compliance", "fine", "sanction",
    "reputational damage", "loss of license", "contractual impact",
    "compliance monitoring", "due care", "acknowledgement", "privacy",
    "legal implication", "data subject", "right to be forgotten",
    "data inventory", "general data protection regulation", "gdpr",
    "payment card industry", "pci dss", "hipaa", "sarbanes-oxley",
    "regulatory requirement", "compliance",
    "data privacy", "personally identifiable information", "pii", "regulation", "legal hold requirement"]),
"5.5": (5, "Explain types and purposes of audits and assessments", [
    "audit", "attestation", "internal audit", "compliance audit",
    "self-assessment", "external audit", "regulatory examination",
    "independent third-party audit", "physical penetration test",
    "offensive penetration", "defensive penetration", "integrated penetration",
    "known environment", "partially known environment", "unknown environment",
    "passive reconnaissance", "active reconnaissance", "reconnaissance", "assessment",
    "red team", "blue team", "purple team", "white team", "offensive testing", "defensive testing", "team combines", "testing techniques"]),
"5.6": (5, "Given a scenario, implement security awareness practices", [
    "security awareness", "phishing campaign", "recognizing a phishing attempt",
    "reported suspicious message", "anomalous behavior", "risky behavior",
    "unexpected behavior", "unintentional behavior", "user guidance", "handbook",
    "situational awareness", "insider threat training", "removable media and cables",
    "operational security", "hybrid work", "remote work environment",
    "awareness training", "security training", "user training", "employee training",
    "training program", "educate users", "user awareness"]),
}


def objectives_for_domain(d):
    return {k: v for k, v in OBJECTIVES.items() if v[0] == d}


def infer_objective(text):
    """Score every objective's keywords against `text`.

    Returns (objective, domain, confidence). Confidence is the winning score's
    share of total scored weight -- a low value means several objectives matched
    about equally and the pick is weak.
    """
    t = " " + text.lower() + " "
    scores = {}
    for obj, (dom, _title, kws) in OBJECTIVES.items():
        s = 0
        for kw in kws:
            if kw in t:
                # weight by specificity: word count squared, so multi-word
                # phrases decisively outrank incidental single words
                s += len(kw.split()) ** 2
        if s:
            scores[obj] = s
    if not scores:
        return None, None, 0.0
    best = max(scores, key=lambda k: (scores[k], -float(k)))
    total = sum(scores.values())
    return best, OBJECTIVES[best][0], round(scores[best] / total, 3)
