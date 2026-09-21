# Sec-braindumps

CompTIA Security+ **SY0-701** practice exam app — a self-hosted, offline study
tool built from my own question bank.

Vanilla HTML/CSS/JS, no build step, no backend. Progress lives in `localStorage`.

## Layout

| Path | What's in it |
|---|---|
| `source/` | Original question-bank PDF(s) |
| `tools/` | One-time Python extraction + validation scripts (build-time only) |
| `data/` | Generated question data the app actually loads |
| `js/`, `css/` | The app |

## Status

Phase 1 — question extraction. See `tools/` for the pipeline.
