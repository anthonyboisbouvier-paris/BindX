import React, { useState, useEffect } from 'react'
import { estimatePipelineTime } from '../api.js'

export default function TimeEstimate({ params }) {
  const [estimate, setEstimate] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!params) return
    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await estimatePipelineTime(params)
        if (!cancelled) setEstimate(data)
      } catch {
        if (!cancelled) setEstimate(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 300) // debounce
    return () => { cancelled = true; clearTimeout(timer) }
  }, [
    params?.n_ligands,
    params?.mode,
    params?.docking_engine,
    params?.enable_generation,
    params?.enable_retrosynthesis,
  ])

  if (!estimate && !loading) return null

  const quick = estimate?.quick
  const full = estimate?.estimate

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Estimated Runtime
        </h4>
        {loading && (
          <span className="text-xs text-blue-400 animate-pulse">Calculating...</span>
        )}
      </div>

      {quick && (
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-[#1e3a5f]">
            {quick.estimate_human}
          </span>
          {full?.confidence && (
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
              full.confidence === 'high' ? 'bg-green-100 text-green-700' :
              full.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {full.confidence} confidence
            </span>
          )}
        </div>
      )}

      {full?.steps && full.steps.length > 0 && (
        <Details summary="Step breakdown" defaultOpen={false}>
          <div className="space-y-1 mt-2">
            {full.steps.map((step, i) => {
              const pct = full.total_seconds > 0
                ? (step.seconds / full.total_seconds) * 100
                : 0
              return (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div className="w-32 text-gray-600 truncate">{step.name}</div>
                  <div className="flex-1 bg-blue-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.max(2, pct)}%` }}
                    />
                  </div>
                  <div className="w-14 text-right text-gray-500 font-mono">
                    {step.seconds < 60 ? `${step.seconds.toFixed(0)}s` : `${(step.seconds / 60).toFixed(1)}m`}
                  </div>
                </div>
              )
            })}
          </div>
        </Details>
      )}

      {quick?.breakdown && (
        <div className="flex gap-4 text-xs text-gray-500">
          {quick.breakdown.map((b, i) => (
            <span key={i}>
              <span className="font-medium text-gray-700">{b.step}:</span> {b.time}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function Details({ summary, defaultOpen, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
      >
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-90' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        {summary}
      </button>
      {open && children}
    </div>
  )
}
