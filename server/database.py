"""
database.py — SQLite persistence layer
Stores all analyzed articles and their sentiment predictions.
Uses Python's built-in sqlite3 — zero extra dependencies.
"""

import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "market_intelligence.db")

WATCHLIST = [
    # US Tech
    {"ticker": "AAPL",       "company": "Apple",           "sector": "Technology"},
    {"ticker": "MSFT",       "company": "Microsoft",       "sector": "Technology"},
    {"ticker": "GOOGL",      "company": "Alphabet",        "sector": "Technology"},
    {"ticker": "AMZN",       "company": "Amazon",          "sector": "E-Commerce"},
    {"ticker": "NVDA",       "company": "NVIDIA",          "sector": "Semiconductors"},
    {"ticker": "TSLA",       "company": "Tesla",           "sector": "EV / Energy"},
    {"ticker": "META",       "company": "Meta",            "sector": "Social Media"},
    {"ticker": "NFLX",       "company": "Netflix",         "sector": "Streaming"},
    {"ticker": "AMD",        "company": "AMD",             "sector": "Semiconductors"},
    {"ticker": "JPM",        "company": "JPMorgan Chase",  "sector": "Finance"},
    # India
    {"ticker": "RELIANCE.NS","company": "Reliance",        "sector": "Conglomerate"},
    {"ticker": "TCS.NS",     "company": "TCS",             "sector": "IT Services"},
    {"ticker": "INFY.NS",    "company": "Infosys",         "sector": "IT Services"},
    {"ticker": "HDFCBANK.NS","company": "HDFC Bank",       "sector": "Finance"},
    {"ticker": "WIPRO.NS",   "company": "Wipro",           "sector": "IT Services"},
]

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Create tables if they don't exist."""
    conn = get_connection()
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS articles (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker        TEXT    NOT NULL,
            company       TEXT    NOT NULL,
            title         TEXT    NOT NULL,
            url           TEXT    NOT NULL UNIQUE,
            summary       TEXT,
            sentiment     TEXT    NOT NULL,
            confidence    REAL    NOT NULL,
            score_bullish REAL,
            score_bearish REAL,
            analyzed_at   TEXT    NOT NULL
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS watchlist (
            ticker  TEXT PRIMARY KEY,
            company TEXT NOT NULL,
            sector  TEXT NOT NULL
        )
    """)

    # Seed watchlist
    for item in WATCHLIST:
        c.execute("""
            INSERT OR IGNORE INTO watchlist (ticker, company, sector)
            VALUES (?, ?, ?)
        """, (item["ticker"], item["company"], item["sector"]))

    conn.commit()
    conn.close()
    print(f"[DB] Initialized at {DB_PATH}")

def url_exists(url: str) -> bool:
    """Check if article was already analyzed."""
    conn = get_connection()
    row = conn.execute("SELECT 1 FROM articles WHERE url = ?", (url,)).fetchone()
    conn.close()
    return row is not None

def save_article(ticker, company, title, url, summary, sentiment, confidence, score_bullish, score_bearish):
    """Persist an analyzed article."""
    conn = get_connection()
    try:
        conn.execute("""
            INSERT OR IGNORE INTO articles
                (ticker, company, title, url, summary, sentiment, confidence, score_bullish, score_bearish, analyzed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            ticker, company, title, url, summary,
            sentiment, confidence, score_bullish, score_bearish,
            datetime.utcnow().isoformat()
        ))
        conn.commit()
    finally:
        conn.close()

def get_feed(ticker=None, limit=60):
    """Fetch recent articles, optionally filtered by ticker."""
    conn = get_connection()
    if ticker:
        rows = conn.execute("""
            SELECT * FROM articles WHERE ticker = ?
            ORDER BY analyzed_at DESC LIMIT ?
        """, (ticker, limit)).fetchall()
    else:
        rows = conn.execute("""
            SELECT * FROM articles
            ORDER BY analyzed_at DESC LIMIT ?
        """, (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_stats():
    """Compute overall market sentiment stats."""
    conn = get_connection()

    # Today's counts
    today = datetime.utcnow().date().isoformat()
    today_rows = conn.execute("""
        SELECT sentiment, COUNT(*) as count
        FROM articles
        WHERE analyzed_at >= ?
        GROUP BY sentiment
    """, (today,)).fetchall()

    today_counts = {"Positive": 0, "Negative": 0, "Neutral": 0}
    for r in today_rows:
        today_counts[r["sentiment"]] = r["count"]

    # Per-ticker sentiment (last 20 articles each)
    ticker_rows = conn.execute("""
        SELECT ticker, company, sentiment, COUNT(*) as count,
               AVG(confidence) as avg_confidence
        FROM (
            SELECT ticker, company, sentiment, confidence,
                   ROW_NUMBER() OVER (PARTITION BY ticker ORDER BY analyzed_at DESC) as rn
            FROM articles
        ) WHERE rn <= 20
        GROUP BY ticker, sentiment
    """).fetchall()

    ticker_stats = {}
    for r in ticker_rows:
        t = r["ticker"]
        if t not in ticker_stats:
            ticker_stats[t] = {"ticker": t, "company": r["company"],
                               "Positive": 0, "Negative": 0, "Neutral": 0,
                               "avg_confidence": 0, "total": 0}
        ticker_stats[t][r["sentiment"]] = r["count"]
        ticker_stats[t]["total"] += r["count"]
        ticker_stats[t]["avg_confidence"] = round(r["avg_confidence"], 3)

    # Most active tickers
    most_active = conn.execute("""
        SELECT ticker, company, COUNT(*) as article_count
        FROM articles
        WHERE analyzed_at >= ?
        GROUP BY ticker
        ORDER BY article_count DESC
        LIMIT 5
    """, (today,)).fetchall()

    total_today = sum(today_counts.values())
    overall = "Mixed"
    if total_today > 0:
        if today_counts["Positive"] / total_today > 0.55:
            overall = "Bullish"
        elif today_counts["Negative"] / total_today > 0.55:
            overall = "Bearish"

    conn.close()
    return {
        "overall": overall,
        "today": today_counts,
        "total_today": total_today,
        "per_ticker": list(ticker_stats.values()),
        "most_active": [dict(r) for r in most_active],
    }

def get_watchlist():
    conn = get_connection()
    rows = conn.execute("SELECT * FROM watchlist ORDER BY sector, ticker").fetchall()
    conn.close()
    return [dict(r) for r in rows]
