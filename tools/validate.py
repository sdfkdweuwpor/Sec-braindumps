#!/usr/bin/env python3
"""Validate the extracted question bank. Fails loudly; fixes nothing.

    python3 tools/validate.py

Exits non-zero if any hard check fails.
"""
import json
import os
import re
import sys
from collections import Counter, defaultdict
from difflib import SequenceMatcher

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import objectives as OBJ  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NEAR_DUP = 0.92
SKEW_LIMIT = 0.40

errors, warnings = [], []


def err(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


def norm(s):
    return re.sub(r"[^a-z0-9 ]", "", s.lower()).strip()


def main():
    qs = json.load(open(os.path.join(ROOT, "data", "questions.json")))
    print(f"loaded {len(qs)} questions\n")

    # ---- duplicate ids -------------------------------------------------
    ids = Counter(q["id"] for q in qs)
    for qid, n in ids.items():
        if n > 1:
            err(f"duplicate id {qid} appears {n}x")

    # ---- per-question structural checks --------------------------------
    for q in qs:
        qid = q["id"]
        keys = [c["key"] for c in q["choices"]]

        if not q["question"].strip():
            err(f"{qid}: empty question text")
        for c in q["choices"]:
            if not c["text"].strip():
                err(f"{qid}: empty text for choice {c['key']}")
        if len(q["choices"]) < 2:
            err(f"{qid}: only {len(q['choices'])} choices")
        if len(q["choices"]) > 8:
            err(f"{qid}: {len(q['choices'])} choices (max 8)")
        if len(set(keys)) != len(keys):
            err(f"{qid}: duplicate choice keys {keys}")

        if not q["correct"]:
            err(f"{qid}: no correct answer recorded")
        for k in q["correct"]:
            if k not in keys:
                err(f"{qid}: correct answer {k!r} not among choices {keys}")

        if q["type"] == "single" and len(q["correct"]) != 1:
            err(f"{qid}: type 'single' but {len(q['correct'])} correct answers")
        if q["type"] == "multi" and len(q["correct"]) < 2:
            err(f"{qid}: type 'multi' but {len(q['correct'])} correct answers")

        if q["domain"] not in (1, 2, 3, 4, 5):
            err(f"{qid}: domain {q['domain']!r} outside 1-5")
        if q["objective"] is not None and q["objective"] not in OBJ.OBJECTIVES:
            err(f"{qid}: objective {q['objective']!r} not in the SY0-701 list")
        if q["objective"] and OBJ.OBJECTIVES[q["objective"]][0] != q["domain"]:
            err(f"{qid}: objective {q['objective']} does not belong to domain {q['domain']}")

    # ---- answer-letter distribution ------------------------------------
    letters = Counter(k for q in qs for k in q["correct"])
    total = sum(letters.values())
    print("answer-letter distribution:")
    for k in sorted(letters):
        pct = letters[k] / total
        flag = "  <-- SKEWED" if pct > SKEW_LIMIT else ""
        print(f"   {k}: {letters[k]:>4}  {pct*100:5.1f}%{flag}")
        if pct > SKEW_LIMIT:
            err(f"answer key skew: {k} is {pct*100:.1f}% of all answers "
                f"(>{SKEW_LIMIT*100:.0f}%) -- parser may have misaligned")

    # ---- near-duplicate question text ----------------------------------
    print("\nscanning for near-duplicate questions...")
    normed = [(q["id"], norm(q["question"])) for q in qs]
    buckets = defaultdict(list)
    for qid, n in normed:
        buckets[len(n) // 40].append((qid, n))     # length prefilter

    clusters = []
    for b in list(buckets):
        cand = buckets[b] + buckets.get(b + 1, [])
        for i in range(len(cand)):
            for j in range(i + 1, len(cand)):
                a, bb = cand[i], cand[j]
                if a[0] == bb[0]:
                    continue
                if abs(len(a[1]) - len(bb[1])) / max(len(a[1]), len(bb[1]), 1) > 0.15:
                    continue
                r = SequenceMatcher(None, a[1], bb[1]).ratio()
                if r > NEAR_DUP:
                    clusters.append((a[0], bb[0], round(r, 3)))
    seen = set()
    uniq = []
    for x, y, r in clusters:
        key = tuple(sorted((x, y)))
        if key not in seen:
            seen.add(key)
            uniq.append((x, y, r))
    if uniq:
        warn(f"{len(uniq)} near-duplicate question pair(s) (ratio > {NEAR_DUP}) "
             "-- reported, not removed")
    print(f"   {len(uniq)} near-duplicate pair(s)")

    # A duplicated question whose two copies disagree on the answer is proof
    # that one of the two keys is wrong. Free bad-key detection.
    byid = {q["id"]: q for q in qs}

    def keyed_text(q):
        """The TEXT of the correct answers, normalised.

        Comparing letters is wrong: two questions can share a stem while
        offering completely different choices, so 'both key C' means nothing.
        An earlier version of this check compared letters and produced a bad
        correction on q0513.
        """
        by_key = {c["key"]: c["text"] for c in q["choices"]}
        return sorted(norm(by_key.get(k, "")) for k in q["correct"])

    def same_choice_set(a, b):
        return (sorted(norm(c["text"]) for c in a["choices"])
                == sorted(norm(c["text"]) for c in b["choices"]))

    conflicts = []
    for x, y, r in uniq:
        qx, qy = byid[x], byid[y]
        tag = ""
        if not same_choice_set(qx, qy):
            tag = "   (same stem, different choices - not comparable)"
        elif keyed_text(qx) != keyed_text(qy):
            ax, ay = keyed_text(qx), keyed_text(qy)
            conflicts.append((x, y, r, qx["correct"], qy["correct"]))
            tag = f"   <-- ANSWER CONFLICT {qx['correct']} vs {qy['correct']}"
        print(f"     {x} ~ {y}  ({r}){tag}")
    if conflicts:
        err(f"{len(conflicts)} duplicated question(s) whose copies disagree on the "
            "answer key -- at least one copy is wrong in the source PDF")
        with open(os.path.join(ROOT, "tools", "report-answer-conflicts.md"), "w") as f:
            f.write("# Duplicated questions with conflicting answer keys\n\n")
            f.write("The same question appears twice in the PDF with different "
                    "keys, so one copy is wrong. Resolve before studying.\n\n")
            for x, y, r, ax, ay in conflicts:
                f.write(f"\n## {x} vs {y}  (similarity {r})\n\n")
                f.write(f"> {byid[x]['question'][:400]}\n\n")
                for c in byid[x]["choices"]:
                    f.write(f"- **{c['key']}.** {c['text']}\n")
                f.write(f"\n- `{x}` key: **{''.join(ax)}**\n")
                f.write(f"- `{y}` key: **{''.join(ay)}**\n")

    # A stem/choice lexical-overlap detector was tried here to catch more
    # q0852-style corruption (real stem, another question's choices). It does
    # not work on this format: Security+ choices are frequently bare acronyms
    # (SOW / SLA / MOA / MOU) that share no words with the stem, so it flagged
    # ~72% of the bank. The duplicate-key-conflict check above is the reliable
    # detector; beyond that, corruption needs a human read.

    # ---- unresolved conflicts carried from corrections.py ---------------
    try:
        import corrections as FIX
        for pair, note in FIX.UNRESOLVED.items():
            warn(f"UNRESOLVED key conflict {pair[0]}/{pair[1]}: {note}")
        fixed = [q["id"] for q in qs if q.get("keyCorrected")]
        if fixed:
            print(f"\nanswer keys corrected from source: {', '.join(fixed)}")
    except ImportError:
        pass

    # ---- coverage reporting --------------------------------------------
    labelled = sum(1 for q in qs if not q.get("needsReview"))
    how = ("hand-assigned" if labelled == len(qs)
           else f"{labelled}/{len(qs)} hand-assigned, rest inferred")
    print(f"\nper-domain counts ({how} -- the PDF carries no domain labels):")
    bydom = Counter(q["domain"] for q in qs)
    for d in sorted(OBJ.DOMAINS):
        share = bydom[d] / len(qs) * 100
        w = OBJ.DOMAINS[d]["weight"]
        print(f"   Domain {d} {OBJ.DOMAINS[d]['title'][:42]:<44} "
              f"{bydom[d]:>4}  {share:5.1f}%   (exam weight {w}%)")

    # Every question with an authored objective uses that human read, so raw
    # inference confidence no longer decides anything and reporting it as risk
    # would be noise. What is still worth knowing is where the keyword
    # inference DISAGREES with the human read: either the objective is a
    # genuine judgement call, or the keyword table has a gap worth filling.
    conf = [q["inferenceConfidence"] for q in qs]
    print(f"\ninference confidence: median {sorted(conf)[len(conf)//2]:.2f} "
          f"(diagnostic only -- authored objectives override it)")

    confirmed = [q for q in qs if not q.get("needsReview")]
    disagree = []
    for q in confirmed:
        text = q["question"] + " " + " ".join(c["text"] for c in q["choices"])
        guess, _dom, _c = OBJ.infer_objective(text)
        if guess and guess != q["objective"]:
            disagree.append((q["id"], q["objective"], guess))
    if confirmed:
        pct = len(disagree) / len(confirmed) * 100
        print(f"inference agrees with the human read on "
              f"{len(confirmed) - len(disagree)}/{len(confirmed)} "
              f"({100 - pct:.0f}%) confirmed questions")
        cross = Counter((a, b) for _i, a, b in disagree)
        for (auth, guess), n in cross.most_common(5):
            print(f"   authored {auth} but keywords say {guess}: {n}")
    unreviewed = [q for q in qs if q.get("needsReview")]
    if unreviewed:
        warn(f"{len(unreviewed)} of {len(qs)} questions still carry needsReview:true "
             "-- their domain is inferred, not confirmed by a human read")

    authored = [q for q in qs if q.get("explanationSource") in ("authored", "pdf+authored")]
    with_wrongs = [q for q in qs if q.get("incorrectExplanations")]
    print(f"explanations authored: {len(authored)} | with distractor notes: {len(with_wrongs)}")

    noexp = [q for q in qs if q["needsExplanation"]]
    print(f"explanations: {len(qs)-len(noexp)} present / {len(noexp)} missing")

    empty_obj = [q for q in qs if q["objective"] is None]
    if empty_obj:
        err(f"{len(empty_obj)} question(s) with no objective inferred: "
            f"{[q['id'] for q in empty_obj][:10]}")

    # ---- verdict --------------------------------------------------------
    print("\n" + "=" * 62)
    for w in warnings:
        print(f"WARN  {w}")
    for e in errors:
        print(f"ERROR {e}")
    print("=" * 62)
    print(f"{len(errors)} error(s), {len(warnings)} warning(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
