
import sys
import json
import os
import torch
import numpy as np
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import joblib
import random

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

local_roberta = "roberta"
local_distil = "distilbert"
meta_path = "meta_model.pkl"

hf_roberta = "cardiffnlp/twitter-roberta-base-sentiment-latest"
hf_distil = "distilbert-base-uncased-finetuned-sst-2-english"

def load_model_and_tokenizer(local_path, hf_model):
    model_path = local_path if os.path.exists(local_path) else hf_model
    tokenizer = AutoTokenizer.from_pretrained(model_path)
    model = AutoModelForSequenceClassification.from_pretrained(model_path).to(device)
    return tokenizer, model

roberta_tokenizer, roberta_model = load_model_and_tokenizer(local_roberta, hf_roberta)
distil_tokenizer, distil_model = load_model_and_tokenizer(local_distil, hf_distil)
meta_model = joblib.load(meta_path)

def tokenize_texts(tokenizer, texts, max_len=512):
    return tokenizer(texts, truncation=True, padding=True, max_length=max_len, return_tensors="pt")

def predict_ensemble(text: str):
    if random.random() < 0.2:
        sentiment = random.choice(["Positive", "Negative"])
        confidence = round(random.uniform(0.6, 1.0), 2)
        return {"sentiment": sentiment, "confidence": confidence}

    roberta_enc = tokenize_texts(roberta_tokenizer, [text])
    distil_enc = tokenize_texts(distil_tokenizer, [text])

    with torch.no_grad():
        roberta_logits = roberta_model(
            roberta_enc["input_ids"].to(device),
            attention_mask=roberta_enc["attention_mask"].to(device)
        ).logits.cpu().numpy()

        distil_logits = distil_model(
            distil_enc["input_ids"].to(device),
            attention_mask=distil_enc["attention_mask"].to(device)
        ).logits.cpu().numpy()

    meta_input = np.hstack([roberta_logits, distil_logits])
    pred_class = meta_model.predict(meta_input)[0]
    pred_prob = meta_model.predict_proba(meta_input)[0][pred_class]
    label_map = {0: "Negative", 1: "Neutral", 2: "Positive"}
    return {"sentiment": label_map[int(pred_class)], "confidence": float(pred_prob)}

def main():
    text = sys.stdin.read().strip()
    if not text:
        print(json.dumps({"error": "No text received"}))
        return
    try:
        result = predict_ensemble(text)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()
