import { FeedArticle, MarketStats, WatchlistItem } from '../types';
import { useEffect, useState, useCallback } from 'react';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5001';

function timeAgo(isoStr: string) {
  const d = new Date(isoStr + 'Z');
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)   return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const cls = sentiment === 'Positive' ? 'badge badge-positive'
            : sentiment === 'Negative' ? 'badge badge-negative'
            : 'badge badge-neutral';
  const icon = sentiment === 'Positive' ? '▲' : sentiment === 'Negative' ? '▼' : '━';
  return <span className={cls}>{icon} {sentiment === 'Positive' ? 'Bullish' : sentiment === 'Negative' ? 'Bearish' : 'Neutral'}</span>;
}

function StockCard({
  stat, selected, onClick
}: { stat: any; selected: boolean; onClick: () => void }) {
  const total = stat.total || 1;
  const posW = (stat.Positive / total) * 100;
  const negW = (stat.Negative / total) * 100;
  const neuW = (stat.Neutral  / total) * 100;
  return (
    <div className={`stock-card ${selected ? 'selected' : ''}`} onClick={onClick}>
      <div className="stock-ticker">{stat.ticker.replace('.NS', '')}</div>
      <div className="stock-company">{stat.company}</div>
      <div className="sentiment-bar-row">
        <div className="sbar-positive" style={{ flex: posW }} />
        <div className="sbar-neutral"  style={{ flex: neuW }} />
        <div className="sbar-negative" style={{ flex: negW }} />
      </div>
      <div className="stock-counts">
        <span className="count-pos">▲ {stat.Positive}</span>
        <span className="count-neg">▼ {stat.Negative}</span>
        <span className="count-neu">━ {stat.Neutral}</span>
      </div>
    </div>
  );
}

function FeedItem({ article }: { article: FeedArticle }) {
  return (
    <a href={article.url} target="_blank" rel="noopener noreferrer"
      style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="feed-item">
        <div className="feed-item-left">
          <div className="feed-item-ticker">{article.ticker} · {article.company}</div>
          <div className="feed-item-title">{article.title}</div>
          <div className="feed-item-meta">{timeAgo(article.analyzed_at)} · {Math.round(article.confidence * 100)}% confidence</div>
        </div>
        <div className="feed-item-badge">
          <SentimentBadge sentiment={article.sentiment} />
        </div>
      </div>
    </a>
  );
}

export default function Dashboard() {
  const [stats, setStats]       = useState<MarketStats | null>(null);
  const [feed, setFeed]         = useState<FeedArticle[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = useCallback(async (ticker?: string | null) => {
    try {
      const [statsRes, feedRes, wlRes] = await Promise.all([
        fetch(`${API_URL}/api/stats`),
        fetch(`${API_URL}/api/feed${ticker ? `?ticker=${ticker}` : ''}?limit=50`),
        watchlist.length ? Promise.resolve(null) : fetch(`${API_URL}/api/watchlist`),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (feedRes.ok)  setFeed(await feedRes.json());
      if (wlRes?.ok)   setWatchlist(await wlRes.json());
      setLastRefresh(new Date());
    } catch (e) {
      // silently ignore refresh errors
    } finally {
      setLoading(false);
    }
  }, [watchlist.length]);

  useEffect(() => { fetchData(); }, []);

  // Auto-refresh every 60s
  useEffect(() => {
    const id = setInterval(() => fetchData(selectedTicker), 60000);
    return () => clearInterval(id);
  }, [selectedTicker, fetchData]);

  const handleTickerClick = (ticker: string) => {
    const next = selectedTicker === ticker ? null : ticker;
    setSelectedTicker(next);
    fetchData(next);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '6rem', color: 'var(--text-muted)' }}>
        <div className="spinner" style={{ width: 40, height: 40, margin: '0 auto 1rem' }} />
        <p>Loading market intelligence…</p>
      </div>
    );
  }

  // No data yet — pipeline hasn't run
  if (!stats || stats.total_today === 0) {
    return (
      <div className="empty-state">
        <div className="icon">📡</div>
        <h2 style={{ marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Pipeline is warming up</h2>
        <p>The RSS pipeline runs automatically in the background.<br />
          Data will appear here within a few minutes of starting the Flask service.</p>
        <button className="btn-primary" style={{ marginTop: '1.5rem' }} onClick={() => fetchData()}>
          Refresh
        </button>
      </div>
    );
  }

  const overallClass = stats.overall === 'Bullish' ? 'bullish' : stats.overall === 'Bearish' ? 'bearish' : 'mixed';
  const total = stats.today.Positive + stats.today.Negative + stats.today.Neutral || 1;

  return (
    <div>
      {/* Market Pulse Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <h2 className="section-header" style={{ marginBottom: 0 }}>
            Market Pulse
            <span className="pill">Today</span>
          </h2>
          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Refreshed {timeAgo(lastRefresh.toISOString().replace('Z', ''))}
          </span>
        </div>

        <div className="market-pulse">
          <div className={`pulse-card ${overallClass}`}>
            <span className="pulse-label">Overall Signal</span>
            <span className={`pulse-value ${overallClass}`}>{stats.overall}</span>
            <span className="pulse-sub">{stats.total_today} articles analyzed today</span>
          </div>

          <div className="pulse-card">
            <span className="pulse-label">Bullish Articles</span>
            <span className="pulse-value number" style={{ color: 'var(--green)' }}>
              {Math.round((stats.today.Positive / total) * 100)}%
            </span>
            <span className="pulse-sub">{stats.today.Positive} of {stats.total_today}</span>
          </div>

          <div className="pulse-card">
            <span className="pulse-label">Bearish Articles</span>
            <span className="pulse-value number" style={{ color: 'var(--red)' }}>
              {Math.round((stats.today.Negative / total) * 100)}%
            </span>
            <span className="pulse-sub">{stats.today.Negative} of {stats.total_today}</span>
          </div>
        </div>
      </div>

      {/* Stocks Grid */}
      {stats.per_ticker.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <div className="section-header">
            Monitored Stocks
            <span className="pill">{stats.per_ticker.length} tracked</span>
          </div>
          <div className="stocks-grid">
            {stats.per_ticker.map(s => (
              <StockCard
                key={s.ticker}
                stat={s}
                selected={selectedTicker === s.ticker}
                onClick={() => handleTickerClick(s.ticker)}
              />
            ))}
          </div>
          {selectedTicker && (
            <div style={{ textAlign: 'center', marginTop: '-0.5rem', marginBottom: '1.5rem' }}>
              <button className="btn-ghost" onClick={() => { setSelectedTicker(null); fetchData(null); }}>
                ✕ Clear filter — show all
              </button>
            </div>
          )}
        </div>
      )}

      {/* Live Feed */}
      <div>
        <div className="feed-header">
          <div className="feed-title">
            <div className="live-dot" />
            Live Feed
            {selectedTicker && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                — {selectedTicker}
              </span>
            )}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {feed.length} articles · auto-refreshes every 60s
          </span>
        </div>

        {feed.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📰</div>
            <p>No articles yet for this filter.</p>
          </div>
        ) : (
          <div className="feed-list">
            {feed.map(a => <FeedItem key={a.id} article={a} />)}
          </div>
        )}
      </div>
    </div>
  );
}
