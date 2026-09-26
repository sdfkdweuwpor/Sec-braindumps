# Security+ SY0-701 — second question bank

The same app as the braindump one (repo root), built from a second
question PDF (in `source/`), with a few upgrades of its own. The folder
name is deliberately random so the URL does not name the vendor.

- **1,279 questions**, every one with an explanation, a note on each
  wrong choice and an exam tip. 936 explanations came from the braindump
  bank where the two share a question; the other 343 were written for this
  bank. Every question, choice, key, explanation and note has since been
  read end to end; no explanation runs under 28 words and every wrong-answer
  note says why that choice does not fit this scenario.
- **Answer keys checked.** Where the two banks share a question with
  identical choices, both must key the same answer, and every other key was
  checked while reading. 23 keys the PDF got wrong are corrected and its 4
  blank keys filled, each recorded with the reasoning and corroboration in
  `tools/corrections.py`. Contested items say so in their explanation.
- **Text cleaned.** 243 OCR and typing fixes across 151 questions
  (`TEXT_FIXES` in `tools/corrections.py`: "dicks links" for "clicks
  links", "a risk to a file" for "a link to a file", "fall-closed", and so
  on), missing content restored, exact-duplicate choices removed, every
  multiple-answer prompt worded "(Choose two.)" the way CompTIA writes it,
  and one corrupted question (`q1189`, which pairs one question's stem with
  another's choices) dropped.
- **Exam tips.** Under each explanation, a one-line callout on how to spot
  what the question is testing: the clue in the wording, the concept it
  maps to, or the look-alike answer to rule out (`tools/tips/`).
- **Verify this answer.** After answering, three buttons check the question
  elsewhere (`js/verify.js`): Google (searches the stem), Claude (opens a
  chat with the question, the choices and the marked answer, and copies the
  same text in case the prompt does not carry over) and Professor Messer
  (searches the professormesser.com Security+ material for the topic). Links open in a new tab and
  send no referrer.
- **Quiz navigation.** Previous / Next under every question and arrow
  keys. Practice answers lock once revealed; mock exam
  answers stay editable until you submit and are recorded once, at submit.
- **Similar questions.** After answering, *Similar questions?* pauses the
  quiz and runs 10 real bank questions on the same topic (ranked by how
  closely their question, correct answer and explanation match, same
  objective preferred, nothing from the paused quiz). *Back to my quiz*
  returns to the exact question.
- **Smart review.** Spaced repetition on the Study screen. A missed
  question comes back after 1 day; right at a check moves it to 3 days,
  then 7, and right at the 7-day check masters it. A miss anywhere sends it
  back to 1 day, and answering before a check is due changes nothing. The
  schedule is rebuilt from the answer history (`js/srs.js`), so nothing
  extra is stored and it applies to history from before the feature. When
  questions have moved since the card was last on screen, each move replays
  as a dot hopping from rung to rung (new ones drop in, mastered ones land
  with a burst), then a line of chips says what moved.
- **Exhibits restored.** 27 questions whose logs, tables, code or command
  output the PDF printed as pictures now carry that content as text,
  transcribed from the page images (`EXHIBITS` in `tools/corrections.py`).
  They render as a code box or a table; a table too wide for a phone
  scrolls inside its box with a fade on the side that has more.
- **Acronyms.** Spelled-out terms in questions and choices are written as the
  exam writes them (Full disk encryption -> FDE), from the list in
  `tools/acronyms.py`. *Show acronyms* under a question (or the A key) lists
  what each one stands for.
- **Streak fire.** A full-screen burst of fire at 3, 10, 25 and 50 in a row
  and every 25 after that, with a flame roar; smaller flares at 5, 15 and 40.
  The flame chip glows at 5, catches fire at 10, burns brighter red at 15,
  shifts toward blue from 16 and is blue at 25, then turns cyan and green
  on the way to bright gold at 40. Gold holds for a moment and then slowly
  cycles through the colors; from 50 it is a rainbow. Breaking a streak of 3
  or more puts the flame out with a puff of smoke (`js/flame.js`).
- **Search.** A box on the Study screen and a Search page (`js/search.js`):
  every word must appear in the question, its answers, its explanations or
  its objective; short words such as WAF or IP match whole words only; a
  number like 62 or #62 jumps to that question. Matches are highlighted,
  each result shows whether you last got it right, and *Quiz me on these*
  starts a quiz from the results (up to 50).
- **Sound effects.** Synthesized in the browser (`js/sound.js`, no audio
  files): a chime for right, a soft low tone for wrong, a rising run every 5
  in a row, a roaring flame for the big fire moments, a fizzle when a streak
  breaks, plus quiet taps for tabs, navigation, opening explanations and
  flags. On by default; the speaker button in the top bar turns them off.
  The mock exam only ever plays the neutral tap, so it never gives an answer
  away.
- **XP and levels.** Every answer earns XP (10 right, 3 wrong for the
  effort), plus 15 for every 5 in a row within a quiz, 5 for passing a Smart
  review check, 25 for mastering a question, 20 for finishing a quiz of 10 or
  more and 100 for finishing a mock exam. 17 levels run from Recruit through
  Help Desk Hero, Phish Spotter, SOC Analyst, Threat Hunter and Red Teamer to
  CISO and Security+ Legend at 28,000 XP. The badge in the top bar shows the
  level and a ring filling toward the next one; "+10 XP" flies to it after an
  answer, a new level brings a banner and a fanfare, results show what the
  quiz earned, and Stats has a level card with where the XP came from. Like
  Smart review it is worked out from the answer history (`js/xp.js`), so it
  counts answers from before the feature and nothing extra is stored. In a
  mock exam the XP lands only after you submit.
- **Vibration.** On phones, a short buzz for right, a double one for wrong,
  and patterns for streak fire, mastering a question and a level up, in step
  with the sounds (`js/haptics.js`). Android uses the Vibration API; iPhones
  (iOS 18 and later) get a tick from a hidden switch control, the only
  haptic Safari offers. It has its own on/off button in the top bar, shown
  only on touch screens; nothing buzzes before the first tap on the page.
- **Motion.** Each change moves as one piece: a tab slides in from the side
  of the one you left. Between questions, the one you are leaving stays
  where it was on screen and drifts away as it fades, while the next one
  (question, answers and buttons together) glides in from the side you are
  heading and the progress bar slides along; no frame is ever empty
  (`axisOut` / `axisIn`). A Study card grows into the quiz it starts.
  Everything animates transform and opacity only, so nothing waits on a
  screenshot of the old screen or forces a layout on every frame (the
  browser's view transitions were tried and dropped: without graphics
  acceleration they froze the screen for up to a quarter of a second first).
  Cards and rows further down rise into place as they scroll into view.
  Answers and buttons ripple from where you press them. The logo and the
  quiz progress bar catch one sweep of light when a quiz starts, never on a
  loop while you read. Also answer reveal effects, count-ups, a sliding nav
  highlight, a soft glow and border spotlight that follows the pointer, and
  search boxes that cycle through example searches (`js/motion.js`). All of
  it is off under `prefers-reduced-motion`.
- **Big side bar.** On a computer the tabs down the side are large (76px
  rows with 38px icons on a wide screen, a little smaller on a narrow
  laptop), and their icons still animate on hover.
- **Loading screen.** While the question bank loads, a shimmering outline of
  the app shows where things will appear, in the saved theme from the first
  frame (`js/boot.js` applies it before anything paints).
- **Icons.** Phosphor duotone icons for the interface and Microsoft Fluent
  3D emoji for the feature tiles, both MIT-licensed, embedded as inline SVG
  and small WebP images so nothing is fetched from a CDN
  (`js/icons.js` and `js/art.js`, generated by `tools/build_icons.py`).
- **Letters by position.** Choices are shuffled, but the top choice always
  reads A; explanations and results use the same letters.
- **Look.** Light theme by default (dark is one tap away), and a
  Pocket Prep-style explanation panel that opens by itself when you get a
  question wrong and sits behind *Show explanation* when you get it right.

Progress is stored under its own namespace (`js/config.js`), separate
from the braindump app, even though both are served from one origin.

## Running it

Serve the folder over HTTP. Double-clicking `index.html` does **not** work in
Chrome, Edge or Brave: they refuse to load JavaScript modules from a
`file://` page, so it opens blank. The simplest options:

- **GitHub Pages** (see *Deploying to GitHub Pages* below) gives you a link
  that works on any device.
- **Locally**, from the repository folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/zqvbrtm/
```

## What's in it

| Screen | What it does |
|---|---|
| **Study** | Smart review, then Build Your Own, Missed, Weakest Subject, Mock Exam, search and the readiness card |
| **Build Your Own** | Filter by domain, objective, missed or saved; set a length; choose feedback mode |
| **Quiz** | One question at a time, immediate or end-of-quiz feedback, flag to save, resumes after a refresh |
| **Results** | Score, XP earned, Smart review moves, per-domain breakdown, every question with its explanation, retake-missed |
| **Stats** | Level and XP breakdown, coverage and accuracy per domain and objective, trend line, weakest objectives, export/import |
| **Review** | Everything you have ever answered wrong, filterable, quizzable |
| **Saved** | Questions you flagged |

**Mock Exam** draws 90 questions weighted to the official domain percentages
with a 90-minute timer, and estimates a 100–900 scaled score. That estimate is
a linear map of your raw percentage and is clearly labeled as unofficial —
CompTIA does not publish how it scales, and the real exam includes unscored
items. The real pass mark is 750/900.

Deliberately **not** built: study calendar, daily study streaks, Question of the Day,
Quick 10, timed quizzes outside the mock exam, badges and leaderboards,
anything social, anything with a paywall.

## Layout

```
index.html              entry point, with the loading skeleton
js/boot.js              applies the saved theme before first paint (plain script)
css/theme.css           design tokens; light by default, dark under [data-theme="dark"]
css/app.css             layout and components
js/config.js            app name and storage namespace -- unique per app
js/main.js              hash router, theme toggle, app bootstrap
js/store.js             the only module that touches localStorage
js/quizEngine.js        pool filtering, selection, scoring
js/stats.js             derived analytics and the readiness formula
js/srs.js               Smart review schedule, worked out from the answer history
js/xp.js                XP rules and level titles, worked out from the answer history
js/levels.js            level badge, flying XP, level-up moment, Stats level card
js/search.js            question search and match highlighting patterns
js/acronyms.js          acronym lookup and the Show acronyms tooltips
js/flame.js             streak flame stages and effects
js/milestones.js        milestone banners (questions answered, readiness bands)
data/acronyms.js        acronym dictionary (generated from tools/acronyms.py)
js/smartReview.js       Smart review card and session start
js/sound.js             synthesized sound effects
js/haptics.js           phone vibration patterns (Vibration API, iOS switch tick)
js/motion.js            animation helpers (Web Animations API)
js/icons.js             Phosphor duotone icons as inline SVG (generated)
js/art.js               Fluent 3D emoji art as embedded WebP (generated)
js/verify.js            the Verify row: Google, Claude and Professor Messer links
js/components.js        readiness card, bars, sparkline, paginated question list
js/dom.js               element helper, code-snippet rendering
js/views/               one module per screen
data/domains.js         exam domains and objectives (generated from tools/objectives.py)
data/domain1..5.js      the question bank, one file per domain
data/index.js           ALL_QUESTIONS and QUESTIONS_BY_ID
data/questions.json     the same data as portable JSON (backup; the app does not read it)
data/unsupported.js     performance-based items the schema does not model
tools/                  one-time Python extraction and validation (build-time only)
tools/authored/         hand-written explanations, merged on every extraction
tools/tips/             one exam tip per question, merged on every extraction
tools/build_icons.py    regenerates js/icons.js and js/art.js from the icon packages
source/                 the question-bank PDF -- exactly one
tests/                  node --test suites
```

## Tests

```bash
npm test          # or: node --test
```

117 tests covering pool filtering, the Smart review schedule and ladder moves, XP and levels, the vibration patterns, search, the streak fire tiers and moments, the Verify links, count clamping, no-duplicates-within-a-quiz,
all-or-nothing multi-answer scoring, the readiness maths, the localStorage
migration path, storage-failure fallback, refusing another app's progress
file, and the integrity of the shipped bank. The five bank tests are skipped
until `tools/extract.py` has produced a bank. No install step — `node --test`
is built in, and there are no dependencies.

Note: `node --test tests/` does not work (Node tries to execute the directory
as an entry point). Use `node --test` or `npm test`.

## Adding questions to the bank

The bank is generated. **Do not hand-edit `data/domain*.js`** — the next
extraction run overwrites it.

### From the PDF pipeline

1. Put the PDF in `source/` — exactly one; the extractor uses whichever it
   finds and refuses to guess between several.
2. Run the pipeline:

```bash
pip install pdfplumber
python3 tools/extract.py     # writes data/*.js and data/questions.json
python3 tools/validate.py    # must exit 0
npm test                     # data.test.js guards the shipped bank
```

`validate.py` fails loudly on duplicate ids, answers that name a choice which
does not exist, fewer than 2 or more than 8 choices, empty text, a domain
outside 1–5, an objective that is not in the exam's list, a `single` question
with more than one answer, a "(Choose two.)" prompt that disagrees with the
number of keyed answers, a wrong choice with no note, a question with no exam
tip, and an answer-letter distribution skewed past 40%
(which almost always means the parser misaligned the key). It also clusters
near-duplicate questions and flags any whose copies disagree on the answer —
that disagreement is proof one of them is wrong.

### Explanations

Every question carries an explanation written to one voice plus a note on each
wrong choice saying what that option actually means and why it does not fit
the stem. In the braindump app every PDF explanation was rewritten: they varied
in voice, some only restated the answer, and a few rationalized a wrong key.

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
  tip: "...",                   // one-line exam tip (tools/tips/)
  references: [],
  source: "bank.pdf#p42",       // the PDF's filename and page
  needsReview: true,            // the domain was inferred, not labeled
  inferenceConfidence: 0.68,
  needsExplanation: false,
  keyCorrected: false
}
```

**On provenance:** a braindump PDF usually carries no domain or objective
labels. Keyword matching in `tools/objectives.py` makes a first pass; a
hand-assigned objective in `tools/authored/` overrides the guess and clears
`needsReview`. A question without one keeps the inferred objective and comes
back with `needsReview: true`. `inferenceConfidence` is the winning
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
- Two apps on the same Pages account share an origin, so each needs its own
  `STORAGE_NAMESPACE` (see *Making a new app from this*).

## Credits

- Interface icons: [Phosphor Icons](https://phosphoricons.com) (MIT).
- Feature art: [Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji)
  3D set (MIT), via the `@lobehub/fluent-emoji-3d` package.
- Sounds are synthesized in the browser; there are no audio files.
