# Clocking Report Parser

Parses a "South Deep / Gold Fields - Individual Clocking History" PDF
(`web_clock_report_individual` program output) into a formatted Excel
Timesheet workbook — Name / Employee Number / Occupation, then one row per
calendar day.

## Setup

```bash
pip install -r requirements.txt
```

## Hosted web app on Vercel (recommended for non-technical users)

This is the simplest option for a non-technical company: no install, no
launcher, just a URL in a browser. It's a static frontend
(`webapp/frontend`) plus a Python serverless function (`api/index.py`) that
reuses `clocking_report_parser.py` — see `vercel.json` for the build wiring.

**One-time setup:**

1. Install the CLI and log in: `npm i -g vercel`, then `vercel login`
   (needs a free Vercel account — sign up with email or GitHub at
   [vercel.com](https://vercel.com)).
2. From the project root: `vercel` (first deploy — follow the prompts,
   accepting defaults is fine) then `vercel --prod` to publish it.

After that, share the deployed URL (shown after `vercel --prod`) with the
company. They open it and use the app exactly like the local version — drag
PDFs in, hit Parse, download. There's no login: nothing is ever written to
persistent storage (a PDF is parsed and discarded once the response is
sent), so there's no stored data to gate access to — anyone with the URL
can use the tool.

**How it differs from local:** each `/api/parse` call now does the upload,
parse, and workbook generation in one request and hands back the `.xlsx`
inline, since serverless functions don't keep files around between
requests. Nothing is written to persistent storage — a PDF is parsed and
gone once the response is sent. Very large PDFs could hit Vercel's function
time limit (`maxDuration: 60` in `vercel.json` — Hobby-tier accounts may cap
this lower; bump it if you're on Pro and hitting timeouts).

## Web app, run locally (alternative — keeps everything on one PC)

Double-click **`Run Web App.bat`**:

- **First run only** — installs Python packages and builds the web interface
  (needs [Node.js](https://nodejs.org) installed once). This is the only
  step that might need a more technical person on hand.
- **Every run** — starts the app with no console window (it runs hidden in
  the background) and opens it as its own app window, not a browser tab.
  Running it again while it's already open just brings that window back
  instead of starting a second copy.

Inside the app, there's an **"Add to this computer"** button (top of the
page) — clicking it installs the app properly, so it gets a normal icon on
the Start Menu/desktop and future launches don't need the `.bat` file at
all. Everything runs on that one PC via a small local server
(`webapp/backend`, FastAPI) and a React/TypeScript frontend
(`webapp/frontend`) — no files are ever uploaded anywhere external.

Drag PDFs onto the page (or click to browse) and hit **Parse** to download
each finished workbook.

To stop the background server, end the `python` (or `pythonw`) process from
Task Manager — there's no window to close since it's designed to just quietly
sit there like any other background app (e.g. OneDrive) until the PC restarts.

To develop the frontend with hot-reload instead of the built version:

```bash
# terminal 1
cd webapp/backend && uvicorn main:app --port 8000 --reload
# terminal 2
cd webapp/frontend && npm install && npm run dev
```

## Desktop app

Double-click **`Run App.bat`** (installs missing packages the first time, then
opens the app), or run it directly:

```bash
python clocking_report_app.py
```

Drag one or more PDFs — or a whole folder of them — onto the window (or use
"Browse..."), optionally pick an output folder, then click **Parse**. Each
PDF's Timesheet workbook is written next to its input file by default. The
log pane shows progress, and "Open Output Folder" jumps straight to the
result when it's done.

## Command line

Single file:

```bash
python clocking_report_parser.py path/to/report.pdf [output.xlsx]
```

Batch — parses every `*.pdf` in a folder (e.g. one clocking report per
employee):

```bash
python clocking_report_parser.py path/to/folder [output_folder]
```

If you don't specify an output path, each workbook is written as
`<pdf name>_parsed.xlsx` next to its input file. In batch mode, a PDF that
fails to parse is logged and skipped — it doesn't stop the rest of the batch.

## What you get

An Excel workbook per PDF, with a single **Timesheet** sheet matching the
target report layout: Name / Employee Number / Occupation, then a day-by-day
Day/Date/Shift/1st/2nd/Hrs of work/Planned/O·T Minutes/S·T Minutes/Comments
table with totals and a Planned/Actual/Overtime summary box.

- **Day** is derived from **Date** (`Date.strftime("%A")`) — every calendar
  day in the report's date range gets a row, not just days with clockings.
- **1st / 2nd** are that day's first and last clocking; **Hrs of work** is
  simply their difference.
- **Shift and Planned hours are guessed**, since there's no roster in the
  source PDF, one of two ways:
  - **By day-of-week** (`--work-days`) — every day in the list gets
    `--hours-per-day` planned hours, every other day is OFF. Still wrong for
    anyone on a genuinely irregular week no matter how it's configured.
  - **Rotating** (`--rotating`) — for shifts that don't follow a fixed
    weekly pattern (e.g. 4-on/4-off): `--work-days` is ignored, and any day
    with at least one clocking is treated as a scheduled `--hours-per-day`
    day instead.
  - **CLI**: `--work-days mon,tue,wed,thu,fri`, `--hours-per-day 8`, and/or
    `--rotating`
  - **Desktop app**: day checkboxes + an hours field above the Parse button
  - **Web app (local + Vercel)**: pick a planned shift length up front
    (10h/9h/8h tiles). The 10h tile is treated as a rotating 4-on/4-off
    shift; 9h and 8h follow a Mon–Fri / Mon–Sat toggle (for employees
    scheduled to work Saturdays). Sunday work always counts as overtime
    either way
- **O/T Minutes** is any time worked beyond the planned daily hours on a
  non-Sunday, paid at **1.5x**. **S/T Minutes** ("Sunday Time") is all time
  worked on a Sunday, paid at **2.0x**, regardless of whether Sunday is a
  scheduled day — Sunday work never counts toward O/T Minutes. The summary
  box's **Overtime Pay (hours)** = `O/T Minutes x 1.5 + S/T Minutes x 2.0`.

## How it works

The report is a fixed-column table, not free text, so this uses
**position-based parsing**, not NLP: it reads each word's x/y coordinate
from the PDF (via `pdfplumber`) and buckets words into columns by their
x-position. This is what correctly distinguishes an "IN" clocking from an
"OUT" clocking when both appear on the same printed line — a plain
text/regex extraction can't reliably tell those apart.

If you point this at a differently laid-out report, the x-coordinate
boundaries near the top of the script (`IN_FIELD_BOUNDS`, `OUT_FIELD_BOUNDS`,
`IN_OUT_SPLIT_X`) will likely need adjusting — open the PDF's header row
in a coordinate inspector (or add a quick debug print of `page.extract_words()`)
to find the new anchor positions.

## Notes on "Hours Worked"

Hours are computed from clock-in/clock-out pairs at the underground
workplace access point (`Point == "U01"`, `Type == "Work"`), not from the
overall first-to-last clocking span each calendar day. This matters because
many shifts run overnight, and workers on consecutive night shifts can have
less than 24 hours between one shift's end and the next one's start — a
simple "biggest gap in a day" approach either splits a single overnight
shift in two, or merges multiple real shifts into one. Pairing on the
workplace point avoids both problems.

If your report has no `Work`/`U01` events, the script falls back to
clustering all clockings by a 14-hour gap threshold (less accurate — may
merge back-to-back shifts with short rest gaps).
