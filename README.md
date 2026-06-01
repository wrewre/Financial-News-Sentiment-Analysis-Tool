# Financial News Sentiment Analyzer

A full-stack financial NLP tool that analyzes news articles at paragraph level using **FinBERT** — a BERT model fine-tuned on financial text — and **automatically fact-checks stock-related numerical claims** against live market data.

---

## ✨ Features

| Feature | Details |
|---|---|
| **Paragraph-level sentiment** | Each paragraph classified as Positive / Negative / Neutral |
| **FinBERT model** | ProsusAI/finbert — 97% accuracy on Financial PhraseBank |
| **Per-label confidence scores** | Softmax probabilities shown for all three classes |
| **Fact-checking** | Extracts % change, point change, and price claims; cross-validates with Yahoo Finance |
| **Article date detection** | Extracts publish date from meta tags / JSON-LD for accurate market lookups |
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

## 🤖 ML Model

### Why FinBERT?

`ProsusAI/finbert` is a BERT model fine-tuned on the **Financial PhraseBank** dataset — 10,000 sentences from Reuters financial news annotated by finance domain experts.

| Metric | FinBERT |
|---|---|
| Accuracy (full agreement) | **97%** |
| Accuracy (all samples) | **86%** |
| Input | Financial text up to 512 tokens |
| Labels | Positive / Negative / Neutral |

### How to fine-tune FinBERT on your own dataset

If you want to further adapt the model to a specific domain (e.g., Indian markets, crypto), here's the workflow:

```python
from transformers import AutoTokenizer, AutoModelForSequenceClassification, Trainer, TrainingArguments
from datasets import Dataset
import torch

# 1. Load FinBERT as base
model_name = "ProsusAI/finbert"
tokenizer  = AutoTokenizer.from_pretrained(model_name)
model      = AutoModelForSequenceClassification.from_pretrained(model_name, num_labels=3)

# 2. Prepare your dataset
# Labels: 0=Negative, 1=Neutral, 2=Positive  (same as FinBERT's original mapping)
train_data = Dataset.from_dict({
    "text":  ["Revenue beat expectations", "Stock fell amid losses", ...],
    "label": [2, 0, ...]
})

def tokenize(batch):
    return tokenizer(batch["text"], truncation=True, padding=True, max_length=256)

train_data = train_data.map(tokenize, batched=True)

# 3. Training arguments — fewer epochs needed since FinBERT is already domain-adapted
training_args = TrainingArguments(
    output_dir="./finbert-finetuned",
    num_train_epochs=3,           # 2–3 epochs is enough (not 10!)
    per_device_train_batch_size=16,
    learning_rate=2e-5,
    weight_decay=0.01,
    warmup_ratio=0.1,             # Linear warmup to prevent catastrophic forgetting
    evaluation_strategy="epoch",
    save_strategy="epoch",
    load_best_model_at_end=True,
    metric_for_best_model="accuracy",
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_data,
    # eval_dataset=val_data,
)

# 4. Train and save
trainer.train()
model.save_pretrained("./finbert-finetuned")
tokenizer.save_pretrained("./finbert-finetuned")
```

Then update `flask_service.py` line:
```python
model="ProsusAI/finbert"  →  model="./finbert-finetuned"
```

**Key differences from your original training notebook:**
- Use `warmup_ratio=0.1` to prevent catastrophic forgetting of pre-trained weights
- 2–3 epochs maximum (not 10 — more epochs → overfitting)
- Add `class_weight='balanced'` or use a weighted sampler if classes are imbalanced
- FinBERT already knows financial language, so it converges much faster

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
