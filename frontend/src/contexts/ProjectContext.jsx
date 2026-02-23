import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { getProjectDetail } from '../api.js'

const ProjectContext = createContext(null)

/**
 * ProjectProvider — fetches project detail (with jobs) and provides computed helpers.
 * Wraps children and makes data available via useProject().
 */
export function ProjectProvider({ children }) {
  const { projectId } = useParams()

  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    if (!projectId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await getProjectDetail(projectId)
      setProject(data)
    } catch (err) {
      console.error('[ProjectContext] Failed to fetch project:', err)
      setError(err?.userMessage || err?.message || 'Failed to load project.')
      setProject(null)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Parse target_preview_json
  const targetConfig = (() => {
    if (!project?.target_preview_json) return null
    if (typeof project.target_preview_json === 'string') {
      try { return JSON.parse(project.target_preview_json) } catch { return null }
    }
    return project.target_preview_json
  })()

  const isTargetConfigured = !!(targetConfig?.configured_at)

  const jobs = project?.jobs || []

  const value = {
    project,
    jobs,
    loading,
    error,
    refresh: fetchData,
    targetConfig,
    isTargetConfigured,
  }

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  )
}

/**
 * useProject — access project data, jobs, target config, and helpers.
 * Must be used inside a ProjectProvider.
 */
export function useProject() {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProject must be used within a ProjectProvider')
  return ctx
}

/**
 * useProjectSafe — same as useProject but returns null when outside a ProjectProvider.
 * Use in components that may render both inside and outside a ProjectProvider.
 */
export function useProjectSafe() {
  return useContext(ProjectContext)
}

export default ProjectContext
