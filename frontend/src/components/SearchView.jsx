import { useState, useEffect } from 'react'
import axios from 'axios'
import './SearchView.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function SearchView({ documents, onSelect, onDelete }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    const handler = setTimeout(() => {
      if (query.trim().length >= 2) {
        performSearch(query)
      } else if (query.trim().length === 0) {
        setResults([])
        setSearched(false)
      }
    }, 300)
    return () => clearTimeout(handler)
  }, [query])

  const performSearch = async (searchQuery) => {
    setLoading(true)
    setSearched(true)
    try {
      const res = await axios.get(`${API}/documents/search`, {
        params: { q: searchQuery }
      })
      setResults(res.data.results || [])
    } catch (err) {
      console.error('Search failed:', err)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && query.trim().length >= 2) {
      performSearch(query)
    }
  }

  return (
    <div className="search-view">
      <div className="search-header">
        <h1 className="search-title">Search Documents</h1>
        <p className="search-subtitle">Find information across all your indexed documents</p>
      </div>

      <div className="search-input-wrapper">
        <span className="search-icon">⌕</span>
        <input
          type="text"
          className="search-input"
          placeholder="Search by content, keywords, or phrases..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {query && (
          <button className="search-clear" onClick={() => { setQuery(''); setResults([]); setSearched(false) }}>
            ✕
          </button>
        )}
        {loading && <span className="search-spinner" />}
      </div>

      <div className="search-results">
        {searched && !loading && results.length === 0 && (
          <div className="search-empty">
            <span className="search-empty-icon">∅</span>
            <p>No results found for "{query}"</p>
            <span>Try different keywords or upload more documents</span>
          </div>
        )}

        {!searched && documents.length === 0 && (
          <div className="search-empty">
            <span className="search-empty-icon">📂</span>
            <p>No documents indexed yet</p>
            <span>Upload documents to start searching</span>
          </div>
        )}

        {!searched && documents.length > 0 && (
          <div className="search-hint">
            <p>Start typing to search across {documents.length} document{documents.length !== 1 ? 's' : ''}</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="results-list">
            <p className="results-count">{results.length} result{results.length !== 1 ? 's' : ''} found</p>
            {results.map((result, idx) => (
              <div key={idx} className="result-card" onClick={() => onSelect(result)}>
                <div className="result-header">
                  <span className="result-icon">{result.categoryIcon || '📄'}</span>
                  <span className="result-filename">{result.filename}</span>
                  <span className="result-score">{Math.round(result.score * 100)}% match</span>
                </div>
                <p className="result-excerpt">{result.excerpt}</p>
                <div className="result-meta">
                  <span>{result.file_type}</span>
                  <span>•</span>
                  <span>{result.category}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}