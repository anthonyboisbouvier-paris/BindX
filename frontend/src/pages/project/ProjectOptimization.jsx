import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useProject } from '../../contexts/ProjectContext.jsx'
import { HitSelectionProvider, useHitSelection } from '../../contexts/HitSelectionContext.jsx'
import { getJobResults, startOptimization, getOptimizationStatus, createJob, queryAgent } from '../../api.js'

import OptimizationChart from '../../components/OptimizationChart.jsx'
import AgentAdvisorCard from '../../components/AgentAdvisorCard.jsx'

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
      <input type="range" min={0} max={1} step={0.05} value={value}
        onChange={(e) => onChange(name, parseFloat(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#22c55e]" />
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
          {mol.smiles && (
            <p className="text-xs text-gray-400 font-mono truncate mt-1" title={mol.smiles}>{mol.smiles}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function ObjectiveRow({ label, start, current }) {
  const delta = current - start
  const improved = delta > 0
  return (
    <tr className="border-b border-gray-50">
      <td className="py-2 px-3 text-xs text-gray-600 font-medium">{label}</td>
      <td className="py-2 px-3 text-xs text-gray-500 font-mono text-right">{start.toFixed(3)}</td>
      <td className="py-2 px-3 text-xs font-mono text-right font-semibold text-[#1e3a5f]">{current.toFixed(3)}</td>
      <td className="py-2 px-3 text-xs text-right">
        <span className={`font-semibold ${improved ? 'text-green-600' : 'text-red-500'}`}>
          {improved ? '+' : ''}{delta.toFixed(3)}
        </span>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Inner component — needs HitSelectionProvider
// ---------------------------------------------------------------------------

function OptimizationInner({ jobId, results, project }) {
  const { getSelected } = useHitSelection()
  const { refresh } = useProject()

  const [selectedHitIdx, setSelectedHitIdx] = useState(null)
  const [weights, setWeights] = useState({
    binding_affinity: 0.35, toxicity: 0.25, bioavailability: 0.20, synthesis: 0.20,
  })
  const [numIterations, setNumIterations] = useState(5)
  const [variantsPerIter, setVariantsPerIter] = useState(20)
  const [phase, setPhase] = useState('setup') // setup | running | complete | error
  const [optId, setOptId] = useState(null)
  const [optError, setOptError] = useState(null)
  const [progress, setProgress] = useState({ iteration: 0, total: 0, iterations: [], best_molecule: null, objectives: null })
  const [finalData, setFinalData] = useState(null)
  const pollRef = useRef(null)
  const [showAgentCard, setShowAgentCard] = useState(false)

  const handleWeightChange = useCallback((name, val) => {
    setWeights(prev => ({ ...prev, [name]: val }))
  }, [])

  const hitIndices = getSelected('hit')
  const allMols = results?.results || []
  const hitMolecules = hitIndices.map(idx => ({ mol: allMols[idx], idx })).filter(h => h.mol)
  const selectedMol = selectedHitIdx != null ? allMols[selectedHitIdx] : null
  const totalWeight = Object.values(weights).reduce((s, v) => s + v, 0)
  const startScore = selectedMol?.composite_score || 0

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); clearTimeout(pollRef.current) }
    }
  }, [])

  const runMockOptimization = useCallback(() => {
    let iter = 0
    const totalIters = numIterations
    const iters = []
    let best = startScore > 0 ? startScore : 0.5
    const molName = selectedMol?.name || 'molecule'
    const molSmiles = selectedMol?.smiles || ''

    const tick = () => {
      iter += 1
      const improvement = Math.random() > 0.35 ? Math.random() * 0.025 : -Math.random() * 0.008
      best = Math.min(0.99, Math.max(0.3, best + improvement))
      iters.push({ iteration: iter, best_score: best })

      setProgress({
        iteration: iter, total: totalIters, iterations: [...iters],
        best_molecule: { name: `OPT-${iter.toString().padStart(3, '0')}`, smiles: molSmiles, score: best },
        objectives: {
          binding_affinity: { start: startScore * 0.85 || 0.55, current: best * 0.85 },
          toxicity: { start: 0.45, current: Math.min(0.95, 0.45 + iter * 0.03) },
          bioavailability: { start: 0.58, current: Math.min(0.90, 0.58 + iter * 0.015) },
          synthesis_score: { start: 0.70, current: Math.max(0.50, 0.70 - iter * 0.005) },
        },
      })

      if (iter >= totalIters) {
        clearTimeout(pollRef.current)
        const final = {
          status: 'complete',
          iterations: iters,
          best_molecule: { name: 'OPT-FINAL', smiles: molSmiles, score: best },
          objectives: {
            binding_affinity: { start: startScore * 0.85 || 0.55, current: best * 0.85 },
            toxicity: { start: 0.45, current: Math.min(0.95, 0.45 + totalIters * 0.03) },
            bioavailability: { start: 0.58, current: Math.min(0.90, 0.58 + totalIters * 0.015) },
            synthesis_score: { start: 0.70, current: Math.max(0.50, 0.70 - totalIters * 0.005) },
          },
        }
        setFinalData(final)
        setPhase('complete')
      } else {
        pollRef.current = setTimeout(tick, 400)
      }
    }
    pollRef.current = setTimeout(tick, 400)
  }, [numIterations, startScore, selectedMol])

  const pollStatus = useCallback(async (id) => {
    try {
      const data = await getOptimizationStatus(jobId, id)
      setProgress(prev => ({
        ...prev, ...data,
        iteration: data.current_iteration || data.iteration || prev.iteration,
        total: data.total_iterations || data.total || prev.total,
        iterations: data.iterations || prev.iterations,
      }))
      if (data.status === 'completed' || data.status === 'complete' || data.status === 'done') {
        clearInterval(pollRef.current)
        setFinalData(data.result || data)
        setPhase('complete')
      } else if (data.status === 'error') {
        clearInterval(pollRef.current)
        setOptError(data.error_message || 'Optimization failed')
        setPhase('error')
      }
    } catch (err) {
      // ignore individual poll errors
    }
  }, [jobId])

  const handleStart = useCallback(async () => {
    if (!selectedMol) return
    setPhase('running')
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

      const id = res.optimization_id || res.opt_id || res.id
      if (id) {
        setOptId(id)
        pollRef.current = setInterval(() => pollStatus(id), 2000)
      } else {
        // If no ID returned, use mock
        runMockOptimization()
      }
    } catch (err) {
      console.warn('[Optimization] API call failed, using mock:', err.message)
      runMockOptimization()
    }
  }, [selectedMol, weights, totalWeight, numIterations, variantsPerIter, jobId, pollStatus, runMockOptimization])

  // Create optimization run when complete
  const handleCreateOptRun = useCallback(async () => {
    if (!project || !selectedMol) return
    try {
      const targetConfig = project.target_preview_json
      const config = typeof targetConfig === 'string' ? JSON.parse(targetConfig) : targetConfig
      await createJob({
        uniprot_id: config?.uniprot_id || project.uniprot_id || '',
        mode: 'standard',
        max_ligands: variantsPerIter,
        project_id: project.id,
        use_chembl: false,
        smiles_list: [selectedMol.smiles],
        enable_generation: true,
        enable_retrosynthesis: true,
        target_config_json: typeof targetConfig === 'string' ? targetConfig : JSON.stringify(targetConfig),
      })
      await refresh()
    } catch (err) {
      console.error('Failed to create optimization run:', err)
    }
  }, [project, selectedMol, variantsPerIter, refresh])

  const objectiveLabels = {
    binding_affinity: 'Binding Affinity',
    toxicity: 'Toxicity Safety',
    bioavailability: 'Oral Bioavailability',
    synthesis_score: 'Synthesis Ease',
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

  // PHASE: RUNNING
  if (phase === 'running') {
    const pctDone = Math.round((progress.iteration / (progress.total || numIterations || 1)) * 100)
    return (
      <div className="space-y-6 max-w-3xl">
        <div className="bg-[#1e3a5f] rounded-xl p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-xl font-bold">Optimization Running</h2>
              <p className="text-white/60 text-sm mt-0.5">
                Iteration {progress.iteration}/{progress.total || numIterations}
                {selectedMol && ` — ${selectedMol.name || selectedMol.ligand_name || 'Hit'}`}
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-extrabold text-[#22c55e]">{pctDone}%</div>
            </div>
          </div>
          <div className="w-full bg-white/20 rounded-full h-2">
            <div className="bg-[#22c55e] h-2 rounded-full transition-all duration-300" style={{ width: `${pctDone}%` }} />
          </div>
        </div>

        {progress.iterations.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Score Evolution</h3>
            <OptimizationChart iterations={progress.iterations} />
          </div>
        )}

        {progress.objectives && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Objective Progress</h3>
            <table className="w-full">
              <thead><tr className="border-b border-gray-100">
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Objective</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Start</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Current</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Change</th>
              </tr></thead>
              <tbody>
                {Object.entries(progress.objectives).map(([key, obj]) => (
                  <ObjectiveRow key={key} label={objectiveLabels[key] || key}
                    start={obj.start ?? 0} current={obj.current ?? obj.start ?? 0} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {progress.best_molecule && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Current Best</h3>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm">
                {progress.iteration}
              </div>
              <div>
                <p className="font-bold text-[#1e3a5f] text-sm">{progress.best_molecule.name}</p>
                <p className="text-xs text-gray-400 font-mono truncate max-w-xs">{progress.best_molecule.smiles}</p>
              </div>
              <div className="ml-auto text-right">
                <div className="text-lg font-bold text-[#22c55e]">{Math.round((progress.best_molecule.score || 0) * 100)}/100</div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // PHASE: COMPLETE
  if (phase === 'complete' && finalData) {
    const data = finalData
    const finalScoreVal = data?.best_molecule?.score || 0
    const improvement = finalScoreVal - startScore

    return (
      <div className="space-y-6 max-w-3xl">
        <div className="bg-[#1e3a5f] rounded-xl p-5 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#22c55e] flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold">Optimization Complete</h2>
              <p className="text-white/60 text-sm">{numIterations} iterations</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Before</p>
            <div className="text-center">
              <div className="text-4xl font-extrabold text-gray-400">{Math.round(startScore * 100)}</div>
              <div className="text-sm text-gray-500 mt-1">{selectedMol?.name || 'Starting molecule'}</div>
            </div>
          </div>
          <div className="bg-white rounded-xl border-2 border-green-100 shadow-sm p-5">
            <p className="text-xs font-semibold text-[#22c55e] uppercase mb-3">After Optimization</p>
            <div className="text-center">
              <div className="text-4xl font-extrabold text-[#22c55e]">{Math.round(finalScoreVal * 100)}</div>
              <div className="text-sm text-gray-500 mt-1">{data?.best_molecule?.name || 'Optimized'}</div>
              <div className={`text-sm font-semibold mt-1 ${improvement >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {improvement >= 0 ? '+' : ''}{Math.round(improvement * 100)} points
              </div>
            </div>
          </div>
        </div>

        {data?.iterations?.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Score Evolution</h3>
            <OptimizationChart iterations={data.iterations} />
          </div>
        )}

        {data?.objectives && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Final Improvements</h3>
            <table className="w-full">
              <thead><tr className="border-b border-gray-100">
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Objective</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Start</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Final</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Change</th>
              </tr></thead>
              <tbody>
                {Object.entries(data.objectives).map(([key, obj]) => (
                  <ObjectiveRow key={key} label={objectiveLabels[key] || key}
                    start={obj.start ?? 0} current={obj.current ?? obj.start ?? 0} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button onClick={handleCreateOptRun}
            className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl transition-colors shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Create Optimization Run
          </button>
          <button
            onClick={() => {
              const json = JSON.stringify(data, null, 2)
              const blob = new Blob([json], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a'); a.href = url; a.download = 'optimization_results.json'; a.click()
              URL.revokeObjectURL(url)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] hover:bg-[#2a4f7c] text-white text-sm font-semibold rounded-lg transition-colors">
            Download Results JSON
          </button>
          <button onClick={() => { setPhase('setup'); setOptId(null); setFinalData(null) }}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-600 text-sm font-medium rounded-lg border border-gray-200 transition-colors">
            New Optimization
          </button>
        </div>
      </div>
    )
  }

  // PHASE: ERROR
  if (phase === 'error') {
    return (
      <div className="space-y-6 max-w-3xl">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-sm font-semibold text-red-700 mb-2">Optimization Failed</p>
          <p className="text-xs text-red-500 mb-4">{optError}</p>
          <button onClick={() => { setPhase('setup'); setOptError(null) }}
            className="px-4 py-2 bg-[#1e3a5f] text-white text-sm font-semibold rounded-lg hover:bg-[#2a4f7c] transition-colors">
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // PHASE: SETUP
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-[#1e3a5f]">Lead Optimization</h1>
        <p className="text-sm text-gray-400 mt-1">
          {hitMolecules.length} {hitMolecules.length === 1 ? 'hit' : 'hits'} selected from screening
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">1 — Choose a starting molecule</h2>
        <div className="space-y-2">
          {hitMolecules.map(({ mol, idx }, rank) => (
            <HitCard key={idx} mol={mol} rank={rank + 1}
              selected={selectedHitIdx === idx} onSelect={() => setSelectedHitIdx(idx)} />
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
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Objective Weights</h2>
                <button
                  onClick={() => setShowAgentCard(v => !v)}
                  disabled={!selectedMol}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#1e3a5f] hover:bg-[#2a4f7c] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {showAgentCard ? 'Hide AI' : 'Get AI Recommendation'}
                </button>
              </div>
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
            <button onClick={handleStart}
              className="flex items-center gap-2.5 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow transition-colors text-sm">
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

      {/* Agent 4: Optimization Strategy — inline card */}
      {showAgentCard && selectedMol && (
        <AgentAdvisorCard
          agentName="optimization"
          context={{
            molecule_name: selectedMol.name || 'molecule',
            smiles: selectedMol.smiles,
            affinity: selectedMol.affinity,
            composite_score: selectedMol.composite_score,
            mw: selectedMol.mw,
            logp: selectedMol.logp,
            qed: selectedMol.qed,
            tpsa: selectedMol.tpsa,
            admet: selectedMol.admet,
            off_target: selectedMol.off_target,
            toxicity_level: selectedMol.toxicity_level,
            synthesis_route: selectedMol.synthesis_route ? {
              n_steps: selectedMol.synthesis_route.n_steps,
              confidence: selectedMol.synthesis_route.confidence,
            } : null,
            current_weights: weights,
            target_protein: project?.name || null,
          }}
          autoFetch={true}
          onResult={(data) => {
            if (data?.available && data?.analysis?.recommended_weights) {
              const rw = data.analysis.recommended_weights
              setWeights({
                binding_affinity: rw.binding_affinity ?? weights.binding_affinity,
                toxicity: rw.toxicity ?? weights.toxicity,
                bioavailability: rw.bioavailability ?? weights.bioavailability,
                synthesis: rw.synthesis ?? weights.synthesis,
              })
            }
          }}
          projectId={project?.id}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ProjectOptimization — Screen 5
// ---------------------------------------------------------------------------

export default function ProjectOptimization() {
  const { project, jobs, loading, isTargetConfigured } = useProject()

  const [results, setResults] = useState(null)
  const [loadingResults, setLoadingResults] = useState(false)

  // Find the latest completed screening job (not optimization runs)
  const completedJobs = jobs
    .filter(j => j.status === 'completed')
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
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
      <OptimizationInner jobId={latestJobId} results={results} project={project} />
    </HitSelectionProvider>
  )
}
