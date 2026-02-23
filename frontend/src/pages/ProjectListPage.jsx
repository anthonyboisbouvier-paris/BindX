import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { listProjects, createProject } from '../api'

export default function ProjectListPage() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    listProjects()
      .then(data => { setProjects(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [isAuthenticated])

  const handleCreate = async (e) => {
    e.preventDefault()
    setCreateError('')
    setCreating(true)
    try {
      const p = await createProject({
        name: newName,
        description: newDescription || undefined,
      })
      navigate(`/project/${p.id}`)
    } catch (err) {
      setCreateError(err.userMessage || 'Failed to create project')
      setCreating(false)
    }
  }

  const handleCancelCreate = () => {
    setShowCreate(false)
    setNewName('')
    setNewDescription('')
    setCreateError('')
  }

  if (!isAuthenticated) {
    return (
      <div className="text-center py-20">
        <svg className="w-16 h-16 mx-auto mb-4 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        <h2 className="text-2xl font-bold text-[#1e3a5f] mb-3">My Projects</h2>
        <p className="text-gray-500 mb-6 max-w-sm mx-auto">
          Sign in to organize your screenings into projects and access your history.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            to="/login"
            className="px-6 py-2.5 bg-[#1e3a5f] text-white rounded-lg font-medium hover:bg-[#152d4a] transition-colors"
          >
            Sign In
          </Link>
          <Link
            to="/register"
            className="px-6 py-2.5 bg-white text-[#1e3a5f] rounded-lg font-medium border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Create Account
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-[#1e3a5f]">My Projects</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => { setShowCreate(!showCreate); setCreateError('') }}
          className="px-4 py-2 bg-[#22c55e] text-white rounded-lg font-medium hover:bg-[#16a34a] transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Project
        </button>
      </div>

      {/* Create project form */}
      {showCreate && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <h3 className="font-semibold text-[#1e3a5f] mb-4">Create New Project</h3>
          {createError && (
            <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg p-3 mb-4">
              {createError}
            </div>
          )}
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Project Name *</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                required
                placeholder="e.g. EGFR Inhibitor Screen"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Description</label>
              <textarea
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
                rows={2}
                placeholder="Optional project description..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#152d4a] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {creating && (
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {creating ? 'Creating...' : 'Create Project'}
              </button>
              <button
                type="button"
                onClick={handleCancelCreate}
                className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Project grid */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-6 h-6 animate-spin mx-auto mb-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading projects...
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100 shadow-sm">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <p className="text-gray-400 font-medium">No projects yet</p>
          <p className="text-sm text-gray-300 mt-1">Create a project to organize your screenings</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(p => (
            <Link
              key={p.id}
              to={`/project/${p.id}`}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-[#1e3a5f]/20 transition-all group block"
            >
              {/* Project header */}
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-[#1e3a5f] group-hover:text-[#22c55e] transition-colors leading-tight pr-2">
                  {p.name}
                </h3>
                <svg className="w-4 h-4 text-gray-300 group-hover:text-[#22c55e] transition-colors flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>

              {p.description && (
                <p className="text-sm text-gray-500 mt-2 line-clamp-2 leading-relaxed">
                  {p.description}
                </p>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  {p.job_count || 0} screening{(p.job_count || 0) !== 1 ? 's' : ''}
                </span>
                <span>
                  {p.created_at ? new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
