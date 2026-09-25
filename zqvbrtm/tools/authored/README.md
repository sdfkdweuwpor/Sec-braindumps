# tools/authored/

Hand-written explanations, one `batchNNN.json` per batch, merged by
`tools/extract.py` on every run. Format:

```json
{"q0001": {
  "objective": "5.2",
  "explanation": "Why the keyed answer is right ...",
  "incorrect": {"A": "What A actually means and why it does not fit ...",
                "C": "..."}
}}
```

`python3 tools/dump_batch.py <offset> <count>` prints the questions that
still need one.
