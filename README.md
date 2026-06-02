# Financial News Sentiment Analyzer

A full-stack financial NLP tool that analyzes news articles at paragraph level using a **custom-trained FinBERT model** to predict real-world stock market impact (Bullish vs. Bearish) and **automatically fact-checks stock-related numerical claims** against live market data.

---

## ✨ Features

| Feature | Details |
|---|---|
| **Paragraph-level sentiment** | Each paragraph classified as Positive / Negative / Neutral |
| **Custom Impact Predictor** | Fine-tuned on 51,000 Yahoo Finance articles to predict actual next-day stock price movement (58.5% win rate) |
| **Per-label confidence scores** | Softmax probabilities shown for Bullish (Up) / Bearish (Down) classes |
| **Fact-checking** | Extracts % change, point change, and price claims; cross-validates with Yahoo Finance |
| **Article date detection** | Extracts publish date from meta tags / JSON-LD for accurate market lookups |
| **Anti-Bot Scraping Bypass** | Custom Node.js HTTP parser limits bypassed to scrape heavily protected sites like Yahoo Finance |
| **Universal article extraction** | Mozilla Readability algorithm — works on ET, Moneycontrol, Reuters, Bloomberg, etc. |
| **Batch processing** | All paragraphs analyzed in a single Python call — no per-paragraph process overhead |

---

## 🏗️ Architecture

```
Browser  ──POST /api/analyze──▶  Node.js (port 3001)
                                   │  Readability extraction
                                   │  Date parsing
                                   └──POST /analyze──▶  Python Flask (port 5001)
                                                          │  FinBERT sentiment (batched)
                                                          │  Regex claim extraction
                                                          └──yfinance API──▶  Yahoo Finance
```

---

## 🚀 Quick Start (Windows)

### 1. Install Python dependencies

```bash
cd server
pip install -r requirements.txt
```

> **Note:** First run downloads ~440 MB of FinBERT model weights from HuggingFace. Subsequent starts are instant (cached locally).

### 2. Install Node dependencies

```bash
# From project root
npm install

# Backend packages (already done if you ran this before)
cd server && npm install
```

### 3. Start everything

Double-click **`start_all.bat`** in the project root — it opens all three services in separate windows.

Or start manually in three separate terminals:

```bash
# Terminal 1 — Python FinBERT service (start this first, wait for "Service ready")
cd server
python flask_service.py

# Terminal 2 — Node.js API
cd server
node index.js

# Terminal 3 — React frontend
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## 🤖 ML Model: The Impact Predictor

### Moving beyond "Sentiment"
Traditional sentiment analyzers just look for happy or sad words. We went further by building an **Impact Predictor**. 
We fine-tuned the HuggingFace `ProsusAI/finbert` model on a massive dataset of **51,000 historical financial news articles** mapped directly to historical stock market data from Yahoo Finance.

Instead of predicting "Positive/Negative", our custom model was trained on:
- `1` (Bullish) if the mentioned stock's price went UP the next day.
- `0` (Bearish) if the mentioned stock's price went DOWN the next day.

### Training Details & Results
The model was trained using the `Train_Impact_Predictor.ipynb` notebook included in this repository.
- **Dataset:** 51k articles (2017–2023) balanced 50/50 for up/down days to prevent bull-market bias.
- **Base Model:** `ProsusAI/finbert`
- **Final Accuracy:** **58.49%** 

*Note on accuracy:* In quantitative finance, predicting the stock market with >53% accuracy based purely on textual data is considered a highly profitable, tradable alpha signal. A 58.5% win-rate proves the NLP engine is extracting genuine market sentiment from the news.

### How to use your own weights
If you run the training notebook in Google Colab, it will output a `my_finbert_model.zip` file.
Simply extract it into the `server/saved_model` directory. 
The Flask backend is hardcoded to automatically detect this folder on startup and will instantly swap out the base model for your custom weights!

---

## 🔍 Fact-Checking

The fact-checker detects three types of numerical claims:

| Claim Type | Example | Verification |
|---|---|---|
| % change | "HDFC Bank rose 3.2%" | Checks actual day's % change via yfinance |
| Point change | "Sensex fell 450 points" | Checks actual point change |
| Price | "Nifty trading at 22,500" | Checks closing price within 5% tolerance |

Verdicts:
- ✅ **VERIFIED** — matches real data within tolerance band
- ❌ **DISPUTED** — direction wrong or magnitude significantly off
- ⚠️ **UNVERIFIABLE** — company not in database or no data found

Coverage: 100+ Indian stocks (NSE), 50+ US stocks, and 15 major indices including Sensex, Nifty, Dow, S&P 500, Nasdaq.

---

## 📁 Project Structure

```
project/
├── start_all.bat              ← Windows one-click startup
├── src/                       ← React + TypeScript frontend
│   ├── components/
│   │   ├── InputForm.tsx
│   │   ├── SummaryChart.tsx   ← Sentiment dist + fact-check summary
│   │   ├── ParagraphDisplay.tsx ← Per-paragraph + claim badges
│   │   ├── FactCheckBadge.tsx ← Inline VERIFIED/DISPUTED/UNVERIFIABLE cards
│   │   └── StatusMessage.tsx
│   ├── types.ts
│   └── App.tsx
└── server/
    ├── flask_service.py       ← FinBERT Flask microservice (port 5001)
    ├── fact_checker.py        ← Claim extraction + yfinance verification
    ├── index.js               ← Node.js Express API (port 3001)
    └── requirements.txt       ← Python dependencies
```

---

## 🔧 API Reference

### `POST /api/analyze`

**Request:**
```json
{ "url": "https://economictimes.indiatimes.com/article-url" }
```

**Response:**
```json
{
  "success": true,
  "url": "...",
  "articleDate": "2024-01-15T10:30:00Z",
  "totalParagraphs": 12,
  "paragraphs": [
    {
      "text": "HDFC Bank shares rose 3.2% on Friday...",
      "sentiment": "Positive",
      "confidence": 0.9421,
      "scores": { "Positive": 0.9421, "Negative": 0.0312, "Neutral": 0.0267 },
      "claims": [
        {
          "claim_text": "HDFC Bank shares rose 3.2%",
          "entity": "HDFC Bank",
          "ticker": "HDFCBANK.NS",
          "claim_type": "percent_change",
          "claimed_value": 3.2,
          "direction": "up",
          "actual_value": 3.05,
          "verdict": "VERIFIED",
          "message": "Actual change: +3.05% ≈ claimed +3.2%"
        }
      ]
    }
  ],
  "summary": {
    "overall": "Positive",
    "distribution": { "Positive": 8, "Negative": 2, "Neutral": 2 },
    "averageConfidence": 0.87,
    "factCheck": {
      "totalClaims": 4,
      "verifiedClaims": 2,
      "disputedClaims": 1,
      "unverifiableClaims": 1
    }
  }
}
```

---

## License

MIT
