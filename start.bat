@echo off
echo ============================================
echo   FLEXA AI Fitness Planner
echo   Starting Backend + Frontend...
echo ============================================

echo [1/2] Starting FastAPI backend (port 8000)...
start "FLEXA Backend" cmd /k "set PYTHONIOENCODING=utf-8 && d:\CUI'26\FYP\Flexa\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir d:\CUI'26\FYP\Flexa\flexa-backend --reload --host 0.0.0.0 --port 8000"

echo Waiting for backend to initialize...
timeout /t 4 /nobreak >nul

echo [2/2] Starting React frontend (port 3000)...
start "FLEXA Frontend" cmd /k "cd /d d:\CUI'26\FYP\Flexa\flexa-frontend && node node_modules\react-scripts\bin\react-scripts.js start"

echo.
echo ============================================
echo  Backend:  http://localhost:8000
echo  API Docs: http://localhost:8000/docs
echo  Frontend: http://localhost:3000
echo ============================================
echo  Both servers are starting in separate windows.
echo  Close those windows to stop the servers.
echo ============================================
