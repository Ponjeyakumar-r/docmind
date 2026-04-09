# Deployment Steps

## Prerequisites
- Docker & Docker Compose installed
- OpenRouter API key

## Quick Start

```bash
# 1. Set your API key
export OPENROUTER_API_KEY="sk-or-..."

# 2. Build and start containers
docker-compose up --build

# 3. Access at http://localhost:3000
```

## Manual Run (without Docker)

```bash
# Backend
cd backend
source venv/bin/activate
export OPENROUTER_API_KEY="sk-or-..."
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm run dev
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENROUTER_API_KEY` | API key for LLM | Yes |

## Ports
- Frontend: 3000
- Backend: 8000

## Volumes
- `backend/uploads` - uploaded files
- `backend/indexes` - FAISS indexes
