import { useState, useRef } from 'react'
import axios from 'axios'
import './UploadView.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function UploadView({ onUploaded }) {
  const [dragging, setDragging]   = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState('')
  const [progress, setProgress]   = useState(0)
  const inputRef = useRef()

  const handleFile = async (file) => {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['pdf', 'txt', 'md'].includes(ext)) {
      setError('Only PDF, TXT, and MD files are supported.')
      return
    }
    setError('')
    setUploading(true)
    setProgress(10)

    const form = new FormData()
    form.append('file', file)

    try {
      setProgress(40)
      const { data } = await axios.post(`${API}/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          setProgress(Math.round((e.loaded / e.total) * 60) + 10)
        },
      })
      setProgress(100)
      setTimeout(() => {
        setUploading(false)
        setProgress(0)
        onUploaded(data)
      }, 400)
    } catch (e) {
      setError(e.response?.data?.detail || 'Upload failed. Is the backend running?')
      setUploading(false)
      setProgress(0)
    }
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  return (
    <div className="upload-page">
      <div className="page-header">
        <h1 className="page-title">Upload Document</h1>
        <p className="page-sub">PDF, TXT, or MD — your document stays local</p>
      </div>

      <div
        className={`dropzone ${dragging ? 'dropzone--drag' : ''} ${uploading ? 'dropzone--loading' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,.md"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files[0])}
        />

        {uploading ? (
          <div className="upload-progress">
            <div className="spinner" />
            <p className="upload-progress-label">Processing document…</p>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <p className="progress-steps">
              {progress < 40 ? 'Uploading…' : progress < 70 ? 'Extracting text…' : progress < 90 ? 'Building vector index…' : 'Classifying…'}
            </p>
          </div>
        ) : (
          <div className="upload-idle">
            <div className="upload-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17,8 12,3 7,8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <p className="upload-cta">Drop your file here</p>
            <p className="upload-or">or <span>click to browse</span></p>
            <div className="upload-types">
              <span className="type-badge">PDF</span>
              <span className="type-badge">TXT</span>
              <span className="type-badge">MD</span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="upload-error">
          <span>⚠</span> {error}
        </div>
      )}

      <div className="upload-info">
        <div className="info-card">
          <span className="info-icon">🔍</span>
          <div>
            <strong>Vector Search</strong>
            <p>Text is chunked and embedded using sentence-transformers into FAISS</p>
          </div>
        </div>
        <div className="info-card">
          <span className="info-icon">🏷️</span>
          <div>
            <strong>Auto Classification</strong>
            <p>PyTorch model categorises your doc: resume, legal, technical, research…</p>
          </div>
        </div>
        <div className="info-card">
          <span className="info-icon">💬</span>
          <div>
            <strong>RAG Chat</strong>
            <p>Ask anything — relevant chunks are retrieved and fed to the LLM</p>
          </div>
        </div>
      </div>
    </div>
  )
}
