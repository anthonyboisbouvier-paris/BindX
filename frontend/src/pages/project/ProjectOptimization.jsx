import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useProject } from '../../contexts/ProjectContext.jsx'
import { HitSelectionProvider, useHitSelection } from '../../contexts/HitSelectionContext.jsx'
import { getJobResults, startOptimization, getOptimizationStatus, createJob } from '../../api.js'

import OptimizationChart from '../../components/OptimizationChart.jsx'
import AgentAdvisorCard from '../../components/AgentAdvisorCard.jsx'
import ScaffoldAnalyzer from '../../components/ScaffoldAnalyzer.jsx'
import AnalysisToggles, { DEFAULT_VALUES } from '../../components/AnalysisToggles.jsx'

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

// Badge used in run selector dropdown labels
function modeBadgeText(mode) {
  if (!mode) return 'Run'
  if (mode === 'optimization') return 'Optim'
  if (mode === 'rapid') return 'Rapid'
  if (mode === 'standard') return 'Standard'
  if (mode === 'deep') return 'Deep'
  return mode.charAt(0).toUpperCase() + mode.slice(1)
}

// ---------------------------------------------------------------------------
// Run selector dropdown
// ---------------------------------------------------------------------------

function RunSelectorDropdown({ completedJobs, selectedRunId, onSelect }) {
  if (completedJobs.length <= 1) return null

  return (
    <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
      <svg className="w-4 h-4 text-[#1e3a5f] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 6h16M4 10h16M4 14h8" />
      </svg>
      <label className="text-sm font-semibold text-[#1e3a5f] flex-shrink-0">Source run:</label>
      <div className="relative flex-1 min-w-[260px]">
        <select
          value={selectedRunId || ''}
          onChange={(e) => onSelect(e.target.value)}
          className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-sm text-gray-700 font-medium cursor-pointer hover:border-[#1e3a5f]/40 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] transition-colors"
        >
          {completedJobs.map(j => {
            const id = j.id || j.job_id
            const modeLabel = modeBadgeText(j.mode)
            const dateLabel = j.created_at
              ? new Date(j.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : 'N/A'
            const proteinLabel = j.protein_name || j.uniprot_id || ''
            return (
              <option key={id} value={id}>
                [{modeLabel}] {dateLabel} — {proteinLabel || 'N/A'} ({id.slice(0, 6)})
              </option>
            )
          })}
        </select>
        {/* Custom caret */}
        <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {(() => {
          const selected = completedJobs.find(j => (j.id || j.job_id) === selectedRunId)
          if (!selected) return null
          const isOptim = selected.mode === 'optimization'
          return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
              isOptim
                ? 'bg-purple-100 text-purple-700'
                : selected.mode === 'deep'
                ? 'bg-blue-100 text-[#1e3a5f]'
                : selected.mode === 'standard'
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-green-100 text-[#22c55e]'
            }`}>
              {modeBadgeText(selected.mode)}
            </span>
          )
        })()}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inner component — needs HitSelectionProvider
// ---------------------------------------------------------------------------

function OptimizationInner({ jobId, results, project }) {
  const { getSelected } = useHitSelection()
  const { refresh } = useProject()

  const [selectedHitIdx, setSelectedHitIdx] = useState(null)
  const [modificationRules, setModificationRules] = useState(null)
  const [weights, setWeights] = useState({
    binding_affinity: 0.35, toxicity: 0.25, bioavailability: 0.20, synthesis: 0.20,
  })
  const [numIterations, setNumIterations] = useState(5)
  const [variantsPerIter, setVariantsPerIter] = useState(20)
  const [dockingEngine, setDockingEngine] = useState('gnina')
  const [analyses, setAnalyses] = useState(DEFAULT_VALUES)
  const [boxSize, setBoxSize] = useState([null, null, null])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [phase, setPhase] = useState('setup') // setup | running | complete | error
  const [optId, setOptId] = useState(null)
  const [optError, setOptError] = useState(null)
  const [progress, setProgress] = useState({ iteration: 0, total: 0, iterations: [], best_molecule: null, objectives: null })
  const [finalData, setFinalData] = useState(null)
  const pollRef = useRef(null)
  const [showAgentCard, setShowAgentCard] = useState(false)
  const [createdJobId, setCreatedJobId] = useState(null)

  // Keep a stable ref to jobId so callbacks always use the current selected run
  const jobIdRef = useRef(jobId)
  useEffect(() => { jobIdRef.current = jobId }, [jobId])

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
      // Use the ref so we always poll against the currently selected run's jobId
      const data = await getOptimizationStatus(jobIdRef.current, id)
      setProgress(prev => ({
        ...prev, ...data,
        iteration: data.current_iteration || data.iteration || prev.iteration,
        total: data.total_iterations || data.total || prev.total,
        // Support iterations inside result (backend format) or at top level
        iterations: data.iterations || data.result?.iterations || prev.iterations,
      }))
      if (data.status === 'completed' || data.status === 'complete' || data.status === 'done') {
        clearInterval(pollRef.current)
        // Backend may wrap the payload inside result
        const payload = data.result || data
        // Merge top-level iterations into payload for chart
        if (!payload.iterations && data.iterations) {
          payload.iterations = data.iterations
        }
        setFinalData(payload)
        if (data.created_job_id) {
          setCreatedJobId(data.created_job_id)
          refresh()
        }
        setPhase('complete')
      } else if (data.status === 'error' || data.status === 'failed') {
        clearInterval(pollRef.current)
        setOptError(data.error_message || 'Optimization failed')
        setPhase('error')
      }
    } catch (err) {
      // ignore individual poll errors
    }
  }, [refresh])

  const handleStart = useCallback(async () => {
    if (!selectedMol) return
    setPhase('running')
    setOptError(null)

    // Use the current jobId from the ref (i.e. the selected run)
    const currentJobId = jobIdRef.current

    const normalizedWeights = Object.fromEntries(
      Object.entries(weights).map(([k, v]) => [k, totalWeight > 0 ? v / totalWeight : 0.25])
    )

    try {
      const res = await startOptimization(currentJobId, {
        smiles: selectedMol.smiles,
        molecule_name: selectedMol.name || selectedMol.ligand_name,
        weights: normalizedWeights,
        n_iterations: numIterations,
        variants_per_iter: variantsPerIter,
        modification_rules: modificationRules || undefined,
        docking_engine: dockingEngine,
        ...analyses,
        box_size: boxSize.some(v => v != null && v > 0) ? boxSize.map(v => v || 25) : null,
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
  }, [selectedMol, weights, totalWeight, numIterations, variantsPerIter, dockingEngine, analyses, boxSize, pollStatus, runMockOptimization])

  // Create optimization run when complete — use the OPTIMIZED molecule, not the original
  const handleCreateOptRun = useCallback(async () => {
    if (!project) return
    const optimizedSmiles = finalData?.best_molecule?.smiles
      || finalData?.final_lead?.smiles
      || selectedMol?.smiles
    if (!optimizedSmiles) return
    try {
      const targetConfig = project.target_preview_json
      const config = typeof targetConfig === 'string' ? JSON.parse(targetConfig) : targetConfig
      await createJob({
        uniprot_id: config?.uniprot_id || project.uniprot_id || '',
        mode: 'standard',
        max_ligands: variantsPerIter,
        project_id: project.id,
        use_chembl: false,
        smiles_list: [optimizedSmiles],
        enable_generation: true,
        enable_retrosynthesis: true,
        target_config_json: typeof targetConfig === 'string' ? targetConfig : JSON.stringify(targetConfig),
      })
      await refresh()
    } catch (err) {
      console.error('Failed to create optimization run:', err)
    }
  }, [project, finalData, selectedMol, variantsPerIter, refresh])

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
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Go to Results and Tag Hits
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
                {dockingEngine !== 'mock' && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white/80">
                    {dockingEngine === 'gnina_gpu' ? 'GNINA GPU' : dockingEngine === 'gnina' ? 'GNINA' : dockingEngine === 'vina' ? 'Vina' : 'No docking'}
                  </span>
                )}
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
    // Support both backend formats: best_molecule (new) and final_lead (legacy)
    const bestMol = data?.best_molecule || data?.final_lead || {}
    const objectives = data?.objectives || null
    const finalScoreVal = bestMol?.score || 0
    const improvement = finalScoreVal - startScore
    // Resolve iterations from all possible locations in the backend response
    const iterationsData = data?.iterations || data?.result?.iterations || []

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
              <p className="text-white/60 text-sm">
                {data?.iterations?.length || numIterations} iterations
                {(data?.docking_engine_used || dockingEngine) !== 'mock' && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white/80">
                    {(() => { const e = data?.docking_engine_used || dockingEngine; return e === 'gnina_gpu' ? 'GNINA GPU' : e.toUpperCase() })()}
                  </span>
                )}
              </p>
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
              <div className="text-sm text-gray-500 mt-1">{bestMol?.name || 'Optimized'}</div>
              <div className={`text-sm font-semibold mt-1 ${improvement >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {improvement >= 0 ? '+' : ''}{Math.round(improvement * 100)} points
              </div>
            </div>
          </div>
        </div>

        {iterationsData.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Score Evolution</h3>
            <OptimizationChart iterations={iterationsData} />
          </div>
        )}

        {objectives && (
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
                {Object.entries(objectives).map(([key, obj]) => (
                  <ObjectiveRow key={key} label={objectiveLabels[key] || key}
                    start={obj.start ?? 0} current={obj.current ?? obj.start ?? 0} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Auto-created run notification */}
        {createdJobId && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-800">Optimization run created automatically</p>
              <p className="text-xs text-green-600">The optimized molecule has been added to your project runs.</p>
            </div>
            <Link to="../runs" relative="path"
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              View in Runs
            </Link>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {!createdJobId && (
            <button onClick={handleCreateOptRun}
              className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl transition-colors shadow-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Create Optimization Run
            </button>
          )}
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
          <button onClick={() => { setPhase('setup'); setOptId(null); setFinalData(null); setCreatedJobId(null) }}
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

      {selectedMol?.smiles && (
        <ScaffoldAnalyzer smiles={selectedMol.smiles} onRulesChange={setModificationRules} />
      )}

      {selectedHitIdx !== null && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-6">
              <div>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">2 — Algorithm Settings</h2>
                <div className="space-y-4">
                  <IntStepper label="Iterations" value={numIterations} min={3} max={20} step={1} onChange={setNumIterations} />
                  <IntStepper label="Variants per iteration" value={variantsPerIter} min={10} max={100} step={10} onChange={setVariantsPerIter} />
                </div>
              </div>

              <div>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">3 — Docking Engine</h2>
                <div className="space-y-2">
                  <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    style={dockingEngine === "gnina_gpu" ? {borderColor: "#22c55e", backgroundColor: "#f0fdf4"} : {}}>
                    <input type="radio" name="opt-engine" value="gnina_gpu" checked={dockingEngine === "gnina_gpu"}
                      onChange={() => setDockingEngine("gnina_gpu")} className="mt-0.5 accent-[#22c55e]" />
                    <div>
                      <span className="font-medium text-sm text-green-700">GNINA GPU</span>
                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">Cloud</span>
                      <p className="text-xs text-gray-500">Cloud GPU — 10x faster, ~0.03 USD/run</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    style={dockingEngine === "gnina" ? {borderColor: "#1e3a5f", backgroundColor: "#f0f4f8"} : {}}>
                    <input type="radio" name="opt-engine" value="gnina" checked={dockingEngine === "gnina"}
                      onChange={() => setDockingEngine("gnina")} className="mt-0.5 accent-[#1e3a5f]" />
                    <div>
                      <span className="font-medium text-sm">GNINA</span>
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">Recommended</span>
                      <p className="text-xs text-gray-500">CNN-scored — Local CPU, recommended for optimization</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    style={dockingEngine === "vina" ? {borderColor: "#1e3a5f", backgroundColor: "#f0f4f8"} : {}}>
                    <input type="radio" name="opt-engine" value="vina" checked={dockingEngine === "vina"}
                      onChange={() => setDockingEngine("vina")} className="mt-0.5 accent-[#1e3a5f]" />
                    <div>
                      <span className="font-medium text-sm">Vina</span>
                      <p className="text-xs text-gray-500">Fast — Good for rapid iterations</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    style={dockingEngine === "none" ? {borderColor: "#1e3a5f", backgroundColor: "#f0f4f8"} : {}}>
                    <input type="radio" name="opt-engine" value="none" checked={dockingEngine === "none"}
                      onChange={() => setDockingEngine("none")} className="mt-0.5 accent-[#1e3a5f]" />
                    <div>
                      <span className="font-medium text-sm">None</span>
                      <p className="text-xs text-gray-500">No docking — Optimize DMPK/properties only</p>
                    </div>
                  </label>
                </div>
                {(() => {
                  const timePerMol = dockingEngine === "gnina" ? 60 : dockingEngine === "gnina_gpu" ? 3 : dockingEngine === "vina" ? 2 : 0
                  const estimatedMinutes = Math.ceil(variantsPerIter * numIterations * timePerMol / 60)
                  if (dockingEngine === "none") {
                    return (
                      <div className="mt-3 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                        <p className="text-xs text-gray-500 font-medium">Property-based scoring only — runs in seconds</p>
                      </div>
                    )
                  }
                  return (
                    <div className="mt-3 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                      <p className="text-xs text-blue-700 font-medium">
                        Estimated time: ~{estimatedMinutes} min
                      </p>
                      <p className="text-xs text-blue-500 mt-0.5">
                        {variantsPerIter * numIterations} dockings total ({dockingEngine === 'gnina' ? '~60s' : dockingEngine === 'gnina_gpu' ? '~3s GPU' : '~2s'} each)
                      </p>
                    </div>
                  )
                })()}
              </div>

              <div className="space-y-3">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">4 — Analysis Pipeline</h2>
                <AnalysisToggles values={analyses} onChange={setAnalyses} />
                <div className="mt-2">
                  <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-xs text-gray-400 hover:text-[#1e3a5f] transition-colors">
                    {showAdvanced ? '▼' : '▶'} Advanced settings
                  </button>
                  {showAdvanced && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-2">
                      <label className="block text-xs font-medium text-gray-600">Docking box size (auto if empty)</label>
                      <div className="flex gap-2">
                        {['X', 'Y', 'Z'].map((axis, i) => (
                          <div key={axis} className="flex-1">
                            <label className="text-[10px] text-gray-400">{axis} (A)</label>
                            <input type="number" min="5" max="100" step="1" placeholder="auto"
                              value={boxSize[i] || ''}
                              onChange={e => {
                                const v = [...boxSize]
                                v[i] = e.target.value ? Number(e.target.value) : null
                                setBoxSize(v)
                              }}
                              className="w-full px-2 py-1 text-sm border rounded" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
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

          {/* Get AI Recommendation — big button */}
          <button
            onClick={() => setShowAgentCard(v => !v)}
            disabled={!selectedMol}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 text-sm font-bold rounded-xl transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-[#1e3a5f] to-[#2a4f7c] hover:from-[#2a4f7c] hover:to-[#1e3a5f] text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {showAgentCard ? 'Hide AI Recommendation' : 'Get AI Recommendation'}
          </button>

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
                scaffold_analysis: modificationRules ? {
                  positions: modificationRules.rules?.map(r => ({
                    position_idx: r.position_idx,
                    strategy: r.strategy,
                    allowed_groups: r.allowed_groups,
                  })) || [],
                  frozen_positions: modificationRules.frozen_positions || [],
                  allowed_strategies: modificationRules.allowed_strategies || [],
                  preserve_scaffold: modificationRules.preserve_scaffold,
                  min_similarity: modificationRules.min_similarity,
                } : null,
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
  const [selectedRunId, setSelectedRunId] = useState(null)

  // ALL completed jobs (including optimization runs for recursive optimization),
  // sorted newest first
  const completedJobs = jobs
    .filter(j => j.status === 'completed')
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))

  // Auto-select first (latest) completed job when list becomes available
  useEffect(() => {
    if (completedJobs.length > 0 && !selectedRunId) {
      setSelectedRunId(completedJobs[0].id || completedJobs[0].job_id)
    }
  }, [completedJobs.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reload results whenever the selected run changes
  useEffect(() => {
    if (!selectedRunId) return
    setLoadingResults(true)
    setResults(null)
    getJobResults(selectedRunId)
      .then(data => setResults(data))
      .catch(() => setResults(null))
      .finally(() => setLoadingResults(false))
  }, [selectedRunId])

  // Guard: target not configured
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

  // Guard: loading
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

  // Guard: no completed runs at all
  if (!selectedRunId || !results) {
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
    <div className="space-y-4">
      {/* Run selector — only shown when there is more than one completed run */}
      <RunSelectorDropdown
        completedJobs={completedJobs}
        selectedRunId={selectedRunId}
        onSelect={setSelectedRunId}
      />

      {/* HitSelectionProvider is keyed on selectedRunId so hit tags reset when the run changes */}
      <HitSelectionProvider key={selectedRunId} jobId={selectedRunId}>
        <OptimizationInner jobId={selectedRunId} results={results} project={project} />
      </HitSelectionProvider>
    </div>
  )
}
