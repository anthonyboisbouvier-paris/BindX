import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useProject } from '../../contexts/ProjectContext.jsx'
import { HitSelectionProvider, useHitSelection } from '../../contexts/HitSelectionContext.jsx'
import { getJobResults, getReportUrl, getDownloadUrl } from '../../api.js'

import ReportPreview from '../../components/ReportPreview.jsx'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function SummaryCard({ title, icon, rows }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="text-[#1e3a5f] opacity-70">{icon}</span>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</h2>
      </div>
      <div className="divide-y divide-gray-50">
        {rows.map(([label, value]) =>
          value !== null && value !== undefined && value !== '' ? (
            <div key={label} className="flex items-start justify-between gap-3 py-2.5 last:pb-0 first:pt-0">
              <span className="text-sm text-gray-500 flex-shrink-0">{label}</span>
              <span className="text-sm font-semibold text-gray-800 text-right">{value}</span>
            </div>
          ) : null
        )}
      </div>
    </div>
  )
}

function TagBadge({ tag }) {
  const configs = {
    hit:         { label: 'Hit',         classes: 'bg-green-100 text-green-700 border-green-200' },
    investigate: { label: 'Investigate', classes: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    discard:     { label: 'Discard',     classes: 'bg-gray-100 text-gray-500 border-gray-200' },
  }
  const cfg = configs[tag] || { label: tag, classes: 'bg-gray-100 text-gray-500 border-gray-200' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.classes}`}>
      {cfg.label}
    </span>
  )
}

function DownloadBtn({ label, description, icon, onClick, colorClass }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-3 px-5 py-3.5 rounded-xl font-semibold text-sm transition-colors shadow-sm hover:shadow-md ${colorClass}`}>
      <span className="flex-shrink-0">{icon}</span>
      <div className="text-left">
        <div>{label}</div>
        {description && <div className="text-xs opacity-75 font-normal mt-0.5">{description}</div>}
      </div>
    </button>
  )
}

const IconTarget = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
  </svg>
)
const IconRun = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)
const IconHits = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2z" />
  </svg>
)

// ---------------------------------------------------------------------------
// Inner component (needs HitSelectionProvider)
// ---------------------------------------------------------------------------

function ReportsInner({ jobId, results, job }) {
  const { selections, getTagCount } = useHitSelection()
  const counts = getTagCount()

  const allMols = results?.results || []
  const taggedEntries = Object.entries(selections).map(([idx, sel]) => ({
    idx: Number(idx), mol: allMols[Number(idx)] || null, tag: sel.tag, note: sel.note,
  })).filter(e => e.mol)

  const ps = results?.pipeline_summary || {}
  const modeLabel = {
    rapid: 'Rapid HTS', standard: 'Standard (ADMET + AI)', deep: 'Deep Screening',
  }[job?.mode] || job?.mode || '—'

  const allMolsAll = [...(results?.results || []), ...(results?.generated_molecules || [])]
  const scoreArr = allMolsAll.map(m => m.composite_score).filter(v => v != null)
  const bestScore = scoreArr.length ? Math.round(Math.max(...scoreArr) * 100) : null

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-[#1e3a5f]">Reports and Export</h1>
        <p className="text-sm text-gray-400 mt-1">
          {results?.protein_name || results?.uniprot_id || jobId}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <SummaryCard title="Target" icon={<IconTarget />} rows={[
          ['Protein', results?.protein_name || '—'],
          ['UniProt ID', results?.uniprot_id || '—'],
          ['Structure', ps.effective_structure_source || ps.structure_source || '—'],
          ['PDB ID', ps.pdb_id || null],
        ]} />
        <SummaryCard title="Run Configuration" icon={<IconRun />} rows={[
          ['Mode', modeLabel],
          ['Engine', ps.docking_engine || '—'],
          ['Ligands tested', ps.total_ligands_tested != null ? ps.total_ligands_tested.toLocaleString() : String(allMolsAll.length)],
          ['Best score', bestScore != null ? `${bestScore}/100` : null],
        ]} />
      </div>

      {/* Selected hits */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 bg-[#1e3a5f] flex items-center gap-2.5">
          <span className="text-white opacity-80"><IconHits /></span>
          <h2 className="text-sm font-semibold text-white">
            Selected Hits & Notes
            <span className="ml-2 px-2 py-0.5 bg-white/20 rounded text-xs font-bold">{counts.total}</span>
          </h2>
        </div>
        {taggedEntries.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-gray-400">No molecules have been tagged yet.</p>
            <Link to="../results" relative="path"
              className="inline-flex items-center gap-2 mt-3 px-4 py-2 text-sm font-semibold text-[#1e3a5f] border border-[#1e3a5f] rounded-lg hover:bg-blue-50 transition-colors">
              Go to Results to tag hits
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {taggedEntries.map(({ idx, mol, tag, note }) => {
              const name = mol.name || mol.ligand_name || `Molecule ${idx + 1}`
              const score = mol.composite_score != null ? Math.round(mol.composite_score * 100) : null
              return (
                <div key={idx} className="flex items-start gap-3 px-5 py-3.5">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-xs">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800 truncate">{name}</span>
                      <TagBadge tag={tag} />
                      {score != null && <span className="text-xs font-mono text-[#22c55e] font-semibold">{score}/100</span>}
                    </div>
                    {note && <p className="text-xs text-gray-500 mt-1 italic">{note}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {<ReportPreview results={results} selections={selections} />}

      {/* Download */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Download</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <DownloadBtn label="PDF Report" description="Full summary with figures"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>}
            onClick={() => window.open(getReportUrl(jobId), '_blank')}
            colorClass="bg-[#1e3a5f] hover:bg-[#2a4f7c] text-white"
          />
          <DownloadBtn label="ZIP Archive" description="PDB, PDBQT, CSV, report"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>}
            onClick={() => window.open(getDownloadUrl(jobId), '_blank')}
            colorClass="bg-[#22c55e] hover:bg-[#16a34a] text-white"
          />
        </div>
      </div>

      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl">
        <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-xs text-amber-700 leading-relaxed">
          These results are exploratory and must be validated experimentally before any clinical application.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ProjectReports — Screen 6
// ---------------------------------------------------------------------------

export default function ProjectReports() {
  const { project, jobs, loading, isTargetConfigured } = useProject()

  const [results, setResults] = useState(null)
  const [loadingResults, setLoadingResults] = useState(false)

  const completedJobs = jobs
    .filter(j => j.status === 'completed')
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
  const latestJob = completedJobs[0] || null
  const latestJobId = latestJob ? (latestJob.id || latestJob.job_id) : null

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
          <p className="text-xs text-gray-400 mb-4">Reports are available once a run completes.</p>
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
      <ReportsInner jobId={latestJobId} results={results} job={latestJob} />
    </HitSelectionProvider>
  )
}
