@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
set "BACKEND_DIR=%SCRIPT_DIR%backend"
cd /d "%BACKEND_DIR%" || goto :startup_error

set "PYTHON_EXE=%BACKEND_DIR%\venv\Scripts\python.exe"
set "PYTHONPATH=%BACKEND_DIR%;%SCRIPT_DIR%;%BACKEND_DIR%\venv\Lib\site-packages"
set "TRACE_FINGERPRINT_KEY=dev-trace-fingerprint-key"

rem The copied venv may point to a Python installation from another machine.
if exist "%PYTHON_EXE%" (
    "%PYTHON_EXE%" -c "import sys" >nul 2>&1
    if errorlevel 1 set "PYTHON_EXE="
)

if not defined PYTHON_EXE (
    if exist "%LocalAppData%\Python\bin\python.exe" set "PYTHON_EXE=%LocalAppData%\Python\bin\python.exe"
)

if not defined PYTHON_EXE (
    for /f "delims=" %%P in ('where python 2^>nul') do (
        if not defined PYTHON_EXE set "PYTHON_EXE=%%P"
    )
)

if not defined PYTHON_EXE (
    echo [ERROR] No usable Python executable found.
    echo Install Python 3.11+ and ensure "python" is on PATH.
    goto :startup_error
)

"%PYTHON_EXE%" -c "import fastapi, uvicorn, fastapi.sse" >nul 2>&1
if errorlevel 1 (
    echo [ERROR] FastAPI dependencies are unavailable.
    echo Python: %PYTHON_EXE%
    echo Run: "%PYTHON_EXE%" -m pip install -r "%BACKEND_DIR%\requirements.txt"
    goto :startup_error
)

echo ========================================
echo CorpSec Platform - http://127.0.0.1:8000
echo Docs - http://127.0.0.1:8000/docs
echo ========================================
"%PYTHON_EXE%" -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" echo [ERROR] Backend stopped with exit code %EXIT_CODE%.
pause
exit /b %EXIT_CODE%

:startup_error
pause
exit /b 1
