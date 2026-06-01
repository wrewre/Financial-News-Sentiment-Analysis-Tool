"""
Fact-Checker Module — Financial Claim Extraction & Verification

Pipeline:
  1. Regex patterns extract structured claims from paragraph text
     e.g. "HDFC Bank rose 3.2%" → {entity: "hdfc bank", change: 3.2, direction: up}

  2. Entity is mapped to a stock ticker via COMPANY_TICKER_MAP
     e.g. "hdfc bank" → "HDFCBANK.NS"

  3. yfinance fetches real OHLC data around the article's publish date

  4. Claimed value is compared to actual value with a tolerance band:
     VERIFIED    — matches real data within tolerance
     DISPUTED    — direction or magnitude significantly wrong
     UNVERIFIABLE — can't find ticker or data
"""

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

import yfinance as yf

logger = logging.getLogger(__name__)


# ─── Company → Ticker Mapping ─────────────────────────────────────────────────
# Covers top Indian (NSE/BSE) + US stocks + major indices
# Keys are lowercase for case-insensitive matching

COMPANY_TICKER_MAP: dict[str, str] = {
    # ── Indian Large-Cap (NSE) ──────────────────────────────────────────────
    "reliance":               "RELIANCE.NS",
    "reliance industries":    "RELIANCE.NS",
    "ril":                    "RELIANCE.NS",
    "tcs":                    "TCS.NS",
    "tata consultancy":       "TCS.NS",
    "tata consultancy services": "TCS.NS",
    "infosys":                "INFY.NS",
    "infy":                   "INFY.NS",
    "hdfc bank":              "HDFCBANK.NS",
    "hdfcbank":               "HDFCBANK.NS",
    "hdfc":                   "HDFCBANK.NS",
    "icici bank":             "ICICIBANK.NS",
    "icici":                  "ICICIBANK.NS",
    "wipro":                  "WIPRO.NS",
    "hcl technologies":       "HCLTECH.NS",
    "hcl tech":               "HCLTECH.NS",
    "hcltech":                "HCLTECH.NS",
    "hcl":                    "HCLTECH.NS",
    "axis bank":              "AXISBANK.NS",
    "bajaj finance":          "BAJFINANCE.NS",
    "bajaj finserv":          "BAJAJFINSV.NS",
    "asian paints":           "ASIANPAINT.NS",
    "maruti suzuki":          "MARUTI.NS",
    "maruti":                 "MARUTI.NS",
    "tata motors":            "TATAMOTORS.NS",
    "tatamotors":             "TATAMOTORS.NS",
    "sun pharma":             "SUNPHARMA.NS",
    "sun pharmaceutical":     "SUNPHARMA.NS",
    "ultratech cement":       "ULTRACEMCO.NS",
    "ultratech":              "ULTRACEMCO.NS",
    "kotak mahindra bank":    "KOTAKBANK.NS",
    "kotak mahindra":         "KOTAKBANK.NS",
    "kotak bank":             "KOTAKBANK.NS",
    "kotak":                  "KOTAKBANK.NS",
    "l&t":                    "LT.NS",
    "larsen & toubro":        "LT.NS",
    "larsen and toubro":      "LT.NS",
    "ongc":                   "ONGC.NS",
    "ntpc":                   "NTPC.NS",
    "power grid":             "POWERGRID.NS",
    "titan":                  "TITAN.NS",
    "titan company":          "TITAN.NS",
    "nestle india":           "NESTLEIND.NS",
    "nestle":                 "NESTLEIND.NS",
    "britannia":              "BRITANNIA.NS",
    "dr reddy":               "DRREDDY.NS",
    "dr. reddy":              "DRREDDY.NS",
    "dr. reddy's":            "DRREDDY.NS",
    "cipla":                  "CIPLA.NS",
    "divis laboratories":     "DIVISLAB.NS",
    "divi's":                 "DIVISLAB.NS",
    "adani enterprises":      "ADANIENT.NS",
    "adani ports":            "ADANIPORTS.NS",
    "adani green":            "ADANIGREEN.NS",
    "adani power":            "ADANIPOWER.NS",
    "adani total gas":        "ATGL.NS",
    "adani":                  "ADANIENT.NS",
    "coal india":             "COALINDIA.NS",
    "sbi":                    "SBIN.NS",
    "state bank of india":    "SBIN.NS",
    "state bank":             "SBIN.NS",
    "bajaj auto":             "BAJAJ-AUTO.NS",
    "eicher motors":          "EICHERMOT.NS",
    "hero motocorp":          "HEROMOTOCO.NS",
    "hero":                   "HEROMOTOCO.NS",
    "apollo hospitals":       "APOLLOHOSP.NS",
    "hindalco":               "HINDALCO.NS",
    "jsw steel":              "JSWSTEEL.NS",
    "tata steel":             "TATASTEEL.NS",
    "bpcl":                   "BPCL.NS",
    "bharat petroleum":       "BPCL.NS",
    "tech mahindra":          "TECHM.NS",
    "indusind bank":          "INDUSINDBK.NS",
    "zomato":                 "ZOMATO.NS",
    "paytm":                  "PAYTM.NS",
    "one97 communications":   "PAYTM.NS",
    "nykaa":                  "NYKAA.NS",
    "dmart":                  "DMART.NS",
    "avenue supermarts":      "DMART.NS",
    "vedanta":                "VEDL.NS",
    "grasim":                 "GRASIM.NS",
    "upl":                    "UPL.NS",
    "shree cement":           "SHREECEM.NS",
    "lti mindtree":           "LTIM.NS",
    "ltimindtree":            "LTIM.NS",
    "mrf":                    "MRF.NS",
    "pidilite":               "PIDILITIND.NS",
    "havells":                "HAVELLS.NS",
    "siemens":                "SIEMENS.NS",
    "motherson":              "MOTHERSON.NS",
    "abb india":              "ABB.NS",
    "abb":                    "ABB.NS",
    "irctc":                  "IRCTC.NS",
    "hpcl":                   "HINDPETRO.NS",
    "hindustan petroleum":    "HINDPETRO.NS",
    "ioc":                    "IOC.NS",
    "indian oil":             "IOC.NS",
    "oil india":              "OIL.NS",
    "voltas":                 "VOLTAS.NS",
    "berger paints":          "BERGEPAINT.NS",
    "srf":                    "SRF.NS",
    "godrej consumer":        "GODREJCP.NS",
    "dabur":                  "DABUR.NS",
    "emami":                  "EMAMILTD.NS",
    "marico":                 "MARICO.NS",
    "colgate":                "COLPAL.NS",
    "procter":                "PGHH.NS",
    "hindustan unilever":     "HINDUNILVR.NS",
    "hul":                    "HINDUNILVR.NS",
    "itc":                    "ITC.NS",
    "ambuja cement":          "AMBUJACEM.NS",
    "acc":                    "ACC.NS",
    "dalmia bharat":          "DALBHARAT.NS",
    "jindal steel":           "JSWSTEEL.NS",
    "steel authority":        "SAIL.NS",
    "sail":                   "SAIL.NS",
    "bank of baroda":         "BANKBARODA.NS",
    "bob":                    "BANKBARODA.NS",
    "pnb":                    "PNB.NS",
    "punjab national bank":   "PNB.NS",
    "union bank":             "UNIONBANK.NS",
    "canara bank":            "CANBK.NS",
    # ── US Stocks ───────────────────────────────────────────────────────────
    "apple":                  "AAPL",
    "microsoft":              "MSFT",
    "google":                 "GOOGL",
    "alphabet":               "GOOGL",
    "amazon":                 "AMZN",
    "tesla":                  "TSLA",
    "nvidia":                 "NVDA",
    "meta":                   "META",
    "facebook":               "META",
    "netflix":                "NFLX",
    "jpmorgan":               "JPM",
    "jp morgan":              "JPM",
    "goldman sachs":          "GS",
    "morgan stanley":         "MS",
    "berkshire hathaway":     "BRK-B",
    "johnson & johnson":      "JNJ",
    "walmart":                "WMT",
    "visa":                   "V",
    "mastercard":             "MA",
    "salesforce":             "CRM",
    "adobe":                  "ADBE",
    "intel":                  "INTC",
    "amd":                    "AMD",
    "advanced micro devices": "AMD",
    "qualcomm":               "QCOM",
    "disney":                 "DIS",
    "boeing":                 "BA",
    "exxon":                  "XOM",
    "exxonmobil":             "XOM",
    "chevron":                "CVX",
    "pfizer":                 "PFE",
    "moderna":                "MRNA",
    "uber":                   "UBER",
    "lyft":                   "LYFT",
    "airbnb":                 "ABNB",
    "coinbase":               "COIN",
    "palantir":               "PLTR",
    "snowflake":              "SNOW",
    "spotify":                "SPOT",
    "paypal":                 "PYPL",
    "shopify":                "SHOP",
    "zoom":                   "ZM",
    "twitter":                "X",
    "x corp":                 "X",
    "openai":                 None,   # Not publicly traded
    "arm holdings":           "ARM",
    "arm":                    "ARM",
    "oracle":                 "ORCL",
    "ibm":                    "IBM",
    "cisco":                  "CSCO",
    "dell":                   "DELL",
    "hp":                     "HPQ",
    "amc":                    "AMC",
    "gamestop":               "GME",
    "rivian":                 "RIVN",
    "lucid":                  "LCID",
    "blackrock":              "BLK",
    "bank of america":        "BAC",
    "wells fargo":            "WFC",
    "citigroup":              "C",
    "citi":                   "C",
    # ── Indices ──────────────────────────────────────────────────────────────
    "sensex":                 "^BSESN",
    "bse sensex":             "^BSESN",
    "bse":                    "^BSESN",
    "nifty":                  "^NSEI",
    "nifty 50":               "^NSEI",
    "nifty50":                "^NSEI",
    "nifty bank":             "^NSEBANK",
    "bank nifty":             "^NSEBANK",
    "dow jones":              "^DJI",
    "dow":                    "^DJI",
    "djia":                   "^DJI",
    "s&p 500":                "^GSPC",
    "s&p":                    "^GSPC",
    "sp500":                  "^GSPC",
    "nasdaq":                 "^IXIC",
    "nasdaq composite":       "^IXIC",
    "nasdaq 100":             "^NDX",
    "russell 2000":           "^RUT",
    "ftse 100":               "^FTSE",
    "ftse":                   "^FTSE",
    "dax":                    "^GDAXI",
    "nikkei":                 "^N225",
    "nikkei 225":             "^N225",
    "hang seng":              "^HSI",
    "shanghai":               "000001.SS",
    "cac 40":                 "^FCHI",
}

# ─── Regex Patterns ───────────────────────────────────────────────────────────
_UP   = r"(?:rose|gained|surged|jumped|rallied|climbed|advanced|soared|up|increased|added)"
_DOWN = r"(?:fell|dropped|declined|slipped|lost|plunged|crashed|tumbled|slid|decreased|down|shed)"
_MOVE = rf"(?:{_UP}|{_DOWN})"

# Movement direction detection
_UP_RE   = re.compile(_UP,   re.IGNORECASE)
_DOWN_RE = re.compile(_DOWN, re.IGNORECASE)

# Pattern 1: "<entity> [stock/shares/index] rose/fell X%"
PERCENT_PATTERN = re.compile(
    rf"([\w\s&'.\-]+?)\s+(?:stock|shares?|scrip|counter|index|indices)?\s*"
    rf"({_MOVE})\s+(?:by\s+)?(\d{{1,3}}(?:\.\d{{1,2}})?)\s*(?:per\s*cent|%)",
    re.IGNORECASE
)

# Pattern 2: "<entity> rose/fell X points/pts"
POINT_PATTERN = re.compile(
    rf"([\w\s&'.\-]+?)\s+(?:stock|shares?|index|indices)?\s*"
    rf"({_MOVE})\s+(?:by\s+)?(\d{{1,6}}(?:,\d{{3}})*(?:\.\d{{1,2}})?)\s*(?:points?|pts\.?)",
    re.IGNORECASE
)

# Pattern 3: "<entity> [is/was] trading at/around Rs/$ X"
PRICE_PATTERN = re.compile(
    r"([\w\s&'.\-]+?)\s+(?:stock|shares?)?\s*"
    r"(?:is|was|were|are|trading|closed?|settled?|quoted?)\s+"
    r"(?:at|around|near|above|below|of)\s+"
    r"(?:Rs\.?|INR|₹|\$|USD)?\s*"
    r"(\d{1,6}(?:,\d{3})*(?:\.\d{1,2})?)",
    re.IGNORECASE
)


class FactChecker:
    """Extracts and verifies financial claims from article paragraphs."""

    def __init__(self):
        # Pre-sort keys longest-first so "hdfc bank" matches before "hdfc"
        self._sorted_companies = sorted(
            [(k, v) for k, v in COMPANY_TICKER_MAP.items() if v],
            key=lambda x: len(x[0]),
            reverse=True,
        )

    # ── Public API ─────────────────────────────────────────────────────────────

    def extract_and_verify(
        self,
        paragraph: str,
        article_date: Optional[str] = None,
    ) -> list[dict]:
        """
        Main entry point. Returns a list of claim dicts:
        {
          "claim_text":   str,
          "entity":       str,
          "ticker":       str | None,
          "claim_type":   "percent_change" | "point_change" | "price",
          "claimed_value": float,
          "direction":    "up" | "down" | None,
          "actual_value": float | None,
          "verdict":      "VERIFIED" | "DISPUTED" | "UNVERIFIABLE",
          "message":      str,
        }
        """
        claims = []
        seen_spans: list[tuple[int, int]] = []

        # ── Percentage change claims ──────────────────────────────────────────
        for m in PERCENT_PATTERN.finditer(paragraph):
            span = (m.start(), m.end())
            if self._overlaps(span, seen_spans):
                continue
            seen_spans.append(span)

            entity_raw = m.group(1).strip()
            verb       = m.group(2)
            value      = float(m.group(3).replace(",", ""))
            is_up      = bool(_UP_RE.match(verb))

            ticker = self._resolve_ticker(entity_raw)
            result = self._verify_percent(ticker, value, is_up, article_date)

            claims.append({
                "claim_text":    m.group(0).strip(),
                "entity":        entity_raw,
                "ticker":        ticker,
                "claim_type":    "percent_change",
                "claimed_value": value,
                "direction":     "up" if is_up else "down",
                **result,
            })

        # ── Point change claims ───────────────────────────────────────────────
        for m in POINT_PATTERN.finditer(paragraph):
            span = (m.start(), m.end())
            if self._overlaps(span, seen_spans):
                continue
            seen_spans.append(span)

            entity_raw = m.group(1).strip()
            verb       = m.group(2)
            value      = float(m.group(3).replace(",", ""))
            is_up      = bool(_UP_RE.match(verb))

            ticker = self._resolve_ticker(entity_raw)
            result = self._verify_points(ticker, value, is_up, article_date)

            claims.append({
                "claim_text":    m.group(0).strip(),
                "entity":        entity_raw,
                "ticker":        ticker,
                "claim_type":    "point_change",
                "claimed_value": value,
                "direction":     "up" if is_up else "down",
                **result,
            })

        # ── Price claims ──────────────────────────────────────────────────────
        for m in PRICE_PATTERN.finditer(paragraph):
            span = (m.start(), m.end())
            if self._overlaps(span, seen_spans):
                continue
            seen_spans.append(span)

            entity_raw = m.group(1).strip()
            value      = float(m.group(2).replace(",", ""))

            ticker = self._resolve_ticker(entity_raw)
            result = self._verify_price(ticker, value, article_date)

            claims.append({
                "claim_text":    m.group(0).strip(),
                "entity":        entity_raw,
                "ticker":        ticker,
                "claim_type":    "price",
                "claimed_value": value,
                "direction":     None,
                **result,
            })

        return claims

    # ── Entity Resolution ──────────────────────────────────────────────────────

    def _resolve_ticker(self, entity_raw: str) -> Optional[str]:
        """Map a raw entity string to a stock ticker."""
        entity_lower = entity_raw.lower().strip()
        # Try exact + substring matches (longest key first)
        for company_key, ticker in self._sorted_companies:
            if company_key in entity_lower or entity_lower in company_key:
                return ticker
        return None

    # ── Verification Methods ───────────────────────────────────────────────────

    def _fetch_history(
        self,
        ticker: str,
        article_date: Optional[str],
    ):
        """Fetch 7-day OHLC window around article date. Returns DataFrame or None."""
        try:
            if article_date:
                # Parse ISO date string
                for fmt in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S%z",
                            "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
                    try:
                        target = datetime.strptime(article_date[:19], fmt[:len(article_date)])
                        break
                    except ValueError:
                        continue
                else:
                    target = datetime.now()
            else:
                target = datetime.now()

            start = (target - timedelta(days=7)).strftime("%Y-%m-%d")
            end   = (target + timedelta(days=2)).strftime("%Y-%m-%d")

            hist = yf.Ticker(ticker).history(start=start, end=end)
            return hist if not hist.empty else None
        except Exception as e:
            logger.debug(f"yfinance fetch error [{ticker}]: {e}")
            return None

    def _verify_percent(
        self,
        ticker: Optional[str],
        claimed_pct: float,
        is_up: bool,
        article_date: Optional[str],
    ) -> dict:
        if not ticker:
            return {
                "actual_value": None,
                "verdict":      "UNVERIFIABLE",
                "message":      "Company/index not in our database",
            }

        hist = self._fetch_history(ticker, article_date)
        if hist is None or len(hist) < 2:
            return {
                "actual_value": None,
                "verdict":      "UNVERIFIABLE",
                "message":      f"No market data found for {ticker}",
            }

        latest_close = float(hist["Close"].iloc[-1])
        prev_close   = float(hist["Close"].iloc[-2])
        actual_pct   = ((latest_close - prev_close) / prev_close) * 100

        actual_up = actual_pct > 0
        tolerance = max(0.5, claimed_pct * 0.4)  # 40% relative tolerance

        if actual_up != is_up:
            return {
                "actual_value": round(actual_pct, 2),
                "verdict":      "DISPUTED",
                "message":      f"Article says {'↑' if is_up else '↓'}{claimed_pct}%, "
                                f"actual was {'↑' if actual_up else '↓'}{abs(actual_pct):.2f}%",
            }
        if abs(abs(actual_pct) - claimed_pct) <= tolerance:
            return {
                "actual_value": round(actual_pct, 2),
                "verdict":      "VERIFIED",
                "message":      f"Actual change: {actual_pct:+.2f}% ≈ claimed {'+' if is_up else '-'}{claimed_pct}%",
            }
        return {
            "actual_value": round(actual_pct, 2),
            "verdict":      "DISPUTED",
            "message":      f"Article claimed {'+' if is_up else '-'}{claimed_pct}%, "
                            f"actual was {actual_pct:+.2f}%",
        }

    def _verify_points(
        self,
        ticker: Optional[str],
        claimed_pts: float,
        is_up: bool,
        article_date: Optional[str],
    ) -> dict:
        if not ticker:
            return {
                "actual_value": None,
                "verdict":      "UNVERIFIABLE",
                "message":      "Company/index not in our database",
            }

        hist = self._fetch_history(ticker, article_date)
        if hist is None or len(hist) < 2:
            return {
                "actual_value": None,
                "verdict":      "UNVERIFIABLE",
                "message":      f"No market data found for {ticker}",
            }

        latest_close = float(hist["Close"].iloc[-1])
        prev_close   = float(hist["Close"].iloc[-2])
        actual_pts   = latest_close - prev_close
        actual_up    = actual_pts > 0
        tolerance    = max(5, claimed_pts * 0.35)

        if actual_up != is_up:
            return {
                "actual_value": round(actual_pts, 2),
                "verdict":      "DISPUTED",
                "message":      f"Article says {'↑' if is_up else '↓'}{claimed_pts} pts, "
                                f"actual was {actual_pts:+.2f} pts",
            }
        if abs(abs(actual_pts) - claimed_pts) <= tolerance:
            return {
                "actual_value": round(actual_pts, 2),
                "verdict":      "VERIFIED",
                "message":      f"Actual change: {actual_pts:+.0f} pts ≈ claimed {'+' if is_up else '-'}{claimed_pts:.0f} pts",
            }
        return {
            "actual_value": round(actual_pts, 2),
            "verdict":      "DISPUTED",
            "message":      f"Article claimed {'+' if is_up else '-'}{claimed_pts:.0f} pts, "
                            f"actual was {actual_pts:+.0f} pts",
        }

    def _verify_price(
        self,
        ticker: Optional[str],
        claimed_price: float,
        article_date: Optional[str],
    ) -> dict:
        if not ticker:
            return {
                "actual_value": None,
                "verdict":      "UNVERIFIABLE",
                "message":      "Company/index not in our database",
            }

        hist = self._fetch_history(ticker, article_date)
        if hist is None or len(hist) < 1:
            return {
                "actual_value": None,
                "verdict":      "UNVERIFIABLE",
                "message":      f"No market data found for {ticker}",
            }

        actual_price = float(hist["Close"].iloc[-1])
        tolerance    = claimed_price * 0.05  # 5% price tolerance

        if abs(actual_price - claimed_price) <= tolerance:
            return {
                "actual_value": round(actual_price, 2),
                "verdict":      "VERIFIED",
                "message":      f"Actual price: {actual_price:.2f} ≈ claimed {claimed_price:.2f}",
            }
        pct_diff = ((actual_price - claimed_price) / claimed_price) * 100
        return {
            "actual_value": round(actual_price, 2),
            "verdict":      "DISPUTED",
            "message":      f"Article claimed {claimed_price:.2f}, "
                            f"actual price was {actual_price:.2f} ({pct_diff:+.1f}%)",
        }

    # ── Helpers ────────────────────────────────────────────────────────────────

    @staticmethod
    def _overlaps(span: tuple[int, int], seen: list[tuple[int, int]]) -> bool:
        s, e = span
        return any(not (e <= ss or s >= se) for ss, se in seen)
