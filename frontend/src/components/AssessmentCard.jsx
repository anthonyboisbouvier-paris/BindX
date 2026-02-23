import React from 'react'

const SCORE_CONFIG = {
  evidence:     { label: 'Evidence',     tip: 'Therapeutic validation from literature and databases' },
  druggability: { label: 'Druggability', tip: 'Structural feasibility for small-molecule targeting' },
  novelty:      { label: 'Novelty',      tip: 'How unexplored the target is (higher = more novel)' },
  safety:       { label: 'Safety',       tip: 'Risk of off-target liabilities (lower bar = safer)' },
  feasibility:  { label: 'Feasibility',  tip: 'Practical screening feasibility based on available data' },
}

const BADGE_STYLES = {
  GO:      'bg-green-100 text-green-700 border-green-200',
  CAUTION: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'NO-GO': 'bg-red-100 text-red-700 border-red-200',
}

function ScoreBar({ name, value, isSafety }) {
  const cfg = SCORE_CONFIG[name] || { label: name, tip: '' }
  // Safety is inverted: displayed as (1 - risk) for visual consistency
  const displayValue = isSafety ? 1 - (value || 0) : (value || 0)
  const pct = Math.round(displayValue * 100)

  let barColor = 'bg-red-400'
  if (pct >= 70) barColor = 'bg-[#22c55e]'
  else if (pct >= 40) barColor = 'bg-yellow-400'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600">{cfg.label}</span>
        <span className="text-xs font-bold text-[#1e3a5f] tabular-nums">{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {cfg.tip && (
        <p className="text-[10px] text-gray-400 leading-tight">{cfg.tip}</p>
      )}
    </div>
  )
}

export default function AssessmentCard({ assessment, compact = false }) {
  if (!assessment) return null

  const scores = assessment.scores || {}
  const composite = assessment.composite_score ?? 0
  const recommendation = assessment.recommendation || 'CAUTION'
  const rationale = assessment.rationale || ''

  const compositePct = Math.round(composite * 100)
  const badgeCls = BADGE_STYLES[recommendation] || BADGE_STYLES.CAUTION

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${badgeCls}`}>
          {recommendation}
        </span>
        <span className="text-sm font-bold text-[#1e3a5f] tabular-nums">{compositePct}/100</span>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Target Assessment
        </h3>
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${badgeCls}`}>
          {recommendation}
        </span>
      </div>

      {/* Composite score bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-semibold text-gray-700">Composite Score</span>
          <span className="text-lg font-bold text-[#1e3a5f] tabular-nums">{compositePct}/100</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              compositePct >= 65 ? 'bg-[#22c55e]' : compositePct >= 40 ? 'bg-yellow-400' : 'bg-red-400'
            }`}
            style={{ width: `${compositePct}%` }}
          />
        </div>
      </div>

      {/* 5 score bars */}
      <div className="space-y-3">
        {Object.keys(SCORE_CONFIG).map((key) => {
          const scoreData = scores[key]
          const value = scoreData?.score ?? 0
          return (
            <ScoreBar
              key={key}
              name={key}
              value={value}
              isSafety={key === 'safety'}
            />
          )
        })}
      </div>

      {/* Rationale */}
      {rationale && (
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-600 leading-relaxed">{rationale}</p>
        </div>
      )}

      {/* Flags */}
      {assessment.critical_flags?.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-red-700 mb-1">Critical Flags</p>
          {assessment.critical_flags.map((flag, i) => (
            <p key={i} className="text-xs text-red-600">
              {flag}
            </p>
          ))}
        </div>
      )}

    </div>
  )
}
