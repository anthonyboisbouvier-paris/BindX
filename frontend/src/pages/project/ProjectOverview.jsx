import React from 'react'
import { Link } from 'react-router-dom'
import { useProject } from '../../contexts/ProjectContext.jsx'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatCard({ label, value, sub, colorClass }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-2xl font-bold ${colorClass || 'text-[#1e3a5f]'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function TargetSummaryCard({ targetConfig }) {
  const src = targetConfig.structure?.source || 'unknown'
  const pdbId = targetConfig.structure?.pdb_id
  const pocketCount = targetConfig.pockets?.length || 0
  const selectedPocket = targetConfig.pockets?.[targetConfig.selected_pocket_idx || 0]
  const chembl = targetConfig.chembl_info

  const sourceLabel = {
    pdb_holo: 'PDB Holo',
    pdb_experimental: 'PDB Experimental',
    alphafold: 'AlphaFold',
    esmfold: 'ESMFold',
  }

  const sourceBadgeClass = src.includes('pdb')
    ? 'bg-green-100 text-green-700 border-green-200'
    : src.includes('alphafold')
    ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
    : 'bg-gray-100 text-gray-600 border-gray-200'

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Target Configuration</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">Protein</p>
          <p className="text-sm font-semibold text-gray-800">{targetConfig.protein_name || '—'}</p>
          <p className="text-xs font-mono text-gray-400 mt-0.5">{targetConfig.uniprot_id}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Structure</p>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${sourceBadgeClass}`}>
            {sourceLabel[src] || src}
          </span>
          {pdbId && (
            <p className="text-xs font-mono text-gray-400 mt-0.5">{pdbId}</p>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Binding Pocket</p>
          <p className="text-sm font-semibold text-gray-800">
            Pocket {(targetConfig.selected_pocket_idx || 0) + 1}
            {selectedPocket?.probability != null && (
              <span className="text-xs font-normal text-gray-400 ml-1">
                ({Math.round(selectedPocket.probability * 100)}% druggability)
              </span>
            )}
          </p>
          <p className="text-xs text-gray-400">{pocketCount} pocket{pocketCount !== 1 ? 's' : ''} detected</p>
        </div>
        {chembl && (
          <div>
            <p className="text-xs text-gray-500 mb-1">ChEMBL Data</p>
            <p className="text-sm font-semibold text-gray-800">
              {chembl.has_data ? `${chembl.n_actives || 0} known actives` : 'No data'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ProjectOverview — Screen 1
// ---------------------------------------------------------------------------

export default function ProjectOverview() {
  const { project, jobs, loading, error, targetConfig, isTargetConfigured } = useProject()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <svg className="w-8 h-8 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="text-sm">Loading project...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <p className="text-sm font-semibold text-red-700 mb-1">Failed to load project</p>
          <p className="text-xs text-red-500">{error}</p>
          <Link to="/" className="mt-4 inline-block text-[#1e3a5f] font-medium hover:underline text-sm">
            Back to Projects
          </Link>
        </div>
      </div>
    )
  }

  if (!project) return null

  const completedJobs = jobs.filter(j => j.status === 'completed')
  const runningJobs = jobs.filter(j => j.status === 'running')
  const bestScore = completedJobs.length > 0
    ? Math.max(...completedJobs.map(j => j.best_score || 0))
    : null

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page header */}
      <div>
        <nav className="flex items-center gap-2 text-sm text-gray-400 mb-3">
          <Link to="/" className="hover:text-[#1e3a5f] transition-colors flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            Projects
          </Link>
          <span>/</span>
          <span className="text-gray-700 font-medium truncate max-w-xs">{project.name}</span>
        </nav>
        <h1 className="text-2xl font-bold text-[#1e3a5f]">{project.name}</h1>
        {project.description && (
          <p className="text-gray-500 mt-1 leading-relaxed">{project.description}</p>
        )}
      </div>

      {/* Target not configured — CTA */}
      {!isTargetConfigured && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <svg className="w-12 h-12 text-amber-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" strokeWidth={1.8} />
            <circle cx="12" cy="12" r="5" strokeWidth={1.8} />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" strokeWidth={0} />
          </svg>
          <h3 className="text-lg font-bold text-amber-800 mb-2">Configure your target to begin</h3>
          <p className="text-sm text-amber-600 mb-4 max-w-md mx-auto">
            Before running any screening, you need to validate a target protein, select a 3D structure, and choose a binding pocket.
          </p>
          <Link
            to={`/project/${project.id}/target`}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1e3a5f] text-white font-semibold rounded-xl hover:bg-[#2a4f7c] transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" strokeWidth={2} />
              <circle cx="12" cy="12" r="5" strokeWidth={2} />
            </svg>
            Go to Target Setup
          </Link>
        </div>
      )}

      {/* Target configured — summary */}
      {isTargetConfigured && targetConfig && (
        <TargetSummaryCard targetConfig={targetConfig} />
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Runs" value={jobs.length} />
        <StatCard
          label="Completed"
          value={completedJobs.length}
          colorClass="text-[#22c55e]"
        />
        <StatCard
          label="Running"
          value={runningJobs.length}
          colorClass={runningJobs.length > 0 ? 'text-blue-600' : 'text-gray-300'}
        />
        <StatCard
          label="Best Score"
          value={bestScore != null && bestScore > 0 ? `${Math.round(bestScore * 100)}/100` : '—'}
          colorClass="text-[#22c55e]"
        />
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Link
            to={`/project/${project.id}/target`}
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl font-semibold text-sm bg-[#1e3a5f] text-white hover:bg-[#2a4f7c] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" strokeWidth={2} />
              <circle cx="12" cy="12" r="5" strokeWidth={2} />
            </svg>
            {isTargetConfigured ? 'Reconfigure Target' : 'Target Setup'}
          </Link>
          {isTargetConfigured && (
            <>
              <Link
                to={`/project/${project.id}/runs`}
                className="flex items-center gap-2.5 px-4 py-3 rounded-xl font-semibold text-sm bg-[#22c55e] text-white hover:bg-[#16a34a] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                View Runs
              </Link>
              {completedJobs.length > 0 && (
                <Link
                  to={`/project/${project.id}/results`}
                  className="flex items-center gap-2.5 px-4 py-3 rounded-xl font-semibold text-sm bg-white text-[#1e3a5f] border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Latest Results
                </Link>
              )}
            </>
          )}
        </div>
      </div>

      {/* Recent runs list */}
      {jobs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[#1e3a5f]">Recent Runs</h3>
            <Link to={`/project/${project.id}/runs`} className="text-sm text-[#1e3a5f] hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {jobs.slice(0, 5).map(job => {
              const statusCls = {
                completed: 'bg-green-100 text-green-700 border-green-200',
                running: 'bg-blue-100 text-blue-700 border-blue-200',
                pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
                failed: 'bg-red-100 text-red-700 border-red-200',
              }[job.status] || 'bg-gray-100 text-gray-600 border-gray-200'

              return (
                <div
                  key={job.id || job.job_id}
                  className="flex items-center justify-between bg-white rounded-lg border border-gray-100 px-4 py-3 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium border ${statusCls}`}>
                      {job.status}
                    </span>
                    <span className="text-sm font-medium text-gray-700 truncate">
                      {job.protein_name || job.uniprot_id || (job.id || job.job_id).slice(0, 8) + '...'}
                    </span>
                    <span className="text-xs text-gray-400 capitalize">{job.mode || 'standard'}</span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {job.created_at
                      ? new Date(job.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : ''}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
