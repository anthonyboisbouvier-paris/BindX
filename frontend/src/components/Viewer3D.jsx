import React, { useEffect, useRef, useState, useCallback } from 'react'
import { getProteinUrl, getPoseUrl, getReportUrl } from '../api.js'

// Load 3Dmol via CDN script tag approach for reliable loading
function load3Dmol() {
  return new Promise((resolve, reject) => {
    if (window.$3Dmol) {
      resolve(window.$3Dmol)
      return
    }
    const existing = document.getElementById('3dmol-script')
    if (existing) {
      existing.addEventListener('load', () => resolve(window.$3Dmol))
      existing.addEventListener('error', reject)
      return
    }
    const script = document.createElement('script')
    script.id = '3dmol-script'
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/3Dmol/2.0.4/3Dmol-min.js'
    script.onload = () => {
      if (window.$3Dmol) resolve(window.$3Dmol)
      else reject(new Error('3Dmol unavailable after loading'))
    }
    script.onerror = () => reject(new Error('Failed to load 3Dmol.js'))
    document.head.appendChild(script)
  })
}

// --------------------------------------------------
// Simplified toolbar — used in V3 dashboard flow
// Props: onBack, onPrev, onNext, jobId
// --------------------------------------------------
function SimplifiedToolbar({ onBack, onPrev, onNext, jobId, onReset }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-dockit-blue border-b border-dockit-blue-dark">
      {/* Left: back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 px-3 py-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg text-sm font-medium transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back
      </button>

      {/* Center: title */}
      <h3 className="text-white font-semibold text-sm flex items-center gap-2">
        <svg className="w-4 h-4 text-dockit-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        3D Viewer
      </h3>

      {/* Right: navigation + PDF */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onPrev}
          disabled={!onPrev}
          className="flex items-center gap-1 px-3 py-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Previous
        </button>
        <button
          onClick={onNext}
          disabled={!onNext}
          className="flex items-center gap-1 px-3 py-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Next
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        {jobId && (
          <a
            href={getReportUrl(jobId)}
            target="_blank"
            rel="noopener noreferrer"
            download
            title="Download PDF report"
            className="flex items-center gap-1 px-3 py-1.5 bg-dockit-green hover:bg-dockit-green-dark text-white rounded-lg text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            PDF
          </a>
        )}
        {/* Reset view */}
        <button
          onClick={onReset}
          title="Reset view"
          className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// --------------------------------------------------
// Full toolbar (V2 style) — retained for backwards compat
// --------------------------------------------------
function FullToolbar({ topResults, selectedPoseIndex, onPoseSelect, currentStyle, onStyleChange, onReset }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-dockit-blue border-b border-dockit-blue-dark">
      <h3 className="text-white font-semibold text-sm flex items-center gap-2">
        <svg className="w-4 h-4 text-dockit-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        3D Viewer
      </h3>

      <div className="flex items-center gap-2">
        {/* Pose selector */}
        {topResults.length > 0 && (
          <select
            value={selectedPoseIndex ?? ''}
            onChange={(e) => onPoseSelect(e.target.value !== '' ? parseInt(e.target.value) : null)}
            className="text-xs bg-dockit-blue-light text-white border border-white/20 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-dockit-green"
          >
            <option value="">-- Select a ligand --</option>
            {topResults.map((r, i) => (
              <option key={i} value={i}>
                #{i + 1} {r.name || r.ligand_name || `Ligand ${i + 1}`}
              </option>
            ))}
          </select>
        )}

        {/* Style buttons */}
        <div className="flex rounded overflow-hidden border border-white/20">
          {['cartoon', 'surface', 'stick'].map((style) => (
            <button
              key={style}
              onClick={() => onStyleChange(style)}
              className={`px-2 py-1 text-xs font-medium transition-colors ${
                currentStyle === style
                  ? 'bg-dockit-green text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              {style === 'cartoon' ? 'Ribbon' : style === 'surface' ? 'Surface' : 'Stick'}
            </button>
          ))}
        </div>

        {/* Reset view */}
        <button
          onClick={onReset}
          title="Reset view"
          className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// --------------------------------------------------
// Viewer3D
// Props:
//   jobId, results, selectedPoseIndex, onPoseSelect — V2 full mode
//   simplified — boolean, enables simplified toolbar
//   onBack, onPrev, onNext — simplified mode callbacks
// --------------------------------------------------
export default function Viewer3D({
  jobId,
  results,
  selectedPoseIndex,
  onPoseSelect,
  simplified = false,
  onBack,
  onPrev,
  onNext,
}) {
  const containerRef = useRef(null)
  const viewerRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [viewerReady, setViewerReady] = useState(false)
  const [currentStyle, setCurrentStyle] = useState('cartoon')
  const [ligandLoaded, setLigandLoaded] = useState(false)

  const topResults = results?.results?.slice(0, 10) || []

  const initViewer = useCallback(async () => {
    if (!containerRef.current || !jobId) return

    setLoading(true)
    setError(null)
    setLigandLoaded(false)

    try {
      const $3Dmol = await load3Dmol()

      // Clear any existing viewer
      if (viewerRef.current) {
        try { viewerRef.current.clear() } catch (_) {}
      }
      containerRef.current.innerHTML = ''

      // Create viewer
      const viewer = $3Dmol.createViewer(containerRef.current, {
        backgroundColor: '#0f1923',
        id: 'dockit-viewer',
      })
      viewerRef.current = viewer

      // Load protein structure
      const proteinUrl = getProteinUrl(jobId)
      const response = await fetch(proteinUrl)
      if (!response.ok) throw new Error(`Error loading protein: ${response.status}`)
      const pdbData = await response.text()

      viewer.addModel(pdbData, 'pdb')
      viewer.setStyle({}, { cartoon: { color: '#4a9eff', opacity: 0.85 } })
      viewer.zoomTo()
      viewer.render()

      setViewerReady(true)
      setLoading(false)
    } catch (err) {
      console.error('[Viewer3D] Init error:', err)
      setError(err.message || 'Unable to load the 3D viewer.')
      setLoading(false)
    }
  }, [jobId])

  const loadPose = useCallback(async (poseIndex) => {
    const viewer = viewerRef.current
    if (!viewer || poseIndex === null || poseIndex === undefined) return

    try {
      // Remove previous ligand models (all non-protein models)
      const models = viewer.getModelList()
      if (models && models.length > 1) {
        for (let i = 1; i < models.length; i++) {
          viewer.removeModel(models[i])
        }
      }

      const poseUrl = getPoseUrl(jobId, poseIndex)
      const response = await fetch(poseUrl)
      if (!response.ok) {
        console.warn(`[Viewer3D] Pose ${poseIndex} not available: ${response.status}`)
        return
      }

      const poseData = await response.text()
      // PDBQT is PDB-compatible for coordinate reading; 3Dmol handles it as pdb
      viewer.addModel(poseData, 'pdb')

      // Last model is the ligand
      const models2 = viewer.getModelList()
      const ligandModel = models2[models2.length - 1]
      viewer.setStyle({ model: ligandModel }, {
        stick: { color: '#22c55e', radius: 0.2 },
        sphere: { color: '#22c55e', radius: 0.35, opacity: 0.8 },
      })

      // Semi-transparent surface on protein when ligand is loaded (simplified mode default)
      if (simplified) {
        const proteinModel = models2[0]
        if (proteinModel) {
          viewer.setStyle({ model: proteinModel }, {
            cartoon: { color: '#4a9eff', opacity: 0.6 },
          })
          viewer.addSurface(
            window.$3Dmol?.SurfaceType?.VDW || 1,
            { opacity: 0.25, color: '#4a9eff' },
            { model: proteinModel }
          )
        }
      }

      viewer.zoomTo({ model: ligandModel })
      viewer.render()
      setLigandLoaded(true)
    } catch (err) {
      console.error('[Viewer3D] Pose load error:', err)
    }
  }, [jobId, simplified])

  // Apply protein style change
  const applyStyle = useCallback((style) => {
    const viewer = viewerRef.current
    if (!viewer) return

    const models = viewer.getModelList()
    const proteinModel = models?.[0]
    if (!proteinModel) return

    const styleObj = style === 'cartoon'
      ? { cartoon: { color: '#4a9eff', opacity: 0.85 } }
      : style === 'surface'
      ? { surface: { opacity: 0.6, color: '#4a9eff' } }
      : { stick: { colorscheme: 'default', radius: 0.15 } }

    viewer.setStyle({ model: proteinModel }, styleObj)
    viewer.render()
  }, [])

  useEffect(() => {
    initViewer()
  }, [initViewer])

  useEffect(() => {
    if (viewerReady && selectedPoseIndex !== null && selectedPoseIndex !== undefined) {
      loadPose(selectedPoseIndex)
    }
  }, [selectedPoseIndex, viewerReady, loadPose])

  const handleStyleChange = (style) => {
    setCurrentStyle(style)
    applyStyle(style)
  }

  const handleReset = () => {
    const viewer = viewerRef.current
    if (!viewer) return
    viewer.zoomTo()
    viewer.render()
  }

  return (
    <div className="card overflow-hidden">
      {/* Toolbar */}
      {simplified ? (
        <SimplifiedToolbar
          onBack={onBack}
          onPrev={onPrev}
          onNext={onNext}
          jobId={jobId}
          onReset={handleReset}
        />
      ) : (
        <FullToolbar
          topResults={topResults}
          selectedPoseIndex={selectedPoseIndex}
          onPoseSelect={onPoseSelect}
          currentStyle={currentStyle}
          onStyleChange={handleStyleChange}
          onReset={handleReset}
        />
      )}

      {/* Viewer container */}
      <div className="relative bg-gray-900" style={{ height: '420px' }}>
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-gray-900">
            <div className="w-12 h-12 border-3 border-dockit-green border-t-transparent rounded-full animate-spin mb-4" style={{ borderWidth: '3px' }} />
            <p className="text-white/70 text-sm">Loading 3D structure...</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-gray-900">
            <svg className="w-12 h-12 text-red-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-400 text-sm font-medium mb-1">Visualization unavailable</p>
            <p className="text-white/40 text-xs text-center px-8">{error}</p>
            <button
              onClick={initViewer}
              className="mt-4 px-4 py-2 text-xs bg-dockit-blue text-white rounded-lg hover:bg-dockit-blue-light transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        <div
          ref={containerRef}
          className="w-full h-full viewer-container"
          style={{ visibility: loading || error ? 'hidden' : 'visible' }}
        />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-400 inline-block" />
          Protein (receptor)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-dockit-green inline-block" />
          Ligand (docking pose)
        </span>
        <span className="ml-auto text-gray-400">
          Left click: rotate | Scroll: zoom | Right click: translate
        </span>
      </div>
    </div>
  )
}
