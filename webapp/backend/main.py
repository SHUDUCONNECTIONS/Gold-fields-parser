"""
Clocking Report Parser - Web App Backend
===========================================
A thin FastAPI wrapper around clocking_report_parser.py. Runs entirely on
localhost: uploaded PDFs live in a temp folder for the lifetime of the
process, nothing leaves the machine.

Endpoints
---------
POST /api/parse   - upload one PDF, parse it, return a JSON summary plus the
                     finished .xlsx inline as base64 (same contract as the
                     Vercel backend in api/index.py, so the frontend doesn't
                     need to special-case which one it's talking to)
GET  /api/health  - liveness check

USAGE
-----
    pip install -r requirements.txt
    uvicorn main:app --port 8000
"""

import base64
import sys
import tempfile
import uuid
from pathlib import Path

from fastapi import FastAPI, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# clocking_report_parser.py lives two levels up (the project root), alongside
# the desktop app - reuse it rather than reimplementing the parsing/business
# logic here.
PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))
import clocking_report_parser as parser  # noqa: E402

app = FastAPI(title="Clocking Report Parser")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ParseResult(BaseModel):
    filename: str
    status: str  # "ok" | "error"
    message: str
    events: int | None = None
    days: int | None = None
    shifts: int | None = None
    total_hours: float | None = None
    xlsx_base64: str | None = None
    download_name: str | None = None


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/parse", response_model=ParseResult)
async def parse_pdf(
    file: UploadFile,
    work_days: str = Form(default="mon,tue,wed,thu,fri"),
    hours_per_day: float = Form(default=parser.DEFAULT_HOURS_PER_DAY),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only .pdf files are supported")
    try:
        parsed_work_days = parser.parse_work_days(work_days)
    except ValueError as e:
        raise HTTPException(400, str(e))

    job_dir = Path(tempfile.mkdtemp(prefix=f"clocking_{uuid.uuid4().hex}_"))
    in_path = job_dir / file.filename
    with open(in_path, "wb") as f:
        f.write(await file.read())

    out_name = Path(file.filename).stem + "_parsed.xlsx"
    out_path = job_dir / out_name

    try:
        meta, records = parser.parse_pdf(str(in_path))
        if not records:
            raise ValueError(
                "No clocking records found - check the PDF layout / column x-positions."
            )

        df = parser.build_dataframe(records)
        full_daily = parser.build_daily_summary(df, meta["Date From"], meta["Date To"])
        shifts_df = parser.build_hours_worked(df)
        timesheet_df = parser.build_timesheet(
            df, meta, work_days=parsed_work_days, hours_per_day=hours_per_day
        )

        parser.build_workbook(
            meta, timesheet_df, out_path, work_days=parsed_work_days, hours_per_day=hours_per_day
        )

        total_hours = float(shifts_df["Hours Worked"].sum())
        xlsx_bytes = out_path.read_bytes()

        return ParseResult(
            filename=file.filename,
            status="ok",
            message=f"{meta.get('First Names', '')} {meta.get('SurName', '')}".strip()
            or "Parsed successfully",
            events=len(records),
            days=int(full_daily.shape[0]),
            shifts=len(shifts_df),
            total_hours=round(total_hours, 2),
            xlsx_base64=base64.b64encode(xlsx_bytes).decode("ascii"),
            download_name=out_name,
        )
    except Exception as e:
        return ParseResult(filename=file.filename, status="error", message=str(e))


# Serve the built frontend (npm run build -> ../frontend/dist), if present.
FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
