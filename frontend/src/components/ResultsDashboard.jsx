import React, { useState, useMemo } from 'react'
import { getReportUrl } from '../api.js'
import InfoTip from './InfoTip.jsx'
import SafetyReport from './SafetyReport.jsx'
import ConfidenceBreakdown from './ConfidenceBreakdown.jsx'
import ParetoFront from './ParetoFront.jsx'

// --------------------------------------------------
// Star rating display
// --------------------------------------------------
function StarRating({ stars }) {
  const count = Math.min(5, Math.max(1, stars))
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`text-base leading-none ${i <= count ? 'text-yellow-400' : 'text-gray-300'}`}>
          {i <= count ? '★' : '☆'}
        </span>
      ))}
    </span>
  )
}

// --------------------------------------------------
// Color dot
// --------------------------------------------------
function ColorDot({ color }) {
  const classes = {
    green: 'bg-dockit-green',
    yellow: 'bg-yellow-400',
    red: 'bg-red-500',
  }
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${classes[color] || 'bg-gray-300'} mr-1.5 flex-shrink-0`} />
}

// --------------------------------------------------
// FeatureBadge — standardised badge sub-component
// --------------------------------------------------
function FeatureBadge({ icon, label, variant = 'secondary', tip }) {
  const styles = {
    primary:   'bg-white/20 text-white',
    secondary: 'bg-white/10 text-white/80',
    warning:   'bg-amber-500/20 text-amber-200',
    success:   'bg-green-500/20 text-green-200',
    purple:    'bg-purple-500/30 text-purple-200',
    orange:    'bg-orange-500/30 text-orange-200',
    indigo:    'bg-indigo-500/30 text-indigo-200',
    teal:      'bg-teal-500/30 text-teal-200',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${styles[variant] || styles.secondary}`}>
      {icon && <span>{icon}</span>}
      {label}
      {tip && <InfoTip text={tip} />}
    </span>
  )
}

// --------------------------------------------------
// Derive affinity star count from kcal/mol value
// -10 → 5 stars, -8 → 4, -6 → 3, -4 → 2, else 1
// --------------------------------------------------
function affinityToStars(affinity) {
  const val = Math.abs(affinity || 0)
  if (val >= 10) return 5
  if (val >= 8) return 4
  if (val >= 6) return 3
  if (val >= 4) return 2
  return 1
}

// --------------------------------------------------
// Derive toxicity info from admet color_code or heuristic
// --------------------------------------------------
function deriveToxicity(mol) {
  const code = mol.admet?.color_code
  if (code === 'green') return { label: 'low', color: 'green' }
  if (code === 'yellow') return { label: 'moderate', color: 'yellow' }
  if (code === 'red') return { label: 'high', color: 'red' }
  const logp = mol.logp ?? mol.log_p ?? 0
  const mw = mol.mw ?? mol.molecular_weight ?? 0
  if (logp > 5 || mw > 500) return { label: 'moderate', color: 'yellow' }
  return { label: 'low', color: 'green' }
}

// --------------------------------------------------
// Derive synthesis info from synthesis_route field
// --------------------------------------------------
function deriveSynthesis(mol) {
  const route = mol.synthesis_route
  if (!route) return { label: 'Data not available', color: 'yellow', steps: null }

  const nSteps = route.n_steps ?? route.steps ?? null
  const available = route.all_reagents_available ?? route.feasible ?? null
  const complexity = route.complexity || ''

  let label = ''
  let color = 'green'

  if (nSteps !== null) {
    label += `${nSteps} step${nSteps > 1 ? 's' : ''}`
  }

  if (available === true) {
    label += label ? ', reagents available' : 'reagents available'
    color = 'green'
  } else if (available === false || complexity === 'high' || (nSteps !== null && nSteps > 7)) {
    label += label ? ', complex' : 'complex'
    color = 'yellow'
  } else {
    label += label ? ', feasibility unknown' : 'feasibility unknown'
    color = 'yellow'
  }

  if (!label) label = 'Route undetermined'

  return { label, color, steps: nSteps }
}

// --------------------------------------------------
// Determine whether a molecule was AI-generated
// --------------------------------------------------
function isAIGenerated(mol) {
  const src = (mol.source || '').toLowerCase()
  return src.includes('reinvent') || src.includes('mock_generation') || src.includes('generated') || src.includes('ai')
}

// --------------------------------------------------
// Confidence badge
// --------------------------------------------------
function ConfidenceBadge({ value }) {
  if (value === undefined || value === null) return null
  const pct = Math.round(value * 100)
  let colorClass = 'text-red-500'
  if (pct >= 70) colorClass = 'text-dockit-green'
  else if (pct >= 50) colorClass = 'text-yellow-500'
  return (
    <span className={`text-xs font-bold ${colorClass} flex items-center gap-0.5`}>
      {pct}%
      <InfoTip text="Overall prediction confidence score combining structure quality, pocket detection, docking reliability, ADMET, and synthesis feasibility." />
    </span>
  )
}

// --------------------------------------------------
// Selectivity indicator
// --------------------------------------------------
function SelectivityIndicator({ offTarget }) {
  if (!offTarget) return null
  const { n_safe, n_total } = offTarget
  if (n_total === undefined || n_total === 0) return null
  const ratio = n_safe / n_total
  const color = ratio >= 0.9 ? 'bg-dockit-green' : ratio >= 0.7 ? 'bg-yellow-400' : 'bg-red-500'
  const textColor = ratio >= 0.9 ? 'text-green-700' : ratio >= 0.7 ? 'text-yellow-700' : 'text-red-700'
  return (
    <span className={`flex items-center text-xs font-semibold ${textColor}`}>
      <span className={`w-2 h-2 rounded-full ${color} mr-1.5 flex-shrink-0`} />
      {n_safe}/{n_total} safe
    </span>
  )
}

// --------------------------------------------------
// Modal overlay for safety report / confidence breakdown
// --------------------------------------------------
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm pt-8 pb-8 px-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="font-bold text-dockit-blue text-base">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

// --------------------------------------------------
// V5bis: Interaction quality mini-bar
// --------------------------------------------------
function InteractionQualityBar({ interactions }) {
  if (!interactions) return null
  const quality = interactions.interaction_quality ?? 0
  const functional = interactions.functional_contacts ?? 0
  const total = interactions.total_functional ?? 0
  const pct = Math.round(quality * 100)

  let barColor = 'bg-red-400'
  let textColor = 'text-red-600'
  if (quality >= 0.6) { barColor = 'bg-dockit-green'; textColor = 'text-green-700' }
  else if (quality >= 0.3) { barColor = 'bg-yellow-400'; textColor = 'text-yellow-700' }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-semibold ${textColor} whitespace-nowrap`}>
        {functional}/{total} functional
      </span>
    </div>
  )
}

// --------------------------------------------------
// V5bis: ADMET domain badge
// --------------------------------------------------
function ADMETDomainBadge({ domain }) {
  if (!domain) return null
  const configs = {
    in_domain:      { label: 'In Domain',      classes: 'bg-green-100 text-green-700 border-green-200' },
    partial:        { label: 'Partial',         classes: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    out_of_domain:  { label: 'Out of Domain',   classes: 'bg-red-100 text-red-700 border-red-200' },
  }
  const key = typeof domain === 'string' ? domain : (domain === true ? 'in_domain' : 'out_of_domain')
  const cfg = configs[key] || { label: String(domain), classes: 'bg-gray-100 text-gray-600 border-gray-200' }
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${cfg.classes} ml-1`}>
      {cfg.label}
    </span>
  )
}

// --------------------------------------------------
// Chevron icon for collapsible toggle
// --------------------------------------------------
function ChevronIcon({ open }) {
  return (
    <svg
      className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

// --------------------------------------------------
// Single candidate card (V6: collapsible details)
// --------------------------------------------------
function CandidateCard({ mol, rank, onSelect3D, onOptimize, onSafetyReport, onConfidence, defaultExpanded = true }) {
  const [showDetails, setShowDetails] = useState(defaultExpanded)

  const score100 = Math.round((mol.composite_score || 0) * 100)
  const stars = affinityToStars(mol.affinity)
  const toxicity = deriveToxicity(mol)
  const synthesis = deriveSynthesis(mol)
  const generated = isAIGenerated(mol)
  const molName = mol.name || mol.ligand_name || `Molecule ${rank}`
  const confidence = mol.confidence
  const offTarget = mol.off_target

  // V5bis extras
  const cnnScore = mol.cnn_score ?? mol.gnina_cnn_score ?? null
  const clusterId = mol.cluster_id ?? null
  const interactions = mol.interactions || null
  const admetDomain = mol.admet_domain?.status ?? mol.admet?.applicability_domain?.status ?? null

  // Score color
  let scoreColor = 'text-red-500'
  if (score100 >= 80) scoreColor = 'text-dockit-green'
  else if (score100 >= 60) scoreColor = 'text-yellow-500'

  // Determine if there is any detail content to show
  const hasDetails =
    mol.synthesis_route ||
    (offTarget && offTarget.n_total > 0) ||
    interactions ||
    clusterId !== null ||
    admetDomain !== null

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          {/* Rank badge */}
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-dockit-blue flex items-center justify-center text-white font-bold text-sm">
            {rank}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-dockit-blue text-base truncate max-w-[140px]" title={molName}>
                {molName}
              </h3>
              {generated && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-200 flex-shrink-0">
                  AI-Generated
                  <InfoTip text="This molecule was computationally designed by AI, not found in existing databases." />
                </span>
              )}
            </div>
            {mol.affinity && (
              <p className="text-xs text-gray-400 mt-0.5 font-mono flex items-center gap-1">
                {Number(mol.affinity).toFixed(1)} kcal/mol
                <InfoTip text="Binding energy in kilocalories per mole. More negative values indicate stronger predicted binding." />
                {cnnScore !== null && (
                  <span className="ml-1 text-gray-500 not-italic">
                    | CNN: <span className="font-semibold text-dockit-blue">{Number(cnnScore).toFixed(2)}</span>
                    <InfoTip text="GNINA CNN confidence score (0-1). Higher = more reliable pose prediction from neural network scoring." />
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Score + Confidence */}
        <div className="flex-shrink-0 text-right">
          <div className="flex items-baseline gap-2 justify-end">
            <div className={`text-2xl font-extrabold leading-none ${scoreColor}`}>
              {score100}
            </div>
            <div className="text-xs text-gray-400 leading-none">/100</div>
          </div>
          {confidence?.overall !== undefined && (
            <div className="flex items-center justify-end gap-1 mt-1">
              <span className="text-xs text-gray-400">Confidence:</span>
              <button onClick={onConfidence} className="focus:outline-none hover:underline">
                <ConfidenceBadge value={confidence.overall} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Always-visible properties */}
      <div className="space-y-2.5 mb-4 flex-1">
        {/* Affinity stars */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 font-medium w-24 flex-shrink-0 flex items-center">
            Affinity
            <InfoTip text="Predicted binding strength (kcal/mol). More negative = stronger binding." />
          </span>
          <StarRating stars={stars} />
        </div>

        {/* ADMET / Toxicity */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 font-medium w-24 flex-shrink-0 flex items-center">
            ADMET
            <InfoTip text="Drug safety prediction. Green = low risk, Yellow = moderate, Red = high risk." />
          </span>
          {mol.admet ? (
            <span
              className="flex items-center text-xs font-semibold flex-wrap justify-end gap-0.5"
              style={{ color: toxicity.color === 'green' ? '#22c55e' : toxicity.color === 'yellow' ? '#ca8a04' : '#ef4444' }}
            >
              <ColorDot color={toxicity.color} />
              Toxicity {toxicity.label}
              {mol.admet.composite_score !== undefined && (
                <span className="ml-1 text-gray-400 font-mono">({Number(mol.admet.composite_score).toFixed(2)})</span>
              )}
            </span>
          ) : (
            <span className="text-xs text-gray-300 italic">Not evaluated</span>
          )}
        </div>
      </div>

      {/* Collapsible details panel */}
      {hasDetails && (
        <div className="mb-3">
          {showDetails && (
            <div className="border-t border-gray-100 pt-3 pb-2 space-y-2.5">
              {/* Synthesis */}
              {mol.synthesis_route && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-500 font-medium w-24 flex-shrink-0 flex items-center">
                    Synthesis
                    <InfoTip text="Feasibility of manufacturing this molecule in a lab." />
                  </span>
                  <span
                    className="flex items-center text-xs font-medium text-right leading-tight"
                    style={{ color: synthesis.color === 'green' ? '#22c55e' : '#ca8a04' }}
                  >
                    <ColorDot color={synthesis.color} />
                    {synthesis.label}
                  </span>
                </div>
              )}

              {/* Selectivity */}
              {offTarget && offTarget.n_total > 0 && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-500 font-medium w-24 flex-shrink-0 flex items-center">
                    Selectivity
                    <InfoTip text="Off-target safety: number of anti-targets (e.g. hERG, CYPs) with non-risky predicted binding." />
                  </span>
                  <SelectivityIndicator offTarget={offTarget} />
                </div>
              )}

              {/* Interaction quality */}
              {interactions && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-500 font-medium flex items-center">
                    Interactions
                    <InfoTip text="Protein-ligand interaction analysis showing contacts with key functional residues." />
                  </span>
                  <InteractionQualityBar interactions={interactions} />
                </div>
              )}

              {/* SEA hits count badge */}
              {mol.off_target?.sea_results && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-500 font-medium w-24 flex-shrink-0 flex items-center">
                    SEA Screening
                    <InfoTip text="Number of targets hit in broad SEA (Similarity Ensemble Approach) screening across 3000+ targets." />
                  </span>
                  {(() => {
                    const nHits = mol.off_target.sea_results.targets_hit?.length ?? 0
                    const nScreened = mol.off_target.sea_results.n_targets_screened
                    const badgeClass = nHits === 0
                      ? 'bg-green-100 text-green-700 border-green-200'
                      : nHits <= 3
                      ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
                      : 'bg-red-100 text-red-700 border-red-200'
                    return (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${badgeClass}`}>
                        {nHits} SEA {nHits === 1 ? 'target' : 'targets'}
                        {nScreened !== undefined && (
                          <span className="font-normal opacity-70">/ {nScreened.toLocaleString()}</span>
                        )}
                      </span>
                    )
                  })()}
                </div>
              )}

              {/* Specialized hERG risk badge */}
              {mol.herg_specialized?.risk_level && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-500 font-medium w-24 flex-shrink-0 flex items-center">
                    hERG Risk
                    <InfoTip text="Specialized hERG cardiotoxicity risk assessment. HIGH risk indicates potential QT interval prolongation." />
                  </span>
                  {(() => {
                    const level = mol.herg_specialized.risk_level.toUpperCase()
                    const cfg = {
                      LOW:      { classes: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500' },
                      MODERATE: { classes: 'bg-yellow-100 text-yellow-700 border-yellow-200', dot: 'bg-yellow-400' },
                      HIGH:     { classes: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' },
                    }
                    const { classes, dot } = cfg[level] || { classes: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-400' }
                    return (
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${classes}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${dot} flex-shrink-0`} />
                        {level}
                      </span>
                    )
                  })()}
                </div>
              )}

              {/* Synthesis cost estimate */}
              {mol.synthesis_route?.cost_estimate?.total_cost_usd !== undefined && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-500 font-medium w-24 flex-shrink-0 flex items-center">
                    Synth. Cost
                    <InfoTip text="Estimated total synthesis cost in USD including reagents and labor." />
                  </span>
                  <span className="text-xs font-semibold text-gray-700 font-mono">
                    ${Number(mol.synthesis_route.cost_estimate.total_cost_usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {/* Reagent availability ratio */}
              {Array.isArray(mol.synthesis_route?.reagent_availability) && mol.synthesis_route.reagent_availability.length > 0 && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-500 font-medium w-24 flex-shrink-0 flex items-center">
                    Reagents
                    <InfoTip text="Proportion of required reagents that are commercially available." />
                  </span>
                  {(() => {
                    const total = mol.synthesis_route.reagent_availability.length
                    const available = mol.synthesis_route.reagent_availability.filter((r) => r.available !== false).length
                    const ratio = total > 0 ? available / total : 0
                    const textColor = ratio === 1 ? 'text-green-700' : ratio >= 0.5 ? 'text-yellow-700' : 'text-red-600'
                    const pct = Math.round(ratio * 100)
                    return (
                      <span className={`text-xs font-semibold ${textColor} flex items-center gap-1.5`}>
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${ratio === 1 ? 'bg-green-500' : ratio >= 0.5 ? 'bg-yellow-400' : 'bg-red-400'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {available}/{total}
                      </span>
                    )
                  })()}
                </div>
              )}

              {/* ADMET applicability domain + cluster/family — inline row */}
              <div className="flex items-center gap-2 flex-wrap">
                {admetDomain !== null && (
                  <span className="flex items-center text-xs text-gray-500">
                    ADMET domain:
                    <ADMETDomainBadge domain={admetDomain} />
                  </span>
                )}
                {clusterId !== null && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200">
                    Family {clusterId + 1}
                    <InfoTip text="Chemical family assigned by structural clustering." />
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Toggle button */}
          <button
            onClick={() => setShowDetails((v) => !v)}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-gray-400 hover:text-dockit-blue transition-colors py-1 rounded-lg hover:bg-gray-50"
          >
            <ChevronIcon open={showDetails} />
            {showDetails ? 'Hide details' : 'Details'}
          </button>
        </div>
      )}

      {/* Buttons */}
      <div className="space-y-2">
        <button
          onClick={onSelect3D}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-dockit-blue hover:bg-dockit-blue-light text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          View in 3D
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onOptimize}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            Optimize
          </button>

          <button
            onClick={onSafetyReport}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-blue-50 text-dockit-blue text-xs font-semibold rounded-lg border border-dockit-blue transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Safety
          </button>
        </div>
      </div>
    </div>
  )
}

// --------------------------------------------------
// Compact card for eliminated molecules accordion
// --------------------------------------------------
function EliminatedCard({ mol, rank }) {
  const score100 = Math.round((mol.composite_score || 0) * 100)
  const molName = mol.name || mol.ligand_name || `Molecule ${rank}`
  const eliminationReason = mol.elimination_reason || mol.eliminated_reason || ''

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-100">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-white font-bold text-xs">
          {rank}
        </div>
        <span className="text-sm font-medium text-gray-600 truncate max-w-[120px]" title={molName}>
          {molName}
        </span>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-xs font-mono text-gray-400">{score100}/100</span>
        {eliminationReason && (
          <span className="text-xs font-medium text-red-500 max-w-[160px] text-right leading-tight">
            {eliminationReason}
          </span>
        )}
      </div>
    </div>
  )
}

// --------------------------------------------------
// ResultsDashboard — top candidates + eliminated section
// --------------------------------------------------
export default function ResultsDashboard({ results, onSelect3D, onShowAll, onOptimize, onShowClusters }) {
  const [safetyMol, setSafetyMol] = useState(null)
  const [confidenceMol, setConfidenceMol] = useState(null)
  const [showEliminated, setShowEliminated] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState({
    minScore: 0,
    maxAffinity: 0, // 0 means no filter (kcal/mol is negative, so 0 = no filter)
    safetyLevels: [], // empty = show all
    sources: [],     // empty = show all
  })

  if (!results) return null

  const jobId = results.job_id
  const reportUrl = getReportUrl(jobId)

  // Merge docking results and generated molecules
  const dockingResults = (results.results || []).map((mol) => ({ ...mol, _pool: 'docking' }))
  const generatedMols = (results.generated_molecules || []).map((mol) => ({ ...mol, _pool: 'generated' }))

  // Separate passed and eliminated
  const allMolecules = [...dockingResults, ...generatedMols].sort(
    (a, b) => (b.composite_score || 0) - (a.composite_score || 0)
  )
  const passed = allMolecules.filter((m) => m.eliminated !== true)
  const eliminated = allMolecules.filter((m) => m.eliminated === true)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filteredPassed = useMemo(() => {
    if (!passed || passed.length === 0) return passed
    return passed.filter((mol) => {
      // Score filter
      if (filters.minScore > 0) {
        const score = (mol.composite_score || 0) * 100
        if (score < filters.minScore) return false
      }
      // Affinity filter (values are negative — more negative = stronger binding)
      if (filters.maxAffinity < 0) {
        const affinity = mol.affinity || mol.vina_score || 0
        if (affinity > filters.maxAffinity) return false
      }
      // Safety / toxicity filter
      if (filters.safetyLevels.length > 0) {
        const code = mol.admet?.color_code
        let level = 'unknown'
        if (code === 'green') level = 'Low'
        else if (code === 'yellow') level = 'Medium'
        else if (code === 'red') level = 'High'
        else {
          const logp = mol.logp ?? mol.log_p ?? 0
          const mw = mol.mw ?? mol.molecular_weight ?? 0
          level = (logp > 5 || mw > 500) ? 'Medium' : 'Low'
        }
        if (!filters.safetyLevels.includes(level)) return false
      }
      // Source filter
      if (filters.sources.length > 0) {
        const src = (mol.source || mol.library || '').toLowerCase()
        const matchedSource = filters.sources.some((s) => {
          if (s === 'AI') return src.includes('reinvent') || src.includes('generated') || src.includes('ai') || src.includes('mock_generation')
          return src.includes(s.toLowerCase())
        })
        if (!matchedSource) return false
      }
      return true
    })
  }, [passed, filters])

  const hasActiveFilters =
    filters.minScore > 0 ||
    filters.maxAffinity < 0 ||
    filters.safetyLevels.length > 0 ||
    filters.sources.length > 0

  const topCandidates = filteredPassed.slice(0, 3)
  const remainingCount = Math.max(0, passed.length - 3)

  // Stats for summary strip
  const uniprotId = results.uniprot_id || jobId
  const totalTested = dockingResults.length
  const generatedCount = generatedMols.length
  const bestScore = allMolecules[0]?.composite_score
    ? Math.round(allMolecules[0].composite_score * 100)
    : null

  // V5bis: pipeline_summary extras
  const pipelineSummary = results.pipeline_summary || {}
  const structureSource = pipelineSummary.structure_source || results.structure_source || null
  const pdbInfo = pipelineSummary.pdb_info || {}
  const pdbId = pdbInfo.pdb_id || pipelineSummary.pdb_id || null
  const pdbResolution = pdbInfo.resolution || pipelineSummary.pdb_resolution || null
  const hardCutoffs = pipelineSummary.hard_cutoffs || {}
  const cutoffsPassed = hardCutoffs.passed ?? null
  const cutoffsTotal =
    hardCutoffs.passed != null && hardCutoffs.eliminated != null
      ? hardCutoffs.passed + hardCutoffs.eliminated
      : null
  const clusterCount = pipelineSummary.n_clusters ?? pipelineSummary.cluster_count ?? null

  // Structure source badge config
  const structureBadge = (() => {
    if (structureSource === 'pdb_experimental') {
      return {
        label: 'PDB Experimental',
        variant: 'primary',
        tip: `Structure from PDB database${pdbId ? ` (${pdbId})` : ''}${pdbResolution ? `, resolution ${pdbResolution} A` : ''}. Experimental structures provide higher accuracy than computational predictions.`,
      }
    }
    if (structureSource === 'esmfold') {
      return {
        label: 'ESMFold',
        variant: 'secondary',
        tip: 'Structure predicted by ESMFold (Meta AI). Used as fallback when AlphaFold structure is unavailable.',
      }
    }
    if (structureSource === 'alphafold' || !structureSource) {
      return {
        label: 'AlphaFold',
        variant: 'secondary',
        tip: 'Structure predicted by AlphaFold 2 (DeepMind). High-confidence prediction from amino acid sequence.',
      }
    }
    return null
  })()

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <div className="bg-dockit-blue rounded-xl p-5 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold mb-1">
              Top Candidates
              <span className="ml-2 text-dockit-green font-mono text-xl">{uniprotId}</span>
            </h2>
            <p className="text-white/60 text-sm">
              {totalTested} ligands tested
              {generatedCount > 0 && ` + ${generatedCount} AI-generated`}
              {cutoffsPassed !== null && cutoffsTotal !== null && (
                <span className="ml-1">
                  &mdash;{' '}
                  <span className="text-white/80 font-medium">
                    {cutoffsPassed}/{cutoffsTotal} passed hard cutoffs
                  </span>
                  <InfoTip text="Molecules that passed all hard cutoff filters (PAINS, reactive groups, ADMET thresholds). Eliminated candidates are shown below the top candidates." />
                </span>
              )}
              {' '}&mdash; Top {topCandidates.length} shown below
            </p>

            {/* Feature badges using FeatureBadge component */}
            <div className="flex flex-wrap gap-2 mt-2">
              {structureBadge && (
                <FeatureBadge
                  label={structureBadge.label}
                  variant={structureBadge.variant}
                  tip={structureBadge.tip}
                />
              )}
              {allMolecules.some((m) => m.admet) && (
                <FeatureBadge
                  label="ADMET"
                  variant="secondary"
                  tip="Absorption, Distribution, Metabolism, Excretion, Toxicity — pharmacological safety predictions."
                />
              )}
              {allMolecules.some((m) => m.synthesis_route) && (
                <FeatureBadge label="Retrosynthesis" variant="secondary" />
              )}
              {generatedCount > 0 && (
                <FeatureBadge label="AI Generation" variant="purple" />
              )}
              {allMolecules.some((m) => m.off_target) && (
                <FeatureBadge label="Off-Target Safety" variant="orange" />
              )}
              {clusterCount !== null && (
                <FeatureBadge
                  label={`${clusterCount} chemical ${clusterCount !== 1 ? 'families' : 'family'}`}
                  variant="indigo"
                  tip="Number of distinct chemical scaffold families identified by Butina clustering among screened molecules."
                />
              )}
              {allMolecules.some((m) => m.interactions) && (
                <FeatureBadge
                  label="Interactions"
                  variant="teal"
                  tip="Protein-ligand interaction fingerprinting performed (ProLIF or estimated)."
                />
              )}
            </div>
          </div>

          <div className="flex gap-6 flex-shrink-0">
            {bestScore !== null && (
              <div className="text-center">
                <div className="text-3xl font-extrabold text-dockit-green leading-none">{bestScore}</div>
                <div className="text-xs text-white/50 mt-0.5 flex items-center justify-center">
                  Score/100
                  <InfoTip text="Composite score (0-100) combining binding affinity, drug-likeness (QED), and ADMET properties." />
                </div>
              </div>
            )}
            {allMolecules[0]?.affinity && (
              <div className="text-center">
                <div className="text-3xl font-extrabold text-dockit-green leading-none font-mono">
                  {Number(allMolecules[0].affinity).toFixed(1)}
                </div>
                <div className="text-xs text-white/50 mt-0.5 flex items-center justify-center">
                  kcal/mol
                  <InfoTip text="Binding energy in kilocalories per mole. More negative values indicate stronger predicted binding." />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-dockit-blue transition-colors"
          >
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${filtersOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707l-6.414 6.414A1 1 0 0014 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 018 21v-7.586a1 1 0 00-.293-.707L1.293 6.707A1 1 0 011 6V4z" />
            </svg>
            Filters
            {hasActiveFilters && (
              <span className="bg-dockit-blue text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                Active
              </span>
            )}
          </button>

          <p className="text-xs text-gray-400">
            Showing{' '}
            <span className="font-semibold text-dockit-blue">{filteredPassed.length}</span>
            {' '}of{' '}
            <span className="font-semibold">{passed.length}</span>
            {' '}molecules
          </p>
        </div>

        {filtersOpen && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 mb-3 shadow-sm">
            {/* Min Score slider */}
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-2 flex items-center gap-1">
                Min Score
                <span className="ml-auto font-mono text-dockit-blue">{filters.minScore > 0 ? filters.minScore : 'Off'}</span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={filters.minScore}
                onChange={(e) => setFilters((f) => ({ ...f, minScore: Number(e.target.value) }))}
                className="w-full accent-dockit-blue"
              />
              <div className="flex justify-between text-[10px] text-gray-300 mt-0.5">
                <span>0</span>
                <span>100</span>
              </div>
            </div>

            {/* Max Affinity input */}
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-2">
                Max Affinity (kcal/mol)
              </label>
              <input
                type="number"
                step="0.5"
                value={filters.maxAffinity < 0 ? filters.maxAffinity : ''}
                placeholder="e.g. -8.0"
                onChange={(e) => setFilters((f) => ({ ...f, maxAffinity: Number(e.target.value) || 0 }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-dockit-blue/30 focus:border-dockit-blue"
              />
              <p className="text-[10px] text-gray-300 mt-1">More negative = stronger binding</p>
            </div>

            {/* Safety / Toxicity toggles */}
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-2">Toxicity Level</label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: 'Low',    active: 'bg-dockit-green border-dockit-green text-white' },
                  { label: 'Medium', active: 'bg-yellow-500 border-yellow-500 text-white' },
                  { label: 'High',   active: 'bg-red-500 border-red-500 text-white' },
                ].map(({ label, active }) => {
                  const isOn = filters.safetyLevels.includes(label)
                  return (
                    <button
                      key={label}
                      onClick={() =>
                        setFilters((f) => ({
                          ...f,
                          safetyLevels: isOn
                            ? f.safetyLevels.filter((l) => l !== label)
                            : [...f.safetyLevels, label],
                        }))
                      }
                      className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition-colors ${
                        isOn ? active : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Source toggles */}
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-2">Source</label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: 'ChEMBL', active: 'bg-dockit-blue border-dockit-blue text-white' },
                  { label: 'ZINC',   active: 'bg-dockit-blue border-dockit-blue text-white' },
                  { label: 'AI',     active: 'bg-purple-600 border-purple-600 text-white' },
                ].map(({ label, active }) => {
                  const isOn = filters.sources.includes(label)
                  return (
                    <button
                      key={label}
                      onClick={() =>
                        setFilters((f) => ({
                          ...f,
                          sources: isOn
                            ? f.sources.filter((s) => s !== label)
                            : [...f.sources, label],
                        }))
                      }
                      className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition-colors ${
                        isOn ? active : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>

              {/* Reset all */}
              {hasActiveFilters && (
                <button
                  onClick={() => setFilters({ minScore: 0, maxAffinity: 0, safetyLevels: [], sources: [] })}
                  className="mt-3 text-xs text-red-500 hover:text-red-700 font-medium underline underline-offset-2 transition-colors"
                >
                  Reset all filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Top candidates grid — passed molecules only */}
      {topCandidates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {topCandidates.map((mol, i) => (
            <CandidateCard
              key={mol.name || mol.ligand_name || i}
              mol={mol}
              rank={i + 1}
              onSelect3D={() => onSelect3D(mol.name || mol.smiles, mol)}
              onOptimize={() => onOptimize && onOptimize(mol)}
              onSafetyReport={() => setSafetyMol(mol)}
              onConfidence={() => setConfidenceMol(mol)}
            />
          ))}
        </div>
      ) : passed.length > 0 ? (
        <div className="card p-10 text-center text-gray-400">
          <p className="font-medium text-gray-500 mb-1">No molecules match the current filters.</p>
          <button
            onClick={() => setFilters({ minScore: 0, maxAffinity: 0, safetyLevels: [], sources: [] })}
            className="mt-2 text-sm text-dockit-blue hover:underline font-medium"
          >
            Reset filters
          </button>
        </div>
      ) : (
        <div className="card p-10 text-center text-gray-400">
          <p>No results available for this screening.</p>
        </div>
      )}

      {/* Multi-Objective Trade-Off Analysis — Pareto front */}
      {allMolecules.some((m) => m.pareto_objectives) && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5 bg-dockit-blue flex items-center gap-3">
            <div className="w-7 h-7 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm flex items-center gap-1.5">
                Multi-Objective Trade-Off Analysis
                <InfoTip text="The Pareto front shows molecules that are non-dominated: no other molecule is strictly better on all objectives simultaneously. These represent optimal trade-offs across affinity, safety, bioavailability, and synthesizability." />
              </h3>
              <p className="text-white/60 text-xs">
                {allMolecules.filter((m) => m.pareto_front).length} non-dominated solutions on the Pareto front
              </p>
            </div>
          </div>
          <div className="p-5">
            <ParetoFront
              molecules={allMolecules}
              onSelect={(mol) => {
                if (onSelect3D) onSelect3D(mol.name || mol.smiles, mol)
              }}
            />
          </div>
        </div>
      )}

      {/* Eliminated molecules accordion */}
      {eliminated.length > 0 && (
        <div className="border border-amber-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowEliminated((v) => !v)}
            className="w-full flex items-center gap-3 px-5 py-3.5 bg-amber-50 hover:bg-amber-100 transition-colors text-left"
          >
            <svg
              className="w-4 h-4 text-amber-500 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span className="text-sm font-semibold text-amber-700 flex-1">
              {eliminated.length} {eliminated.length === 1 ? 'molecule' : 'molecules'} eliminated — Click to see reasons
            </span>
            <ChevronIcon open={showEliminated} />
          </button>

          {showEliminated && (
            <div className="px-5 py-4 bg-white space-y-2">
              {eliminated.map((mol, i) => (
                <EliminatedCard
                  key={mol.name || mol.ligand_name || i}
                  mol={mol}
                  rank={i + 1}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action row */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
        {/* PDF download */}
        <a
          href={reportUrl}
          target="_blank"
          rel="noopener noreferrer"
          download
          className="flex items-center gap-2 px-5 py-2.5 bg-dockit-blue hover:bg-dockit-blue-light text-white text-sm font-semibold rounded-xl transition-colors shadow-sm hover:shadow-md"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Download Full PDF Report
        </a>

        {/* Right side button group */}
        <div className="flex flex-wrap items-center gap-3">
          {onShowClusters && (
            <button
              onClick={onShowClusters}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm hover:shadow-md"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              View Chemical Families
              {clusterCount !== null && (
                <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded text-xs font-bold">
                  {clusterCount}
                </span>
              )}
            </button>
          )}

          {remainingCount > 0 && (
            <button
              onClick={onShowAll}
              className="flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-gray-50 text-dockit-blue text-sm font-semibold rounded-xl border border-gray-200 transition-colors shadow-sm hover:shadow-md"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              View All Results ({remainingCount} more)
            </button>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-lg">
        <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <p className="text-xs text-amber-700 leading-relaxed">
          These results are exploratory and must be validated experimentally before any clinical application.
          Scores are indicative and based on in silico calculations.
        </p>
      </div>

      {/* Safety Report modal */}
      {safetyMol && (
        <Modal title="Off-Target Safety Report" onClose={() => setSafetyMol(null)}>
          <SafetyReport
            offTargetResults={{ ...safetyMol.off_target, ...safetyMol.combined_off_target }}
            moleculeName={safetyMol.name || safetyMol.ligand_name}
          />
        </Modal>
      )}

      {/* Confidence Breakdown modal */}
      {confidenceMol && (
        <Modal title="Confidence Breakdown" onClose={() => setConfidenceMol(null)}>
          <ConfidenceBreakdown
            confidence={confidenceMol.confidence}
            moleculeName={confidenceMol.name || confidenceMol.ligand_name}
            pipeline_summary={pipelineSummary}
          />
        </Modal>
      )}
    </div>
  )
}
