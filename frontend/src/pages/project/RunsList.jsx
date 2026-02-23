import React, { useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useProject } from '../../contexts/ProjectContext.jsx'
import { createJob, getJobStatus } from '../../api.js'
import ProgressBar from '../../components/ProgressBar.jsx'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatusBadge({ status }) {
  const configs = {
    completed: { label: 'Completed', classes: 'bg-green-100 text-green-700 border-green-200' },
    running:   { label: 'Running',   classes: 'bg-blue-100  text-blue-700  border-blue-200' },
    pending:   { label: 'Pending',   classes: 'bg-gray-100  text-gray-600  border-gray-200' },
    failed:    { label: 'Failed',    classes: 'bg-red-100   text-red-700   border-red-200' },
  }
  const cfg = configs[status] || { label: status || 'Unknown', classes: 'bg-gray-100 text-gray-500 border-gray-200' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${cfg.classes}`}>
      {cfg.label}
    </span>
  )
}

function TypeLabel({ mode }) {
  if (mode === 'rapid') return <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">Rapid Screening</span>
  if (mode === 'standard') return <span className="text-xs font-medium text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">Standard + ADMET</span>
  if (mode === 'deep') return <span className="text-xs font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">Deep Screening</span>
  return <span className="text-xs text-gray-400">{mode || '—'}</span>
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

const STRATEGY_OPTIONS = [
  { value: 'rapid',    label: 'Fast',      description: 'Quick HTS screening',      defaultLigands: 50,  maxLigands: 200 },
  { value: 'standard', label: 'Balanced',  description: 'ADMET + AI generation',    defaultLigands: 100, maxLigands: 500 },
  { value: 'deep',     label: 'Precise',   description: '5-pass deep screening',    defaultLigands: 500, maxLigands: 5000 },
]

const ENGINE_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'vina', label: 'Vina' },
  { value: 'gnina', label: 'GNINA' },
]

// Single-source ligand options
const LIGAND_SOURCE_OPTIONS = [
  { value: 'chembl', label: 'ChEMBL', description: 'Known active compounds from ChEMBL database' },
  { value: 'zinc',   label: 'ZINC',   description: 'Drug-like molecules from ZINC20' },
  { value: 'custom', label: 'Custom SMILES', description: 'Your own molecules (paste SMILES below)' },
]

// ---------------------------------------------------------------------------
// RunsList — Screen 3
// ---------------------------------------------------------------------------

export default function RunsList() {
  const { project, jobs, loading, error, isTargetConfigured, targetConfig, refresh } = useProject()
  const navigate = useNavigate()

  // New run form state
  const [showForm, setShowForm] = useState(false)
  const [mode, setMode] = useState('rapid')
  const [maxLigands, setMaxLigands] = useState(50)
  const [ligandSource, setLigandSource] = useState('chembl') // single source: 'chembl' | 'zinc' | 'custom'
  const [customSmiles, setCustomSmiles] = useState('')
  const [engine, setEngine] = useState('auto')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)

  // Active run tracking (inline progress)
  const [activeJobId, setActiveJobId] = useState(null)

  const canCreateRun = !!(project && isTargetConfigured && (targetConfig?.uniprot_id || targetConfig?.sequence))

  const handleCreateRun = useCallback(async () => {
    if (!canCreateRun) return
    setCreating(true)
    setCreateError(null)

    const params = {
      mode,
      max_ligands: maxLigands,
      use_chembl: ligandSource === 'chembl',
      use_zinc: ligandSource === 'zinc',
      project_id: project.id,
      docking_engine: engine === 'auto' ? undefined : engine,
      // Pass target config so backend can skip structure+pockets recomputation
      target_config_json: targetConfig ? JSON.stringify(targetConfig) : undefined,
    }

    // Set uniprot_id or sequence based on target mode
    if (targetConfig?.uniprot_id) {
      params.uniprot_id = targetConfig.uniprot_id
    } else if (targetConfig?.sequence) {
      params.sequence = targetConfig.sequence
    }

    if (ligandSource === 'custom' && customSmiles.trim()) {
      params.smiles_list = customSmiles.split('\n').map(s => s.trim()).filter(Boolean)
    }

    try {
      const res = await createJob(params)
      const jobId = res.job_id || res.id
      setActiveJobId(jobId)
      setShowForm(false)
      // Refresh project to get updated jobs list
      setTimeout(() => refresh(), 1000)
    } catch (err) {
      setCreateError(err?.userMessage || err?.message || 'Failed to create run.')
    } finally {
      setCreating(false)
    }
  }, [canCreateRun, targetConfig, mode, maxLigands, ligandSource, customSmiles, engine, project, refresh])

  const handleRunComplete = useCallback((results) => {
    setActiveJobId(null)
    refresh()
  }, [refresh])

  const handleRunError = useCallback((err) => {
    console.error('[RunsList] Run error:', err)
    setActiveJobId(null)
    refresh()
  }, [refresh])

  // Guard: target not configured
  if (!loading && !isTargetConfigured) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 max-w-sm text-center">
          <svg className="w-12 h-12 text-amber-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" strokeWidth={1.8} />
            <circle cx="12" cy="12" r="5" strokeWidth={1.8} />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" strokeWidth={0} />
          </svg>
          <p className="text-sm font-semibold text-amber-800 mb-2">Target not configured</p>
          <p className="text-xs text-amber-600 mb-4">
            You must configure a target protein before running screenings.
          </p>
          <Link
            to="../target"
            relative="path"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] text-white text-sm font-semibold rounded-lg hover:bg-[#2a4f7c] transition-colors"
          >
            Go to Target Setup
          </Link>
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
          <span className="text-sm">Loading runs...</span>
        </div>
      </div>
    )
  }

  const sortedJobs = [...jobs].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
  const hasChemblData = targetConfig?.chembl_info?.has_data

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1e3a5f]">Runs</h1>
          <p className="text-sm text-gray-400 mt-1">
            {sortedJobs.length} run{sortedJobs.length !== 1 ? 's' : ''} for {targetConfig?.uniprot_id || targetConfig?.protein_name || 'this target'}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#22c55e] hover:bg-[#16a34a] text-white text-sm font-semibold rounded-xl transition-colors shadow-sm whitespace-nowrap"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create New Run
        </button>
      </div>

      {/* Active job progress */}
      {activeJobId && (
        <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-blue-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            </svg>
            <h3 className="text-sm font-semibold text-blue-700">Run in progress</h3>
          </div>
          <ProgressBar jobId={activeJobId} onComplete={handleRunComplete} onError={handleRunError} />
        </div>
      )}

      {/* Create new run form (inline) */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-5">
          <h3 className="text-sm font-semibold text-[#1e3a5f] uppercase tracking-wider">New Screening Run</h3>

          {/* Target (read-only) */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Target</label>
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
              <span className="text-sm font-mono font-semibold text-[#1e3a5f]">
                {targetConfig?.uniprot_id || `Sequence (${targetConfig?.sequence?.length || 0} aa)`}
              </span>
              {targetConfig?.protein_name && (
                <span className="text-xs text-gray-400">{targetConfig.protein_name}</span>
              )}
            </div>
          </div>

          {/* Strategy */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Strategy</label>
            <div className="grid grid-cols-3 gap-2">
              {STRATEGY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setMode(opt.value)
                    setMaxLigands(opt.defaultLigands)
                  }}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    mode === opt.value
                      ? 'border-[#1e3a5f] bg-blue-50/50 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="text-sm font-semibold text-gray-800">{opt.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{opt.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Ligand Source — single selection */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Ligand Source</label>
            <div className="space-y-2">
              {LIGAND_SOURCE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    ligandSource === opt.value
                      ? 'border-[#1e3a5f] bg-blue-50/40'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="ligandSource"
                    value={opt.value}
                    checked={ligandSource === opt.value}
                    onChange={() => setLigandSource(opt.value)}
                    className="mt-0.5 accent-[#1e3a5f]"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {opt.label}
                      {opt.value === 'chembl' && (
                        <span className={`ml-2 text-xs ${hasChemblData ? 'text-green-600' : 'text-gray-400'}`}>
                          {hasChemblData
                            ? `(${targetConfig.chembl_info.n_actives} actives)`
                            : '(no data for this target)'}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400">{opt.description}</p>
                  </div>
                </label>
              ))}
            </div>

            {/* Custom SMILES — only shown when 'custom' selected */}
            {ligandSource === 'custom' && (
              <div className="mt-3">
                <label className="text-xs font-medium text-gray-500">SMILES (one per line)</label>
                <textarea
                  value={customSmiles}
                  onChange={(e) => setCustomSmiles(e.target.value)}
                  rows={3}
                  placeholder={"CC(=O)Oc1ccccc1C(=O)O\nCCCc1nn(C)c(=O)c2[nH]cnc12"}
                  className="w-full mt-1 px-3 py-2 text-xs font-mono border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f] outline-none resize-none"
                />
              </div>
            )}
          </div>

          {/* Max ligands — range adaptatif selon strategy */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Max Ligands: <span className="font-bold text-[#1e3a5f]">{maxLigands}</span>
            </label>
            <input
              type="range"
              min={5}
              max={STRATEGY_OPTIONS.find(o => o.value === mode)?.maxLigands || 200}
              step={mode === 'deep' ? 50 : 5}
              value={maxLigands}
              onChange={(e) => setMaxLigands(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#22c55e]"
            />
            <div className="flex justify-between text-xs text-gray-300 mt-1">
              <span>5</span>
              <span>{STRATEGY_OPTIONS.find(o => o.value === mode)?.maxLigands || 200}</span>
            </div>
          </div>

          {/* Docking engine */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Docking Engine</label>
            <div className="flex gap-2">
              {ENGINE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setEngine(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    engine === opt.value
                      ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {createError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {createError}
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleCreateRun}
              disabled={creating || !canCreateRun || (ligandSource === 'custom' && !customSmiles.trim())}
              className="flex items-center gap-2 px-6 py-3 bg-[#22c55e] hover:bg-[#16a34a] disabled:bg-gray-300 text-white font-bold rounded-xl shadow transition-colors text-sm"
            >
              {creating ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  </svg>
                  Start Screening
                </>
              )}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Runs table */}
      {sortedJobs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Run ID</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Type</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Mode</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Date</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedJobs.map((row) => {
                const rowId = row.id || row.job_id
                return (
                  <tr key={rowId} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="py-3.5 px-4">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-sm font-mono text-gray-700 truncate max-w-[140px] block" title={rowId}>
                        {rowId?.slice(0, 8)}...
                      </span>
                    </td>
                    <td className="py-3.5 px-4 hidden sm:table-cell">
                      <TypeLabel mode={row.mode} />
                    </td>
                    <td className="py-3.5 px-4 hidden md:table-cell">
                      <span className="text-xs text-gray-500 capitalize">{row.mode || '—'}</span>
                    </td>
                    <td className="py-3.5 px-4 hidden lg:table-cell">
                      <span className="text-xs text-gray-400">{formatDate(row.created_at)}</span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {row.status === 'completed' ? (
                        <Link
                          to={`../results?run=${rowId}`}
                          relative="path"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#22c55e] bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                        >
                          Results
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      ) : row.status === 'running' ? (
                        <span className="text-xs text-blue-600 font-medium">
                          {row.progress || 0}%
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">{row.status}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {sortedJobs.length === 0 && !showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-10 text-center">
          <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-sm text-gray-500 font-medium">No runs yet</p>
          <p className="text-xs text-gray-400 mt-1">Create your first screening run.</p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-[#1e3a5f] text-white text-sm font-semibold rounded-lg hover:bg-[#2a4f7c] transition-colors"
          >
            Create New Run
          </button>
        </div>
      )}
    </div>
  )
}
