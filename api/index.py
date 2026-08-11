"""
Clocking Report Parser - Vercel serverless backend
=====================================================
A FastAPI app deployed as a single Vercel Python function. Unlike the local
webapp/backend (a long-running uvicorn server with a job-id + separate
download step), serverless functions are stateless and don't share disk
across requests/instances - so /api/parse does everything in ONE request:
parse the uploaded PDF and hand back the finished .xlsx inline (base64) in
the same JSON response, rather than a two-step upload-then-download.

No auth gate: nothing is ever written to persistent storage (a PDF is
parsed and gone once the response is sent), so there's no stored data to
protect - anyone with the URL can use the tool.
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

# clocking_report_parser.py lives at the project root, one level up from
# this function - reuse it rather than reimplementing the parsing logic.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))
import clocking_report_parser as parser  # noqa: E402

app = FastAPI(title="Clocking Report Parser")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


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


# Serve the built frontend (webapp/frontend/dist, bundled into this function
# via vercel.json's includeFiles) for every other path. Vercel now routes
# ALL requests for this project through this one FastAPI app rather than
# hosting static files separately, so this app has to handle both jobs -
# registered last so it doesn't shadow the /api/* routes above.
FRONTEND_DIST = PROJECT_ROOT / "webapp" / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
