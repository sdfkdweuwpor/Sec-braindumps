#!/usr/bin/env python3
"""Extract SY0-701 questions from the VirtuLearner braindump PDF into the
canonical schema used by the app.

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

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF = os.path.join(ROOT, "source", "SY0-701_en.pdf")
DATA = os.path.join(ROOT, "data")
TOOLS = os.path.join(ROOT, "tools")

# Running header / footer furniture, stripped per line. These interleave in the
# middle of questions because questions span page breaks.
FURNITURE = [
    re.compile(r"^SY0-701$"),
    re.compile(r"^https://VirtuLearner\.com$", re.I),
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
    """Return [(line, page_number)] with page furniture removed."""
    import pdfplumber
    out = []
    with pdfplumber.open(PDF) as pdf:
        for pageno, page in enumerate(pdf.pages, start=1):
            for raw in (page.extract_text() or "").split("\n"):
                line = raw.strip()
                if any(p.match(line) for p in FURNITURE):
                    continue
                out.append((line, pageno))
    return out


CHOICE_RE = re.compile(r"^(?:[•●▪◦]\s*)?([A-H])\.\s+(.*)$")
ANSWER_RE = re.compile(r"^Answer\(s\):\s*(.+?)\s*$")
QUESTION_RE = re.compile(r"^QUESTION:\s*(\d+)\s*$")


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


def build():
    lines = load_lines()
    blocks = split_questions(lines)
    print(f"blocks found: {len(blocks)}")

    supported, unsupported = [], []
    for num, page, body in blocks:
        raw = "\n".join(l for l, _ in body)
        rec = parse_block(num, page, body)

        if PBQ_MARKERS.search(raw) or len(rec["choices"]) < 2:
            unsupported.append({
                "id": rec["id"],
                "number": num,
                "reason": ("performance-based (hotspot/drag-drop/simulation)"
                           if PBQ_MARKERS.search(raw) else
                           f"only {len(rec['choices'])} parsed choice(s)"),
                "question": rec["question"][:400],
                "source": f"SY0-701_en.pdf#p{page}",
            })
            continue

        if rec["id"] in FIX.DROPPED:
            unsupported.append({
                "id": rec["id"], "number": num,
                "reason": "dropped by correction: " + FIX.DROPPED[rec["id"]],
                "question": rec["question"][:400],
                "source": f"SY0-701_en.pdf#p{page}",
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

        text_for_inference = rec["question"] + " " + " ".join(
            c["text"] for c in rec["choices"])
        obj, dom, conf = OBJ.infer_objective(text_for_inference)
        title = OBJ.OBJECTIVES[obj][1] if obj else None

        supported.append({
            "id": rec["id"],
            "domain": dom,
            "objective": obj,
            "objectiveTitle": title,
            "type": "multi" if len(rec["correct"]) > 1 else "single",
            "question": rec["question"],
            "choices": rec["choices"],
            "correct": rec["correct"],
            "explanation": rec["explanation"],
            "explanationSource": "pdf" if rec["explanation"] else None,
            "incorrectExplanations": {},
            "references": [],
            "source": f"SY0-701_en.pdf#p{rec['page']}",
            "needsReview": True,          # every domain value is inferred
            "inferenceConfidence": conf,
            "needsExplanation": rec["explanation"] is None,
            "keyCorrected": corrected,
        })

    return supported, unsupported


def write_outputs(questions, unsupported):
    os.makedirs(DATA, exist_ok=True)
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
    qs, unsup = build()
    print(f"supported: {len(qs)} | unsupported: {len(unsup)}")
    write_outputs(qs, unsup)
    write_reports(qs, unsup)
    print(f"homoglyph events: {len(homoglyph_log)}")
