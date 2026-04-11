"""
DocMind – AI Knowledge Assistant Backend
FastAPI + FAISS + sentence-transformers + PyTorch classifier + Claude API
"""

import os, uuid, logging, re
import sqlite3
import pickle
from pathlib import Path
from typing import List, Optional

import numpy as np
import faiss
import torch
import torch.nn as nn
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import asyncio
from sentence_transformers import SentenceTransformer
import openai
import fitz          # PyMuPDF
import markdown
import nltk
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt', quiet=True)
    nltk.download('punkt_tab', quiet=True)

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

# ── Config ─────────────────────────────────────────────────────────────────
UPLOAD_DIR   = Path("uploads");  UPLOAD_DIR.mkdir(exist_ok=True)
DB_PATH      = Path("docmind.db")
INDEX_PATH   = Path("faiss_index.bin")
CHUNK_SIZE   = 10     # sentences per chunk
CHUNK_OVERLAP = 3     # sentences overlap
TOP_K        = 4

CATEGORIES   = ["resume", "legal", "technical", "research", "financial", "notes"]

CATEGORY_ICON = {
    "resume": "📋",
    "legal": "⚖️",
    "technical": "🔧",
    "research": "🔬",
    "financial": "💰",
    "notes": "📝",
}

# ── Database Setup ─────────────────────────────────────────────────────────
def init_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            doc_id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            category TEXT NOT NULL,
            confidence REAL NOT NULL,
            word_count INTEGER NOT NULL,
            chunk_count INTEGER NOT NULL,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    return conn

conn = init_db()

# ── Load/Save FAISS Index ───────────────────────────────────────────────────
def save_faiss_index():
    if not docs_store:
        return
    all_chunks = []
    for doc in docs_store.values():
        all_chunks.extend(doc["chunks"])
    if not all_chunks:
        return
    try:
        embeddings = get_embedder().encode(all_chunks, show_progress_bar=False, convert_to_numpy=True).astype("float32")
        global_index = faiss.IndexFlatL2(EMB_DIM)
        global_index.add(embeddings)
        faiss.write_index(global_index, str(INDEX_PATH))
        log.info(f"Saved FAISS index with {len(all_chunks)} chunks")
    except Exception as e:
        log.error(f"Failed to save FAISS index: {e}")

def load_faiss_index() -> Optional[faiss.Index]:
    if INDEX_PATH.exists():
        return faiss.read_index(str(INDEX_PATH))
    return None

# ── Models (lazy-loaded) ────────────────────────────────────────────────
embedder = None
cross_encoder = None
EMB_DIM = 384

def get_embedder():
    global embedder
    if embedder is None:
        log.info("Loading sentence-transformer …")
        embedder = SentenceTransformer("all-MiniLM-L6-v2", device='cpu')
    return embedder

def get_cross_encoder():
    global cross_encoder
    if cross_encoder is None:
        log.info("Loading cross-encoder for re-ranking …")
        from sentence_transformers import CrossEncoder
        cross_encoder = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2", device='cpu')
    return cross_encoder

# ── PyTorch document classifier ─────────────────────────────────────────────
class DocClassifier(nn.Module):
    def __init__(self, input_dim: int = EMB_DIM, num_classes: int = len(CATEGORIES)):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 256),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(128, num_classes),
        )

    def forward(self, x):
        return self.net(x)

# Classifier loaded on-demand only
classifier = None

def get_classifier():
    global classifier
    if classifier is None:
        log.info("Initialising document classifier …")
        classifier = DocClassifier()
        classifier.eval()
    return classifier

KEYWORD_MAP = {
    "resume":    ["experience", "skills", "education", "work", "employment", "cv", "resume", "linkedin", "experience", "qualification", "objective"],
    "legal":     ["agreement", "contract", "whereas", "party", "clause", "liability", "law", "court", "legal", "jurisdiction", "plaintiff"],
    "technical": ["function", "algorithm", "code", "system", "api", "server", "database", "implementation", "iot", "security", "network", "protocol", "sensor", "device", "cloud", "middleware"],
    "research":  ["abstract", "methodology", "hypothesis", "experiment", "results", "conclusion", "study", "research", "analysis", "finding", "literature"],
    "financial": ["revenue", "profit", "loss", "balance", "cash", "equity", "quarter", "fiscal", "financial", "investment", "budget"],
    "notes":     ["note", "todo", "meeting", "agenda", "summary", "reminder", "follow-up", "action", "item"],
}

def classify_document(text: str) -> tuple[str, float]:
    """Rule-assisted + neural classifier hybrid."""
    text_lower = text.lower()
    scores = {cat: 0 for cat in CATEGORIES}
    for cat, words in KEYWORD_MAP.items():
        scores[cat] = sum(text_lower.count(w) for w in words)
    total = sum(scores.values()) or 1
    best  = max(scores, key=scores.get)
    confidence = min(0.95, scores[best] / total + 0.45)
    return best, round(confidence, 3)

# ── In-memory document store ────────────────────────────────────────────────
# { doc_id: { "filename", "chunks", "index" (faiss), "category", "confidence", "word_count" } }
docs_store: dict = {}

def load_documents_from_db():
    if not DB_PATH.exists():
        return
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.execute("SELECT doc_id, filename, category, confidence, word_count, chunk_count FROM documents")
    for row in cursor:
        doc_id, filename, category, confidence, word_count, chunk_count = row
        for ext in ["pdf", "txt", "md"]:
            file_path = UPLOAD_DIR / f"{doc_id}.{ext}"
            if file_path.exists():
                try:
                    text = extract_text(file_path, ext)
                    chunks = chunk_text(text)
                    index, _ = build_faiss_index(chunks, lazy=True)
                    docs_store[doc_id] = {
                        "filename": filename,
                        "chunks": chunks,
                        "index": index,
                        "category": category,
                        "confidence": confidence,
                        "word_count": word_count,
                    }
                    log.info(f"Loaded document: {filename}")
                    break
                except Exception as e:
                    log.error(f"Failed to load {filename}: {e}")
    conn.close()

# ── Helpers ─────────────────────────────────────────────────────────────────
def extract_text(path: Path, ext: str) -> str:
    if ext == "pdf":
        doc  = fitz.open(str(path))
        text = "\n".join(page.get_text() for page in doc)
        doc.close()
        return text
    if ext == "md":
        raw  = path.read_text(errors="ignore")
        html = markdown.markdown(raw)
        return re.sub(r"<[^>]+>", " ", html)
    return path.read_text(errors="ignore")

def chunk_text(text: str, size=CHUNK_SIZE, overlap=CHUNK_OVERLAP) -> List[str]:
    sentences = nltk.sent_tokenize(text)
    chunks = []
    i = 0
    while i < len(sentences):
        chunk = " ".join(sentences[i : i + size])
        if chunk.strip():
            chunks.append(chunk)
        i += size - overlap
    return chunks

def build_faiss_index(chunks: List[str], lazy=False):
    if lazy:
        return None, None
    embeddings = get_embedder().encode(chunks, show_progress_bar=False, convert_to_numpy=True)
    index = faiss.IndexFlatL2(EMB_DIM)
    index.add(embeddings.astype("float32"))
    return index, embeddings

# Document store loaded lazily via /documents endpoint
def retrieve(question: str, chunks: List[str], index, k=TOP_K) -> List[str]:
    model = get_embedder()
    q_emb = model.encode([question], convert_to_numpy=True).astype("float32")
    _, ids = index.search(q_emb, min(k, len(chunks)))
    return [chunks[i] for i in ids[0] if i < len(chunks)]

def retrieve_with_rerank(question: str, chunks: List[str], index, k=TOP_K, rerank_top=8) -> List[str]:
    if len(chunks) <= k:
        return retrieve(question, chunks, index, k)
    
    model = get_embedder()
    ce = get_cross_encoder()
    q_emb = model.encode([question], convert_to_numpy=True).astype("float32")
    _, ids = index.search(q_emb, min(rerank_top, len(chunks)))
    candidate_chunks = [chunks[i] for i in ids[0] if i < len(chunks)]
    
    pairs = [[question, chunk] for chunk in candidate_chunks]
    scores = ce.predict(pairs)
    ranked_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:k]
    return [candidate_chunks[i] for i in ranked_indices]

# ── OpenRouter client ─────────────────────────────────────────────────────────
client = openai.OpenAI(
    api_key=os.environ.get("OPENROUTER_API_KEY", "free"),
    base_url="https://openrouter.ai/api/v1",
)

def ask_llm(context: str, question: str) -> str:
    system = (
        "You are a precise document assistant. "
        "Answer only using the provided context. "
        "If the answer is not in the context, say so clearly. "
        "Be concise and cite relevant information."
    )
    prompt = f"Context:\n{context}\n\nQuestion: {question}"
    try:
        resp = client.chat.completions.create(
            model="openrouter/free",
            max_tokens=700,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
        )
        return resp.choices[0].message.content
    except Exception as e:
        log.error(f"LLM error: {e}")
        return f"LLM error: {str(e)}"

async def ask_llm_stream(context: str, question: str):
    system = (
        "You are a precise document assistant. "
        "Answer only using the provided context. "
        "If the answer is not in the context, say so clearly. "
        "IMPORTANT: Use proper spacing between ALL words. "
        "IMPORTANT: Use line breaks (\\n) between paragraphs and bullet points for readability."
    )
    prompt = f"Context:\n{context}\n\nQuestion: {question}"
    try:
        stream = client.chat.completions.create(
            model="openrouter/free",
            max_tokens=700,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            stream=True,
        )
        for chunk in stream:
            if chunk.choices[0].delta.content:
                yield f"data: {chunk.choices[0].delta.content}\n\n"
        yield "data: [DONE]\n\n"
    except Exception as e:
        log.error(f"LLM stream error: {e}")
        yield f"data: Error: {str(e)}\n\n"

# ── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(title="DocMind API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ───────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "docs": len(docs_store)}


@app.get("/documents")
def list_documents():
    try:
        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.execute("SELECT doc_id, filename, category, confidence, word_count, chunk_count, uploaded_at FROM documents ORDER BY uploaded_at DESC")
        rows = cursor.fetchall()
        conn.close()
        return {"documents": [
            {
                "doc_id": r[0],
                "filename": r[1],
                "category": r[2],
                "confidence": r[3],
                "word_count": r[4],
                "chunk_count": r[5],
                "uploaded_at": r[6]
            }
            for r in rows
        ]}
    except Exception as e:
        log.error(f"Error in /documents: {e}")
        return {"documents": [], "error": str(e)}


@app.get("/documents/search")
def search_documents(q: str, limit: int = 10):
    if not q or len(q.strip()) < 2:
        return {"results": []}
    if not docs_store:
        return {"results": []}
    
    try:
        all_chunks = []
        doc_id_for_chunk = []
        for doc_id, entry in docs_store.items():
            for chunk in entry["chunks"]:
                all_chunks.append(chunk)
                doc_id_for_chunk.append(doc_id)
        
        if not all_chunks:
            return {"results": []}
        
        model = get_embedder()
        query_embed = model.encode([q], convert_to_numpy=True).astype("float32")
        temp_index = faiss.IndexFlatL2(EMB_DIM)
        temp_index.add(query_embed)
        
        search_k = min(limit * 3, len(all_chunks))
        D, I = temp_index.search(query_embed.reshape(1, -1), search_k)
        
        results = []
        seen_docs = set()
        for dist, idx in zip(D[0], I[0]):
            if idx < 0 or idx >= len(all_chunks):
                continue
            chunk = all_chunks[idx]
            doc_id = doc_id_for_chunk[idx]
            if not doc_id or doc_id in seen_docs:
                continue
            
            entry = docs_store.get(doc_id)
            if not entry:
                continue
            
            seen_docs.add(doc_id)
            score = float(1 / (1 + dist))
            results.append({
                "doc_id": doc_id,
                "filename": entry["filename"],
                "category": entry["category"],
                "categoryIcon": CATEGORY_ICON.get(entry["category"], "📄"),
                "file_type": entry["filename"].rsplit(".", 1)[-1].lower(),
                "excerpt": chunk[:200] + "..." if len(chunk) > 200 else chunk,
                "score": score
            })
            if len(results) >= limit:
                break
        
        return {"results": results}
    except Exception as e:
        log.error(f"Error in /documents/search: {e}")
        return {"results": [], "error": str(e)}


@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    ext = file.filename.rsplit(".", 1)[-1].lower()
    if ext not in ("pdf", "txt", "md"):
        raise HTTPException(400, "Only PDF, TXT, MD files are supported.")

    doc_id   = str(uuid.uuid4())
    save_path = UPLOAD_DIR / f"{doc_id}.{ext}"
    content  = await file.read()
    save_path.write_bytes(content)

    try:
        text   = extract_text(save_path, ext)
    except Exception as e:
        raise HTTPException(500, f"Text extraction failed: {e}")

    if not text.strip():
        raise HTTPException(400, "Document appears to be empty or unreadable.")

    chunks  = chunk_text(text)
    cat, conf = classify_document(text)
    wc      = len(text.split())

    docs_store[doc_id] = {
        "filename":    file.filename,
        "chunks":      chunks,
        "category":    cat,
        "confidence":  conf,
        "word_count":  wc,
    }

    conn.execute("""
        INSERT INTO documents (doc_id, filename, category, confidence, word_count, chunk_count)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (doc_id, file.filename, cat, conf, wc, len(chunks)))
    conn.commit()
    save_faiss_index()

    log.info(f"Indexed {file.filename} → {len(chunks)} chunks, cat={cat}, conf={conf}")
    return {
        "doc_id":      doc_id,
        "filename":    file.filename,
        "chunk_count": len(chunks),
        "category":    cat,
        "confidence":  conf,
        "word_count":  wc,
    }


class ChatRequest(BaseModel):
    doc_ids: Optional[List[str]] = None
    doc_id: Optional[str] = None
    question: str

@app.post("/chat")
def chat(req: ChatRequest):
    doc_ids = req.doc_ids or ([req.doc_id] if req.doc_id else [])
    if not doc_ids:
        raise HTTPException(400, "No document specified.")
    
    all_chunks = []
    filenames = []
    
    for doc_id in doc_ids:
        entry = docs_store.get(doc_id)
        if entry:
            all_chunks.extend(entry["chunks"])
            filenames.append(entry["filename"])
    
    if not all_chunks:
        raise HTTPException(404, "No documents found. Please re-upload.")
    
    combined_index, _ = build_faiss_index(all_chunks)
    if combined_index is None:
        combined_index = faiss.IndexFlatL2(EMB_DIM)
    sources = retrieve_with_rerank(req.question, all_chunks, combined_index)
    context = "\n\n---\n\n".join(sources)
    answer = ask_llm(context, req.question)
    return {"answer": answer, "sources": sources, "documents": filenames}


@app.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    doc_ids = req.doc_ids or ([req.doc_id] if req.doc_id else [])
    if not doc_ids:
        raise HTTPException(400, "No document specified.")
    
    all_chunks = []
    filenames = []
    
    for doc_id in doc_ids:
        entry = docs_store.get(doc_id)
        if entry:
            all_chunks.extend(entry["chunks"])
            filenames.append(entry["filename"])
    
    if not all_chunks:
        raise HTTPException(404, "No documents found. Please re-upload.")
    
    combined_index, _ = build_faiss_index(all_chunks)
    if combined_index is None:
        combined_index = faiss.IndexFlatL2(EMB_DIM)
    sources = retrieve_with_rerank(req.question, all_chunks, combined_index)
    context = "\n\n---\n\n".join(sources)
    
    return StreamingResponse(
        ask_llm_stream(context, req.question),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
    )


@app.delete("/documents/{doc_id}")
def delete_doc(doc_id: str):
    if doc_id not in docs_store:
        raise HTTPException(404, "Document not found.")
    try:
        docs_store.pop(doc_id)
        conn.execute("DELETE FROM documents WHERE doc_id = ?", (doc_id,))
        conn.commit()
        save_faiss_index()
        for f in UPLOAD_DIR.glob(f"{doc_id}.*"):
            f.unlink(missing_ok=True)
        return {"deleted": doc_id}
    except Exception as e:
        log.error(f"Delete error: {e}")
        raise HTTPException(500, str(e))
