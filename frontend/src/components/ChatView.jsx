import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import './ChatView.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const CATEGORY_ICON = {
  resume: '👤', legal: '⚖️', technical: '⚙️',
  research: '🔬', financial: '💹', notes: '📝',
}

const SUGGESTIONS = [
  'Summarize this document',
  'What are the key points?',
  'List the main topics covered',
  'What conclusions are drawn?',
]

export default function ChatView({ document, onDelete }) {
  const [messages, setMessages] = useState([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [sources, setSources]   = useState([])
  const [showSources, setShowSources] = useState(false)
  const bottomRef = useRef()
  const inputRef  = useRef()

  useEffect(() => {
    if (document) {
      setMessages([{
        role: 'assistant',
        text: `Document loaded: **${document.filename}**\n\nCategory: ${document.category} · ${document.chunk_count} chunks indexed · ${document.word_count?.toLocaleString()} words\n\nAsk me anything about this document.`,
        ts: Date.now(),
      }])
      setSources([])
    }
  }, [document?.doc_id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = async (text) => {
    const q = (text || input).trim()
    if (!q || loading || !document) return
    setInput('')

    setMessages(prev => [...prev, { role: 'user', text: q, ts: Date.now() }])
    setLoading(true)
    setSources([])

    try {
      const res = await axios.post(`${API}/chat`, {
        doc_id: document.doc_id,
        question: q
      })

      const { answer, sources: srcs } = res.data
      setSources(srcs || [])
      
      let formatted = answer || 'No response received.'
      if (typeof formatted === 'string') {
        formatted = formatted
          .replace(/([a-z])([A-Z])/g, '$1 $2')
          .replace(/([a-zA-Z])(\d)/g, '$1 $2')
          .replace(/(\d)([a-zA-Z])/g, '$1 $2')
          .replace(/\.([A-Z])/g, '. $1')
          .replace(/!([A-Z])/g, '! $1')
          .replace(/\?([A-Z])/g, '? $1')
          .replace(/([.,!?])([A-Za-z])/g, '$1 $2')
      }

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        text: formatted, 
        ts: Date.now() 
      }])
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: `Error: ${e.response?.data?.detail || e.message || 'Could not reach the server.'}`,
        isError: true,
        ts: Date.now(),
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  if (!document) {
    return (
      <div className="chat-empty">
        <div className="empty-icon">◉</div>
        <p className="empty-title">No document selected</p>
        <p className="empty-sub">Upload a document or pick one from the sidebar to start chatting.</p>
      </div>
    )
  }

  return (
    <div className="chat-layout">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-doc-info">
          <span className="chat-doc-icon">{CATEGORY_ICON[document.category] || '📄'}</span>
          <div>
            <div className="chat-doc-name">{document.filename}</div>
            <div className="chat-doc-meta">
              {document.category} · {document.chunk_count} chunks · confidence {Math.round(document.confidence * 100)}%
            </div>
          </div>
        </div>
        <div className="chat-header-actions">
          {sources.length > 0 && (
            <button className="sources-toggle" onClick={() => setShowSources(s => !s)}>
              {showSources ? 'Hide' : 'Show'} sources ({sources.length})
            </button>
          )}
          {onDelete && (
            <button className="doc-delete-btn" onClick={onDelete} title="Delete document">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Sources panel */}
      {showSources && sources.length > 0 && (
        <div className="sources-panel">
          <p className="sources-label">Retrieved chunks</p>
          {sources.map((s, i) => (
            <div key={i} className="source-chunk">
              <span className="chunk-num">#{i + 1}</span>
              <p>{s}</p>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="messages">
        {messages.map((msg, i) => (
          <Message key={i} msg={msg} />
        ))}
        {loading && (
          <div className="msg msg--assistant">
            <div className="msg-avatar msg-avatar--ai">AI</div>
            <div className="msg-bubble msg-bubble--thinking">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="suggestions">
          {SUGGESTIONS.map((s, i) => (
            <button key={i} className="suggestion-btn" onClick={() => send(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="input-bar">
        <textarea
          ref={inputRef}
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="Ask anything about the document…"
          rows={1}
          disabled={loading}
        />
        <button
          className="send-btn"
          onClick={() => send()}
          disabled={loading || !input.trim()}
        >
          ↑
        </button>
      </div>
    </div>
  )
}

function Message({ msg }) {
  const isUser = msg.role === 'user'
  const text = msg.text || ''

  return (
    <div className={`msg ${isUser ? 'msg--user' : 'msg--assistant'} ${msg.isError ? 'msg--error' : ''}`}>
      {!isUser && <div className="msg-avatar msg-avatar--ai">AI</div>}
      <div
        className={`msg-bubble ${isUser ? 'msg-bubble--user' : 'msg-bubble--ai'}`}
        style={{ whiteSpace: 'pre-wrap' }}
      >
        {text}
      </div>
      {isUser && <div className="msg-avatar msg-avatar--user">You</div>}
    </div>
  )
}
