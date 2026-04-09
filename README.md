# DocMind — AI Knowledge Assistant

> Upload documents → ask questions → get AI-powered answers with RAG

---

## Architecture

```
React Frontend (Vite, port 3000)
        │
        │  REST API
        ▼
FastAPI Backend (port 8000)
        │
        ├── Text Extraction  (PyMuPDF / plain text / Markdown)
        ├── Chunking         (sliding-window, ~400 words)
        ├── Embeddings       (sentence-transformers: all-MiniLM-L6-v2)
        ├── Vector Store     (FAISS IndexFlatL2, in-memory)
        ├── ML Classifier    (PyTorch MLP — doc category detection)
        └── LLM (RAG)        (Anthropic Claude via API)
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 18 |
| Python | ≥ 3.10 |
| pip | latest |
| Anthropic API key | from console.anthropic.com |

---

## Quick Start (3 steps)

### Step 1 — Backend

```bash
cd backend

# Create & activate virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies (first time ~2-3 min, downloads ML models)
pip install -r requirements.txt

# Set your Anthropic API key
# Windows PowerShell:
$env:ANTHROPIC_API_KEY = "sk-ant-..."
# Mac/Linux:
export ANTHROPIC_API_KEY="sk-ant-..."

# Run the server
uvicorn main:app --reload --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Loading sentence-transformer …
INFO:     Initialising document classifier …
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
2. The backend extracts text, chunks it, builds embeddings, classifies the doc
3. Click **Chat** → ask anything about the document
4. Relevant chunks are retrieved via FAISS → sent to Claude → answer displayed

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/upload` | Upload & index a document |
| POST | `/chat` | Ask a question about a document |
| DELETE | `/documents/{doc_id}` | Remove a document |

### Upload response example
```json
{
  "doc_id": "a3f1c2d4-...",
  "filename": "resume.pdf",
  "chunk_count": 12,
  "category": "resume",
  "confidence": 0.87,
  "word_count": 4823
}
```

### Chat request / response
```json
// POST /chat
{ "doc_id": "a3f1c2d4-...", "question": "What are the key skills?" }

// Response
{
  "answer": "Based on the document, the key skills include ...",
  "sources": ["chunk 1 text ...", "chunk 2 text ..."]
}
```

---

## ML Components (for academic/interview explanation)

### 1. Sentence Embeddings (sentence-transformers)
- Model: `all-MiniLM-L6-v2` — 384-dimensional dense vectors
- Each text chunk is converted to an embedding that captures semantic meaning
- Similar content → vectors close together in embedding space

### 2. FAISS Vector Index
- `IndexFlatL2` — exact L2 distance search
- At query time: question is embedded → top-K nearest chunks retrieved
- This is the **retrieval** step in RAG

### 3. PyTorch MLP Classifier (`DocClassifier`)
- 3-layer feedforward network: 384 → 256 → 128 → 6
- Input: mean embedding of first 500 words of document
- Output: probability over 6 categories (resume, legal, technical, research, financial, notes)
- Uses keyword-frequency hybrid scoring for robust out-of-the-box accuracy

### 4. RAG Pipeline
```
User question
     │
     ▼
Embed question (MiniLM)
     │
     ▼
FAISS top-K search over document chunks
     │
     ▼
Concatenate retrieved chunks as context
     │
     ▼
Claude API: system prompt + context + question
     │
     ▼
Answer returned to user
```

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
│       ├── App.css
│       ├── index.css
│       └── components/
│           ├── DashboardView.jsx / .css
│           ├── UploadView.jsx   / .css
│           └── ChatView.jsx     / .css
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
| `ANTHROPIC_API_KEY` not set | Export it before running uvicorn |
| `faiss-cpu` install fails | Try `pip install faiss-cpu --no-cache-dir` |
| PDF text empty | Scanned PDFs not supported (add OCR with pytesseract if needed) |
| CORS error | Make sure backend is on port 8000 and frontend on 3000 |
| `torch` takes too long | Normal for first install; or use CPU-only: `pip install torch --index-url https://download.pytorch.org/whl/cpu` |

---

## Get your Anthropic API Key

1. Go to https://console.anthropic.com
2. Sign up / log in
3. Click **API Keys** → **Create Key**
4. Copy and export as `ANTHROPIC_API_KEY`

Free tier: $5 credit — plenty for academic demos.

---

## For VIT Academic Submission

**Technologies demonstrated:**
- ✅ React.js frontend with component architecture
- ✅ FastAPI REST backend
- ✅ PyTorch neural network (document classifier)
- ✅ Sentence Transformers (embedding model)
- ✅ FAISS vector database
- ✅ RAG pipeline (Retrieval-Augmented Generation)
- ✅ LLM integration (Anthropic Claude)
- ✅ PDF/text processing pipeline
- ✅ Full-stack integration

**Registration:** 22MIS1035
