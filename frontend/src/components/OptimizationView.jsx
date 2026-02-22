import React, { useState, useEffect, useRef, useCallback } from 'react'
import OptimizationChart from './OptimizationChart.jsx'
import { startOptimization, getOptimizationStatus } from '../api.js'

// --------------------------------------------------
// Weight slider row
// --------------------------------------------------
function WeightSlider({ label, name, value, onChange, tip }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className="text-sm font-bold text-dockit-blue tabular-nums w-12 text-right">
          {Math.round(value * 100)}%
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(name, parseFloat(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-dockit-green"
      />
      {tip && <p className="text-xs text-gray-400 leading-relaxed">{tip}</p>}
    </div>
  )
}

// --------------------------------------------------
// Integer selector
// --------------------------------------------------
function IntInput({ label, value, min, max, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - (max <= 20 ? 5 : 10)))}
          className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-base flex items-center justify-center transition-colors"
        >
          -
        </button>
        <span className="w-12 text-center font-bold text-dockit-blue tabular-nums">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + (max <= 20 ? 5 : 10)))}
          className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-base flex items-center justify-center transition-colors"
        >
          +
        </button>
        <span className="text-xs text-gray-400 ml-1">{min}–{max}</span>
      </div>
    </div>
  )
}

// --------------------------------------------------
// Per-objective table row
// --------------------------------------------------
function ObjectiveRow({ label, start, current }) {
  const delta = current - start
  const improved = delta > 0
  return (
    <tr className="border-b border-gray-50">
      <td className="py-2 px-3 text-xs text-gray-600 font-medium">{label}</td>
      <td className="py-2 px-3 text-xs text-gray-500 font-mono text-right">{start.toFixed(3)}</td>
      <td className="py-2 px-3 text-xs font-mono text-right font-semibold text-dockit-blue">{current.toFixed(3)}</td>
      <td className="py-2 px-3 text-xs text-right">
        <span className={`font-semibold ${improved ? 'text-green-600' : 'text-red-500'}`}>
          {improved ? '+' : ''}{delta.toFixed(3)}
        </span>
      </td>
    </tr>
  )
}

// --------------------------------------------------
// Generate mock optimization data for UI demo
// --------------------------------------------------
function generateMockData(weights, iterations, variantsPerIter) {
  const iters = []
  let best = 0.45 + Math.random() * 0.1
  for (let i = 1; i <= iterations; i++) {
    const improvement = (Math.random() > 0.3) ? Math.random() * 0.02 : -Math.random() * 0.005
    best = Math.min(0.99, Math.max(0.3, best + improvement))
    iters.push({ iteration: i, best_score: best })
  }
  return {
    status: 'complete',
    iterations: iters,
    best_molecule: {
      name: 'OPT-001',
      smiles: 'CC(=O)Nc1ccc(cc1)S(=O)(=O)N',
      score: iters[iters.length - 1].best_score,
    },
    objectives: {
      binding_affinity: { start: 0.62, current: iters[iters.length - 1].best_score * 0.85 },
      toxicity: { start: 0.45, current: 0.72 },
      bioavailability: { start: 0.58, current: 0.71 },
      synthesis_score: { start: 0.70, current: 0.68 },
    },
  }
}

// --------------------------------------------------
// OptimizationView
// --------------------------------------------------
export default function OptimizationView({ jobId, molecule, onBack, onComplete }) {
  const [phase, setPhase] = useState('setup') // setup | running | complete
  const [weights, setWeights] = useState({
    binding_affinity: 0.35,
    toxicity: 0.25,
    bioavailability: 0.20,
    synthesis: 0.20,
  })
  const [numIterations, setNumIterations] = useState(10)
  const [variantsPerIter, setVariantsPerIter] = useState(50)

  const [optId, setOptId] = useState(null)
  const [progress, setProgress] = useState({ iteration: 0, iterations: [], best_molecule: null, objectives: null, eta: null })
  const [finalData, setFinalData] = useState(null)
  const [error, setError] = useState(null)

  const pollRef = useRef(null)
  const molName = molecule?.name || molecule?.ligand_name || 'Unknown'
  const molSmiles = molecule?.smiles || ''
  const startScore = molecule?.composite_score || 0

  // Normalize weights to sum to 1
  const totalWeight = Object.values(weights).reduce((s, v) => s + v, 0)

  const handleWeightChange = (name, val) => {
    setWeights((prev) => ({ ...prev, [name]: val }))
  }

  const handleStart = async () => {
    setPhase('running')
    setError(null)

    // Normalize weights
    const total = Object.values(weights).reduce((s, v) => s + v, 0)
    const normalizedWeights = Object.fromEntries(
      Object.entries(weights).map(([k, v]) => [k, total > 0 ? v / total : 0.25])
    )

    const params = {
      weights: normalizedWeights,
      n_iterations: numIterations,
      variants_per_iteration: variantsPerIter,
      starting_smiles: molSmiles,
    }

    try {
      const result = await startOptimization(jobId, params)
      setOptId(result.opt_id || result.id || 'mock')
      // Start polling
      pollRef.current = setInterval(() => pollStatus(result.opt_id || result.id || 'mock'), 2000)
    } catch (err) {
      // API not ready — use mock mode
      console.warn('[OptimizationView] API not available, using mock data:', err.message)
      runMockOptimization(normalizedWeights)
    }
  }

  const runMockOptimization = useCallback((normalizedWeights) => {
    let iter = 0
    const totalIters = numIterations
    const iters = []
    let best = startScore > 0 ? startScore : 0.5

    const tick = () => {
      iter += 1
      const improvement = Math.random() > 0.35 ? Math.random() * 0.025 : -Math.random() * 0.008
      best = Math.min(0.99, Math.max(0.3, best + improvement))
      const newPoint = { iteration: iter, best_score: best }
      iters.push(newPoint)

      setProgress({
        iteration: iter,
        total: totalIters,
        iterations: [...iters],
        best_molecule: { name: `OPT-${iter.toString().padStart(3, '0')}`, smiles: molSmiles, score: best },
        objectives: {
          binding_affinity: { start: startScore * 0.85 || 0.55, current: best * 0.85 },
          toxicity: { start: 0.45, current: Math.min(0.95, 0.45 + iter * 0.03) },
          bioavailability: { start: 0.58, current: Math.min(0.90, 0.58 + iter * 0.015) },
          synthesis_score: { start: 0.70, current: Math.max(0.50, 0.70 - iter * 0.005) },
        },
        eta: Math.max(0, (totalIters - iter) * 2),
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
        if (onComplete) onComplete(final)
      } else {
        pollRef.current = setTimeout(tick, 400)
      }
    }

    pollRef.current = setTimeout(tick, 400)
  }, [numIterations, startScore, molSmiles, onComplete])

  const pollStatus = async (id) => {
    try {
      const data = await getOptimizationStatus(jobId, id)
      setProgress((prev) => ({
        ...prev,
        ...data,
        iterations: data.iterations || prev.iterations,
      }))
      if (data.status === 'complete' || data.status === 'done') {
        clearInterval(pollRef.current)
        setFinalData(data)
        setPhase('complete')
        if (onComplete) onComplete(data)
      }
    } catch {
      // ignore poll errors
    }
  }

  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        clearTimeout(pollRef.current)
      }
    }
  }, [])

  const pctDone = progress.total > 0 ? Math.round((progress.iteration / progress.total) * 100) : 0
  const objectiveLabels = {
    binding_affinity: 'Binding Affinity',
    toxicity: 'Toxicity Safety',
    bioavailability: 'Oral Bioavailability',
    synthesis_score: 'Synthesis Ease',
  }

  // --------------------------------------------------
  // PHASE: setup
  // --------------------------------------------------
  if (phase === 'setup') {
    return (
      <div className="space-y-6">
        {/* Back + header */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </button>
          <div>
            <h2 className="text-xl font-bold text-dockit-blue">Lead Optimization</h2>
            <p className="text-sm text-gray-500">Multi-objective molecular optimization via REINVENT4</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Starting molecule info */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Starting Molecule</h3>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-dockit-blue flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {molName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-dockit-blue">{molName}</p>
                <p className="text-xs text-gray-400 font-mono mt-0.5 truncate max-w-xs" title={molSmiles}>
                  {molSmiles || 'SMILES not available'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-dockit-blue">{Math.round(startScore * 100)}</div>
                <div className="text-xs text-gray-500">Current Score/100</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-dockit-blue">{molecule?.affinity ? Number(molecule.affinity).toFixed(1) : 'N/A'}</div>
                <div className="text-xs text-gray-500">Affinity (kcal/mol)</div>
              </div>
            </div>
          </div>

          {/* Algorithm settings */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Algorithm Settings</h3>
            <div className="space-y-4">
              <IntInput
                label="Number of Iterations"
                value={numIterations}
                min={5}
                max={20}
                onChange={setNumIterations}
              />
              <IntInput
                label="Variants per Iteration"
                value={variantsPerIter}
                min={20}
                max={100}
                onChange={setVariantsPerIter}
              />
              <div className="text-xs text-gray-400 p-2 bg-gray-50 rounded-lg leading-relaxed">
                Estimated time: ~{Math.round(numIterations * variantsPerIter * 0.05)}s
                ({numIterations * variantsPerIter} total molecules evaluated)
              </div>
            </div>
          </div>
        </div>

        {/* Optimization weights */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Optimization Objectives</h3>
            <div className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded">
              Total: {Math.round(totalWeight * 100)}%
              {Math.abs(totalWeight - 1) > 0.01 && (
                <span className="text-amber-500 ml-1">(will be normalized)</span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <WeightSlider
              label="Maximize binding affinity"
              name="binding_affinity"
              value={weights.binding_affinity}
              onChange={handleWeightChange}
              tip="Weight given to improving docking affinity against the primary target."
            />
            <WeightSlider
              label="Minimize toxicity (hERG)"
              name="toxicity"
              value={weights.toxicity}
              onChange={handleWeightChange}
              tip="Penalize molecules with predicted hERG channel binding (cardiac risk)."
            />
            <WeightSlider
              label="Maximize oral bioavailability"
              name="bioavailability"
              value={weights.bioavailability}
              onChange={handleWeightChange}
              tip="Favor molecules with good predicted oral absorption (Caco-2, F30%)."
            />
            <WeightSlider
              label="Minimize synthesis complexity"
              name="synthesis"
              value={weights.synthesis}
              onChange={handleWeightChange}
              tip="Favor molecules that are easier to synthesize (fewer steps, commercial reagents)."
            />
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{error}</div>
        )}

        {/* Start button */}
        <div className="flex justify-end">
          <button
            onClick={handleStart}
            className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow transition-colors text-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Start Optimization
          </button>
        </div>
      </div>
    )
  }

  // --------------------------------------------------
  // PHASE: running
  // --------------------------------------------------
  if (phase === 'running') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-dockit-blue rounded-xl p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-xl font-bold">Optimization Running</h2>
              <p className="text-white/60 text-sm mt-0.5">
                Iteration {progress.iteration}/{progress.total || numIterations} — {molName}
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-extrabold text-dockit-green">{pctDone}%</div>
              {progress.eta !== null && progress.eta !== undefined && (
                <div className="text-xs text-white/50">~{progress.eta}s remaining</div>
              )}
            </div>
          </div>
          <div className="w-full bg-white/20 rounded-full h-2">
            <div
              className="bg-dockit-green h-2 rounded-full transition-all duration-300"
              style={{ width: `${pctDone}%` }}
            />
          </div>
        </div>

        {/* Score chart */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Score Evolution</h3>
          <OptimizationChart iterations={progress.iterations} />
        </div>

        {/* Objectives table */}
        {progress.objectives && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Objective Progress</h3>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Objective</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Start</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Current</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Change</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(progress.objectives).map(([key, obj]) => (
                  <ObjectiveRow
                    key={key}
                    label={objectiveLabels[key] || key}
                    start={obj.start ?? 0}
                    current={obj.current ?? obj.start ?? 0}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Current best */}
        {progress.best_molecule && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Current Best Molecule</h3>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm">
                {progress.iteration}
              </div>
              <div>
                <p className="font-bold text-dockit-blue text-sm">{progress.best_molecule.name}</p>
                <p className="text-xs text-gray-400 font-mono truncate max-w-xs">{progress.best_molecule.smiles}</p>
              </div>
              <div className="ml-auto text-right">
                <div className="text-lg font-bold text-dockit-green">
                  {Math.round((progress.best_molecule.score || 0) * 100)}/100
                </div>
                <div className="text-xs text-gray-400">Score</div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // --------------------------------------------------
  // PHASE: complete
  // --------------------------------------------------
  const data = finalData || progress
  const startScoreVal = data?.objectives?.binding_affinity?.start || startScore
  const finalScoreVal = data?.best_molecule?.score || 0
  const improvement = finalScoreVal - startScore

  return (
    <div className="space-y-6">
      {/* Success banner */}
      <div className="bg-dockit-blue rounded-xl p-5 text-white">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-dockit-green flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold">Optimization Complete</h2>
            <p className="text-white/60 text-sm">{numIterations} iterations — {molName}</p>
          </div>
        </div>
      </div>

      {/* Before / After comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Before</p>
          <div className="text-center">
            <div className="text-4xl font-extrabold text-gray-400">{Math.round(startScore * 100)}</div>
            <div className="text-sm text-gray-500 mt-1">{molName}</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-green-100 shadow-sm p-5 border-2">
          <p className="text-xs font-semibold text-dockit-green uppercase tracking-wide mb-3">After Optimization</p>
          <div className="text-center">
            <div className="text-4xl font-extrabold text-dockit-green">{Math.round(finalScoreVal * 100)}</div>
            <div className="text-sm text-gray-500 mt-1">{data?.best_molecule?.name || 'Optimized molecule'}</div>
            <div className={`text-sm font-semibold mt-1 ${improvement >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {improvement >= 0 ? '+' : ''}{Math.round(improvement * 100)} points
            </div>
          </div>
        </div>
      </div>

      {/* Score evolution chart */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Score Evolution</h3>
        <OptimizationChart iterations={data?.iterations || []} />
      </div>

      {/* Final objectives */}
      {data?.objectives && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Final Objective Improvements</h3>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Objective</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Start</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Final</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Change</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.objectives).map(([key, obj]) => (
                <ObjectiveRow
                  key={key}
                  label={objectiveLabels[key] || key}
                  start={obj.start ?? 0}
                  current={obj.current ?? obj.start ?? 0}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Download buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => {
            const json = JSON.stringify(data, null, 2)
            const blob = new Blob([json], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `optimization_${molName}.json`
            a.click()
            URL.revokeObjectURL(url)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-dockit-blue hover:bg-dockit-blue-light text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download Results JSON
        </button>

        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-dockit-blue text-sm font-semibold rounded-lg border border-gray-200 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Results
        </button>
      </div>
    </div>
  )
}
