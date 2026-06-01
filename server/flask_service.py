"""
Flask Microservice — Financial Sentiment Analysis
Uses ProsusAI/finbert: BERT fine-tuned on 10,000 financial sentences.
Accuracy: 97% on Financial PhraseBank (full agreement subset).

Loads model ONCE at startup — no per-request reload overhead.
"""

import logging
import sys
from flask import Flask, request, jsonify
import torch
from transformers import pipeline

from fact_checker import FactChecker

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

# ─── App Setup ────────────────────────────────────────────────────────────────
app = Flask(__name__)

# ─── FinBERT Model Loading ────────────────────────────────────────────────────
# Model: ProsusAI/finbert
# Fine-tuned on Financial PhraseBank dataset
# Labels: positive, negative, neutral (note: lowercase from HuggingFace)
logger.info("=" * 60)
logger.info("Loading ProsusAI/finbert...")
logger.info("(First run will download ~440MB — subsequent runs are instant)")

device_id = 0 if torch.cuda.is_available() else -1
device_name = "CUDA GPU" if device_id == 0 else "CPU"
logger.info(f"Running on: {device_name}")

try:
    sentiment_pipeline = pipeline(
        task="text-classification",
        model="ProsusAI/finbert",
        device=device_id,
        top_k=None,          # Return scores for all 3 labels
        truncation=True,
        max_length=512,
    )
    logger.info("FinBERT loaded successfully!")
except Exception as e:
    logger.error(f"Failed to load FinBERT: {e}")
    logger.error("Make sure 'transformers' and 'torch' are installed.")
    sys.exit(1)

# Label normalizer (FinBERT returns lowercase)
LABEL_MAP = {
    "positive": "Positive",
    "negative": "Negative",
    "neutral":  "Neutral",
}

# ─── Fact Checker ─────────────────────────────────────────────────────────────
try:
    fact_checker = FactChecker()
    logger.info("Fact-checker module initialized.")
except Exception as e:
    logger.warning(f"Fact-checker failed to initialize: {e}. Continuing without it.")
    fact_checker = None

logger.info("=" * 60)
logger.info("Service ready. Listening on port 5001.")


# ─── Routes ──────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "model": "ProsusAI/finbert",
        "device": device_name,
        "fact_checker": fact_checker is not None,
    })


@app.route("/analyze", methods=["POST"])
def analyze():
    """
    Expects JSON body:
    {
      "paragraphs": ["text1", "text2", ...],
      "article_date": "2024-01-15T10:30:00Z"  (optional)
    }

    Returns:
    {
      "results": [
        {
          "text": "...",
          "sentiment": "Positive" | "Negative" | "Neutral",
          "confidence": 0.94,
          "scores": { "Positive": 0.94, "Negative": 0.03, "Neutral": 0.03 },
          "claims": [ ... ]
        }
      ]
    }
    """
    data = request.get_json(force=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    paragraphs = data.get("paragraphs", [])
    article_date = data.get("article_date", None)

    if not paragraphs or not isinstance(paragraphs, list):
        return jsonify({"error": "paragraphs must be a non-empty list"}), 400

    logger.info(f"Analyzing {len(paragraphs)} paragraphs | date={article_date}")

    # ── Sentiment Analysis (Batched) ──────────────────────────────────────────
    # Truncate to 1200 chars for tokenizer safety (well within 512-token limit)
    truncated = [p[:1200] for p in paragraphs]

    try:
        batch_scores = sentiment_pipeline(truncated)
    except Exception as e:
        logger.error(f"Sentiment pipeline error: {e}")
        return jsonify({"error": f"Sentiment analysis failed: {str(e)}"}), 500

    # ── Assemble Results ──────────────────────────────────────────────────────
    results = []
    for paragraph, score_list in zip(paragraphs, batch_scores):
        # score_list = [{"label": "positive", "score": 0.94}, ...]
        best = max(score_list, key=lambda x: x["score"])
        sentiment  = LABEL_MAP.get(best["label"].lower(), "Neutral")
        confidence = round(best["score"], 4)

        # Build full score dict for transparency
        scores = {
            LABEL_MAP.get(s["label"].lower(), s["label"]): round(s["score"], 4)
            for s in score_list
        }

        # ── Fact-Check ───────────────────────────────────────────────────────
        claims = []
        if fact_checker:
            try:
                claims = fact_checker.extract_and_verify(paragraph, article_date)
            except Exception as e:
                logger.warning(f"Fact-check error on paragraph: {e}")

        results.append({
            "text":       paragraph,
            "sentiment":  sentiment,
            "confidence": confidence,
            "scores":     scores,
            "claims":     claims,
        })

    logger.info(f"Done. Sentiments: "
                f"{sum(1 for r in results if r['sentiment']=='Positive')}+ "
                f"{sum(1 for r in results if r['sentiment']=='Negative')}- "
                f"{sum(1 for r in results if r['sentiment']=='Neutral')}=")

    return jsonify({"results": results})


# ─── Entry Point ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=False, use_reloader=False)
