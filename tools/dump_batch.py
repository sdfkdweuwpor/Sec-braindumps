#!/usr/bin/env python3
"""Print a compact slice of the bank for writing explanations against.

    python3 tools/dump_batch.py <offset> <count>
"""
import json, sys, os, glob
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

qs = json.load(open(os.path.join(ROOT, "data", "questions.json")))
done = set()
for p in glob.glob(os.path.join(ROOT, "tools", "authored", "*.json")):
    done |= set(json.load(open(p)).keys())

todo = [q for q in qs if q["id"] not in done]
off = int(sys.argv[1]) if len(sys.argv) > 1 else 0
cnt = int(sys.argv[2]) if len(sys.argv) > 2 else 40

print(f"# {len(done)} authored / {len(qs)} total | {len(todo)} remaining | showing {off}..{off+cnt}")
for q in todo[off:off + cnt]:
    stem = " ".join(q["question"].split())
    print(f'\n{q["id"]} [D{q["domain"]}/{q["objective"]}] conf={q["inferenceConfidence"]}')
    print(f'Q: {stem}')
    for c in q["choices"]:
        mark = "*" if c["key"] in q["correct"] else " "
        print(f'  {mark}{c["key"]}. {" ".join(c["text"].split())}')
    pdf = q["explanation"]
    print(f'PDF: {" ".join(pdf.split())[:400] if pdf else "NONE"}')
