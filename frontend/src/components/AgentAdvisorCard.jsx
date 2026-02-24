import React, { useState, useEffect, useCallback } from 'react'
import { queryAgent } from '../api.js'

// ---------------------------------------------------------------------------
// Theme config per agent type
// ---------------------------------------------------------------------------
const AGENT_THEMES = {
  target: {
    name: 'Target Assessment Agent',
    icon: '🎯',
    color: '#1e3a5f',
    bgLight: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-800',
    badgeBg: 'bg-blue-100 text-blue-700 border-blue-200',
    headerBg: 'bg-[#1e3a5f]',
    accentBorder: 'border-l-[#1e3a5f]',
  },
  run_analysis: {
    name: 'Run Analysis Agent',
    icon: '📊',
    color: '#059669',
    bgLight: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    textColor: 'text-emerald-800',
    badgeBg: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    headerBg: 'bg-emerald-700',
    accentBorder: 'border-l-emerald-600',
  },
  candidate: {
    name: 'Candidate Evaluation Agent',
    icon: '💊',
    color: '#7c3aed',
    bgLight: 'bg-purple-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-800',
    badgeBg: 'bg-purple-100 text-purple-700 border-purple-200',
    headerBg: 'bg-purple-700',
    accentBorder: 'border-l-purple-600',
  },
  optimization: {
    name: 'Optimization Strategy Agent',
    icon: '⚗️',
    color: '#d97706',
    bgLight: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-800',
    badgeBg: 'bg-amber-100 text-amber-700 border-amber-200',
    headerBg: 'bg-amber-600',
    accentBorder: 'border-l-amber-500',
  },
}

const RECOMMENDATION_BADGES = {
  GO: 'bg-green-100 text-green-700 border-green-300',
  CAUTION: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  'NO-GO': 'bg-red-100 text-red-700 border-red-300',
  advance: 'bg-green-100 text-green-700 border-green-300',
  caution: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  stop: 'bg-red-100 text-red-700 border-red-300',
  excellent: 'bg-green-100 text-green-700 border-green-300',
  good: 'bg-blue-100 text-blue-700 border-blue-300',
  moderate: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  poor: 'bg-red-100 text-red-700 border-red-300',
  potency: 'bg-blue-100 text-blue-700 border-blue-300',
  selectivity: 'bg-purple-100 text-purple-700 border-purple-300',
  admet: 'bg-teal-100 text-teal-700 border-teal-300',
  balanced: 'bg-gray-100 text-gray-700 border-gray-300',
}

const PRIORITY_BADGES = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-red-100 text-red-700',
  recommended: 'bg-blue-100 text-blue-700',
  medium: 'bg-yellow-100 text-yellow-700',
  optional: 'bg-gray-100 text-gray-600',
  low: 'bg-gray-100 text-gray-600',
}

// ---------------------------------------------------------------------------
// Confidence arc SVG
// ---------------------------------------------------------------------------
function ConfidenceArc({ value, size = 48 }) {
  const pct = Math.round((value || 0) * 100)
  const radius = (size - 6) / 2
  const circumference = Math.PI * radius
  const offset = circumference * (1 - (value || 0))
  const color = pct >= 70 ? '#22c55e' : pct >= 40 ? '#eab308' : '#ef4444'

  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg width={size} height={size / 2 + 4} viewBox={`0 0 ${size} ${size / 2 + 4}`}>
        <path
          d={`M 3 ${size / 2 + 1} A ${radius} ${radius} 0 0 1 ${size - 3} ${size / 2 + 1}`}
          fill="none" stroke="#e5e7eb" strokeWidth={4} strokeLinecap="round"
        />
        <path
          d={`M 3 ${size / 2 + 1} A ${radius} ${radius} 0 0 1 ${size - 3} ${size / 2 + 1}`}
          fill="none" stroke={color} strokeWidth={4} strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <span className="text-xs font-bold" style={{ color }}>{pct}%</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Expandable section
// ---------------------------------------------------------------------------
function ExpandSection({ title, count, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  if (!count) return null
  return (
    <div>
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 w-full text-left text-xs font-semibold text-gray-500 hover:text-gray-700 py-1">
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-90' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        {title}
        <span className="text-gray-400 font-normal">({count})</span>
      </button>
      {open && <div className="ml-5 mt-1 space-y-1.5">{children}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function AgentAdvisorCard({
  agentName,
  context,
  result: preResult,
  autoFetch = false,
  onResult,
  projectId,
}) {
  const [result, setResult] = useState(preResult || null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const theme = AGENT_THEMES[agentName] || AGENT_THEMES.target

  const doFetch = useCallback(async () => {
    if (!context || loading) return
    setLoading(true)
    setError(null)
    try {
      const data = await queryAgent(agentName, context, projectId)
      setResult(data)
      if (onResult) onResult(data)
    } catch (err) {
      setError(err?.userMessage || err?.message || 'Agent query failed')
    } finally {
      setLoading(false)
    }
  }, [agentName, context, projectId, onResult, loading])

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch && !result && !loading) doFetch()
  }, [autoFetch]) // eslint-disable-line react-hooks/exhaustive-deps

  // Update from pre-fetched
  useEffect(() => {
    if (preResult) setResult(preResult)
  }, [preResult])

  const analysis = result?.analysis
  const available = result?.available
  const researchSummary = result?.research_summary || analysis?.research_summary

  // Not yet fetched — show trigger button
  if (!result && !loading && !error) {
    return (
      <div className={`rounded-xl border ${theme.borderColor} ${theme.bgLight} p-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{theme.icon}</span>
            <span className={`text-sm font-semibold ${theme.textColor}`}>{theme.name}</span>
          </div>
          <button onClick={doFetch}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg transition-colors ${theme.headerBg} hover:opacity-90`}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Get AI Analysis
          </button>
        </div>
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className={`rounded-xl border ${theme.borderColor} ${theme.bgLight} p-5`}>
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 animate-spin" style={{ color: theme.color }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <div>
            <p className={`text-sm font-semibold ${theme.textColor}`}>{theme.name}</p>
            <p className="text-xs text-gray-400">
              {researchSummary ? 'Analyzing research data...' : 'Gathering research data & analyzing...'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className={`rounded-xl border border-red-200 bg-red-50 p-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{theme.icon}</span>
            <div>
              <p className="text-sm font-semibold text-red-700">{theme.name}</p>
              <p className="text-xs text-red-500">{error}</p>
            </div>
          </div>
          <button onClick={doFetch}
            className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-100 hover:bg-red-200 rounded-lg border border-red-200 transition-colors">
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Fallback (unavailable)
  if (!available || !analysis) {
    return (
      <div className={`rounded-xl border ${theme.borderColor} ${theme.bgLight} p-4`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{theme.icon}</span>
          <div>
            <p className={`text-sm font-semibold ${theme.textColor}`}>{theme.name}</p>
            <p className="text-xs text-gray-400 italic">
              {result?.fallback || 'AI analysis unavailable (OpenAI API key not configured)'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Extract common fields from analysis
  const summary = analysis.summary || ''
  const recommendation = analysis.recommendation || analysis.assessment || analysis.run_quality || analysis.optimization_priority || ''
  const confidence = analysis.confidence ?? null
  const strengths = analysis.strengths || []
  const weaknesses = analysis.weaknesses || analysis.risks || analysis.property_alerts || []
  const nextSteps = analysis.next_steps || analysis.recommended_next_steps || analysis.validation_actions || analysis.experimental_validation || []
  const comparableDrugs = analysis.comparable_drugs || analysis.comparable_clinical_compounds || []
  const litRefs = analysis.literature_references || []
  const keyPapers = analysis.key_papers || []
  const screeningStrategy = analysis.screening_strategy
  const chemicalSeries = analysis.chemical_series || []
  const topCandidates = analysis.top_candidates || []
  const structuralMods = analysis.structural_modifications || []
  const sarHypotheses = analysis.sar_hypotheses || []
  const recommendedWeights = analysis.recommended_weights
  const drugLikeness = analysis.drug_likeness

  const recBadge = RECOMMENDATION_BADGES[recommendation] || RECOMMENDATION_BADGES.CAUTION

  const papersCount = researchSummary?.pubmed_papers_found || 0
  const trialsCount = researchSummary?.clinical_trials_found || 0

  return (
    <div className={`rounded-xl border ${theme.borderColor} shadow-sm overflow-hidden`}>
      {/* Header */}
      <div className={`${theme.headerBg} px-5 py-3 flex items-center justify-between gap-3`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-lg flex-shrink-0">{theme.icon}</span>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm truncate">{theme.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-white/50 text-[10px] font-medium">GPT-4o</span>
              {papersCount > 0 && (
                <span className="text-white/60 text-[10px]">{papersCount} papers analyzed</span>
              )}
              {trialsCount > 0 && (
                <span className="text-white/60 text-[10px]">{trialsCount} trials found</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {confidence != null && <ConfidenceArc value={confidence} />}
          {recommendation && (
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${recBadge} whitespace-nowrap`}>
              {recommendation.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      <div className={`${theme.bgLight} p-5 space-y-4`}>
        {/* Executive summary */}
        {summary && (
          <div className={`border-l-4 ${theme.accentBorder} pl-4 py-1`}>
            <p className="text-sm text-gray-700 leading-relaxed">{summary}</p>
          </div>
        )}

        {/* Strengths & Risks/Weaknesses grid */}
        {(strengths.length > 0 || weaknesses.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {strengths.length > 0 && (
              <div className="bg-white/80 rounded-lg p-3">
                <p className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Strengths
                </p>
                <ul className="space-y-1.5">
                  {strengths.map((s, i) => {
                    const text = typeof s === 'string' ? s : s.detail || s.category || JSON.stringify(s)
                    return (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-green-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0 mt-1" />
                        {text}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
            {weaknesses.length > 0 && (
              <div className="bg-white/80 rounded-lg p-3">
                <p className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {agentName === 'target' ? 'Weaknesses' : 'Risks'}
                </p>
                <ul className="space-y-1.5">
                  {weaknesses.map((w, i) => {
                    const text = typeof w === 'string' ? w : w.detail || w.description || JSON.stringify(w)
                    const severity = typeof w === 'object' ? w.severity : null
                    const sevColor = severity === 'high' ? 'bg-red-400' : severity === 'medium' ? 'bg-yellow-400' : 'bg-gray-400'
                    return (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-red-600">
                        <span className={`w-1.5 h-1.5 rounded-full ${sevColor} flex-shrink-0 mt-1`} />
                        {severity && <span className="text-[10px] font-semibold uppercase opacity-60">[{severity}]</span>}
                        {text}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Screening strategy (target agent) */}
        {screeningStrategy && (
          <div className="bg-white/80 rounded-lg p-3">
            <p className="text-xs font-semibold text-blue-700 mb-2">Screening Strategy</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-gray-400">Mode</span>
                <p className="font-semibold text-gray-700 capitalize">{screeningStrategy.recommended_mode}</p>
              </div>
              <div>
                <span className="text-gray-400">Hit Rate</span>
                <p className="font-semibold text-gray-700 capitalize">{screeningStrategy.expected_hit_rate}</p>
              </div>
              {screeningStrategy.library_focus && (
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-gray-400">Library</span>
                  <p className="font-semibold text-gray-700">{screeningStrategy.library_focus}</p>
                </div>
              )}
            </div>
            {screeningStrategy.key_considerations?.length > 0 && (
              <div className="mt-2 space-y-0.5">
                {screeningStrategy.key_considerations.map((c, i) => (
                  <p key={i} className="text-[11px] text-gray-500">- {c}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Drug likeness (candidate agent) */}
        {drugLikeness && (
          <div className="bg-white/80 rounded-lg p-3">
            <p className="text-xs font-semibold text-purple-700 mb-2">Drug-Likeness Profile</p>
            <div className="flex flex-wrap gap-3 text-xs">
              <div>
                <span className="text-gray-400">Lipinski violations</span>
                <p className="font-semibold text-gray-700">{drugLikeness.lipinski_violations}</p>
              </div>
              <div>
                <span className="text-gray-400">Lead-like</span>
                <p className={`font-semibold ${drugLikeness.lead_likeness ? 'text-green-600' : 'text-red-500'}`}>
                  {drugLikeness.lead_likeness ? 'Yes' : 'No'}
                </p>
              </div>
              <div>
                <span className="text-gray-400">Oral bioavailability</span>
                <p className="font-semibold text-gray-700 capitalize">{drugLikeness.oral_bioavailability_prediction}</p>
              </div>
            </div>
          </div>
        )}

        {/* Recommended weights (optimization agent) */}
        {recommendedWeights && (
          <div className="bg-white/80 rounded-lg p-3">
            <p className="text-xs font-semibold text-amber-700 mb-2">Recommended Weights</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(recommendedWeights).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className="font-bold text-gray-700">{Math.round((val || 0) * 100)}%</span>
                </div>
              ))}
            </div>
            {analysis.weight_rationale && (
              <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">{analysis.weight_rationale}</p>
            )}
          </div>
        )}

        {/* Chemical series (run_analysis agent) */}
        <ExpandSection title="Chemical Series" count={chemicalSeries.length}>
          {chemicalSeries.map((s, i) => (
            <div key={i} className="bg-white/80 rounded p-2 text-xs">
              <p className="font-semibold text-gray-700">{s.name} ({s.n_members || '?'} members)</p>
              {s.avg_affinity && <p className="text-gray-500">Avg affinity: {s.avg_affinity} kcal/mol</p>}
              {s.strengths?.length > 0 && (
                <p className="text-green-600 mt-0.5">{s.strengths.join(', ')}</p>
              )}
            </div>
          ))}
        </ExpandSection>

        {/* Top candidates (run_analysis agent) */}
        <ExpandSection title="Top Candidates" count={topCandidates.length}>
          {topCandidates.map((c, i) => (
            <div key={i} className="text-xs">
              <span className="font-semibold text-gray-700">{c.name}</span>
              {c.rationale && <span className="text-gray-500 ml-1">— {c.rationale}</span>}
            </div>
          ))}
        </ExpandSection>

        {/* Structural modifications (optimization agent) */}
        <ExpandSection title="Structural Modifications" count={structuralMods.length} defaultOpen={true}>
          {structuralMods.map((m, i) => (
            <div key={i} className="bg-white/80 rounded p-2 text-xs space-y-0.5">
              <p className="font-semibold text-gray-700">{m.position}</p>
              <p className="text-gray-500">
                {m.current_group} → <span className="font-medium text-amber-700">{(m.suggested_groups || []).join(', ')}</span>
              </p>
              {m.rationale && <p className="text-gray-400 italic">{m.rationale}</p>}
            </div>
          ))}
        </ExpandSection>

        {/* SAR hypotheses */}
        <ExpandSection title="SAR Hypotheses" count={sarHypotheses.length}>
          {sarHypotheses.map((h, i) => (
            <div key={i} className="text-xs">
              <p className="text-gray-700">{h.hypothesis}</p>
              {h.test && <p className="text-gray-400 italic">Test: {h.test}</p>}
            </div>
          ))}
        </ExpandSection>

        {/* Comparable drugs/compounds */}
        <ExpandSection title="Comparable Clinical Compounds" count={comparableDrugs.length}>
          {comparableDrugs.map((d, i) => (
            <span key={i} className="inline-flex items-center mr-1.5 mb-1 px-2 py-0.5 bg-white rounded border border-gray-200 text-xs text-gray-600 font-medium">
              {typeof d === 'string' ? d : d.name || JSON.stringify(d)}
            </span>
          ))}
        </ExpandSection>

        {/* Literature references */}
        <ExpandSection title="Literature References" count={litRefs.length}>
          {litRefs.map((ref, i) => (
            <div key={i} className="text-xs">
              {ref.url || ref.pmid ? (
                <a href={ref.url || `https://pubmed.ncbi.nlm.nih.gov/${ref.pmid}/`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-blue-600 hover:underline font-medium">
                  {ref.title || `PMID: ${ref.pmid}`}
                </a>
              ) : (
                <span className="text-gray-700 font-medium">{ref.title || JSON.stringify(ref)}</span>
              )}
              {ref.finding && <p className="text-gray-400 mt-0.5">{ref.finding}</p>}
            </div>
          ))}
        </ExpandSection>

        {/* Key papers */}
        <ExpandSection title="Key Papers" count={keyPapers.length}>
          {keyPapers.map((p, i) => (
            <div key={i} className="text-xs space-y-0.5">
              <p className="font-medium text-gray-700">{p.title || `Paper ${i + 1}`}</p>
              {p.finding && <p className="text-gray-500">{p.finding}</p>}
              {p.pmid && (
                <a href={`https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-blue-500 hover:underline text-[10px]">
                  PMID: {p.pmid}
                </a>
              )}
            </div>
          ))}
        </ExpandSection>

        {/* Next steps / actions */}
        {nextSteps.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">Recommended Actions</p>
            <div className="space-y-1.5">
              {nextSteps.map((step, i) => {
                const text = typeof step === 'string' ? step : step.action || step.experiment || step.description || JSON.stringify(step)
                const priority = typeof step === 'object' ? (step.priority || '') : ''
                const priBadge = PRIORITY_BADGES[priority] || ''
                return (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 font-semibold text-[10px] flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {priority && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${priBadge}`}>
                            {priority}
                          </span>
                        )}
                        <span className="text-gray-700">{text}</span>
                      </div>
                      {typeof step === 'object' && step.rationale && (
                        <p className="text-gray-400 mt-0.5 italic">{step.rationale}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-[10px] text-gray-400 pt-2 border-t border-gray-200/50">
          <div className="flex items-center gap-3">
            <span>v{result.version || '2.0.0'}</span>
            <span>{result.model || 'gpt-4o'}</span>
          </div>
          <div className="flex items-center gap-2">
            {result.timestamp && <span>{new Date(result.timestamp).toLocaleString()}</span>}
            <button onClick={doFetch} className="text-gray-500 hover:text-gray-700 underline underline-offset-2">
              Refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
