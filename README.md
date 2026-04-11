# DocMind — AI Knowledge Assistant

> Upload documents → ask questions → get AI-powered answers

**Live Demo:** https://docmind-6xll.vercel.app/

---

## Deployment

- **Frontend (UI):** https://docmind-6xll.vercel.app/ (Vercel)
- **Backend (API):** https://docmind-4fy3.onrender.com (Render)

> Note: I used Vercel for frontend hosting and Render for backend. This is intentional since:
> - Vercel: Great for static/React frontend, fast CDN
> - Render: Good for Python/FastAPI backend with free tier

---

## Architecture

```
React Frontend (Vite, Vercel port 3000)
        │
        │  REST API
        ▼
FastAPI Backend (Render port 8000)
        │
        ├── Text Extraction  (PyMuPDF / plain text / Markdown)
        ├── Chunking         (sliding-window, ~10 sentences)
        ├── Keyword Search  (inverted index)
        └── LLM (RAG)    (OpenRouter API)
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 18 |
| Python | ≥ 3.10 |
| pip | latest |
| OpenRouter API key | from openrouter.ai |

---

## Quick Start (Local Development)

### Step 1 — Backend

```bash
cd backend

# Create & activate virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set your OpenRouter API key
# Windows PowerShell:
$env:OPENROUTER_API_KEY = "sk-or-..."
# Mac/Linux:
export OPENROUTER_API_KEY="sk-or-..."

# Run the server
uvicorn main:app --reload --port 8000
```

### Step 2 — Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**

### Step 3 — Use it!

1. Click **Upload** → drag & drop a PDF, TXT, or MD file
2. The backend extracts text, chunks it, classifies the doc
3. Click **Chat** → ask anything about the document
4. Relevant chunks are retrieved → sent to LLM → answer displayed

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/documents` | List all uploaded documents |
| GET | `/documents/search` | Search documents by keyword |
| POST | `/upload` | Upload & index a document |
| POST | `/chat` | Ask a question about a document |
| POST | `/chat/stream` | Streaming chat response |
| DELETE | `/documents/{doc_id}` | Remove a document |

---

## Project Structure

```
docmind/
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       └── components/
│           ├── DashboardView.jsx
│           ├── UploadView.jsx
│           ├── ChatView.jsx
│           └── SearchView.jsx
│
└── backend/
    ├── main.py            ← FastAPI app (all logic here)
    ├── requirements.txt
    └── uploads/           ← auto-created, stores uploaded files
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `OPENROUTER_API_KEY` not set | Export it before running uvicorn |
| PDF text empty | Scanned PDFs not supported (add OCR if needed) |
| CORS error | Check backend CORS middleware settings |
| Slow LLM response | OpenRouter free tier is slow; consider upgrading |

---

## Get your OpenRouter API Key

1. Go to https://openrouter.ai
2. Sign up / log in
3. Click **API Keys** → **Create Key**
4. Copy and export as `OPENROUTER_API_KEY`

Free tier available with limited credits.

---

## Technologies Demonstrated

- ✅ React.js frontend with component architecture
- ✅ FastAPI REST backend
- ✅ Keyword-based document retrieval
- ✅ RAG pipeline (Retrieval-Augmented Generation)
- ✅ LLM integration (OpenRouter)
- ✅ PDF/text processing pipeline
- ✅ Full-stack integration (Vercel + Render)

**Registration:** 22MIS1035