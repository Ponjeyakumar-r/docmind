import { useState, useEffect } from 'react'
import UploadView from './components/UploadView.jsx'
import ChatView from './components/ChatView.jsx'
import DashboardView from './components/DashboardView.jsx'
import SearchView from './components/SearchView.jsx'
import axios from 'axios'
import './App.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const CATEGORY_ICON = {
  resume: '👤', legal: '⚖️', technical: '⚙️',
  research: '🔬', financial: '💹', notes: '📝',
}

export default function App() {
  const [view, setView]           = useState('dashboard')
  const [documents, setDocuments] = useState([])
  const [activeDoc, setActiveDoc] = useState(null)

  useEffect(() => {
    fetchDocs()
  }, [])

  const fetchDocs = () => {
    axios.get(`${API}/documents`)
      .then(res => {
        if (res.data.documents) {
          setDocuments(res.data.documents)
        }
      })
      .catch(() => {})
  }

  const handleUploaded = (doc) => {
    setDocuments(prev => [doc, ...prev])
    setActiveDoc(doc)
    setView('chat')
  }

  const handleSelectDoc = (doc) => {
    setActiveDoc(doc)
    setView('chat')
  }

  const handleDeleteDoc = async (docId) => {
    try {
      await axios.delete(`${API}/documents/${docId}`)
      setDocuments(prev => prev.filter(d => d.doc_id !== docId))
      if (activeDoc?.doc_id === docId) {
        setActiveDoc(null)
        setView('dashboard')
      }
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-dot" />
          <span className="brand-name">DocMind</span>
          <span className="brand-tag">AI</span>
        </div>

        <nav className="nav">
          <NavBtn icon="◈" label="Dashboard" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
          <NavBtn icon="⌕" label="Search" active={view === 'search'} onClick={() => setView('search')} />
          <NavBtn icon="↑" label="Upload" active={view === 'upload'} onClick={() => setView('upload')} />
          <NavBtn
            icon="◉"
            label="Chat"
            active={view === 'chat'}
            onClick={() => setView('chat')}
            disabled={!activeDoc}
            sub={activeDoc ? activeDoc.filename : null}
          />
        </nav>

        {documents.length > 0 && (
          <div className="sidebar-docs">
            <p className="sidebar-section-label">Recent docs</p>
            {documents.slice(0, 6).map(doc => (
              <button
                key={doc.doc_id}
                className={`doc-pill ${activeDoc?.doc_id === doc.doc_id ? 'doc-pill--active' : ''}`}
                onClick={() => handleSelectDoc(doc)}
              >
                <span>{CATEGORY_ICON[doc.category] || '📄'}</span>
                <span className="doc-pill-name">{doc.filename}</span>
              </button>
            ))}
          </div>
        )}

        <div className="sidebar-footer">
          <span className="status-dot" />
          <span className="status-text">{documents.length} doc{documents.length !== 1 ? 's' : ''} indexed</span>
        </div>
      </aside>

      {/* Main */}
      <main className="content">
        {view === 'dashboard' && (
          <DashboardView
            documents={documents}
            onSelect={handleSelectDoc}
            onDelete={handleDeleteDoc}
            onUpload={() => setView('upload')}
          />
        )}
        {view === 'search' && (
          <SearchView
            documents={documents}
            onSelect={handleSelectDoc}
            onDelete={handleDeleteDoc}
          />
        )}
        {view === 'upload' && (
          <UploadView onUploaded={handleUploaded} />
        )}
        {view === 'chat' && (
          <ChatView document={activeDoc} onDelete={() => handleDeleteDoc(activeDoc?.doc_id)} />
        )}
      </main>
    </div>
  )
}

function NavBtn({ icon, label, active, onClick, disabled, sub }) {
  return (
    <button
      className={`nav-btn ${active ? 'nav-btn--active' : ''} ${disabled ? 'nav-btn--disabled' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="nav-icon">{icon}</span>
      <span className="nav-label">
        {label}
        {sub && <span className="nav-sub">{sub.length > 18 ? sub.slice(0, 18) + '…' : sub}</span>}
      </span>
    </button>
  )
}
