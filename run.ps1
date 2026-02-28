Write-Host "============================================" -ForegroundColor Yellow
Write-Host "  FLEXA AI Fitness Planner" -ForegroundColor Yellow
Write-Host "  Starting Backend + Frontend..." -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Yellow

Write-Host "`n[1/2] Starting FastAPI backend (port 8000)..." -ForegroundColor Cyan
Start-Process -FilePath "cmd" -ArgumentList "/k cd /d `"d:\CUI'26\FYP\Flexa\flexa-backend`" && venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000" -WindowStyle Normal

Write-Host "Waiting for backend to initialize..." -ForegroundColor Gray
Start-Sleep -Seconds 4

Write-Host "[2/2] Starting React frontend (port 3000)..." -ForegroundColor Cyan
Start-Process -FilePath "cmd" -ArgumentList "/k cd /d `"d:\CUI'26\FYP\Flexa\flexa-frontend`" && node node_modules\react-scripts\bin\react-scripts.js start" -WindowStyle Normal

Write-Host ""
Write-Host "============================================" -ForegroundColor Yellow
Write-Host "  Backend:  http://localhost:8000" -ForegroundColor Green
Write-Host "  API Docs: http://localhost:8000/docs" -ForegroundColor Green
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Yellow
Write-Host "  Both servers starting in separate windows." -ForegroundColor Gray
Write-Host "  Close those cmd windows to stop servers." -ForegroundColor Gray
Write-Host "============================================" -ForegroundColor Yellow
