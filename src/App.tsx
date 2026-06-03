import './index.css';
import { useState } from 'react';
import Dashboard from './components/Dashboard';
import { AnalysisResult } from './types';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

type Tab = 'analyze' | 'dashboard';
type Sentiment = 'Positive' | 'Negative' | 'Neutral';

function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  const cls = sentiment === 'Positive' ? 'badge badge-positive'
            : sentiment === 'Negative' ? 'badge badge-negative'
            : 'badge badge-neutral';
  const label = sentiment === 'Positive' ? '▲ Bullish'
              : sentiment === 'Negative' ? '▼ Bearish'
              : '━ Neutral';
  return <span className={cls}>{label}</span>;
}

function AnalyzePage() {
  const [url, setUrl]       = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus]   = useState<{ type: 'success'|'error'|'loading'; message: string } | null>(null);
  const [result, setResult]   = useState<AnalysisResult | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setStatus({ type: 'loading', message: 'Fetching article and running Impact Predictor… this may take 15–30s' });
    setResult(null);

    try {
      const resp = await fetch(`${API_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Analysis failed');

      const fc = data.summary?.factCheck;
      const fcMsg = fc?.totalClaims > 0 ? ` · ${fc.totalClaims} claim${fc.totalClaims !== 1 ? 's' : ''} fact-checked` : '';
      setStatus({ type: 'success', message: `Done — ${data.totalParagraphs} paragraphs${fcMsg}` });
      setResult(data);
    } catch (err) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed to analyze article' });
    } finally {
      setLoading(false);
    }
  };

  const overall = result?.summary.overall;
  const dist    = result?.summary.distribution;
  const total   = result ? Object.values(dist!).reduce((a, b) => a + b, 0) : 0;

  return (
    <>
      {!result ? (
        <div className="analyze-hero">
          <h1>Market Intelligence<br />at the Speed of News</h1>
          <p>Paste any financial news URL. Our custom-trained FinBERT model predicts its real-world market impact, paragraph by paragraph.</p>
          <form className="url-form" onSubmit={handleAnalyze}>
            <input
              id="url-input"
              className="url-input"
              type="url"
              placeholder="https://finance.yahoo.com/news/…"
              value={url}
              onChange={e => setUrl(e.target.value)}
              disabled={loading}
            />
            <button id="analyze-btn" className="btn-primary" type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Analyze'}
            </button>
          </form>
          {status && (
            <div className={`status-msg ${status.type}`} style={{ maxWidth: 700, margin: '1.5rem auto 0', textAlign: 'left' }}>
              {status.message}
            </div>
          )}
        </div>
      ) : (
        <div>
          {/* Back + status row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <button className="btn-ghost" onClick={() => { setResult(null); setStatus(null); }}>
              ← New Analysis
            </button>
            {status && <div className={`status-msg ${status.type}`} style={{ flex: 1 }}>{status.message}</div>}
          </div>

          {/* Summary stats */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                Analysis Results
              </h2>
              <SentimentBadge sentiment={overall as Sentiment} />
            </div>
            <a href={result.url} target="_blank" rel="noreferrer"
              style={{ fontSize: '0.8rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
              {result.url.length > 80 ? result.url.slice(0, 80) + '…' : result.url}
            </a>
          </div>

          <div className="summary-grid">
            <div className="stat-card">
              <div className="stat-value" style={{ color: overall === 'Positive' ? 'var(--green)' : overall === 'Negative' ? 'var(--red)' : 'var(--amber)' }}>
                {overall === 'Positive' ? 'Bullish' : overall === 'Negative' ? 'Bearish' : 'Mixed'}
              </div>
              <div className="stat-label">Overall Signal</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--green)' }}>{dist!.Positive}</div>
              <div className="stat-label">Bullish Paragraphs</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--red)' }}>{dist!.Negative}</div>
              <div className="stat-label">Bearish Paragraphs</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{Math.round(result.summary.averageConfidence * 100)}%</div>
              <div className="stat-label">Avg Confidence</div>
            </div>
            {result.summary.factCheck.totalClaims > 0 && (
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--amber)' }}>
                  {result.summary.factCheck.verifiedClaims}/{result.summary.factCheck.totalClaims}
                </div>
                <div className="stat-label">Claims Verified</div>
              </div>
            )}
          </div>

          {/* Sentiment bar */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', height: 8, borderRadius: 9999, overflow: 'hidden', gap: 2 }}>
              <div style={{ flex: dist!.Positive, background: 'var(--green)', transition: 'flex 0.6s' }} />
              <div style={{ flex: dist!.Neutral,  background: 'var(--text-muted)', transition: 'flex 0.6s' }} />
              <div style={{ flex: dist!.Negative, background: 'var(--red)', transition: 'flex 0.6s' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>
              <span style={{ color: 'var(--green)' }}>{Math.round((dist!.Positive / total) * 100)}% Bullish</span>
              <span>{Math.round((dist!.Neutral / total) * 100)}% Neutral</span>
              <span style={{ color: 'var(--red)' }}>{Math.round((dist!.Negative / total) * 100)}% Bearish</span>
            </div>
          </div>

          {/* Paragraph breakdown */}
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            Paragraph Breakdown
          </h3>
          <div>
            {result.paragraphs.map((p, i) => {
              const cls = p.sentiment === 'Positive' ? 'positive' : p.sentiment === 'Negative' ? 'negative' : 'neutral';
              return (
                <div key={i} className={`paragraph-card ${cls}`}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>§{i + 1}</span>
                    <SentimentBadge sentiment={p.sentiment as Sentiment} />
                  </div>
                  <p className="paragraph-text">{p.text}</p>
                  <div className="confidence-bar-wrap">
                    <div className={`confidence-bar ${cls}`} style={{ width: `${p.confidence * 100}%` }} />
                  </div>
                  {p.claims?.length > 0 && (
                    <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {p.claims.map((c, ci) => (
                        <span key={ci}
                          title={c.message}
                          className={`claim-badge ${c.verdict === 'VERIFIED' ? 'claim-verified' : c.verdict === 'DISPUTED' ? 'claim-disputed' : 'claim-unknown'}`}>
                          {c.verdict === 'VERIFIED' ? '✓' : c.verdict === 'DISPUTED' ? '✗' : '?'} {c.entity}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <div className="logo">
            <div className="logo-icon">📈</div>
            FinSight AI
          </div>
          <nav className="nav-tabs">
            <button id="tab-dashboard" className={`nav-tab ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>
              Market Dashboard
            </button>
            <button id="tab-analyze" className={`nav-tab ${tab === 'analyze' ? 'active' : ''}`} onClick={() => setTab('analyze')}>
              Analyze Article
            </button>
          </nav>
        </div>
      </header>

      <main className="page-content">
        {tab === 'dashboard' ? <Dashboard /> : <AnalyzePage />}
      </main>
    </div>
  );
}
