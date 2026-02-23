import React, { useState, useEffect } from 'react'
import { queryAgent } from '../api.js'

const AGENT_LABELS = {
  target: 'Target Assessment Agent',
  run_analysis: 'Run Analysis Agent',
  candidate: 'Candidate Evaluation Agent',
  optimization: 'Optimization Strategy Agent',
}

export default function AgentChat({ agentName, context, onClose, onResult }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!agentName || !context) return
    let cancelled = false

    async function fetchAnalysis() {
      setLoading(true)
      setError(null)
      try {
        const data = await queryAgent(agentName, context)
        if (cancelled) return
        setResult(data)
        if (onResult) onResult(data)
      } catch (err) {
        if (cancelled) return
        setError(err?.userMessage || err?.message || 'Agent query failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAnalysis()
    return () => { cancelled = true }
  }, [agentName, context])

  const label = AGENT_LABELS[agentName] || agentName

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#1e3a5f] flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1e3a5f]">{label}</h3>
              <p className="text-[10px] text-gray-400">AI Scientific Advisor</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg className="w-8 h-8 animate-spin text-[#1e3a5f]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm text-gray-500">Analyzing with AI...</p>
              <p className="text-xs text-gray-400">This may take up to 30 seconds</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-700 font-medium">Analysis failed</p>
              <p className="text-xs text-red-500 mt-1">{error}</p>
            </div>
          )}

          {result && !result.available && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-700 font-medium">AI agent unavailable</p>
              <p className="text-xs text-amber-500 mt-1">
                {result.fallback || 'OpenAI API key not configured. Set OPENAI_API_KEY to enable AI analysis.'}
              </p>
            </div>
          )}

          {result && result.available && result.analysis && (
            <div className="space-y-4">
              {/* Summary */}
              {result.analysis.summary && (
                <div className="bg-[#1e3a5f]/5 rounded-lg p-3">
                  <p className="text-xs text-gray-600 leading-relaxed">{result.analysis.summary}</p>
                </div>
              )}

              {/* Assessment badge (for candidate agent) */}
              {result.analysis.assessment && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-500">Verdict:</span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                    result.analysis.assessment === 'advance' ? 'bg-green-100 text-green-700 border-green-200' :
                    result.analysis.assessment === 'stop' ? 'bg-red-100 text-red-700 border-red-200' :
                    'bg-yellow-100 text-yellow-700 border-yellow-200'
                  }`}>
                    {result.analysis.assessment.toUpperCase()}
                  </span>
                </div>
              )}

              {/* Strengths */}
              {result.analysis.strengths?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-green-700 mb-1.5">Strengths</p>
                  <ul className="space-y-1">
                    {result.analysis.strengths.map((s, i) => (
                      <li key={i} className="text-xs text-green-600 flex gap-1.5">
                        <span className="text-green-400 flex-shrink-0">+</span>
                        <span>{typeof s === 'object' ? s.detail || JSON.stringify(s) : s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Risks */}
              {result.analysis.risks?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-700 mb-1.5">Risks</p>
                  <ul className="space-y-1">
                    {result.analysis.risks.map((r, i) => (
                      <li key={i} className="text-xs text-red-600 flex gap-1.5">
                        <span className={`flex-shrink-0 ${
                          r.severity === 'high' ? 'text-red-500' : r.severity === 'medium' ? 'text-yellow-500' : 'text-gray-400'
                        }`}>!</span>
                        <span>{typeof r === 'object' ? r.detail || JSON.stringify(r) : r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Validation actions */}
              {result.analysis.validation_actions?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[#1e3a5f] mb-1.5">Recommended Actions</p>
                  <ol className="list-decimal list-inside space-y-1">
                    {result.analysis.validation_actions.map((a, i) => (
                      <li key={i} className="text-xs text-gray-600">
                        <span className={`inline-block px-1 py-0.5 rounded text-[10px] font-bold mr-1 ${
                          a.priority === 'critical' ? 'bg-red-100 text-red-600' :
                          a.priority === 'recommended' ? 'bg-blue-100 text-blue-600' :
                          'bg-gray-100 text-gray-500'
                        }`}>{a.priority}</span>
                        {typeof a === 'object' ? a.action || JSON.stringify(a) : a}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Recommended weights (for optimization agent) */}
              {result.analysis.recommended_weights && (
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-blue-700 mb-2">Recommended Weights</p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(result.analysis.recommended_weights).map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-xs text-blue-600 capitalize">{key.replace(/_/g, ' ')}</span>
                        <span className="text-xs font-bold text-blue-700">{Math.round(val * 100)}%</span>
                      </div>
                    ))}
                  </div>
                  {result.analysis.weight_rationale && (
                    <p className="text-[10px] text-blue-500 mt-2">{result.analysis.weight_rationale}</p>
                  )}
                </div>
              )}

              {/* Next steps / recommended next steps */}
              {(result.analysis.next_steps || result.analysis.recommended_next_steps)?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1.5">Next Steps</p>
                  <ol className="list-decimal list-inside space-y-1">
                    {(result.analysis.next_steps || result.analysis.recommended_next_steps).map((s, i) => (
                      <li key={i} className="text-xs text-gray-500">
                        {typeof s === 'object' ? s.action || JSON.stringify(s) : s}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
          <p className="text-[10px] text-gray-400">
            {result?.version && `v${result.version}`}
            {result?.model && ` | ${result.model}`}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
