export interface ParagraphResult {
  text: string;
  sentiment: 'Positive' | 'Negative' | 'Neutral';
  confidence: number;
  scores: {
    Positive?: number;
    Negative?: number;
    Neutral?: number;
  };
  claims: Claim[];
}

export interface Claim {
  claim_text: string;
  entity: string;
  ticker?: string;
  claim_type: string;
  claimed_value: number;
  direction: string;
  actual_value?: number;
  verdict: 'VERIFIED' | 'DISPUTED' | 'UNVERIFIABLE';
  message: string;
}

export interface AnalysisResult {
  success: boolean;
  url: string;
  articleDate: string | null;
  totalParagraphs: number;
  paragraphs: ParagraphResult[];
  summary: {
    overall: string;
    distribution: { Positive: number; Negative: number; Neutral: number };
    averageConfidence: number;
    factCheck: {
      totalClaims: number;
      verifiedClaims: number;
      disputedClaims: number;
      unverifiableClaims: number;
    };
  };
}

// Dashboard / Feed types
export interface FeedArticle {
  id: number;
  ticker: string;
  company: string;
  title: string;
  url: string;
  summary: string;
  sentiment: 'Positive' | 'Negative' | 'Neutral';
  confidence: number;
  score_bullish: number;
  score_bearish: number;
  analyzed_at: string;
}

export interface TickerStats {
  ticker: string;
  company: string;
  Positive: number;
  Negative: number;
  Neutral: number;
  total: number;
  avg_confidence: number;
}

export interface MarketStats {
  overall: 'Bullish' | 'Bearish' | 'Mixed';
  today: { Positive: number; Negative: number; Neutral: number };
  total_today: number;
  per_ticker: TickerStats[];
  most_active: { ticker: string; company: string; article_count: number }[];
}

export interface WatchlistItem {
  ticker: string;
  company: string;
  sector: string;
}
