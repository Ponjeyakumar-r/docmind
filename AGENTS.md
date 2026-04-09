# DocMind — AGENTS.md

## Quick Setup

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt

# Frontend
cd frontend
npm install
```

## Running the App

**Required**: Set `OPENROUTER_API_KEY` environment variable before starting backend.

```bash
# Terminal 1: Backend (port 8000)
export OPENROUTER_API_KEY="sk-or-..."
cd backend
uvicorn main:app --reload --port 8000

# Terminal 2: Frontend (port 3000)
cd frontend
npm run dev
```

Open http://localhost:3000

## Key Commands

| Task | Command |
|------|---------|
| Start backend | `uvicorn main:app --reload --port 8000` |
| Start frontend | `npm run dev` |
| Install backend deps | `pip install -r requirements.txt` |
| Install frontend deps | `npm install` |

## Project Structure

- `backend/main.py` — FastAPI app, all logic (upload, chat, RAG pipeline)
- `backend/uploads/` — stores uploaded files (auto-created)
- `frontend/src/` — React components (DashboardView, UploadView, ChatView)

## Important Notes

- **API key required**: `OPENROUTER_API_KEY` must be exported before running uvicorn
- **Ports**: frontend 3000, backend 8000
- **RAG flow**: upload → extract → chunk → embed → FAISS index → Claude RAG
- **ML models**: sentence-transformers (all-MiniLM-L6-v2), PyTorch MLP classifier
- **Supported formats**: PDF, TXT, MD
