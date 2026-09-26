#!/usr/bin/env python3
"""Extract questions from the PDF in source/ into the canonical schema used
by the app.

TEMPLATE NOTE: the parsing below is tuned to the Security+ braindump PDF
this template was copied from -- its page furniture (FURNITURE), its
"QUESTION: n" / "Answer:" / "Explanation:" layout and its homoglyphs. A PDF
from another source will almost certainly need those adjusted. Run it,
read the block count and validate.py output, and fix the parser before
trusting a single answer key.

Build-time only -- nothing here ships. Run from the repo root:

    python3 tools/extract.py

Writes data/domain{1..5}.js, data/index.js, data/questions.json,
data/unsupported.js and tools/report-missing-explanations.md.
"""
import json
import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import objectives as OBJ  # noqa: E402
import corrections as FIX  # noqa: E402
import acronyms as ACR  # noqa: E402


def _no_duplicate_keys():
    """A dict literal silently keeps only the last of two equal keys, which
    once dropped earlier fixes for the same question. Refuse to run instead."""
    import ast
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "corrections.py")
    for node in ast.parse(open(path, encoding="utf-8").read()).body:
        if isinstance(node, ast.Assign) and isinstance(node.value, ast.Dict):
            keys = [k.value for k in node.value.keys if isinstance(k, ast.Constant)]
            dup = sorted({k for k in keys if keys.count(k) > 1})
            if dup:
                raise SystemExit(f"corrections.{node.targets[0].id} lists {dup} twice; merge the entries")


_no_duplicate_keys()


def load_authored():
    """Merge hand-written explanations from tools/authored/*.json.

    Kept outside the extractor's output so re-running extraction never loses
    them. Each file maps question id -> {"explanation": str,
    "incorrect": {choiceKey: str}}.
    """
    import glob
    out = {}
    for path in sorted(glob.glob(os.path.join(TOOLS, "authored", "*.json"))):
        with open(path) as f:
            data = json.load(f)
        for qid, rec in data.items():
            if qid in out:
                raise SystemExit(f"{qid} is authored twice (second copy in {path})")
            out[qid] = rec
    return out


AUTHORED = None


def load_tips():
    """Exam tips from tools/tips/*.json: question id -> a sentence or two on
    how to recognize what the question is testing. Kept apart from the
    explanations so either can change without touching the other."""
    import glob
    out = {}
    for path in sorted(glob.glob(os.path.join(TOOLS, "tips", "*.json"))):
        with open(path) as f:
            data = json.load(f)
        for qid, tip in data.items():
            if qid in out:
                raise SystemExit(f"{qid} has two tips (second copy in {path})")
            out[qid] = tip.strip()
    return out


TIPS = None

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, "source")


def find_pdf():
    """The one PDF in source/. Refuses to guess between several."""
    import glob
    pdfs = sorted(glob.glob(os.path.join(SOURCE, "*.pdf")))
    if len(pdfs) != 1:
        raise SystemExit(
            f"expected exactly one PDF in {SOURCE}, found {len(pdfs)}"
            + (": " + ", ".join(os.path.basename(p) for p in pdfs) if pdfs else ""))
    return pdfs[0]


PDF = None        # resolved by build(); only the parser needs it
DATA = os.path.join(ROOT, "data")
TOOLS = os.path.join(ROOT, "tools")

# Running header / footer furniture, stripped per line. These interleave in the
# middle of questions because questions span page breaks.
FURNITURE = [
    # Lead2Pass page header and footer, repeated on every page.
    re.compile(r"^Get Latest & Actual SY0-701 Exam's Question and Answers from Lead2pass\.$"),
    re.compile(r"^https://www\.lead2pass\.com$", re.I),
    re.compile(r"^\d{1,4}$"),
    re.compile(r"^$"),
]

# Cyrillic characters that render identically to Latin ones. The PDF contains a
# handful inside acronyms (A. ЕАР should read EAP), which would otherwise make
# the choice text unsearchable. One instance is deliberate -- a lowercase е in
# "examplе.com" demonstrating typosquatting -- so only all-caps tokens are
# transliterated and everything else is reported.
HOMOGLYPHS = {
    "А": "A", "В": "B", "Е": "E", "К": "K", "М": "M",
    "Н": "H", "О": "O", "Р": "P", "С": "C", "Т": "T",
    "Х": "X", "а": "a", "е": "e", "о": "o", "р": "p",
    "с": "c", "х": "x",
}
CYRILLIC = re.compile(r"[Ѐ-ӿ]")

# Case-SENSITIVE on purpose. These are all-caps section headers in the PDF;
# matching case-insensitively also hits the ordinary word "simulation" in
# incident-response prose and wrongly excludes valid multiple-choice questions.
PBQ_MARKERS = re.compile(
    r"\bHOTSPOT\b|\bDRAG DROP\b|\bSIMULATION\b|See Explanation section|Hot Area")

homoglyph_log = []


def normalize(text, where=""):
    """Clean PDF artifacts without damaging meaningful content."""
    # Targeted homoglyph repair: all-caps tokens only (acronyms, "Company B").
    def fix_token(m):
        tok = m.group(0)
        stripped = re.sub(r"[^\w]", "", tok)
        if stripped and stripped == stripped.upper():
            fixed = "".join(HOMOGLYPHS.get(c, c) for c in tok)
            homoglyph_log.append((where, tok, fixed, "repaired"))
            return fixed
        homoglyph_log.append((where, tok, tok, "preserved (lowercase - likely intentional)"))
        return tok

    text = re.sub(r"\S*[Ѐ-ӿ]\S*", fix_token, text)

    # Quotes and dashes -> ASCII. Keep en/em dashes as-is where they are real
    # punctuation; only the odd U+2010 hyphen is folded to ASCII.
    text = (text.replace("‘", "'").replace("’", "'")
                .replace("“", '"').replace("”", '"')
                .replace("‐", "-"))
    # Bullet variants -> one consistent marker. These are meaningful: they mark
    # requirement lists inside question stems, so they are kept, not stripped.
    text = re.sub(r"[●▪◦]", "•", text)
    # Ligatures, if any survive.
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


SENTENCE_END = re.compile(r"[.!?:;]['\")\]]?$")
BULLET_START = re.compile(r"^[\u2022\u25cf\u25aa\u25e6-]\s")


def unwrap(text):
    """Rejoin lines the PDF hard-wrapped, keeping deliberate breaks.

    The source wraps prose at a fixed column, so a stem arrives as
    "...installation of a RADIUS\nserver?" and renders with a break mid
    sentence. A line is joined to the one above unless that line ended a
    sentence, or either line is a bullet -- which keeps requirement lists and
    the scenario/question split intact.
    """
    lines = [l for l in text.split("\n")]
    out = []
    for line in lines:
        if not line.strip():
            out.append("")
            continue
        if (out and out[-1].strip()
                and not SENTENCE_END.search(out[-1].strip())
                and not BULLET_START.match(line.strip())
                and not out[-1].strip().endswith(":")):
            out[-1] = out[-1].rstrip() + " " + line.strip()
        else:
            out.append(line.strip())
    return "\n".join(out).strip()


def load_lines():
    """Return [(line, page_number)] with page furniture removed.

    Parsing the PDF takes a couple of minutes. Set EXTRACT_CACHE to a file
    path to keep the parsed lines between runs (reused only while the PDF's
    size and modification time are unchanged).
    """
    cache = os.environ.get("EXTRACT_CACHE")
    stamp = [os.path.getsize(PDF), os.path.getmtime(PDF)]
    if cache and os.path.exists(cache):
        with open(cache) as f:
            saved = json.load(f)
        if saved.get("stamp") == stamp:
            return [tuple(x) for x in saved["lines"]]
    import pdfplumber
    out = []
    with pdfplumber.open(PDF) as pdf:
        for pageno, page in enumerate(pdf.pages, start=1):
            for raw in (page.extract_text() or "").split("\n"):
                line = raw.strip()
                if any(p.match(line) for p in FURNITURE):
                    continue
                out.append((line, pageno))
    if cache:
        with open(cache, "w") as f:
            json.dump({"stamp": stamp, "lines": out}, f)
    return out


CHOICE_RE = re.compile(r"^(?:[•●▪◦]\s*)?([A-H])\.\s+(.*)$")
# "Answer: AD" -- the letters run together on multi-answer questions.
ANSWER_RE = re.compile(r"^Answer:\s*([A-H]*)\s*$")
QUESTION_RE = re.compile(r"^QUESTION\s*:?\s*(\d+)\s*$")


def split_questions(lines):
    blocks, cur, num, page = [], [], None, None
    for line, pg in lines:
        m = QUESTION_RE.match(line)
        if m:
            if num is not None:
                blocks.append((num, page, cur))
            num, page, cur = int(m.group(1)), pg, []
        elif num is not None:
            cur.append((line, pg))
    if num is not None:
        blocks.append((num, page, cur))
    return blocks


def parse_block(num, page, body):
    """Turn one QUESTION block into the canonical record."""
    stem, choices, answer, explanation = [], [], None, []
    mode = "stem"
    for line, _pg in body:
        if ANSWER_RE.match(line):
            answer = ANSWER_RE.match(line).group(1)
            mode = "post"
            continue
        if line.startswith("Explanation:"):
            mode = "explanation"
            rest = line[len("Explanation:"):].strip()
            if rest:
                explanation.append(rest)
            continue
        if mode == "explanation":
            explanation.append(line)
            continue
        if mode == "post":
            # Stray text between the key and an Explanation header; keep it
            # out of the record rather than guessing where it belongs.
            continue
        cm = CHOICE_RE.match(line)
        if cm:
            choices.append([cm.group(1), cm.group(2)])
            mode = "choices"
        elif mode == "choices" and choices:
            choices[-1][1] += " " + line          # wrapped choice text
        else:
            stem.append(line)

    qtext = unwrap(normalize("\n".join(stem), f"q{num} stem"))
    parsed_choices = [{"key": k, "text": unwrap(normalize(t, f"q{num} choice {k}"))}
                      for k, t in choices]
    correct = re.findall(r"[A-H]", answer or "")
    exp = unwrap(normalize("\n".join(explanation), f"q{num} explanation")) or None
    # A duplicated "Explanation:" header appears inside a few bodies.
    if exp:
        exp = re.sub(r"^Explanation:\s*", "", exp).strip() or None

    return {
        "id": f"q{num:04d}",
        "number": num,
        "question": qtext,
        "choices": parsed_choices,
        "correct": correct,
        "explanation": exp,
        "page": page,
    }


def apply_text_fixes(rec):
    """Repair the PDF's OCR and typing errors in the text students read.

    Fixes are exact substring replacements listed per question in
    corrections.TEXT_FIXES; each must match, so a fix can never silently
    stop applying after re-extraction. Choices that exactly duplicate an
    earlier choice (a PDF defect) are removed, unless one is keyed.
    """
    for old, new in FIX.TEXT_FIXES.get(rec["id"], []):
        hits = rec["question"].count(old) + sum(c["text"].count(old) for c in rec["choices"])
        if not hits:
            raise SystemExit(f"{rec['id']}: text fix {old!r} no longer matches")
        rec["question"] = rec["question"].replace(old, new)
        for c in rec["choices"]:
            c["text"] = c["text"].replace(old, new)
    # Two layout defects the PDF repeats: a hyphen left dangling by a line
    # wrap ("company- owned"), and the last bullet of a list running straight
    # into the question ("- Storage scalability Which of the following").
    rec["question"] = re.sub(r"(\w)- (\w)", r"\1-\2", rec["question"])
    for c in rec["choices"]:
        c["text"] = re.sub(r"(\w)- (\w)", r"\1-\2", c["text"])
    if re.search(r"^- ", rec["question"], re.M):
        rec["question"] = re.sub(r"(\n- [^\n]*?[a-z0-9)]) (Which of the following)", r"\1\n\2", rec["question"])
    seen, kept = set(), []
    for c in rec["choices"]:
        t = " ".join(c["text"].lower().split())
        if t in seen and c["key"] not in (rec["correct"] or []):
            continue
        seen.add(t)
        kept.append(c)
    rec["choices"] = kept


def apply_exhibits(rec):
    """Put back the exhibits the PDF printed as pictures (corrections.EXHIBITS).

    Each block is inserted as a fenced block right after its anchor text,
    which must appear exactly once so a re-extraction can never misplace it.
    """
    for anchor, kind, block in getattr(FIX, "EXHIBITS", {}).get(rec["id"], []):
        n = rec["question"].count(anchor)
        if n != 1:
            raise SystemExit(f"{rec['id']}: exhibit anchor {anchor!r} matches {n} times")
        rec["question"] = rec["question"].replace(
            anchor, f"{anchor}\n```{kind}\n{block.strip(chr(10))}\n```", 1)


def _acronym_rules():
    rules = []
    for acr, phrases in ACR.CONVERT.items():
        for ph in phrases:
            words = re.split(r"[\s-]+", ph)
            body = r"[\s-]+".join(re.escape(w) for w in words)
            pat = re.compile(
                r"(?:\b(?P<art>an?)\s+)?\b(?P<ph>" + body + r")(?P<pl>s|es)?\b"
                + r"(?:\s*\(" + re.escape(acr) + r"s?\))?",
                re.I)
            rules.append((len(ph), pat, acr))
    rules.sort(key=lambda r: -r[0])
    return rules


ACRONYM_RULES = None
ACRONYM_LOG = Counter()


def apply_acronyms(rec):
    """Write spelled-out terms as acronyms, the way the exam does (FDE, not
    full disk encryption). Exhibits are left exactly as transcribed."""
    global ACRONYM_RULES
    if ACRONYM_RULES is None:
        ACRONYM_RULES = _acronym_rules()

    def convert(text):
        parts = re.split(r"(```\w*\n[\s\S]*?\n```)", text)
        for i in range(0, len(parts), 2):
            seg = parts[i]
            for _, pat, acr in ACRONYM_RULES:
                def sub(m, acr=acr):
                    ACRONYM_LOG[acr] += 1
                    out = acr + ("s" if m.group("pl") else "")
                    if m.group("art"):
                        art = ACR.article(acr)
                        if m.group("art")[0].isupper():
                            art = art.capitalize()
                        out = f"{art} {out}"
                    return out
                seg = pat.sub(sub, seg)
            parts[i] = seg
        return "".join(parts)

    rec["question"] = convert(rec["question"])
    for c in rec["choices"]:
        c["text"] = convert(c["text"])


def write_acronyms_js():
    body = json.dumps(ACR.ACRONYMS, indent=1, ensure_ascii=False, sort_keys=True)
    with open(os.path.join(DATA, "acronyms.js"), "w", encoding="utf-8") as f:
        f.write("// GENERATED by tools/extract.py from tools/acronyms.py -- do not edit by hand.\n\n"
                "/** Acronym -> what it stands for, for the Show acronyms panel. */\n"
                f"export const ACRONYMS = {body};\n")


def build():
    global AUTHORED, TIPS, PDF
    PDF = PDF or find_pdf()
    src = os.path.basename(PDF)
    if AUTHORED is None:
        AUTHORED = load_authored()
    if TIPS is None:
        TIPS = load_tips()
    lines = load_lines()
    blocks = split_questions(lines)
    print(f"blocks found: {len(blocks)}")

    supported, unsupported = [], []
    for num, page, body in blocks:
        raw = "\n".join(l for l, _ in body)
        rec = parse_block(num, page, body)
        apply_text_fixes(rec)
        apply_exhibits(rec)
        apply_acronyms(rec)

        if PBQ_MARKERS.search(raw) or len(rec["choices"]) < 2:
            unsupported.append({
                "id": rec["id"],
                "number": num,
                "reason": ("performance-based (hotspot/drag-drop/simulation)"
                           if PBQ_MARKERS.search(raw) else
                           f"only {len(rec['choices'])} parsed choice(s)"),
                "question": rec["question"][:400],
                "source": f"{src}#p{page}",
            })
            continue

        if rec["id"] in FIX.DROPPED:
            unsupported.append({
                "id": rec["id"], "number": num,
                "reason": "dropped by correction: " + FIX.DROPPED[rec["id"]],
                "question": rec["question"][:400],
                "source": f"{src}#p{page}",
            })
            continue

        corrected = False
        if rec["id"] in FIX.KEY_CORRECTIONS:
            pdf_key, fixed_key, _reason, _src = FIX.KEY_CORRECTIONS[rec["id"]]
            assert rec["correct"] == pdf_key, (
                f"{rec['id']}: correction expects PDF key {pdf_key} but the "
                f"extractor read {rec['correct']} -- re-check the correction")
            rec["correct"] = list(fixed_key)
            corrected = True

        authored = AUTHORED.get(rec["id"])
        incorrect = {}
        exp_source = "pdf" if rec["explanation"] else None
        if authored:
            if authored.get("explanation"):
                # Authored text replaces the PDF's, per the decision to
                # normalise every explanation to one voice.
                exp_source = "pdf+authored" if rec["explanation"] else "authored"
                rec["explanation"] = authored["explanation"]
            incorrect = authored.get("incorrect", {}) or {}
            valid = {c["key"] for c in rec["choices"]} - set(rec["correct"])
            bad = set(incorrect) - valid
            if bad:
                raise SystemExit(
                    f"{rec['id']}: authored notes for {sorted(bad)} which are "
                    f"not wrong-answer choices (choices "
                    f"{sorted(c['key'] for c in rec['choices'])}, "
                    f"correct {rec['correct']})")

        # An authored objective is a human read of the question, so it wins
        # over inference and brings its domain with it.
        text_for_inference = rec["question"] + " " + " ".join(
            c["text"] for c in rec["choices"])
        obj, dom, conf = OBJ.infer_objective(text_for_inference)
        title = OBJ.OBJECTIVES[obj][1] if obj else None

        auth_obj = (authored or {}).get("objective") or obj
        if (authored or {}).get("objective") and auth_obj not in OBJ.OBJECTIVES:
            raise SystemExit(f"{rec['id']}: authored objective {auth_obj!r} is not a real SY0-701 objective")
        # No keyword matched and nobody has classified it yet: leave it
        # unplaced (validate.py fails on it) rather than guess a domain.
        auth_dom = OBJ.OBJECTIVES[auth_obj][0] if auth_obj else None
        auth_title = OBJ.OBJECTIVES[auth_obj][1] if auth_obj else None

        supported.append({
            "id": rec["id"],
            "domain": auth_dom,
            "objective": auth_obj,
            "objectiveTitle": auth_title,
            "type": "multi" if len(rec["correct"]) > 1 else "single",
            "question": rec["question"],
            "choices": rec["choices"],
            "correct": rec["correct"],
            "explanation": rec["explanation"],
            "explanationSource": exp_source,
            "incorrectExplanations": incorrect,
            "tip": TIPS.get(rec["id"]),
            "references": [],
            "source": f"{src}#p{rec['page']}",
            # An authored record means a human read the question, so its
            # domain is confirmed rather than inferred.
            "needsReview": not (authored and authored.get("objective")),
            "inferenceConfidence": conf,
            "needsExplanation": rec["explanation"] is None,
            "keyCorrected": corrected,
        })

    return supported, unsupported


def write_outputs(questions, unsupported):
    os.makedirs(DATA, exist_ok=True)
    write_acronyms_js()
    banner = ("// GENERATED by tools/extract.py -- do not edit by hand.\n"
              "// Re-run the extractor instead; see README.\n\n")

    by_domain = defaultdict(list)
    for q in questions:
        by_domain[q["domain"] or 0].append(q)

    for d in range(1, 6):
        rows = by_domain.get(d, [])
        path = os.path.join(DATA, f"domain{d}.js")
        with open(path, "w") as f:
            f.write(banner)
            f.write(f"export const domain{d}Questions = ")
            f.write(json.dumps(rows, indent=2, ensure_ascii=False))
            f.write(";\n")
        print(f"  data/domain{d}.js: {len(rows)} questions")

    with open(os.path.join(DATA, "index.js"), "w") as f:
        f.write(banner)
        for d in range(1, 6):
            f.write(f"import {{ domain{d}Questions }} from './domain{d}.js';\n")
        f.write("\nexport const ALL_QUESTIONS = [\n")
        f.write("".join(f"  ...domain{d}Questions,\n" for d in range(1, 6)))
        f.write("];\n\nexport const QUESTIONS_BY_ID = new Map(\n"
                "  ALL_QUESTIONS.map((q) => [q.id, q])\n);\n")

    with open(os.path.join(DATA, "questions.json"), "w") as f:
        json.dump(questions, f, indent=2, ensure_ascii=False)

    with open(os.path.join(DATA, "unsupported.js"), "w") as f:
        f.write(banner)
        f.write("// Performance-based and non-multiple-choice items the schema\n"
                "// intentionally does not model. Not loaded by the app.\n\n")
        f.write("export const UNSUPPORTED_QUESTIONS = ")
        f.write(json.dumps(unsupported, indent=2, ensure_ascii=False))
        f.write(";\n")

    # domains.js generated from the Python source of truth
    with open(os.path.join(DATA, "domains.js"), "w") as f:
        f.write(banner)
        f.write("export const DOMAINS = ")
        f.write(json.dumps(
            {str(k): {"id": k, "title": v["title"], "weight": v["weight"]}
             for k, v in OBJ.DOMAINS.items()}, indent=2, ensure_ascii=False))
        f.write(";\n\nexport const OBJECTIVES = ")
        f.write(json.dumps(
            {k: {"id": k, "domain": v[0], "title": v[1]}
             for k, v in OBJ.OBJECTIVES.items()}, indent=2, ensure_ascii=False))
        f.write(";\n\nexport const OBJECTIVES_BY_DOMAIN = ")
        f.write(json.dumps(
            {str(d): [k for k, v in OBJ.OBJECTIVES.items() if v[0] == d]
             for d in OBJ.DOMAINS}, indent=2, ensure_ascii=False))
        f.write(";\n")


def write_reports(questions, unsupported):
    missing = [q for q in questions if q["needsExplanation"]]
    with open(os.path.join(TOOLS, "report-missing-explanations.md"), "w") as f:
        f.write("# Questions with no explanation in the source PDF\n\n")
        f.write(f"{len(missing)} of {len(questions)} extracted questions.\n\n")
        f.write("These carry `explanation: null` and `needsExplanation: true`. "
                "Nothing was invented at extraction time.\n\n")
        f.write("| id | domain | objective | question |\n|---|---|---|---|\n")
        for q in missing:
            stem = q["question"].replace("\n", " ").replace("|", "\\|")[:110]
            f.write(f"| {q['id']} | {q['domain']} | {q['objective']} | {stem} |\n")

    with open(os.path.join(TOOLS, "report-homoglyphs.md"), "w") as f:
        f.write("# Cyrillic homoglyphs found in the PDF\n\n")
        f.write("Characters that render like Latin letters but are not. All-caps "
                "tokens are repaired (they are acronyms); lowercase ones are "
                "preserved because at least one is a deliberate typosquatting "
                "example.\n\n| where | found | result | action |\n|---|---|---|---|\n")
        for where, tok, fixed, action in homoglyph_log:
            f.write(f"| {where} | `{tok}` | `{fixed}` | {action} |\n")


if __name__ == "__main__":
    AUTHORED = load_authored()
    print(f"authored records: {len(AUTHORED)}")
    qs, unsup = build()
    print(f"supported: {len(qs)} | unsupported: {len(unsup)}")
    write_outputs(qs, unsup)
    write_reports(qs, unsup)
    print(f"homoglyph events: {len(homoglyph_log)}")
