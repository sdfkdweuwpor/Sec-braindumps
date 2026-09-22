# Security+ SY0-701 Practice

An offline practice-exam app for **CompTIA Security+ SY0-701**, built from a
question bank extracted out of a PDF in `source/`.

Vanilla HTML, CSS and ES modules. No framework, no build step, no bundler, no
runtime dependencies, no backend, no accounts, no network calls. All progress
lives in `localStorage`.

## Running it

Open `index.html`. That is the whole procedure — it works straight off the
filesystem, which is why the question data is `.js` files exporting consts
rather than JSON fetched at runtime (`fetch()` on a local file is blocked over
`file://`).

If you prefer a server:

```bash
python3 -m http.server 8000
# then http://localhost:8000
```

## What's in it

| Screen | What it does |
|---|---|
| **Study** | Readiness card, plus Build Your Own, Missed, Weakest Subject and Mock Exam |
| **Build Your Own** | Filter by domain, objective, missed or saved; set a length; choose feedback mode |
| **Quiz** | One question at a time, immediate or end-of-quiz feedback, flag to save, resumes after a refresh |
| **Results** | Score, per-domain breakdown, every question with its explanation, retake-missed |
| **Stats** | Coverage and accuracy per domain and objective, trend line, weakest objectives, export/import |
| **Review** | Everything you have ever answered wrong, filterable, quizzable |
| **Saved** | Questions you flagged |

**Mock Exam** draws 90 questions weighted to the official domain percentages
with a 90-minute timer, and estimates a 100–900 scaled score. That estimate is
a linear map of your raw percentage and is clearly labelled as unofficial —
CompTIA does not publish how it scales, and the real exam includes unscored
items. The real pass mark is 750/900.

Deliberately **not** built: study calendar, streaks, Question of the Day,
Quick 10, timed quizzes outside the mock exam, XP/levels/badges, anything
social, anything with a paywall.

## Layout

```
index.html              entry point
css/theme.css           design tokens; dark by default, light under [data-theme="light"]
css/app.css             layout and components
js/main.js              hash router, theme toggle, app bootstrap
js/store.js             the only module that touches localStorage
js/quizEngine.js        pool filtering, selection, scoring
js/stats.js             derived analytics and the readiness formula
js/components.js        readiness card, bars, sparkline, paginated question list
js/dom.js               element helper, code-snippet rendering
js/views/               one module per screen
data/domains.js         SY0-701 domains and all 28 objectives
data/domain1..5.js      the question bank, one file per domain
data/index.js           ALL_QUESTIONS and QUESTIONS_BY_ID
data/questions.json     the same data as portable JSON (backup; the app does not read it)
data/unsupported.js     performance-based items the schema does not model
tools/                  one-time Python extraction and validation (build-time only)
source/                 the original PDF
tests/                  node --test suites
```

## Tests

```bash
npm test          # or: node --test
```

67 tests covering pool filtering, count clamping, no-duplicates-within-a-quiz,
all-or-nothing multi-answer scoring, the readiness maths, the localStorage
migration path, storage-failure fallback, and the integrity of the shipped
bank. No install step — `node --test` is built in, and there are no
dependencies.

Note: `node --test tests/` does not work (Node tries to execute the directory
as an entry point). Use `node --test` or `npm test`.

## Adding questions to the bank

The bank is generated. **Do not hand-edit `data/domain*.js`** — the next
extraction run overwrites it.

### From the PDF pipeline

1. Drop the new PDF in `source/`.
2. Point `PDF` in `tools/extract.py` at it (or extend it to glob the folder).
3. Run the pipeline:

```bash
pip install pdfplumber
python3 tools/extract.py     # writes data/*.js and data/questions.json
python3 tools/validate.py    # must exit 0
npm test                     # data.test.js guards the shipped bank
```

`validate.py` fails loudly on duplicate ids, answers that name a choice which
does not exist, fewer than 2 or more than 8 choices, empty text, a domain
outside 1–5, an objective that is not in the SY0-701 list, a `single` question
with more than one answer, and an answer-letter distribution skewed past 40%
(which almost always means the parser misaligned the key). It also clusters
near-duplicate questions and flags any whose copies disagree on the answer —
that disagreement is proof one of them is wrong.

### Explanations

Every question carries an explanation written to one voice plus a note on each
wrong choice saying what that option actually means and why it does not fit
the stem. The PDF's own explanations were not trusted verbatim — they vary in
voice, some only restate the answer, and a few rationalise a wrong key — so
all of them were rewritten.

Authored text lives in `tools/authored/batch*.json`, keyed by question id and
kept out of the extractor so re-extraction never loses it:

```json
{"q0001": {
  "objective": "5.2",
  "explanation": "Transfer moves the financial consequence of a risk ...",
  "incorrect": {"A": "Accept means ...", "C": "Mitigate means ..."}
}}
```

`objective` is a human read and wins over keyword inference. `incorrect` may
only name choices that are actually wrong — the extractor exits non-zero if a
note targets a correct answer or a choice that does not exist, so a shifted
question cannot silently acquire the wrong notes.

To write more, `python3 tools/dump_batch.py` prints a compact slice of the
questions that have no authored record yet.

### Question ids are permanent

Progress is keyed by `id`, never by position or question text. `q0142` must
keep meaning the same question forever. Ids come from the PDF's own
`QUESTION: n` numbering, so appending a second source PDF needs its own id
prefix or offset — otherwise re-extraction silently re-points your history at
different questions.

### Corrections

Manual fixes live in `tools/corrections.py`, separate from the extractor so
re-running it never loses them:

- `KEY_CORRECTIONS` — answer keys changed from what the PDF said, each with
  the reasoning and what corroborated it. The extractor asserts the PDF still
  says what the correction expects, so a correction can never silently apply
  to a question that has shifted underneath it.
- `DROPPED` — questions removed entirely, with why.
- `UNRESOLVED` — conflicts checked against outside sources without a confident
  answer. Left exactly as the PDF had them and reported on every run.

### The schema

```js
{
  id: "q0142",                  // stable, zero-padded, never reused
  domain: 4,                    // 1-5
  objective: "4.3",             // or null
  objectiveTitle: "...",        // or null
  type: "single",               // "single" | "multi"
  question: "...",
  choices: [{ key: "A", text: "..." }, ...],
  correct: ["C"],               // always an array, even for single-answer
  explanation: "..." ,          // or null
  explanationSource: "pdf",     // "pdf" | "authored" | "pdf+authored" | null
  incorrectExplanations: { A: "...", B: "..." },   // may be {}
  references: [],
  source: "SY0-701_en.pdf#p42",
  needsReview: true,            // the domain was inferred, not labelled
  inferenceConfidence: 0.68,
  needsExplanation: false,
  keyCorrected: false
}
```

**On provenance:** the source PDF carries no domain or objective labels.
Keyword matching in `tools/objectives.py` makes a first pass, but every
question in the bank now carries a hand-assigned objective from
`tools/authored/`, which overrides the guess and clears `needsReview`. Any
question added later without an authored objective falls back to inference and
comes back with `needsReview: true`. `inferenceConfidence` is the winning
objective's share of the total keyword score, kept as a diagnostic only —
`validate.py` reports where inference disagrees with the human read, which
points at gaps in the keyword table rather than at bad data.
`explanationSource` records whether an explanation came from the PDF or was
written afterwards, so anything authored can be spot-checked.

## How readiness is calculated

For each domain: your accuracy × that domain's official exam weight, then
multiplied by a coverage factor of `min(1, questions seen ÷ (0.6 × domain
pool))`. Summed across all five domains, giving 0–100.

The coverage factor is the point. Without it, four lucky answers in one domain
would read as mastery of it. A domain you have never touched contributes
nothing, which correctly drags the score down rather than being quietly
skipped. Bands: Not ready <60, Building 60–74, Approaching 75–84, Exam ready
85+. The formula is also shown on the card itself.

## Deploying to GitHub Pages

The repo is already a static site — there is nothing to build.

1. **Settings → Pages**
2. **Source: Deploy from a branch**
3. Pick your branch and the **`/ (root)`** folder, then Save.

It appears at `https://<user>.github.io/<repo>/` within a minute or two.

Notes:

- Routing is hash-based (`#/stats`, `#/review`), so deep links and the back
  button work on Pages without any redirect rules or 404 shim.
- Every path in the HTML is relative, so serving from a subdirectory is fine.
- No `.nojekyll` is needed — no file or directory starts with an underscore.
- Pages is public even from a private repo on some plans. The question bank is
  copyrighted material from the source PDF; keep that in mind before publishing.
- Progress is per-browser and per-origin. Moving between phone and laptop means
  **Stats → Export progress**, then **Import progress** on the other device.

## Known limits

- 9 performance-based items (hotspot, drag-and-drop, simulation) are in
  `data/unsupported.js` and never shown — they are image-based and cannot be
  answered as multiple choice. One more (`q0114`) has choices that exist only
  as images, and one (`q0852`) was dropped because the PDF paired its stem with
  another question's choices.
- 18 near-duplicate question pairs remain in the bank, reported by
  `validate.py` and left in deliberately rather than auto-deleted. One pair
  (`q0342`/`q0513`) shares a stem but offers different choices and is listed
  in `UNRESOLVED`; both are left as the PDF had them.
- Objectives are hand-assigned, but a Security+ question often defensibly
  belongs to more than one. Where the placement is a judgement call it was
  made once and applied consistently rather than split across objectives.
- The bank's domain mix is not the exam's (Domain 4 is 31% of the pool against
  a 28% exam weight, Domain 2 is 19% against 22%). Only the mock exam corrects
  for this, apportioning by official weight; a custom quiz over the whole bank
  will over-sample Domain 4.
