import React, { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useProject } from '../../contexts/ProjectContext.jsx'
import { HitSelectionProvider, useHitSelection } from '../../contexts/HitSelectionContext.jsx'
import { getJobResults } from '../../api.js'

import ResultsDashboard from '../../components/ResultsDashboard.jsx'
import Viewer3D from '../../components/Viewer3D.jsx'
import ResultsTable from '../../components/ResultsTable.jsx'
import MoleculeCard from '../../components/MoleculeCard.jsx'
import DownloadButtons from '../../components/DownloadButtons.jsx'
import GeneratedMols from '../../components/GeneratedMols.jsx'

// Lazy-load optional components
let ScoringWeights = null
let HitSelector = null
try { ScoringWeights = require('../../components/ScoringWeights.jsx').default } catch {}
try { HitSelector = require('../../components/HitSelector.jsx').default } catch {}

// ---------------------------------------------------------------------------
// Hit selection bar
// ---------------------------------------------------------------------------
function HitSelectionBar({ onSendToOptimization }) {
  const { getTagCount } = useHitSelection()
  const counts = getTagCount()
  const hasHits = counts.hit > 0

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
      <div className="flex items-center gap-5 flex-wrap">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-[#22c55e]">
          <span className="w-2 h-2 rounded-full bg-[#22c55e] inline-block" />
          {counts.hit} {counts.hit === 1 ? 'hit' : 'hits'}
        </span>
        <span className="flex items-center gap-1.5 text-sm font-semibold text-yellow-600">
          <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
          {counts.investigate} investigating
        </span>
        <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-400">
          <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />
          {counts.discard} discarded
        </span>
      </div>
      <Link
        to="../optimization"
        relative="path"
        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
          hasHits
            ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm'
            : 'bg-gray-100 text-gray-400 pointer-events-none'
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
        Send to Optimization
        {hasHits && (
          <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded text-xs font-bold">{counts.hit}</span>
        )}
      </Link>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline hit tagger
// ---------------------------------------------------------------------------
function InlineHitTagger({ molecules }) {
  const { selections, setTag, setNote, removeSelection } = useHitSelection()
  const [search, setSearch] = useState('')

  if (!molecules || molecules.length === 0) return null

  const filtered = molecules.filter((m, i) => {
    const name = (m.name || m.ligand_name || `Mol ${i + 1}`).toLowerCase()
    return !search || name.includes(search.toLowerCase())
  })

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 bg-[#1e3a5f] flex items-center gap-3">
        <svg className="w-4 h-4 text-white opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2z" />
        </svg>
        <h3 className="text-sm font-semibold text-white">Hit Tagging</h3>
      </div>
      <div className="p-4">
        <input
          type="text"
          placeholder="Search molecule name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full mb-3 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f]"
        />
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {filtered.map((mol) => {
            const realIdx = molecules.indexOf(mol)
            const molName = mol.name || mol.ligand_name || `Molecule ${realIdx + 1}`
            const sel = selections[realIdx]
            const tag = sel?.tag || null
            const note = sel?.note || ''

            const tagBtnCls = (t) => {
              const isActive = tag === t
              if (t === 'hit') return isActive ? 'bg-[#22c55e] text-white border-[#22c55e]' : 'bg-white text-gray-500 border-gray-200 hover:border-[#22c55e] hover:text-[#22c55e]'
              if (t === 'investigate') return isActive ? 'bg-yellow-400 text-white border-yellow-400' : 'bg-white text-gray-500 border-gray-200 hover:border-yellow-400 hover:text-yellow-600'
              if (t === 'discard') return isActive ? 'bg-gray-400 text-white border-gray-400' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
              return ''
            }

            return (
              <div key={realIdx} className={`rounded-lg border p-3 transition-colors ${
                tag === 'hit' ? 'border-green-200 bg-green-50/40' :
                tag === 'investigate' ? 'border-yellow-200 bg-yellow-50/30' :
                tag === 'discard' ? 'border-gray-200 bg-gray-50/40' :
                'border-gray-100 bg-white'
              }`}>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#1e3a5f] text-white text-xs font-bold flex items-center justify-center">
                      {realIdx + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-700 truncate" title={molName}>{molName}</span>
                    {mol.composite_score != null && (
                      <span className="text-xs font-mono text-gray-400">{Math.round(mol.composite_score * 100)}/100</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {['hit', 'investigate', 'discard'].map((t) => (
                      <button key={t}
                        onClick={() => tag === t ? removeSelection(realIdx) : setTag(realIdx, t)}
                        className={`px-2 py-0.5 rounded text-xs font-semibold border transition-colors ${tagBtnCls(t)}`}
                      >
                        {t === 'hit' ? 'Hit' : t === 'investigate' ? 'Inv.' : 'X'}
                      </button>
                    ))}
                  </div>
                </div>
                {(tag === 'hit' || tag === 'investigate') && (
                  <input type="text" placeholder="Add a note..." value={note}
                    onChange={(e) => setNote(realIdx, e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f] text-gray-600 placeholder-gray-300"
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ProjectResults inner (needs HitSelectionProvider wrapping per jobId)
// ---------------------------------------------------------------------------
function ProjectResultsInner({ selectedJobId, results }) {
  const [selectedPoseIndex, setSelectedPoseIndex] = useState(0)
  const [showAllResults, setShowAllResults] = useState(false)

  const allMols = results?.results || []
  const selectedMol = allMols[selectedPoseIndex] || allMols[0] || null

  const handleSelect3D = useCallback((nameOrSmiles, mol) => {
    if (!mol) return
    const idx = results?.results?.findIndex(
      (m) => m.name === mol.name || m.smiles === mol.smiles
    ) ?? 0
    setSelectedPoseIndex(Math.max(0, idx))
    setShowAllResults(true)
  }, [results])

  return (
    <div className="space-y-6">
      <HitSelectionBar />

      {!showAllResults && (
        <ResultsDashboard
          results={results}
          onSelect3D={handleSelect3D}
          onShowAll={() => setShowAllResults(true)}
          onOptimize={() => {}}
        />
      )}

      {showAllResults && (
        <div className="space-y-6">
          <button
            onClick={() => setShowAllResults(false)}
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-[#1e3a5f] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </button>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-2">
              <Viewer3D
                jobId={selectedJobId}
                results={results}
                selectedIndex={selectedPoseIndex}
                onSelectIndex={setSelectedPoseIndex}
              />
            </div>
            <div>
              {selectedMol && (
                <MoleculeCard molecule={selectedMol} rank={selectedPoseIndex + 1} jobId={selectedJobId} />
              )}
            </div>
          </div>

          <ResultsTable results={results} onSelectMolecule={setSelectedPoseIndex} />
          <InlineHitTagger molecules={allMols} />

          {results.generated_molecules?.length > 0 && (
            <GeneratedMols molecules={results.generated_molecules} />
          )}

          <DownloadButtons jobId={selectedJobId} results={results} />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ProjectResults — Screen 4
// ---------------------------------------------------------------------------

export default function ProjectResults() {
  const { jobs, loading, error, isTargetConfigured } = useProject()
  const [searchParams, setSearchParams] = useSearchParams()

  const [results, setResults] = useState(null)
  const [loadingResults, setLoadingResults] = useState(false)
  const [resultsError, setResultsError] = useState(null)

  const completedJobs = jobs.filter(j => j.status === 'completed')
  const runParam = searchParams.get('run')
  const selectedJobId = runParam || (completedJobs.length > 0 ? (completedJobs[0].id || completedJobs[0].job_id) : null)

  // Fetch results when selectedJobId changes
  useEffect(() => {
    if (!selectedJobId) {
      setResults(null)
      return
    }
    setLoadingResults(true)
    setResultsError(null)
    getJobResults(selectedJobId)
      .then(data => setResults(data))
      .catch(err => setResultsError(err?.userMessage || 'Failed to load results.'))
      .finally(() => setLoadingResults(false))
  }, [selectedJobId])

  // Guard: target not configured
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
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
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
    <div className="space-y-6">
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
              <button
                key={jid}
                onClick={() => setSearchParams({ run: jid })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  isSelected
                    ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'
                }`}
              >
                {jid.slice(0, 8)}... <span className="text-xs opacity-60 capitalize">{job.mode || 'standard'}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Results content */}
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
          <ProjectResultsInner selectedJobId={selectedJobId} results={results} />
        </HitSelectionProvider>
      )}
    </div>
  )
}
