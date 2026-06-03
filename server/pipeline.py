"""
pipeline.py — Autonomous RSS News Pipeline
Fetches latest financial news for all watchlist tickers every 60 minutes,
runs them through the FinBERT sentiment model, and stores results to SQLite.

Uses Yahoo Finance RSS feeds (free, no scraping bans, no API key needed).
"""

import feedparser
import requests
import logging
import time
from datetime import datetime
from database import init_db, url_exists, save_article, get_watchlist

logger = logging.getLogger(__name__)

FLASK_ANALYZE_URL = "http://localhost:5001/analyze"

# Yahoo Finance RSS — returns top 10 headlines per ticker
def get_rss_url(ticker: str) -> str:
    # Strip .NS suffix for Yahoo RSS (Indian stocks use bare symbol in RSS)
    clean = ticker.replace(".NS", "")
    return f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={clean}&region=US&lang=en-US"

def analyze_text(text: str):
    """Call the local Flask service to get sentiment."""
    try:
        resp = requests.post(
            FLASK_ANALYZE_URL,
            json={"paragraphs": [text[:800]]},
            timeout=30
        )
        resp.raise_for_status()
        results = resp.json().get("results", [])
        if results:
            r = results[0]
            scores = r.get("scores", {})
            return {
                "sentiment":     r.get("sentiment", "Neutral"),
                "confidence":    r.get("confidence", 0.5),
                "score_bullish": scores.get("Positive", scores.get("label_1", 0)),
                "score_bearish": scores.get("Negative", scores.get("label_0", 0)),
            }
    except Exception as e:
        logger.warning(f"[Pipeline] Flask analyze failed: {e}")
    return None

def run_pipeline():
    """Main pipeline run — fetch and analyze all tickers."""
    watchlist = get_watchlist()
    logger.info(f"[Pipeline] Starting run for {len(watchlist)} tickers at {datetime.utcnow().isoformat()}")
    new_articles = 0

    for item in watchlist:
        ticker  = item["ticker"]
        company = item["company"]
        rss_url = get_rss_url(ticker)

        try:
            feed = feedparser.parse(rss_url)
            entries = feed.entries[:8]  # top 8 headlines per ticker
            logger.info(f"[Pipeline] {ticker}: {len(entries)} headlines from RSS")

            for entry in entries:
                url   = entry.get("link", "")
                title = entry.get("title", "")
                summary = entry.get("summary", title)

                if not url or not title:
                    continue

                # Skip already-processed articles
                if url_exists(url):
                    continue

                # Use title + summary as the text to analyze
                text_to_analyze = f"{title}. {summary}"

                result = analyze_text(text_to_analyze)
                if not result:
                    continue

                save_article(
                    ticker=ticker,
                    company=company,
                    title=title,
                    url=url,
                    summary=summary[:400],
                    sentiment=result["sentiment"],
                    confidence=result["confidence"],
                    score_bullish=result["score_bullish"],
                    score_bearish=result["score_bearish"],
                )
                new_articles += 1
                logger.info(f"  ✓ [{result['sentiment']}] {title[:60]}")

            # Be polite — small delay between tickers
            time.sleep(1)

        except Exception as e:
            logger.error(f"[Pipeline] Error processing {ticker}: {e}")

    logger.info(f"[Pipeline] Run complete. {new_articles} new articles saved.")
    return new_articles


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    init_db()
    run_pipeline()
