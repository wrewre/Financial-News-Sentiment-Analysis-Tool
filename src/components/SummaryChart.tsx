import { AnalysisResult } from '../types';
import { TrendingUp, TrendingDown, Minus, BarChart3, ShieldCheck, ShieldAlert, ShieldOff } from 'lucide-react';

interface SummaryChartProps {
  result: AnalysisResult;
}

export default function SummaryChart({ result }: SummaryChartProps) {
  const { summary } = result;
  const total = result.totalParagraphs;
  const fc = summary.factCheck;

  const getPercentage = (count: number) => ((count / total) * 100).toFixed(1);

  const getOverallIcon = () => {
    switch (summary.overall) {
      case 'Positive': return <TrendingUp className="w-8 h-8 text-green-600" />;
      case 'Negative': return <TrendingDown className="w-8 h-8 text-red-600" />;
      default:         return <Minus className="w-8 h-8 text-gray-600" />;
    }
  };

  const getOverallColor = () => {
    switch (summary.overall) {
      case 'Positive': return 'text-green-600';
      case 'Negative': return 'text-red-600';
      default:         return 'text-gray-600';
    }
  };

  const getMarketTone = () => {
    const posRatio = summary.distribution.Positive / total;
    const negRatio = summary.distribution.Negative / total;
    if (posRatio > 0.6) return 'Strongly optimistic market sentiment';
    if (posRatio > 0.4) return 'Moderately positive market tone';
    if (negRatio > 0.6) return 'Market tone is largely negative';
    if (negRatio > 0.4) return 'Cautiously bearish outlook';
    return 'Balanced and neutral market perspective';
  };

  const sentimentBars = [
    { key: 'Positive' as const, label: 'Positive', color: 'bg-green-500', text: 'text-green-700' },
    { key: 'Negative' as const, label: 'Negative', color: 'bg-red-500',   text: 'text-red-700'   },
    { key: 'Neutral'  as const, label: 'Neutral',  color: 'bg-gray-400',  text: 'text-gray-700'  },
  ];

  return (
    <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-3xl">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-blue-100 rounded-lg">
          <BarChart3 className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Analysis Summary</h2>
          <p className="text-xs text-gray-400 mt-0.5">Powered by ProsusAI/FinBERT · Financial-domain NLP</p>
        </div>
      </div>

      {/* ── Top cards ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Overall sentiment */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5">
          <div className="flex items-center gap-4">
            {getOverallIcon()}
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Overall Sentiment</p>
              <p className={`text-3xl font-bold ${getOverallColor()}`}>{summary.overall}</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-5">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-white rounded-full shadow-sm">
              <span className="text-2xl font-bold text-purple-600">{total}</span>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Paragraphs Analyzed</p>
              <p className="text-sm text-gray-700 font-semibold">
                {(summary.averageConfidence * 100).toFixed(1)}% avg confidence
              </p>
              {result.articleDate && (
                <p className="text-xs text-gray-400 mt-0.5">
                  Article: {new Date(result.articleDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Sentiment distribution bars ──────────────────────────────────────── */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Sentiment Distribution</h3>
        <div className="space-y-3">
          {sentimentBars.map(({ key, label, color, text }) => (
            <div key={key}>
              <div className="flex justify-between mb-1">
                <span className={`text-sm font-medium ${text}`}>{label}</span>
                <span className={`text-sm font-bold ${text}`}>
                  {summary.distribution[key]} ({getPercentage(summary.distribution[key])}%)
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div
                  className={`${color} h-2.5 rounded-full transition-all duration-700`}
                  style={{ width: `${getPercentage(summary.distribution[key])}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Fact-check summary ───────────────────────────────────────────────── */}
      {fc && fc.totalClaims > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
            🔍 Fact-Check Summary
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
              <ShieldCheck className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-emerald-700">{fc.verifiedClaims}</p>
              <p className="text-xs text-emerald-600 font-medium">Verified</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
              <ShieldAlert className="w-5 h-5 text-red-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-red-700">{fc.disputedClaims}</p>
              <p className="text-xs text-red-600 font-medium">Disputed</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
              <ShieldOff className="w-5 h-5 text-amber-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-amber-700">{fc.unverifiableClaims}</p>
              <p className="text-xs text-amber-600 font-medium">Unverifiable</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            {fc.totalClaims} financial claim{fc.totalClaims !== 1 ? 's' : ''} detected and cross-checked with live market data
          </p>
        </div>
      )}

      {/* ── Market tone ──────────────────────────────────────────────────────── */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
        <p className="text-sm font-medium text-blue-900">{getMarketTone()}</p>
      </div>
    </div>
  );
}
