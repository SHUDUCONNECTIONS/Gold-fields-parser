"""
Clocking Report Parser - Vercel serverless backend
=====================================================
A FastAPI app deployed as a single Vercel Python function. Unlike the local
webapp/backend (a long-running uvicorn server with a job-id + separate
download step), serverless functions are stateless and don't share disk
across requests/instances - so /api/parse does everything in ONE request:
parse the uploaded PDF and hand back the finished .xlsx inline (base64) in
the same JSON response, rather than a two-step upload-then-download.

Access is gated by a single shared password (APP_PASSWORD env var, set in
the Vercel project settings) sent as `Authorization: Bearer <password>` on
protected requests. If APP_PASSWORD isn't set at all (e.g. local dev without
configuring it), the gate is skipped rather than locking everyone out.
"""

import base64
import os
import sys
import tempfile
import uuid
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, UploadFile
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


def require_password(authorization: str | None):
    expected = os.environ.get("APP_PASSWORD")
    if not expected:
        return  # no password configured - gate disabled (local dev)
    token = (authorization or "").removeprefix("Bearer ").strip()
    if token != expected:
        raise HTTPException(401, "Wrong or missing password")


class LoginRequest(BaseModel):
    password: str


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/login")
def login(body: LoginRequest):
    expected = os.environ.get("APP_PASSWORD")
    if expected and body.password != expected:
        raise HTTPException(401, "Wrong password")
    return {"ok": True}


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
async def parse_pdf(file: UploadFile, authorization: str | None = Header(default=None)):
    require_password(authorization)

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only .pdf files are supported")

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
        timesheet_df = parser.build_timesheet(df, meta)

        parser.build_workbook(meta, timesheet_df, out_path)

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
