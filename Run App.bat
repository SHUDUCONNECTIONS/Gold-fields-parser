@echo off
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
    echo Python was not found on this PC. Install it from https://python.org then run this again.
    pause
    exit /b 1
)
python -c "import pdfplumber, pandas, openpyxl, tkinterdnd2" >nul 2>nul
if errorlevel 1 (
    echo Installing required packages one time only, this can take a minute...
    python -m pip install -r requirements.txt
)
python clocking_report_app.py
if errorlevel 1 pause
