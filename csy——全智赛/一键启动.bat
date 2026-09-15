@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
set "WORKSPACE_DIR=%SCRIPT_DIR%.."
set "BACKEND_DIR=%SCRIPT_DIR%backend"
set "FRONTEND_DIR=%SCRIPT_DIR%..\apps\main-platform"

rem ============================================================
rem  1. Backend - Python / uvicorn :8000
rem ============================================================

set "PYTHON_EXE=%BACKEND_DIR%\venv\Scripts\python.exe"
set "PYTHONPATH=%BACKEND_DIR%;%SCRIPT_DIR%;%BACKEND_DIR%\venv\Lib\site-packages"
set "TRACE_FINGERPRINT_KEY=dev-trace-fingerprint-key"

set "SYSTEM_PYTHON="

rem The copied venv may point to a Python installation from another machine.
if not exist "%PYTHON_EXE%" set "PYTHON_EXE="
if defined PYTHON_EXE (
    "%PYTHON_EXE%" -c "import sys" >nul 2>&1
    if errorlevel 1 set "PYTHON_EXE="
)

if not defined PYTHON_EXE (
    if exist "%LocalAppData%\Python\bin\python.exe" set "PYTHON_EXE=%LocalAppData%\Python\bin\python.exe"
)

if not defined PYTHON_EXE (
    for /f "delims=" %%P in ('where python 2^>nul') do (
        if not defined SYSTEM_PYTHON set "SYSTEM_PYTHON=%%P"
    )
)

if not defined SYSTEM_PYTHON if exist "%LocalAppData%\Python\bin\python.exe" set "SYSTEM_PYTHON=%LocalAppData%\Python\bin\python.exe"

if not defined PYTHON_EXE set "PYTHON_EXE=%SYSTEM_PYTHON%"

if not defined PYTHON_EXE (
    echo [ERROR] No usable Python executable found.
    echo Install Python 3.11+ and ensure "python" is on PATH.
    goto :startup_error
)

"%PYTHON_EXE%" -c "import fastapi, uvicorn, fastapi.sse, networkx" >nul 2>&1
if errorlevel 1 (
    echo [INFO] Backend dependencies are missing; preparing the local virtual environment...
    if not defined SYSTEM_PYTHON set "SYSTEM_PYTHON=%PYTHON_EXE%"
    if not exist "%BACKEND_DIR%\venv\Scripts\python.exe" (
        "%SYSTEM_PYTHON%" -m venv "%BACKEND_DIR%\venv"
        if errorlevel 1 (
            echo [ERROR] Could not create backend virtual environment.
            goto :startup_error
        )
    )
    set "PYTHON_EXE=%BACKEND_DIR%\venv\Scripts\python.exe"
    "%PYTHON_EXE%" -m pip install -r "%BACKEND_DIR%\requirements.txt"
    if errorlevel 1 (
        echo [ERROR] Backend dependency installation failed.
        goto :startup_error
    )
)

rem ============================================================
rem  2. Frontend - pnpm :3000
rem ============================================================

set "PNPM_CMD=pnpm"
where pnpm >nul 2>&1
if errorlevel 1 (
    echo [WARN] pnpm not found, trying npx pnpm...
    set "PNPM_CMD=npx pnpm"
)

if not exist "%FRONTEND_DIR%\package.json" (
    echo [WARN] Frontend not found, starting backend only...
    goto :backend_only
)

if not exist "%FRONTEND_DIR%\node_modules\.bin\next.cmd" (
    echo [INFO] Frontend dependencies are missing; installing the workspace packages...
    pushd "%WORKSPACE_DIR%"
    call %PNPM_CMD% install --frozen-lockfile
    set "PNPM_INSTALL_CODE=!ERRORLEVEL!"
    popd
    if not "!PNPM_INSTALL_CODE!"=="0" (
        echo [ERROR] Frontend dependency installation failed.
        goto :startup_error
    )
)

rem ============================================================
rem  2.1 PDF export runtime - Playwright Chromium
rem ============================================================

rem PDF export uses Playwright on the server. Check the exact browser
rem executable first so normal launches never download it again.
pushd "%FRONTEND_DIR%"
node -e "const {chromium}=require('@playwright/test'); const fs=require('fs'); process.exit(fs.existsSync(chromium.executablePath())?0:1)" >nul 2>&1
if errorlevel 1 (
    echo [INFO] PDF browser is missing. Installing Chromium once...
    if exist "%FRONTEND_DIR%\node_modules\.bin\playwright.cmd" (
        call "%FRONTEND_DIR%\node_modules\.bin\playwright.cmd" install chromium
    ) else (
        echo [WARN] Playwright CLI not found; PDF export will be unavailable.
    )
    if errorlevel 1 echo [WARN] Chromium installation failed; TXT/Markdown export remains available.
)
popd

rem ============================================================
rem  3. Launch both in separate windows
rem ============================================================

echo ========================================
echo  CorpSec Platform - Starting...
echo ========================================
echo  Backend  : http://127.0.0.1:8000
echo  API Docs : http://127.0.0.1:8000/docs
echo  Frontend : http://localhost:3000
echo ========================================

start "CorpSec Backend :8000" cmd /k "cd /d "%BACKEND_DIR%" && set "PYTHONPATH=%PYTHONPATH%" && set "TRACE_FINGERPRINT_KEY=dev-trace-fingerprint-key" && "%PYTHON_EXE%" -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload"

rem If the teammate already ran pnpm dev, keep that frontend and only launch the backend above.
set "FRONTEND_RUNNING="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":3000 .*LISTENING"') do set "FRONTEND_RUNNING=1"
if defined FRONTEND_RUNNING (
    echo Frontend :3000 is already running; reusing it.
) else (
    start "CorpSec Frontend :3000" cmd /k "cd /d "%FRONTEND_DIR%" && %PNPM_CMD% dev"
)

echo.
echo Both services launched in separate windows.
echo Press any key to open browser...
pause >nul

start http://localhost:3000
exit /b 0

:backend_only
echo ========================================
echo  CorpSec Backend :8000
echo  API Docs : http://127.0.0.1:8000/docs
echo ========================================
"%PYTHON_EXE%" -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" echo [ERROR] Backend stopped with exit code %EXIT_CODE%.
pause
exit /b %EXIT_CODE%

:startup_error
pause
exit /b 1
