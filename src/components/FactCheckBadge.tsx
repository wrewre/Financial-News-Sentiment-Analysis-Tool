import { Claim } from '../types';

interface FactCheckBadgeProps {
  claims: Claim[];
}

const VERDICT_CONFIG = {
  VERIFIED: {
    icon: '✅',
    label: 'Verified',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-800',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  DISPUTED: {
    icon: '❌',
    label: 'Disputed',
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    badge: 'bg-red-100 text-red-700',
  },
  UNVERIFIABLE: {
    icon: '⚠️',
    label: 'Unverifiable',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-800',
    badge: 'bg-amber-100 text-amber-700',
  },
};

const CLAIM_TYPE_LABEL: Record<string, string> = {
  percent_change: '% change',
  point_change: 'pts change',
  price: 'price',
};

export default function FactCheckBadge({ claims }: FactCheckBadgeProps) {
  if (!claims || claims.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        🔍 Fact Check ({claims.length} claim{claims.length !== 1 ? 's' : ''} found)
      </p>
      {claims.map((claim, i) => {
        const cfg = VERDICT_CONFIG[claim.verdict];
        return (
          <div
            key={i}
            className={`${cfg.bg} ${cfg.border} border rounded-lg px-3 py-2 text-xs`}
          >
            {/* Header row */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className={`font-semibold ${cfg.text} flex items-center gap-1`}>
                {cfg.icon}
                <span className={`${cfg.badge} px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide`}>
                  {cfg.label}
                </span>
                <span className="text-gray-500 font-normal">
                  [{CLAIM_TYPE_LABEL[claim.claim_type] ?? claim.claim_type}]
                </span>
              </span>
              {claim.ticker && (
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono text-[10px]">
                  {claim.ticker}
                </span>
              )}
            </div>

            {/* Claim text */}
            <p className="mt-1 text-gray-600 italic">
              &ldquo;{claim.claim_text}&rdquo;
            </p>

            {/* Verdict message */}
            <p className={`mt-1 ${cfg.text} font-medium`}>{claim.message}</p>
          </div>
        );
      })}
    </div>
  );
}
