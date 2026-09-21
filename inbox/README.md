# inbox

Drop PDFs (or other source docs) here for Claude to read.

## How to drop a file

- **GitHub web UI:** open this folder → **Add file → Upload files** → drag the
  PDF in → commit. Max 25 MB per file through the web uploader.
- **From a clone:** `git add inbox/your-file.pdf && git commit && git push`.
  Max 100 MB per file (GitHub warns above 50 MB).

Then send the prompt describing what you want — a summary, extracted commands,
a cheat sheet, exam-style notes, whatever.

## Conventions

- Any filename is fine; descriptive beats `scan_001.pdf` when several files are
  sitting here at once.
- Files stay put after they're processed. Delete one yourself when you're done
  with it, or ask and Claude will remove it in the same change.
- Output goes to `notes/` by default.

## Scanned PDFs

Image-only scans need OCR before the text is readable. Claude can run it — just
say so, or say "this one's a scan" if the file looks empty when read.
