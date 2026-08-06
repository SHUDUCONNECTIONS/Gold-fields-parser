@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

set PORT=8000
set URL=http://127.0.0.1:%PORT%

rem Already running (e.g. from an earlier launch today)? Just reopen the
rem app window instead of starting a second server.
netstat -ano | findstr ":%PORT% " | findstr "LISTENING" >nul 2>nul
if not errorlevel 1 goto openapp

where python >nul 2>nul
if errorlevel 1 (
    echo Python was not found on this PC. Install it from https://python.org then run this again.
    pause
    exit /b 1
)

python -c "import fastapi, uvicorn, pdfplumber, pandas, openpyxl" >nul 2>nul
if errorlevel 1 (
    echo Setting up - this is one-time only and can take a minute...
    python -m pip install -r requirements.txt
)

if not exist "webapp\frontend\dist\index.html" (
    where npm >nul 2>nul
    if errorlevel 1 (
        echo Node.js was not found, needed to build the app the first time.
        echo Install it from https://nodejs.org then run this again.
        pause
        exit /b 1
    )
    echo Building the app - this is one-time only and can take a minute...
    pushd webapp\frontend
    call npm install
    call npm run build
    popd
)

rem Launch the server with no visible console window (pythonw has none).
where pythonw >nul 2>nul
if errorlevel 1 (set PYCMD=python) else (set PYCMD=pythonw)
start "" /min !PYCMD! -m uvicorn main:app --app-dir "webapp\backend" --port %PORT%

rem Wait for it to come up (up to ~20s). Note: "timeout" fails if this was
rem launched from a context with no real console attached, so "ping" is
rem used as a portable ~1-second delay instead.
set tries=0
:waitloop
ping -n 2 127.0.0.1 >nul
netstat -ano | findstr ":%PORT% " | findstr "LISTENING" >nul 2>nul
if not errorlevel 1 goto openapp
set /a tries+=1
if !tries! lss 20 goto waitloop

:openapp
rem Opens as its own app window (no address bar/tabs) if Edge is present,
rem which it is on every standard Windows 10/11 install; otherwise falls
rem back to a normal browser tab.
start "" msedge --app=%URL% 2>nul || start "" %URL%
exit /b 0
