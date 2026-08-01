@echo off
setlocal enabledelayedexpansion

set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%backend"

if not exist "venv\Scripts\activate.bat" (
    echo [ERROR] venv not found
    echo Run in backend\:  python -m venv venv
    echo Then:  venv\Scripts\activate ^&^& pip install -r requirements.txt
    pause
    exit /b 1
)

call venv\Scripts\activate.bat
set PYTHONPATH=%SCRIPT_DIR%
echo ========================================
echo CorpSec Platform — http://127.0.0.1:8000
echo Docs — http://127.0.0.1:8000/docs
echo ========================================
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
pause
