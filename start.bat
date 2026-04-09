@echo off
echo ========================================
echo   DocMind — AI Knowledge Assistant
echo ========================================
echo.

:: ── Backend ──────────────────────────────
echo [1/3] Setting up Python backend...
cd backend
if not exist venv (
    python -m venv venv
    echo Virtual environment created.
)
call venv\Scripts\activate

pip install -r requirements.txt --quiet

if "%ANTHROPIC_API_KEY%"=="" (
    echo.
    echo ERROR: ANTHROPIC_API_KEY is not set!
    echo Run: set ANTHROPIC_API_KEY=sk-ant-your-key-here
    echo Then run this script again.
    pause
    exit /b 1
)

echo Starting FastAPI backend on port 8000...
start "DocMind Backend" cmd /k "venv\Scripts\activate && uvicorn main:app --reload --port 8000"

:: ── Frontend ─────────────────────────────
cd ..\frontend
echo.
echo [2/3] Installing Node packages...
call npm install --silent

echo.
echo [3/3] Starting React frontend on port 3000...
start "DocMind Frontend" cmd /k "npm run dev"

echo.
echo ✓ Both servers starting...
echo   Frontend → http://localhost:3000
echo   Backend  → http://localhost:8000
echo   API Docs → http://localhost:8000/docs
echo.
pause
