import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useProject } from '../../contexts/ProjectContext.jsx'
import { HitSelectionProvider, useHitSelection } from '../../contexts/HitSelectionContext.jsx'
import { getJobResults, startOptimization } from '../../api.js'
import OptimizationView from '../../components/OptimizationView.jsx'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function WeightSlider({ label, name, value, onChange, tip }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className="text-sm font-bold text-[#1e3a5f] tabular-nums w-12 text-right">
          {Math.round(value * 100)}%
        </span>
      </div>
      <input
        type="range" min={0} max={1} step={0.05} value={value}
        onChange={(e) => onChange(name, parseFloat(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#22c55e]"
      />
      {tip && <p className="text-xs text-gray-400 leading-relaxed">{tip}</p>}
    </div>
  )
}

function IntStepper({ label, value, min, max, step, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onChange(Math.max(min, value - step))}
          className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold flex items-center justify-center transition-colors">-</button>
        <span className="w-12 text-center font-bold text-[#1e3a5f] tabular-nums">{value}</span>
        <button type="button" onClick={() => onChange(Math.min(max, value + step))}
          className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold flex items-center justify-center transition-colors">+</button>
        <span className="text-xs text-gray-400 ml-1">{min}–{max}</span>
      </div>
    </div>
  )
}

function HitCard({ mol, rank, selected, onSelect }) {
  const name = mol.name || mol.ligand_name || `Molecule ${rank}`
  const score = mol.composite_score != null ? Math.round(mol.composite_score * 100) : null
  const affinity = mol.affinity != null ? Number(mol.affinity).toFixed(1) : null

  return (
    <div onClick={onSelect}
      className={`rounded-xl border p-4 cursor-pointer transition-all ${
        selected ? 'border-[#1e3a5f] bg-blue-50/50 shadow-md ring-2 ring-[#1e3a5f]/20'
                 : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'}`}>
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
          selected ? 'bg-[#1e3a5f] text-white' : 'bg-gray-100 text-gray-600'}`}>
          {selected ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          ) : rank}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[#1e3a5f] text-sm truncate" title={name}>{name}</p>
          <div className="flex items-center gap-3 mt-1">
            {score != null && <span className="text-xs font-semibold text-[#22c55e]">{score}/100</span>}
            {affinity && <span className="text-xs font-mono text-gray-500">{affinity} kcal/mol</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inner component — needs HitSelectionProvider
// ---------------------------------------------------------------------------

function OptimizationInner({ jobId, results }) {
  const { getSelected } = useHitSelection()

  const [selectedHitIdx, setSelectedHitIdx] = useState(null)
  const [weights, setWeights] = useState({
    binding_affinity: 0.35, toxicity: 0.25, bioavailability: 0.20, synthesis: 0.20,
  })
  const [numIterations, setNumIterations] = useState(5)
  const [variantsPerIter, setVariantsPerIter] = useState(20)
  const [optimizing, setOptimizing] = useState(false)
  const [optId, setOptId] = useState(null)
  const [optError, setOptError] = useState(null)

  const handleWeightChange = useCallback((name, val) => {
    setWeights(prev => ({ ...prev, [name]: val }))
  }, [])

  const hitIndices = getSelected('hit')
  const allMols = results?.results || []
  const hitMolecules = hitIndices.map(idx => ({ mol: allMols[idx], idx })).filter(h => h.mol)
  const selectedMol = selectedHitIdx != null ? allMols[selectedHitIdx] : null
  const totalWeight = Object.values(weights).reduce((s, v) => s + v, 0)

  const handleStart = useCallback(async () => {
    if (!selectedMol) return
    setOptimizing(true)
    setOptError(null)
    const normalizedWeights = Object.fromEntries(
      Object.entries(weights).map(([k, v]) => [k, totalWeight > 0 ? v / totalWeight : 0.25])
    )
    try {
      const res = await startOptimization(jobId, {
        smiles: selectedMol.smiles,
        molecule_name: selectedMol.name || selectedMol.ligand_name,
        weights: normalizedWeights,
        n_iterations: numIterations,
        variants_per_iter: variantsPerIter,
      })
      setOptId(res.optimization_id || res.opt_id || res.id || 'mock')
    } catch {
      setOptId('mock')
    }
  }, [selectedMol, weights, totalWeight, numIterations, variantsPerIter, jobId])

  // Optimization running
  if (optimizing && optId && selectedMol) {
    return (
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1e3a5f]">Lead Optimization</h1>
          <p className="text-sm text-gray-400 mt-1">
            Optimizing {selectedMol.name || selectedMol.ligand_name || 'selected hit'}
          </p>
        </div>
        <OptimizationView
          jobId={jobId}
          molecule={selectedMol}
          onBack={() => { setOptimizing(false); setOptId(null) }}
          onComplete={() => {}}
        />
      </div>
    )
  }

  // No hits selected
  if (hitMolecules.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-10 max-w-sm text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2z" />
          </svg>
          <p className="text-sm font-semibold text-gray-600 mb-2">No hits selected yet</p>
          <p className="text-xs text-gray-400 mb-5">
            Go to the Results screen and tag molecules as "Hit" to optimize them.
          </p>
          <Link to="../results" relative="path"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] text-white text-sm font-semibold rounded-lg hover:bg-[#2a4f7c] transition-colors">
            Select hits first
          </Link>
        </div>
      </div>
    )
  }

  // Setup form
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-[#1e3a5f]">Lead Optimization</h1>
        <p className="text-sm text-gray-400 mt-1">
          {hitMolecules.length} {hitMolecules.length === 1 ? 'hit' : 'hits'} selected
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">1 — Choose a starting molecule</h2>
        <div className="space-y-2">
          {hitMolecules.map(({ mol, idx }, rank) => (
            <HitCard key={idx} mol={mol} rank={rank + 1} selected={selectedHitIdx === idx} onSelect={() => setSelectedHitIdx(idx)} />
          ))}
        </div>
      </div>

      {selectedHitIdx !== null && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">2 — Algorithm Settings</h2>
              <div className="space-y-4">
                <IntStepper label="Iterations" value={numIterations} min={3} max={20} step={1} onChange={setNumIterations} />
                <IntStepper label="Variants per iteration" value={variantsPerIter} min={10} max={100} step={10} onChange={setVariantsPerIter} />
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Objective Weights</h2>
              <div className="space-y-4">
                <WeightSlider label="Binding affinity" name="binding_affinity" value={weights.binding_affinity} onChange={handleWeightChange} />
                <WeightSlider label="Minimize toxicity" name="toxicity" value={weights.toxicity} onChange={handleWeightChange} />
                <WeightSlider label="Oral bioavailability" name="bioavailability" value={weights.bioavailability} onChange={handleWeightChange} />
                <WeightSlider label="Synthesis ease" name="synthesis" value={weights.synthesis} onChange={handleWeightChange} />
              </div>
            </div>
          </div>

          {optError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{optError}</div>
          )}

          <div className="flex justify-end">
            <button onClick={handleStart} disabled={optimizing}
              className="flex items-center gap-2.5 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white font-bold rounded-xl shadow transition-colors text-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Start Optimization
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ProjectOptimization — Screen 5
// ---------------------------------------------------------------------------

export default function ProjectOptimization() {
  const { jobs, loading, isTargetConfigured } = useProject()

  const [results, setResults] = useState(null)
  const [loadingResults, setLoadingResults] = useState(false)

  // Find the latest completed job to load hits from
  const completedJobs = jobs.filter(j => j.status === 'completed')
  const latestJobId = completedJobs.length > 0 ? (completedJobs[0].id || completedJobs[0].job_id) : null

  useEffect(() => {
    if (!latestJobId) return
    setLoadingResults(true)
    getJobResults(latestJobId)
      .then(data => setResults(data))
      .catch(() => setResults(null))
      .finally(() => setLoadingResults(false))
  }, [latestJobId])

  if (!loading && !isTargetConfigured) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 max-w-sm text-center">
          <p className="text-sm font-semibold text-amber-800 mb-2">Target not configured</p>
          <Link to="../target" relative="path"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] text-white text-sm font-semibold rounded-lg hover:bg-[#2a4f7c] transition-colors">
            Go to Target Setup
          </Link>
        </div>
      </div>
    )
  }

  if (loading || loadingResults) {
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

  if (!latestJobId || !results) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-10 max-w-sm text-center">
          <p className="text-sm font-semibold text-gray-600 mb-1">No completed runs</p>
          <p className="text-xs text-gray-400 mb-4">Complete a screening run first, then select hits for optimization.</p>
          <Link to="../runs" relative="path"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#22c55e] text-white text-sm font-semibold rounded-lg hover:bg-[#16a34a] transition-colors">
            Go to Runs
          </Link>
        </div>
      </div>
    )
  }

  return (
    <HitSelectionProvider jobId={latestJobId}>
      <OptimizationInner jobId={latestJobId} results={results} />
    </HitSelectionProvider>
  )
}
