# tools/tips/

Exam tips, one `tipsNNN.json` per batch, merged by `tools/extract.py` into
each question's `tip` field. A tip is a sentence or two on how to spot what
the question is testing: the clue in the wording, the concept it maps to,
or the look-alike answer to rule out. Format, one question per line:

```json
{
"q0001": "Details about a program running on one machine live on that machine: think endpoint logs (EDR). Network logs only show the traffic it made."
}
```

`python3 tools/validate.py` reports questions still missing a tip.
