import { ParagraphAnalysis } from '../types';
import FactCheckBadge from './FactCheckBadge';

interface ParagraphDisplayProps {
  paragraph: ParagraphAnalysis;
  index: number;
}

export default function ParagraphDisplay({ paragraph, index }: ParagraphDisplayProps) {
  const getSentimentStyles = (sentiment: string) => {
    switch (sentiment) {
      case 'Positive':
        return {
          border: 'border-l-4 border-green-500',
          bg: 'bg-green-50',
          badge: 'bg-green-100 text-green-800',
          scoreDot: 'bg-green-500',
        };
      case 'Negative':
        return {
          border: 'border-l-4 border-red-500',
          bg: 'bg-red-50',
          badge: 'bg-red-100 text-red-800',
          scoreDot: 'bg-red-500',
        };
      default:
        return {
          border: 'border-l-4 border-gray-400',
          bg: 'bg-gray-50',
          badge: 'bg-gray-100 text-gray-700',
          scoreDot: 'bg-gray-400',
        };
    }
  };

  const styles = getSentimentStyles(paragraph.sentiment);
  const confidencePct = (paragraph.confidence * 100).toFixed(1);

  // Mini score bars for all three labels
  const scoreLabels = [
    { label: 'Pos', key: 'Positive' as const, color: 'bg-green-400' },
    { label: 'Neg', key: 'Negative' as const, color: 'bg-red-400' },
    { label: 'Neu', key: 'Neutral'  as const, color: 'bg-gray-400' },
  ];

  return (
    <div className={`${styles.border} ${styles.bg} rounded-r-lg p-5 transition hover:shadow-md`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <span className="text-sm font-semibold text-gray-500">
          Paragraph {index + 1}
        </span>

        <div className="flex items-center gap-3">
          {/* Mini score bars */}
          {paragraph.scores && (
            <div className="flex items-center gap-1.5">
              {scoreLabels.map(({ label, key, color }) => (
                <div key={key} className="flex flex-col items-center gap-0.5">
                  <div className="w-8 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`${color} h-full rounded-full`}
                      style={{ width: `${(paragraph.scores[key] * 100).toFixed(0)}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-gray-400">{label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Sentiment badge */}
          <span className={`${styles.badge} px-3 py-1 rounded-full text-xs font-semibold`}>
            {paragraph.sentiment} · {confidencePct}%
          </span>
        </div>
      </div>

      {/* Paragraph text — no underline, just clean prose */}
      <p className="text-gray-800 leading-relaxed text-sm">{paragraph.text}</p>

      {/* Fact-check badges */}
      {paragraph.claims && paragraph.claims.length > 0 && (
        <FactCheckBadge claims={paragraph.claims} />
      )}
    </div>
  );
}
