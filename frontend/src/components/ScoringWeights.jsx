import React, { useState, useEffect, useCallback, useRef } from 'react'

// -----------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------
const DEFAULT_WEIGHTS = { affinity: 25, safety: 25, druglikeness: 25, synthesis: 25 }

const SLIDER_CONFIG = [
  {
    key: 'affinity',
    label: 'Affinity Weight',
    description: 'Binding energy (more negative = better)',
    color: 'accent-blue-600',
  },
  {
    key: 'safety',
    label: 'Safety Weight',
    description: 'ADMET safety score (0–1)',
    color: 'accent-[#22c55e]',
  },
  {
    key: 'druglikeness',
    label: 'Drug-likeness Weight',
    description: 'QED score (0–1)',
    color: 'accent-[#22c55e]',
  },
  {
    key: 'synthesis',
    label: 'Synthesis Weight',
    description: 'Synthesis accessibility (0–1)',
    color: 'accent-[#22c55e]',
  },
]

// -----------------------------------------------------------------------
// Normalization helpers
// -----------------------------------------------------------------------

/**
 * Normalize affinity: more negative is better, so flip the scale.
 * Returns a value in [0, 1] where 1 = best (most negative affinity).
 */
function normalizeAffinity(value, minAffinity, maxAffinity) {
  if (minAffinity === maxAffinity) return 1
  return (maxAffinity - value) / (maxAffinity - minAffinity)
}

/**
 * Normalize a 0–1 score (safety, qed, synthesis) — higher is better.
 * Clamps to [0, 1].
 */
function normalizeDirect(value) {
  if (value === null || value === undefined || isNaN(value)) return 0
  return Math.max(0, Math.min(1, value))
}

/**
 * Compute a weighted composite score for each molecule and return a
 * sorted (descending) copy of the array.
 */
function rerank(molecules, weights) {
  if (!molecules || molecules.length === 0) return []

  const totalWeight =
    weights.affinity + weights.safety + weights.druglikeness + weights.synthesis

  // Guard against all-zero weights
  if (totalWeight === 0) return [...molecules]

  // Pre-compute affinity range
  const affinities = molecules
    .map((m) => m.affinity)
    .filter((a) => a !== null && a !== undefined && !isNaN(a))

  const minAffinity = affinities.length > 0 ? Math.min(...affinities) : 0
  const maxAffinity = affinities.length > 0 ? Math.max(...affinities) : 0

  const scored = molecules.map((mol) => {
    const normAff =
      mol.affinity !== null && mol.affinity !== undefined && !isNaN(mol.affinity)
        ? normalizeAffinity(mol.affinity, minAffinity, maxAffinity)
        : 0

    const normSafety = normalizeDirect(mol.safety_score)
    const normQed = normalizeDirect(mol.qed)
    const normSynth = normalizeDirect(mol.synthesis_score ?? 0.5)

    const composite =
      (weights.affinity * normAff +
        weights.safety * normSafety +
        weights.druglikeness * normQed +
        weights.synthesis * normSynth) /
      totalWeight

    return { ...mol, _weighted_score: composite }
  })

  return scored.sort((a, b) => b._weighted_score - a._weighted_score)
}

// -----------------------------------------------------------------------
// WeightSlider — single labelled range slider
// -----------------------------------------------------------------------
function WeightSlider({ config, value, onChange }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-gray-700">{config.label}</label>
        <span className="text-xs font-mono font-bold text-[#1e3a5f] w-8 text-right">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(config.key, Number(e.target.value))}
        className={`w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 ${config.color}`}
        aria-label={config.label}
      />
      <p className="text-[10px] text-gray-400">{config.description}</p>
    </div>
  )
}

// -----------------------------------------------------------------------
// ScoringWeights — collapsible panel with 4 weight sliders
// -----------------------------------------------------------------------
/**
 * ScoringWeights — client-side re-ranking panel.
 *
 * Props:
 *   results    {array}    — molecules array from job results
 *   onReranked {function} — callback(sortedArray)
 *   jobId      {string}   — used for localStorage persistence
 */
export default function ScoringWeights({ results = [], onReranked, jobId }) {
  const storageKey = jobId ? `dockit_weights_${jobId}` : null

  // Load persisted weights or use defaults
  const [weights, setWeights] = useState(() => {
    if (!storageKey) return { ...DEFAULT_WEIGHTS }
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        // Validate all keys are present
        if (
          typeof parsed.affinity === 'number' &&
          typeof parsed.safety === 'number' &&
          typeof parsed.druglikeness === 'number' &&
          typeof parsed.synthesis === 'number'
        ) {
          return parsed
        }
      }
    } catch {
      // fall through to defaults
    }
    return { ...DEFAULT_WEIGHTS }
  })

  const [collapsed, setCollapsed] = useState(true)

  // Persist weights to localStorage whenever they change
  useEffect(() => {
    if (!storageKey) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(weights))
    } catch (err) {
      console.warn('[ScoringWeights] localStorage write failed:', err)
    }
  }, [weights, storageKey])

  // Re-compute ranking whenever weights or results change.
  // Use a ref to hold the latest onReranked callback so the effect does not
  // need to list it as a dependency (avoids potential infinite loops when the
  // parent passes an inline arrow function).
  const onRerankedRef = useRef(onReranked)
  useEffect(() => {
    onRerankedRef.current = onReranked
  }, [onReranked])

  useEffect(() => {
    if (!results || results.length === 0) return
    const sorted = rerank(results, weights)
    onRerankedRef.current?.(sorted)
  }, [weights, results])

  const handleSliderChange = useCallback((key, value) => {
    setWeights((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleReset = useCallback(() => {
    setWeights({ ...DEFAULT_WEIGHTS })
  }, [])

  const isDefault =
    weights.affinity === DEFAULT_WEIGHTS.affinity &&
    weights.safety === DEFAULT_WEIGHTS.safety &&
    weights.druglikeness === DEFAULT_WEIGHTS.druglikeness &&
    weights.synthesis === DEFAULT_WEIGHTS.synthesis

  // ---- Summary line shown when collapsed ----
  const summaryLine = `Aff ${weights.affinity} | Safety ${weights.safety} | Drug ${weights.druglikeness} | Synth ${weights.synthesis}`

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e3a5f] focus-visible:ring-inset"
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-[#1e3a5f] flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"
            />
          </svg>
          <span className="text-sm font-semibold text-[#1e3a5f]">Scoring Weights</span>
          {!isDefault && (
            <span className="text-[10px] px-1.5 py-0.5 bg-[#22c55e]/10 text-[#22c55e] font-semibold rounded-full">
              Custom
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {collapsed && (
            <span className="text-[10px] text-gray-400 font-mono hidden sm:block">{summaryLine}</span>
          )}
          {/* Chevron */}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      {!collapsed && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100">
          <p className="text-[11px] text-gray-400 pt-3 leading-relaxed">
            Adjust weights (0–100) to re-rank molecules. All four scores are normalized to [0,1]
            before weighting. Changes apply instantly.
          </p>

          <div className="space-y-4">
            {SLIDER_CONFIG.map((cfg) => (
              <WeightSlider
                key={cfg.key}
                config={cfg}
                value={weights[cfg.key]}
                onChange={handleSliderChange}
              />
            ))}
          </div>

          {/* Reset button */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-gray-400 font-mono">{summaryLine}</span>
            <button
              type="button"
              onClick={handleReset}
              disabled={isDefault}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors focus:outline-none focus-visible:ring-2 ${
                isDefault
                  ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-100 hover:border-gray-400'
              }`}
            >
              Reset to Default
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
