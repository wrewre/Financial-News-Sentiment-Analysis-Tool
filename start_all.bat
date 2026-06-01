@echo off
title Financial Sentiment Analyzer — Startup
color 0A

echo.
echo ============================================================
echo   Financial Sentiment Analyzer — Starting All Services
echo ============================================================
echo.

REM ── Check Python ─────────────────────────────────────────────
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Please install Python 3.9+
    pause
    exit /b 1
)

REM ── Check Node.js ─────────────────────────────────────────────
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Please install Node.js 18+
    pause
    exit /b 1
)

echo [1/3] Starting Python FinBERT service on port 5001...
echo       (First run downloads ~440MB model — be patient)
echo.
start "FinBERT Service (port 5001)" cmd /k "cd /d %~dp0server && python flask_service.py"

REM Wait for Python service to initialize (model loading takes time)
echo       Waiting 5s before starting Node server...
timeout /t 5 /nobreak >nul

echo [2/3] Starting Node.js API server on port 3001...
start "Node API (port 3001)" cmd /k "cd /d %~dp0server && node index.js"

timeout /t 2 /nobreak >nul

echo [3/3] Starting React frontend on port 5173...
start "React Frontend (port 5173)" cmd /k "cd /d %~dp0 && npm run dev"

echo.
echo ============================================================
echo   All services launching in separate windows!
echo.
echo   Frontend  → http://localhost:5173
echo   Node API  → http://localhost:3001
echo   FinBERT   → http://localhost:5001/health
echo.
echo   Wait for the FinBERT window to print "Service ready"
echo   before using the app.
echo ============================================================
echo.
pause
