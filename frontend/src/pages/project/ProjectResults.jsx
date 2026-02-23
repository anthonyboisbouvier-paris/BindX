import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useProject } from '../../contexts/ProjectContext.jsx'
import { HitSelectionProvider, useHitSelection } from '../../contexts/HitSelectionContext.jsx'
import { getJobResults } from '../../api.js'

import Viewer3D from '../../components/Viewer3D.jsx'
import MoleculeCard from '../../components/MoleculeCard.jsx'
import DownloadButtons from '../../components/DownloadButtons.jsx'
import ParetoFront from '../../components/ParetoFront.jsx'
import Badge from '../../components/Badge.jsx'
import SafetyReport from '../../components/SafetyReport.jsx'
import ConfidenceBreakdown from '../../components/ConfidenceBreakdown.jsx'
import AgentAdvisorCard from '../../components/AgentAdvisorCard.jsx'

// ---------------------------------------------------------------------------
// Filter bar with configurable criteria
// ---------------------------------------------------------------------------

const DEFAULT_CUTOFFS = {
  minScore: 0,
  maxAffinity: 0,
  minQED: 0,
  maxLogP: 10,
  maxMW: 2000,
  safetyLevels: [],
  sources: [],
  showEliminated: false,
}

function FilterBar({ filters, setFilters, counts, hasAdmet, hasSources }) {
  const [open, setOpen] = useState(false)
  const hasActive = filters.minScore > 0 || filters.maxAffinity < 0 || filters.minQED > 0 ||
    filters.maxLogP < 10 || filters.maxMW < 2000 ||
    filters.safetyLevels.length > 0 || filters.sources.length > 0

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707l-6.414 6.414A1 1 0 0014 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 018 21v-7.586a1 1 0 00-.293-.707L1.293 6.707A1 1 0 011 6V4z" />
          </svg>
          <span className="text-sm font-semibold text-gray-700">Filters & Cutoffs</span>
          {hasActive && (
            <span className="px-2 py-0.5 bg-[#1e3a5f] text-white text-xs font-bold rounded-full">Active</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            {counts.shown}/{counts.total} molecules
          </span>
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-4 pt-2 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
              Min Score
              <span className="ml-auto font-mono text-[#1e3a5f]">{filters.minScore || 'Off'}</span>
            </label>
            <input type="range" min="0" max="100" step="5" value={filters.minScore}
              onChange={e => setFilters(f => ({ ...f, minScore: +e.target.value }))}
              className="w-full accent-[#1e3a5f]" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Max Affinity (kcal/mol)</label>
            <input type="number" step="0.5" value={filters.maxAffinity < 0 ? filters.maxAffinity : ''}
              placeholder="e.g. -7.0"
              onChange={e => setFilters(f => ({ ...f, maxAffinity: +e.target.value || 0 }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30" />
            <p className="text-[10px] text-gray-300 mt-0.5">More negative = stronger</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
              Min QED
              <span className="ml-auto font-mono text-[#1e3a5f]">{filters.minQED > 0 ? filters.minQED.toFixed(2) : 'Off'}</span>
            </label>
            <input type="range" min="0" max="1" step="0.05" value={filters.minQED}
              onChange={e => setFilters(f => ({ ...f, minQED: +e.target.value }))}
              className="w-full accent-[#1e3a5f]" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
              Max LogP
              <span className="ml-auto font-mono text-[#1e3a5f]">{filters.maxLogP < 10 ? filters.maxLogP : 'Off'}</span>
            </label>
            <input type="range" min="0" max="10" step="0.5" value={filters.maxLogP}
              onChange={e => setFilters(f => ({ ...f, maxLogP: +e.target.value }))}
              className="w-full accent-[#1e3a5f]" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
              Max MW (Da)
              <span className="ml-auto font-mono text-[#1e3a5f]">{filters.maxMW < 2000 ? filters.maxMW : 'Off'}</span>
            </label>
            <input type="range" min="100" max="2000" step="50" value={filters.maxMW}
              onChange={e => setFilters(f => ({ ...f, maxMW: +e.target.value }))}
              className="w-full accent-[#1e3a5f]" />
          </div>
          {hasAdmet && (
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Toxicity Level</label>
              <div className="flex flex-wrap gap-1">
                {[
                  { label: 'Low', cls: 'bg-[#22c55e] border-[#22c55e] text-white' },
                  { label: 'Medium', cls: 'bg-yellow-500 border-yellow-500 text-white' },
                  { label: 'High', cls: 'bg-red-500 border-red-500 text-white' },
                ].map(({ label, cls }) => {
                  const on = filters.safetyLevels.includes(label)
                  return (
                    <button key={label}
                      onClick={() => setFilters(f => ({
                        ...f, safetyLevels: on ? f.safetyLevels.filter(l => l !== label) : [...f.safetyLevels, label]
                      }))}
                      className={`px-2 py-0.5 text-xs rounded border font-medium transition-colors ${
                        on ? cls : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          {hasSources && (
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Source</label>
              <div className="flex flex-wrap gap-1">
                {['ChEMBL', 'ZINC', 'AI'].map(label => {
                  const on = filters.sources.includes(label)
                  return (
                    <button key={label}
                      onClick={() => setFilters(f => ({
                        ...f, sources: on ? f.sources.filter(s => s !== label) : [...f.sources, label]
                      }))}
                      className={`px-2 py-0.5 text-xs rounded border font-medium transition-colors ${
                        on ? 'bg-[#1e3a5f] border-[#1e3a5f] text-white' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={filters.showEliminated}
                onChange={e => setFilters(f => ({ ...f, showEliminated: e.target.checked }))}
                className="accent-[#1e3a5f]" />
              <span className="text-xs text-gray-600 font-medium">Show eliminated</span>
            </label>
          </div>
          {hasActive && (
            <div className="flex items-end">
              <button onClick={() => setFilters({ ...DEFAULT_CUTOFFS })}
                className="text-xs text-red-500 hover:text-red-700 font-medium underline underline-offset-2">
                Reset all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Auto-hit criteria dialog
// ---------------------------------------------------------------------------

function AutoHitDialog({ onApply, onClose, molecules }) {
  const [criteria, setCriteria] = useState({
    minScore: 60,
    maxAffinity: -7.0,
    minQED: 0.4,
    maxLogP: 5,
    maxMW: 500,
    lowToxicityOnly: false,
  })

  const preview = useMemo(() => {
    return molecules.filter(mol => {
      const score = (mol.composite_score || 0) * 100
      if (score < criteria.minScore) return false
      if (criteria.maxAffinity < 0 && (mol.affinity || 0) > criteria.maxAffinity) return false
      if ((mol.qed || 0) < criteria.minQED) return false
      if ((mol.logp || 0) > criteria.maxLogP) return false
      if ((mol.mw || 0) > criteria.maxMW) return false
      if (criteria.lowToxicityOnly && mol.admet?.color_code !== 'green') return false
      return !mol.eliminated
    }).length
  }, [molecules, criteria])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="font-bold text-[#1e3a5f]">Auto-Select Hits</h2>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Min Score (/100)</label>
              <input type="number" value={criteria.minScore} min={0} max={100}
                onChange={e => setCriteria(c => ({ ...c, minScore: +e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Max Affinity (kcal/mol)</label>
              <input type="number" step="0.5" value={criteria.maxAffinity}
                onChange={e => setCriteria(c => ({ ...c, maxAffinity: +e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Min QED</label>
              <input type="number" step="0.05" value={criteria.minQED} min={0} max={1}
                onChange={e => setCriteria(c => ({ ...c, minQED: +e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Max LogP</label>
              <input type="number" step="0.5" value={criteria.maxLogP}
                onChange={e => setCriteria(c => ({ ...c, maxLogP: +e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Max MW (Da)</label>
              <input type="number" step="50" value={criteria.maxMW}
                onChange={e => setCriteria(c => ({ ...c, maxMW: +e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={criteria.lowToxicityOnly}
                  onChange={e => setCriteria(c => ({ ...c, lowToxicityOnly: e.target.checked }))}
                  className="accent-[#22c55e]" />
                <span className="text-xs text-gray-600 font-medium">Low toxicity only</span>
              </label>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
            <span className="text-sm text-[#1e3a5f] font-semibold">{preview} molecules match</span>
            <button onClick={() => onApply(criteria)}
              disabled={preview === 0}
              className="px-4 py-2 bg-[#22c55e] hover:bg-[#16a34a] disabled:bg-gray-300 text-white text-sm font-bold rounded-lg transition-colors">
              Tag as Hits
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hit selection bar (compact)
// ---------------------------------------------------------------------------

function HitBar() {
  const { getTagCount } = useHitSelection()
  const counts = getTagCount()

  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3 bg-white rounded-xl border border-gray-100 shadow-sm">
      <div className="flex items-center gap-5 flex-wrap">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-[#22c55e]">
          <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
          {counts.hit} {counts.hit === 1 ? 'hit' : 'hits'}
        </span>
        <span className="flex items-center gap-1.5 text-sm font-semibold text-yellow-600">
          <span className="w-2 h-2 rounded-full bg-yellow-400" />
          {counts.investigate} investigating
        </span>
        <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-400">
          <span className="w-2 h-2 rounded-full bg-gray-300" />
          {counts.discard} discarded
        </span>
      </div>
      <Link
        to="../optimization" relative="path"
        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
          counts.hit > 0
            ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm'
            : 'bg-gray-100 text-gray-400 pointer-events-none'
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
        Send to Optimization
        {counts.hit > 0 && (
          <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded text-xs font-bold">{counts.hit}</span>
        )}
      </Link>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modal overlay
// ---------------------------------------------------------------------------

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm pt-8 pb-8 px-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="font-bold text-[#1e3a5f] text-base">{title}</h2>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors">
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

// ---------------------------------------------------------------------------
// Safety & Selectivity panel for selected molecule
// ---------------------------------------------------------------------------

function SafetyConfidencePanel({ mol, pipelineSummary, onSafetyReport, onConfidenceBreakdown, onAIAnalysis }) {
  if (!mol) return null

  const offTarget = mol.off_target
  const confidence = mol.confidence
  const herg = mol.herg_specialized
  const seaResults = offTarget?.sea_results
  const admetDomain = mol.admet_domain?.status ?? mol.admet?.applicability_domain?.status ?? null
  const cnnScore = mol.cnn_score ?? mol.gnina_cnn_score ?? null
  const clusterId = mol.cluster_id ?? null
  const interactions = mol.interactions
  const synthCost = mol.synthesis_route?.cost_estimate?.total_cost_usd

  const hasAny = offTarget || confidence || herg || seaResults || admetDomain || cnnScore != null || interactions || synthCost != null

  if (!hasAny) return null

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Safety & Advanced Metrics</h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {/* Off-target selectivity */}
        {offTarget && offTarget.n_total > 0 && (
          <div className="p-2.5 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 font-semibold uppercase mb-1">Selectivity</p>
            <div className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${
                (offTarget.n_safe / offTarget.n_total) >= 0.9 ? 'bg-green-500' :
                (offTarget.n_safe / offTarget.n_total) >= 0.7 ? 'bg-yellow-400' : 'bg-red-500'
              }`} />
              <span className="text-sm font-semibold text-gray-700">{offTarget.n_safe}/{offTarget.n_total} safe</span>
            </div>
          </div>
        )}

        {/* Confidence */}
        {confidence?.overall != null && (
          <div className="p-2.5 bg-gray-50 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors"
            onClick={onConfidenceBreakdown}>
            <p className="text-[10px] text-gray-400 font-semibold uppercase mb-1">Confidence</p>
            <span className={`text-sm font-bold ${
              confidence.overall >= 0.7 ? 'text-green-600' : confidence.overall >= 0.5 ? 'text-yellow-600' : 'text-red-500'
            }`}>{Math.round(confidence.overall * 100)}%</span>
            <span className="text-[10px] text-blue-500 ml-1">details</span>
          </div>
        )}

        {/* hERG risk */}
        {herg?.risk_level && (
          <div className="p-2.5 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 font-semibold uppercase mb-1">hERG Risk</p>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
              herg.risk_level.toUpperCase() === 'LOW' ? 'bg-green-100 text-green-700 border-green-200' :
              herg.risk_level.toUpperCase() === 'MODERATE' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
              'bg-red-100 text-red-700 border-red-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                herg.risk_level.toUpperCase() === 'LOW' ? 'bg-green-500' :
                herg.risk_level.toUpperCase() === 'MODERATE' ? 'bg-yellow-400' : 'bg-red-500'
              }`} />
              {herg.risk_level.toUpperCase()}
            </span>
          </div>
        )}

        {/* SEA screening */}
        {seaResults && (
          <div className="p-2.5 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 font-semibold uppercase mb-1">SEA Screening</p>
            {(() => {
              const nHits = seaResults.targets_hit?.length ?? 0
              const nScreened = seaResults.n_targets_screened
              return (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                  nHits === 0 ? 'bg-green-100 text-green-700 border-green-200' :
                  nHits <= 3 ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                  'bg-red-100 text-red-700 border-red-200'
                }`}>
                  {nHits} target{nHits !== 1 ? 's' : ''}
                  {nScreened != null && <span className="font-normal opacity-70">/ {nScreened.toLocaleString()}</span>}
                </span>
              )
            })()}
          </div>
        )}

        {/* CNN Score */}
        {cnnScore != null && (
          <div className="p-2.5 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 font-semibold uppercase mb-1">CNN Score</p>
            <span className="text-sm font-bold text-[#1e3a5f]">{Number(cnnScore).toFixed(3)}</span>
          </div>
        )}

        {/* ADMET Domain */}
        {admetDomain && (
          <div className="p-2.5 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 font-semibold uppercase mb-1">ADMET Domain</p>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${
              admetDomain === 'in_domain' ? 'bg-green-100 text-green-700 border-green-200' :
              admetDomain === 'partial' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
              'bg-red-100 text-red-700 border-red-200'
            }`}>
              {admetDomain === 'in_domain' ? 'In Domain' : admetDomain === 'partial' ? 'Partial' : 'Out of Domain'}
            </span>
          </div>
        )}

        {/* Interactions quality */}
        {interactions && (
          <div className="p-2.5 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 font-semibold uppercase mb-1">Interactions</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${
                  (interactions.interaction_quality ?? 0) >= 0.6 ? 'bg-green-500' :
                  (interactions.interaction_quality ?? 0) >= 0.3 ? 'bg-yellow-400' : 'bg-red-400'
                }`} style={{ width: `${Math.round((interactions.interaction_quality ?? 0) * 100)}%` }} />
              </div>
              <span className="text-xs font-semibold text-gray-600">
                {interactions.functional_contacts ?? 0}/{interactions.total_functional ?? 0}
              </span>
            </div>
          </div>
        )}

        {/* Cluster/family */}
        {clusterId != null && (
          <div className="p-2.5 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 font-semibold uppercase mb-1">Chemical Family</p>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200">
              Family {clusterId + 1}
            </span>
          </div>
        )}

        {/* Synthesis cost */}
        {synthCost != null && (
          <div className="p-2.5 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 font-semibold uppercase mb-1">Synth. Cost</p>
            <span className="text-sm font-semibold text-gray-700 font-mono">
              ${Number(synthCost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 pt-1">
        {offTarget && (
          <button onClick={onSafetyReport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1e3a5f] bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Full Safety Report
          </button>
        )}
        {confidence && (
          <button onClick={onConfidenceBreakdown}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1e3a5f] bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Confidence Breakdown
          </button>
        )}
        <button onClick={onAIAnalysis}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#1e3a5f] hover:bg-[#2a4f7c] rounded-lg transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          AI Analysis
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Enhanced results table with inline hit tagging
// ---------------------------------------------------------------------------

function TagButton({ tag, activeTag, onClick }) {
  const configs = {
    hit: { label: 'Hit', active: 'bg-[#22c55e] text-white border-[#22c55e]', inactive: 'text-gray-400 border-gray-200 hover:border-[#22c55e] hover:text-[#22c55e]' },
    investigate: { label: 'Inv', active: 'bg-yellow-400 text-white border-yellow-400', inactive: 'text-gray-400 border-gray-200 hover:border-yellow-400 hover:text-yellow-600' },
    discard: { label: 'X', active: 'bg-gray-400 text-white border-gray-400', inactive: 'text-gray-400 border-gray-200 hover:border-gray-400' },
  }
  const cfg = configs[tag]
  const isActive = activeTag === tag
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border transition-colors ${isActive ? cfg.active : cfg.inactive}`}
      title={tag}
    >
      {cfg.label}
    </button>
  )
}

function EnhancedResultsTable({ allMols, selectedPoseIndex, setSelectedPoseIndex, generatedMolCount }) {
  const { selections, setTag, removeSelection } = useHitSelection()
  const [sortKey, setSortKey] = useState('composite_score')
  const [sortDir, setSortDir] = useState('desc')

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir(['composite_score', 'qed'].includes(key) ? 'desc' : 'asc') }
  }

  const sorted = useMemo(() => {
    return [...allMols].map((mol, origIdx) => ({ mol, origIdx })).sort((a, b) => {
      const va = a.mol[sortKey] ?? -Infinity
      const vb = b.mol[sortKey] ?? -Infinity
      return sortDir === 'asc' ? va - vb : vb - va
    })
  }, [allMols, sortKey, sortDir])

  const hasAdmet = allMols.some(m => m.admet)
  const hasSource = allMols.some(m => m.source) || generatedMolCount > 0
  const hasOffTarget = allMols.some(m => m.off_target?.n_total > 0)
  const hasConfidence = allMols.some(m => m.confidence?.overall != null)

  const SortIcon = ({ k }) => {
    if (sortKey !== k) return <svg className="w-3 h-3 text-gray-300 inline ml-0.5" fill="currentColor" viewBox="0 0 20 20"><path d="M5 10l5-5 5 5H5z" /></svg>
    return sortDir === 'asc'
      ? <svg className="w-3 h-3 text-[#1e3a5f] inline ml-0.5" fill="currentColor" viewBox="0 0 20 20"><path d="M5 10l5-5 5 5H5z" /></svg>
      : <svg className="w-3 h-3 text-[#1e3a5f] inline ml-0.5" fill="currentColor" viewBox="0 0 20 20"><path d="M15 10l-5 5-5-5h10z" /></svg>
  }

  const getName = (r) => r.name || r.molecule_name || r.smiles?.slice(0, 20) || 'Unknown'

  const deriveToxLevel = (mol) => {
    const code = mol.admet?.color_code
    if (code === 'green') return 'Low'
    if (code === 'red') return 'High'
    if (code === 'yellow') return 'Medium'
    return null
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3 bg-[#1e3a5f] flex items-center justify-between">
        <h3 className="text-white font-semibold text-sm flex items-center gap-2">
          <svg className="w-4 h-4 text-[#22c55e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          All Results
          {generatedMolCount > 0 && (
            <span className="ml-1 text-purple-300 text-xs font-normal">(incl. {generatedMolCount} AI-generated)</span>
          )}
        </h3>
        <span className="text-white/60 text-xs">{allMols.length} molecules</span>
      </div>

      <div className="overflow-x-auto">
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-20 bg-gray-50">
              <tr className="border-b border-gray-100">
                <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase w-8">Tag</th>
                <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase w-12">#</th>
                <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="px-1 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase w-12">2D</th>
                <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-[#1e3a5f] select-none"
                  onClick={() => handleSort('affinity')}>
                  Affinity <SortIcon k="affinity" />
                </th>
                <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-[#1e3a5f] select-none"
                  onClick={() => handleSort('composite_score')}>
                  Score <SortIcon k="composite_score" />
                </th>
                <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-[#1e3a5f] select-none"
                  onClick={() => handleSort('qed')}>
                  QED <SortIcon k="qed" />
                </th>
                <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-[#1e3a5f] select-none hidden sm:table-cell"
                  onClick={() => handleSort('logp')}>
                  LogP <SortIcon k="logp" />
                </th>
                <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-[#1e3a5f] select-none hidden sm:table-cell"
                  onClick={() => handleSort('mw')}>
                  MW <SortIcon k="mw" />
                </th>
                {hasAdmet && (
                  <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">ADMET</th>
                )}
                {hasSource && (
                  <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Source</th>
                )}
                {hasOffTarget && (
                  <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Safety</th>
                )}
                {hasConfidence && (
                  <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Conf.</th>
                )}
              </tr>
            </thead>
            <tbody>
              {sorted.map(({ mol, origIdx }, displayIdx) => {
                const isSelected = selectedPoseIndex === origIdx
                const sel = selections[origIdx]
                const tag = sel?.tag || null
                const isEliminated = mol.eliminated === true
                const isGenerated = mol._isGeneratedMol

                const rowBg = isSelected
                  ? 'bg-blue-50/80 border-l-4 border-l-[#1e3a5f]'
                  : tag === 'hit' ? 'bg-green-50/50'
                  : tag === 'investigate' ? 'bg-yellow-50/50'
                  : tag === 'discard' ? 'bg-gray-50/80'
                  : isGenerated ? 'bg-purple-50/30 hover:bg-purple-50/60'
                  : isEliminated ? 'bg-red-50/30'
                  : 'hover:bg-blue-50/50'

                return (
                  <tr key={`${isGenerated ? 'gen' : 'dock'}-${origIdx}`}
                    onClick={() => setSelectedPoseIndex(origIdx)}
                    className={`border-b border-gray-50 cursor-pointer transition-colors ${rowBg}`}>
                    {/* Tag buttons */}
                    <td className="px-1 py-2" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-0.5">
                        {['hit', 'investigate', 'discard'].map(t => (
                          <TagButton key={t} tag={t} activeTag={tag}
                            onClick={() => tag === t ? removeSelection(origIdx) : setTag(origIdx, t)} />
                        ))}
                      </div>
                    </td>
                    {/* Rank */}
                    <td className="px-2 py-2">
                      <span className={`w-6 h-6 text-xs font-medium rounded-full flex items-center justify-center ${
                        displayIdx === 0 && !isGenerated ? 'bg-[#22c55e] text-white font-bold' : 'bg-gray-100 text-gray-500'
                      }`}>{displayIdx + 1}</span>
                    </td>
                    {/* Name */}
                    <td className="px-2 py-2 max-w-[200px]">
                      <span className={`text-sm font-medium break-words ${
                        isEliminated ? 'text-red-400 line-through' : isGenerated ? 'text-purple-700' : 'text-gray-800'
                      }`} title={getName(mol)}>
                        {getName(mol)}
                      </span>
                      {isEliminated && mol.elimination_reason && (
                        <span className="block text-[10px] text-red-500">{mol.elimination_reason}</span>
                      )}
                    </td>
                    {/* 2D SVG */}
                    <td className="px-1 py-1">
                      {mol.svg ? (
                        <div className="w-9 h-9 [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: mol.svg }} />
                      ) : <div className="w-9 h-9 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400">-</div>}
                    </td>
                    {/* Affinity */}
                    <td className="px-2 py-2">
                      <span className={`text-sm font-mono font-semibold ${
                        (mol.affinity || 0) < -9 ? 'text-green-600' : (mol.affinity || 0) < -7 ? 'text-blue-600' : 'text-gray-600'
                      }`}>
                        {mol.affinity != null ? Number(mol.affinity).toFixed(1) : 'N/A'}
                      </span>
                    </td>
                    {/* Score */}
                    <td className="px-2 py-2">
                      {mol.composite_score != null ? (
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                          mol.composite_score >= 0.7 ? 'text-green-700 bg-green-100' :
                          mol.composite_score >= 0.4 ? 'text-yellow-700 bg-yellow-100' : 'text-red-700 bg-red-100'
                        }`}>{Number(mol.composite_score).toFixed(2)}</span>
                      ) : <span className="text-xs text-gray-400">N/A</span>}
                    </td>
                    {/* QED */}
                    <td className="px-2 py-2">
                      {mol.qed != null ? (
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                          mol.qed >= 0.6 ? 'text-green-700 bg-green-100' :
                          mol.qed >= 0.3 ? 'text-yellow-700 bg-yellow-100' : 'text-red-700 bg-red-100'
                        }`}>{Number(mol.qed).toFixed(2)}</span>
                      ) : <span className="text-xs text-gray-400">N/A</span>}
                    </td>
                    {/* LogP */}
                    <td className="px-2 py-2 hidden sm:table-cell">
                      <span className="text-sm text-gray-600 font-mono">{mol.logp != null ? Number(mol.logp).toFixed(1) : 'N/A'}</span>
                    </td>
                    {/* MW */}
                    <td className="px-2 py-2 hidden sm:table-cell">
                      <span className="text-sm text-gray-600">{mol.mw != null ? Math.round(mol.mw) : 'N/A'}</span>
                    </td>
                    {/* ADMET */}
                    {hasAdmet && (
                      <td className="px-2 py-2 hidden md:table-cell">
                        {mol.admet ? (
                          <span className="flex items-center gap-1">
                            <span className={`w-2.5 h-2.5 rounded-full ${
                              mol.admet.color_code === 'green' ? 'bg-green-500' :
                              mol.admet.color_code === 'red' ? 'bg-red-500' : 'bg-yellow-400'
                            }`} />
                            <span className="text-xs text-gray-500 font-mono">
                              {mol.admet.composite_score != null ? Number(mol.admet.composite_score).toFixed(2) : ''}
                            </span>
                          </span>
                        ) : <span className="text-xs text-gray-300">-</span>}
                      </td>
                    )}
                    {/* Source */}
                    {hasSource && (
                      <td className="px-2 py-2 hidden md:table-cell">
                        {isGenerated ? <Badge variant="purple">AI</Badge>
                          : mol.source?.toLowerCase().includes('zinc') ? <Badge variant="blue">ZINC</Badge>
                          : mol.source ? <Badge variant="green">ChEMBL</Badge>
                          : <span className="text-xs text-gray-400">-</span>}
                      </td>
                    )}
                    {/* Off-target safety */}
                    {hasOffTarget && (
                      <td className="px-2 py-2 hidden lg:table-cell">
                        {mol.off_target?.n_total > 0 ? (
                          <span className="flex items-center gap-1">
                            <span className={`w-2 h-2 rounded-full ${
                              (mol.off_target.n_safe / mol.off_target.n_total) >= 0.9 ? 'bg-green-500' :
                              (mol.off_target.n_safe / mol.off_target.n_total) >= 0.7 ? 'bg-yellow-400' : 'bg-red-500'
                            }`} />
                            <span className="text-xs text-gray-500">{mol.off_target.n_safe}/{mol.off_target.n_total}</span>
                          </span>
                        ) : <span className="text-xs text-gray-300">-</span>}
                      </td>
                    )}
                    {/* Confidence */}
                    {hasConfidence && (
                      <td className="px-2 py-2 hidden lg:table-cell">
                        {mol.confidence?.overall != null ? (
                          <span className={`text-xs font-semibold ${
                            mol.confidence.overall >= 0.7 ? 'text-green-600' :
                            mol.confidence.overall >= 0.5 ? 'text-yellow-600' : 'text-red-500'
                          }`}>{Math.round(mol.confidence.overall * 100)}%</span>
                        ) : <span className="text-xs text-gray-300">-</span>}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-400">
        <span>Click a row to view 3D pose</span>
        <span className="ml-auto">Tag molecules directly using Hit / Inv / X buttons</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Summary strip
// ---------------------------------------------------------------------------

function SummaryStrip({ results }) {
  const allMols = [...(results.results || []), ...(results.generated_molecules || [])]
  const bestScore = allMols.length > 0
    ? Math.max(...allMols.map(m => (m.composite_score || 0) * 100))
    : null
  const bestAffinity = allMols.length > 0
    ? Math.min(...allMols.filter(m => m.affinity != null).map(m => m.affinity))
    : null
  const pipelineSummary = results.pipeline_summary || {}
  const hardCutoffs = pipelineSummary.hard_cutoffs || {}

  return (
    <div className="bg-[#1e3a5f] rounded-xl p-5 text-white">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold mb-1">
            Screening Results
            <span className="ml-2 text-[#22c55e] font-mono text-lg">{results.uniprot_id}</span>
          </h2>
          <p className="text-white/60 text-sm">
            {(results.results || []).length} ligands tested
            {(results.generated_molecules || []).length > 0 && ` + ${results.generated_molecules.length} AI-generated`}
            {hardCutoffs.passed != null && hardCutoffs.eliminated != null && (
              <span className="ml-1">
                &mdash; {hardCutoffs.passed}/{hardCutoffs.passed + hardCutoffs.eliminated} passed cutoffs
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-6 flex-shrink-0">
          {bestScore != null && (
            <div className="text-center">
              <div className="text-3xl font-extrabold text-[#22c55e] leading-none">{Math.round(bestScore)}</div>
              <div className="text-xs text-white/50 mt-0.5">Best Score</div>
            </div>
          )}
          {bestAffinity != null && isFinite(bestAffinity) && (
            <div className="text-center">
              <div className="text-3xl font-extrabold text-[#22c55e] leading-none font-mono">{Number(bestAffinity).toFixed(1)}</div>
              <div className="text-xs text-white/50 mt-0.5">kcal/mol</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inner component — needs HitSelectionProvider wrapping
// ---------------------------------------------------------------------------

function ProjectResultsInner({ selectedJobId, results, targetConfig }) {
  const { selections, setTag, clearAll } = useHitSelection()
  const [selectedPoseIndex, setSelectedPoseIndex] = useState(0)
  const [filters, setFilters] = useState({ ...DEFAULT_CUTOFFS })
  const [showAutoHit, setShowAutoHit] = useState(false)
  const [safetyMol, setSafetyMol] = useState(null)
  const [confidenceMol, setConfidenceMol] = useState(null)
  const [showAgentCard, setShowAgentCard] = useState(false)

  // Merge all molecules (docking + generated)
  const allMolsUnfiltered = useMemo(() => {
    const raw = results?.results || []
    const gen = (results?.generated_molecules || []).map(m => ({ ...m, _isGeneratedMol: true }))
    return [...raw, ...gen]
  }, [results])

  // Apply filters
  const allMols = useMemo(() => {
    return allMolsUnfiltered.filter(mol => {
      if (!filters.showEliminated && mol.eliminated) return false
      const score = (mol.composite_score || 0) * 100
      if (filters.minScore > 0 && score < filters.minScore) return false
      if (filters.maxAffinity < 0 && (mol.affinity || 0) > filters.maxAffinity) return false
      if (filters.minQED > 0 && (mol.qed || 0) < filters.minQED) return false
      if (filters.maxLogP < 10 && (mol.logp || 0) > filters.maxLogP) return false
      if (filters.maxMW < 2000 && (mol.mw || 0) > filters.maxMW) return false
      if (filters.safetyLevels.length > 0) {
        const code = mol.admet?.color_code
        let level = code === 'green' ? 'Low' : code === 'red' ? 'High' : code === 'yellow' ? 'Medium' : 'Low'
        if (!filters.safetyLevels.includes(level)) return false
      }
      if (filters.sources.length > 0) {
        const src = (mol.source || '').toLowerCase()
        const matched = filters.sources.some(s => {
          if (s === 'AI') return src.includes('reinvent') || src.includes('generated') || src.includes('ai') || mol._isGeneratedMol
          return src.includes(s.toLowerCase())
        })
        if (!matched) return false
      }
      return true
    })
  }, [allMolsUnfiltered, filters])

  const selectedMol = allMolsUnfiltered[selectedPoseIndex] || allMolsUnfiltered[0] || null

  const handleAutoHit = useCallback((criteria) => {
    allMolsUnfiltered.forEach((mol, idx) => {
      const score = (mol.composite_score || 0) * 100
      if (score < criteria.minScore) return
      if (criteria.maxAffinity < 0 && (mol.affinity || 0) > criteria.maxAffinity) return
      if ((mol.qed || 0) < criteria.minQED) return
      if ((mol.logp || 0) > criteria.maxLogP) return
      if ((mol.mw || 0) > criteria.maxMW) return
      if (criteria.lowToxicityOnly && mol.admet?.color_code !== 'green') return
      if (mol.eliminated) return
      setTag(idx, 'hit')
    })
    setShowAutoHit(false)
  }, [allMolsUnfiltered, setTag])

  const hasAdmet = allMolsUnfiltered.some(m => m.admet)
  const generatedMolCount = allMolsUnfiltered.filter(m => m._isGeneratedMol).length
  const hasSources = allMolsUnfiltered.some(m => m.source) || generatedMolCount > 0

  return (
    <div className="space-y-5">
      <SummaryStrip results={results} />
      <HitBar />

      {/* Action buttons */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => setShowAutoHit(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#22c55e] hover:bg-[#16a34a] text-white text-sm font-semibold rounded-lg transition-colors shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          Auto-Select Hits
        </button>
        <button onClick={clearAll}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-600 text-sm font-medium rounded-lg border border-gray-200 transition-colors">
          Clear All Tags
        </button>
      </div>

      <FilterBar
        filters={filters} setFilters={setFilters}
        counts={{ shown: allMols.length, total: allMolsUnfiltered.length }}
        hasAdmet={hasAdmet} hasSources={hasSources}
      />

      {/* 3D Viewer + Molecule Card */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2">
          <Viewer3D
            jobId={selectedJobId}
            results={results}
            selectedPoseIndex={selectedPoseIndex}
            onPoseSelect={setSelectedPoseIndex}
            pocketCenter={(() => {
              const pockets = targetConfig?.pockets
              const selIdx = targetConfig?.selected_pocket_idx ?? 0
              const pocket = pockets?.[selIdx] || pockets?.[0]
              return pocket?.center || null
            })()}
            pocketResidues={(() => {
              const pockets = targetConfig?.pockets
              const selIdx = targetConfig?.selected_pocket_idx ?? 0
              const pocket = pockets?.[selIdx] || pockets?.[0]
              return pocket?.residues || null
            })()}
            uniprotFeatures={targetConfig?.uniprot_features || null}
          />
        </div>
        <div className="space-y-4">
          {selectedMol && (
            <MoleculeCard molecule={selectedMol} rank={selectedPoseIndex} jobId={selectedJobId} />
          )}
          {selectedMol && (
            <SafetyConfidencePanel
              mol={selectedMol}
              pipelineSummary={results?.pipeline_summary}
              onSafetyReport={() => setSafetyMol(selectedMol)}
              onConfidenceBreakdown={() => setConfidenceMol(selectedMol)}
              onAIAnalysis={() => setShowAgentCard(v => !v)}
            />
          )}
        </div>
      </div>

      {/* Full results table with inline tagging */}
      <EnhancedResultsTable
        allMols={allMols}
        selectedPoseIndex={selectedPoseIndex}
        setSelectedPoseIndex={setSelectedPoseIndex}
        generatedMolCount={generatedMolCount}
      />

      {/* Pareto Front */}
      {allMolsUnfiltered.some(m => m.pareto_objectives) && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 bg-[#1e3a5f]">
            <h3 className="text-white font-semibold text-sm">Multi-Objective Trade-Off (Pareto Front)</h3>
          </div>
          <div className="p-5">
            <ParetoFront molecules={allMolsUnfiltered} onSelect={(mol) => {
              const idx = allMolsUnfiltered.findIndex(m => m.name === mol.name || m.smiles === mol.smiles)
              if (idx >= 0) setSelectedPoseIndex(idx)
            }} />
          </div>
        </div>
      )}

      <DownloadButtons jobId={selectedJobId} results={results} />

      {showAutoHit && (
        <AutoHitDialog
          molecules={allMolsUnfiltered}
          onApply={handleAutoHit}
          onClose={() => setShowAutoHit(false)}
        />
      )}

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
            pipeline_summary={results?.pipeline_summary || {}}
          />
        </Modal>
      )}

      {/* Agent 3: Candidate Evaluation — inline card */}
      {showAgentCard && selectedMol && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 bg-[#1e3a5f] flex items-center justify-between">
            <h3 className="text-white font-semibold text-sm">AI Expert Analysis</h3>
            <button onClick={() => setShowAgentCard(false)}
              className="text-white/60 hover:text-white text-xs font-medium">
              Hide
            </button>
          </div>
          <div className="p-4">
            <AgentAdvisorCard
              agentName="candidate"
              context={{
                molecule_name: selectedMol.name || selectedMol.ligand_name,
                smiles: selectedMol.smiles,
                affinity: selectedMol.affinity,
                composite_score: selectedMol.composite_score,
                score_100: selectedMol.score_100,
                mw: selectedMol.mw,
                logp: selectedMol.logp,
                qed: selectedMol.qed,
                tpsa: selectedMol.tpsa,
                hbd: selectedMol.hbd,
                hba: selectedMol.hba,
                rotatable_bonds: selectedMol.rotatable_bonds,
                cnn_score: selectedMol.cnn_score,
                vina_score: selectedMol.vina_score,
                admet: selectedMol.admet,
                off_target: selectedMol.off_target,
                synthesis_route: selectedMol.synthesis_route ? {
                  n_steps: selectedMol.synthesis_route.n_steps,
                  confidence: selectedMol.synthesis_route.confidence,
                  estimated_cost: selectedMol.synthesis_route.estimated_cost,
                } : null,
                toxicity_level: selectedMol.toxicity_level,
                confidence: selectedMol.confidence,
                pains_alert: selectedMol.pains_alert,
                sa_score: selectedMol.sa_score,
              }}
              autoFetch={true}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ProjectResults — Screen 4
// ---------------------------------------------------------------------------

export default function ProjectResults() {
  const { project, jobs, loading, error, isTargetConfigured, targetConfig } = useProject()
  const [searchParams, setSearchParams] = useSearchParams()

  const [results, setResults] = useState(null)
  const [loadingResults, setLoadingResults] = useState(false)
  const [resultsError, setResultsError] = useState(null)

  const completedJobs = jobs.filter(j => j.status === 'completed')
  const runParam = searchParams.get('run')
  const selectedJobId = runParam || (completedJobs.length > 0 ? (completedJobs[0].id || completedJobs[0].job_id) : null)

  useEffect(() => {
    if (!selectedJobId) { setResults(null); return }
    setLoadingResults(true)
    setResultsError(null)
    getJobResults(selectedJobId)
      .then(data => setResults(data))
      .catch(err => setResultsError(err?.userMessage || 'Failed to load results.'))
      .finally(() => setLoadingResults(false))
  }, [selectedJobId])

  if (!loading && !isTargetConfigured) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" strokeWidth={1.8} />
              <circle cx="12" cy="12" r="5" strokeWidth={1.8} />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" strokeWidth={0} />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-700 mb-2">Target not configured</h3>
          <p className="text-sm text-gray-400 mb-6">You must configure a target protein before running screenings.</p>
          <Link
            to={`/project/${project?.id}/target`}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#22c55e] text-white font-semibold rounded-xl hover:bg-[#16a34a] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" strokeWidth={2} />
              <circle cx="12" cy="12" r="5" strokeWidth={2} />
            </svg>
            Go to Target Setup
          </Link>
          <div className="mt-8 flex items-center gap-3 text-xs text-gray-300 justify-center">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#22c55e]"></span> 1. Setup target</span>
            <span className="w-4 h-px bg-gray-200"></span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-200"></span> 2. Run screening</span>
            <span className="w-4 h-px bg-gray-200"></span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-200"></span> 3. View results</span>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <svg className="w-8 h-8 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    )
  }

  if (completedJobs.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-10 max-w-sm text-center">
          <p className="text-sm font-semibold text-gray-600 mb-1">No completed runs</p>
          <p className="text-xs text-gray-400 mb-4">Results appear here once a run completes.</p>
          <Link to="../runs" relative="path"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#22c55e] text-white text-sm font-semibold rounded-lg hover:bg-[#16a34a] transition-colors">
            Go to Runs
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[#1e3a5f]">Results</h1>
      </div>

      {/* Run selector */}
      {completedJobs.length > 1 && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-gray-500 uppercase">Select run:</span>
          {completedJobs.map(job => {
            const jid = job.id || job.job_id
            const isSelected = jid === selectedJobId
            return (
              <button key={jid}
                onClick={() => setSearchParams({ run: jid })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  isSelected
                    ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'
                }`}>
                {jid.slice(0, 8)}... <span className="text-xs opacity-60 capitalize">{job.mode || 'standard'}</span>
              </button>
            )
          })}
        </div>
      )}

      {loadingResults && (
        <div className="flex items-center justify-center py-10">
          <svg className="w-6 h-6 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {resultsError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{resultsError}</div>
      )}

      {selectedJobId && results && !loadingResults && (
        <HitSelectionProvider jobId={selectedJobId}>
          <ProjectResultsInner selectedJobId={selectedJobId} results={results} targetConfig={targetConfig} />
        </HitSelectionProvider>
      )}
    </div>
  )
}
