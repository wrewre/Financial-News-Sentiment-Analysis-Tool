export interface Claim {
  claim_text: string;
  entity: string;
  ticker: string | null;
  claim_type: 'percent_change' | 'point_change' | 'price';
  claimed_value: number;
  direction: 'up' | 'down' | null;
  actual_value: number | null;
  verdict: 'VERIFIED' | 'DISPUTED' | 'UNVERIFIABLE';
  message: string;
}

export interface ParagraphAnalysis {
  text: string;
  sentiment: 'Positive' | 'Negative' | 'Neutral';
  confidence: number;
  scores: {
    Positive: number;
    Negative: number;
    Neutral: number;
  };
  claims: Claim[];
}

export interface FactCheckSummary {
  totalClaims: number;
  verifiedClaims: number;
  disputedClaims: number;
  unverifiableClaims: number;
}

export interface AnalysisResult {
  success: boolean;
  url: string;
  articleDate: string | null;
  totalParagraphs: number;
  paragraphs: ParagraphAnalysis[];
  summary: {
    overall: 'Positive' | 'Negative' | 'Neutral';
    distribution: {
      Positive: number;
      Negative: number;
      Neutral: number;
    };
    averageConfidence: number;
    factCheck: FactCheckSummary;
  };
}

export interface ApiError {
  error: string;
}
