#!/bin/bash
echo "========================================"
echo "  DocMind — AI Knowledge Assistant"
echo "========================================"
echo ""

# ── Load env vars ───────────────────────────
if [ -f backend/.env ]; then
    export $(cat backend/.env | xargs)
fi

# ── Check API key ─────────────────────────
if [ -z "$OPENROUTER_API_KEY" ]; then
    echo "ERROR: OPENROUTER_API_KEY is not set."
    echo "Run: export OPENROUTER_API_KEY=sk-or-..."
    exit 1
fi

# ── Backend ───────────────────────────────
echo "[1/3] Setting up Python backend..."
cd backend
python3 -m venv venv 2>/dev/null
source venv/bin/activate
pip install -r requirements.txt -q
echo "Starting backend on port 8000..."
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
cd ..

# ── Frontend ──────────────────────────────
echo "[2/3] Installing Node packages..."
cd frontend
npm install -q

echo "[3/3] Starting frontend on port 3000..."
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✓ DocMind is running!"
echo "  Frontend → http://localhost:3000"
echo "  Backend  → http://localhost:8000"
echo "  API Docs → http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both servers."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
