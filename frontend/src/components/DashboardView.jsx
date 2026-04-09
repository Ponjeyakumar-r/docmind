import './DashboardView.css'

const CATEGORY_ICON = {
  resume: '👤', legal: '⚖️', technical: '⚙️',
  research: '🔬', financial: '💹', notes: '📝',
}

const CATEGORY_COLOR = {
  resume: '#7c6af7', legal: '#f5a623', technical: '#3ecf8e',
  research: '#60a5fa', financial: '#f472b6', notes: '#94a3b8',
}

export default function DashboardView({ documents, onSelect, onDelete, onUpload }) {
  const categories = [...new Set(documents.map(d => d.category))]
  const totalWords = documents.reduce((s, d) => s + (d.word_count || 0), 0)
  const avgConf    = documents.length
    ? Math.round(documents.reduce((s, d) => s + d.confidence, 0) / documents.length * 100)
    : 0

  return (
    <div className="dash-page">
      {/* ── Header ── */}
      <div className="dash-header">
        <div>
          <h1 className="dash-title">Knowledge Base</h1>
          <p className="dash-sub">Your uploaded documents, indexed and ready to query.</p>
        </div>
        <button className="dash-upload-btn" onClick={onUpload}>
          <span>↑</span> Upload Document
        </button>
      </div>

      {/* ── Stats ── */}
      <div className="dash-stats">
        <StatCard value={documents.length} label="Documents" icon="📄" />
        <StatCard value={totalWords.toLocaleString()} label="Words Indexed" icon="📝" />
        <StatCard value={categories.length} label="Categories" icon="🏷️" />
        <StatCard value={`${avgConf}%`} label="Avg Confidence" icon="🎯" />
      </div>

      {/* ── Documents grid ── */}
      {documents.length === 0 ? (
        <div className="dash-empty">
          <div className="dash-empty-icon">◈</div>
          <p className="dash-empty-title">No documents yet</p>
          <p className="dash-empty-sub">Upload your first document to get started.</p>
          <button className="dash-upload-btn" onClick={onUpload}>Upload now →</button>
        </div>
      ) : (
        <>
          <p className="dash-section-label">Recent Documents</p>
          <div className="doc-grid">
            {documents.map(doc => (
              <DocCard
                key={doc.doc_id}
                doc={doc}
                onSelect={() => onSelect(doc)}
                onDelete={() => onDelete(doc.doc_id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ value, label, icon }) {
  return (
    <div className="stat-card">
      <span className="stat-icon">{icon}</span>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

function DocCard({ doc, onSelect, onDelete }) {
  const color = CATEGORY_COLOR[doc.category] || '#7c6af7'
  return (
    <div className="doc-card" onClick={onSelect}>
      <div className="doc-card-top" style={{ borderColor: color + '44' }}>
        <span className="doc-cat-icon">{CATEGORY_ICON[doc.category] || '📄'}</span>
        <span className="doc-cat-badge" style={{ color, background: color + '18', borderColor: color + '44' }}>
          {doc.category}
        </span>
        <button
          className="doc-delete-btn"
          onClick={e => { e.stopPropagation(); onDelete() }}
          title="Remove document"
        >✕</button>
      </div>
      <div className="doc-card-body">
        <p className="doc-card-name">{doc.filename}</p>
        <div className="doc-card-meta">
          <span>{doc.chunk_count} chunks</span>
          <span>·</span>
          <span>{doc.word_count?.toLocaleString()} words</span>
        </div>
        <div className="conf-bar-wrap">
          <div className="conf-bar">
            <div className="conf-fill" style={{ width: `${Math.round(doc.confidence * 100)}%`, background: color }} />
          </div>
          <span className="conf-label" style={{ color }}>{Math.round(doc.confidence * 100)}%</span>
        </div>
      </div>
      <div className="doc-card-footer">Chat →</div>
    </div>
  )
}
