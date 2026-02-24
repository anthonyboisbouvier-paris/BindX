import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProject } from '../../contexts/ProjectContext.jsx'
import { previewTarget, previewSequence, updateProject, runTargetAssessment } from '../../api.js'
import AssessmentCard from '../../components/AssessmentCard.jsx'
import AgentAdvisorCard from '../../components/AgentAdvisorCard.jsx'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SOURCE_CONFIGS = {
  pdb_holo:         { label: 'PDB Holo',        classes: 'bg-green-100 text-green-700 border-green-200' },
  pdb_experimental: { label: 'PDB Experimental', classes: 'bg-green-100 text-green-700 border-green-200' },
  alphafold:        { label: 'AlphaFold',         classes: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  esmfold:          { label: 'ESMFold',           classes: 'bg-gray-100 text-gray-600 border-gray-200' },
}

function StructureBadge({ source }) {
  if (!source) return null
  const key = Object.keys(SOURCE_CONFIGS).find((k) => source.toLowerCase().includes(k)) || null
  const cfg = key ? SOURCE_CONFIGS[key] : { label: source, classes: 'bg-gray-100 text-gray-600 border-gray-200' }
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.classes}`}>
      {cfg.label}
    </span>
  )
}

function DruggabilityBar({ value }) {
  if (value == null) return <span className="text-gray-400 text-sm">—</span>
  const pct = Math.round(value * 100)
  let barColor = 'bg-red-400'
  let textColor = 'text-red-600'
  if (value >= 0.7) { barColor = 'bg-[#22c55e]'; textColor = 'text-green-700' }
  else if (value >= 0.4) { barColor = 'bg-yellow-400'; textColor = 'text-yellow-700' }
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-sm font-bold tabular-nums w-10 text-right ${textColor}`}>{pct}%</span>
    </div>
  )
}

function ConfidenceDot({ value }) {
  if (value == null) return null
  const pct = Math.round(value * 100)
  const color = value >= 0.9 ? 'text-green-600' : value >= 0.7 ? 'text-yellow-600' : 'text-gray-400'
  return <span className={`text-xs font-medium ${color}`}>Confidence {pct}%</span>
}

function StepHeader({ number, title, done, active }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
        done
          ? 'bg-[#22c55e] text-white'
          : active
          ? 'bg-[#1e3a5f] text-white'
          : 'bg-gray-100 text-gray-400'
      }`}>
        {done ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        ) : number}
      </div>
      <h2 className="text-lg font-bold text-[#1e3a5f]">{title}</h2>
    </div>
  )
}

// Validate that a string looks like a FASTA or raw AA sequence
function parseFasta(text) {
  const lines = text.trim().split('\n')
  let seq = ''
  for (const line of lines) {
    if (line.startsWith('>')) continue
    seq += line.trim().toUpperCase()
  }
  const validAA = /^[ACDEFGHIKLMNPQRSTVWYBXZJUO*]+$/
  return validAA.test(seq) ? seq : null
}

// ---------------------------------------------------------------------------
// UniProt enrichment — fetch rich protein info for druggability context
// ---------------------------------------------------------------------------

function UniProtInfoCard({ uniprotId, onFeaturesLoaded }) {
  const [info, setInfo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!uniprotId) return
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`https://rest.uniprot.org/uniprotkb/${uniprotId}.json`)
      .then(r => { if (!r.ok) throw new Error(`UniProt ${r.status}`); return r.json() })
      .then(data => {
        if (cancelled) return

        // Extract key fields
        const proteinName = data.proteinDescription?.recommendedName?.fullName?.value
          || data.proteinDescription?.submittedName?.[0]?.fullName?.value || ''
        const geneName = data.genes?.[0]?.geneName?.value || ''
        const organism = data.organism?.scientificName || ''
        const seqLength = data.sequence?.length || 0

        // Function description
        const functionComment = data.comments?.find(c => c.commentType === 'FUNCTION')
        const functionText = functionComment?.texts?.[0]?.value || ''

        // Subcellular location
        const subCell = data.comments?.find(c => c.commentType === 'SUBCELLULAR LOCATION')
        const locations = subCell?.subcellularLocations?.map(l => l.location?.value).filter(Boolean) || []

        // Disease associations (druggability signal)
        const diseaseComments = data.comments?.filter(c => c.commentType === 'DISEASE') || []
        const diseases = diseaseComments.map(d => ({
          name: d.disease?.diseaseId || d.disease?.description || '',
          acronym: d.disease?.acronym || '',
        })).filter(d => d.name)

        // Protein families
        const families = data.comments?.filter(c => c.commentType === 'SIMILARITY')
          ?.map(c => c.texts?.[0]?.value)?.filter(Boolean) || []

        // Keywords for druggability signals
        const keywords = data.keywords?.map(k => ({ name: k.name, category: k.category })) || []
        const druggabilityKeywords = keywords.filter(k =>
          ['Disease', 'Molecular function', 'Biological process', 'Ligand'].includes(k.category)
        )

        // Cross-references for drug/clinical info
        const xrefs = data.uniProtKBCrossReferences || []
        const pdbCount = xrefs.filter(x => x.database === 'PDB').length
        const drugBankRefs = xrefs.filter(x => x.database === 'DrugBank')
        const openTargetsRefs = xrefs.filter(x => x.database === 'OpenTargets')
        const chemblRefs = xrefs.filter(x => x.database === 'ChEMBL')

        // Tissue specificity
        const tissueComment = data.comments?.find(c => c.commentType === 'TISSUE SPECIFICITY')
        const tissueText = tissueComment?.texts?.[0]?.value || ''

        // PTMs
        const ptmComment = data.comments?.find(c => c.commentType === 'PTM')
        const ptmText = ptmComment?.texts?.[0]?.value || ''

        // Pharmaceutical use
        const pharmaComment = data.comments?.find(c => c.commentType === 'PHARMACEUTICAL')
        const pharmaText = pharmaComment?.texts?.[0]?.value || ''

        // Involvement in disease (strong druggability signal)
        const involvementComment = data.comments?.find(c => c.commentType === 'INVOLVEMENT IN DISEASE')
        const involvementText = involvementComment?.texts?.[0]?.value || ''

        setInfo({
          proteinName, geneName, organism, seqLength,
          functionText, locations, diseases, families,
          druggabilityKeywords, pdbCount, drugBankRefs,
          openTargetsRefs, chemblRefs, tissueText,
          ptmText, pharmaText, involvementText,
        })

        // Extract structural features for 3D annotation overlays
        if (onFeaturesLoaded) {
          const features = data.features || []
          onFeaturesLoaded({
            activeSites: features
              .filter(f => f.type === 'Active site')
              .map(f => ({
                position: f.location?.start?.value,
                description: f.description || '',
              })),
            bindingSites: features
              .filter(f => f.type === 'Binding site')
              .map(f => ({
                start: f.location?.start?.value,
                end: f.location?.end?.value || f.location?.start?.value,
                description: f.description || '',
                ligand: f.ligand?.name || '',
              })),
            domains: features
              .filter(f => f.type === 'Domain')
              .map(f => ({
                start: f.location?.start?.value,
                end: f.location?.end?.value,
                name: f.description || '',
              })),
            disulfideBonds: features
              .filter(f => f.type === 'Disulfide bond')
              .map(f => ({
                start: f.location?.start?.value,
                end: f.location?.end?.value,
              })),
            modifiedResidues: features
              .filter(f => f.type === 'Modified residue')
              .map(f => ({
                position: f.location?.start?.value,
                description: f.description || '',
              })),
            transmembrane: features
              .filter(f => f.type === 'Transmembrane')
              .map(f => ({
                start: f.location?.start?.value,
                end: f.location?.end?.value,
                description: f.description || '',
              })),
          })
        }
      })
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [uniprotId])

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Fetching UniProt data...</span>
        </div>
      </div>
    )
  }

  if (error || !info) return null

  const hasDrugs = info.drugBankRefs.length > 0
  const hasOpenTargets = info.openTargetsRefs.length > 0
  const hasDiseases = info.diseases.length > 0

  // Druggability assessment
  let druggabilityLevel = 'Unknown'
  let druggabilityColor = 'bg-gray-100 text-gray-600 border-gray-200'
  if (hasDrugs) {
    druggabilityLevel = 'Validated Target'
    druggabilityColor = 'bg-green-100 text-green-700 border-green-200'
  } else if (hasDiseases && info.pdbCount > 0) {
    druggabilityLevel = 'High Potential'
    druggabilityColor = 'bg-blue-100 text-blue-700 border-blue-200'
  } else if (hasDiseases) {
    druggabilityLevel = 'Emerging Target'
    druggabilityColor = 'bg-yellow-100 text-yellow-700 border-yellow-200'
  } else if (info.pdbCount > 0) {
    druggabilityLevel = 'Structurally Characterized'
    druggabilityColor = 'bg-gray-100 text-gray-600 border-gray-200'
  }

  // Innovation assessment
  let innovationLevel = 'Standard'
  let innovationColor = 'bg-gray-100 text-gray-600 border-gray-200'
  if (!hasDrugs && hasDiseases) {
    innovationLevel = 'Novel — No approved drugs'
    innovationColor = 'bg-purple-100 text-purple-700 border-purple-200'
  } else if (hasDrugs && info.drugBankRefs.length <= 2) {
    innovationLevel = 'Underexplored — Few drugs'
    innovationColor = 'bg-indigo-100 text-indigo-700 border-indigo-200'
  } else if (hasDrugs && info.drugBankRefs.length > 5) {
    innovationLevel = 'Well-established'
    innovationColor = 'bg-green-100 text-green-700 border-green-200'
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">UniProt Intelligence</h3>
        <a
          href={`https://www.uniprot.org/uniprot/${uniprotId}`}
          target="_blank" rel="noopener noreferrer"
          className="text-xs text-[#1e3a5f] hover:underline font-medium"
          onClick={(e) => e.stopPropagation()}
        >
          View on UniProt
        </a>
      </div>

      {/* Header info */}
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {info.geneName && (
              <span className="text-sm font-bold text-[#1e3a5f]">{info.geneName}</span>
            )}
            <span className="text-xs text-gray-400 font-mono">{uniprotId}</span>
            <span className="text-xs text-gray-400">{info.organism}</span>
            <span className="text-xs text-gray-400">{info.seqLength} aa</span>
          </div>
        </div>
      </div>

      {/* Assessment badges */}
      <div className="flex flex-wrap gap-2">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${druggabilityColor}`}>
          {druggabilityLevel}
        </span>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${innovationColor}`}>
          {innovationLevel}
        </span>
        {info.pdbCount > 0 && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border bg-blue-50 text-blue-700 border-blue-200">
            {info.pdbCount} PDB structures
          </span>
        )}
        {hasDrugs && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border bg-green-50 text-green-700 border-green-200">
            {info.drugBankRefs.length} DrugBank {info.drugBankRefs.length === 1 ? 'entry' : 'entries'}
          </span>
        )}
      </div>

      {/* Function */}
      {info.functionText && (
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1">Function</p>
          <p className="text-xs text-gray-600 leading-relaxed line-clamp-4">{info.functionText}</p>
        </div>
      )}

      {/* Grid of details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Disease associations */}
        {hasDiseases && (
          <div className="bg-red-50/50 rounded-lg p-3">
            <p className="text-xs font-semibold text-red-700 mb-1.5">Disease Associations</p>
            <div className="space-y-1">
              {info.diseases.slice(0, 5).map((d, i) => (
                <p key={i} className="text-xs text-red-600">
                  {d.acronym ? `${d.acronym} — ` : ''}{d.name}
                </p>
              ))}
              {info.diseases.length > 5 && (
                <p className="text-xs text-red-400">+{info.diseases.length - 5} more</p>
              )}
            </div>
          </div>
        )}

        {/* Subcellular location */}
        {info.locations.length > 0 && (
          <div className="bg-blue-50/50 rounded-lg p-3">
            <p className="text-xs font-semibold text-blue-700 mb-1.5">Subcellular Location</p>
            <p className="text-xs text-blue-600">{info.locations.slice(0, 4).join(', ')}</p>
          </div>
        )}

        {/* Tissue specificity */}
        {info.tissueText && (
          <div className="bg-purple-50/50 rounded-lg p-3">
            <p className="text-xs font-semibold text-purple-700 mb-1.5">Tissue Expression</p>
            <p className="text-xs text-purple-600 leading-relaxed line-clamp-3">{info.tissueText}</p>
          </div>
        )}

        {/* Pharmaceutical use */}
        {info.pharmaText && (
          <div className="bg-green-50/50 rounded-lg p-3">
            <p className="text-xs font-semibold text-green-700 mb-1.5">Pharmaceutical Use</p>
            <p className="text-xs text-green-600 leading-relaxed line-clamp-3">{info.pharmaText}</p>
          </div>
        )}
      </div>

      {/* Keywords / molecular function tags */}
      {info.druggabilityKeywords.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1.5">Functional Keywords</p>
          <div className="flex flex-wrap gap-1">
            {info.druggabilityKeywords.slice(0, 12).map((kw, i) => (
              <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-medium rounded-full">
                {kw.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Protein family */}
      {info.families.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1">Protein Family</p>
          <p className="text-xs text-gray-600 leading-relaxed">{info.families[0]}</p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ProteinPreviewViewer — full-featured 3D viewer for Target Setup
// ---------------------------------------------------------------------------

function load3DmolLib() {
  return new Promise((resolve, reject) => {
    if (window.$3Dmol) { resolve(window.$3Dmol); return }
    const existing = document.getElementById('3dmol-script')
    if (existing) {
      existing.addEventListener('load', () => resolve(window.$3Dmol))
      existing.addEventListener('error', reject)
      return
    }
    const script = document.createElement('script')
    script.id = '3dmol-script'
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/3Dmol/2.0.4/3Dmol-min.js'
    script.onload = () => window.$3Dmol ? resolve(window.$3Dmol) : reject(new Error('3Dmol unavailable'))
    script.onerror = () => reject(new Error('Failed to load 3Dmol.js'))
    document.head.appendChild(script)
  })
}

const PREVIEW_DOMAIN_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#06b6d4']

const PREVIEW_COLOR_LABELS = {
  default: 'Default',
  chain:   'Chain',
  ss:      'Sec. Structure',
  spectrum: 'Spectrum',
}

function previewGetColorSpec(mode) {
  switch (mode) {
    case 'chain':    return { colorscheme: 'chain' }
    case 'ss':       return { colorscheme: 'ssJmol' }
    case 'spectrum': return { colorscheme: { gradient: 'roygb', min: 0, max: 1, prop: 'resi' } }
    default:         return { color: '#4a9eff' }
  }
}

// Parse residue numbers from pocket.residues (array of "ALA_123" or plain integers)
function parsePocketResidues(residues) {
  if (!residues) return []
  const arr = Array.isArray(residues)
    ? residues
    : typeof residues === 'string'
      ? residues.split(',').map(s => s.trim()).filter(Boolean)
      : []
  return arr.map((r) => {
    if (typeof r === 'number') return r
    const parts = String(r).split('_')
    const n = parseInt(parts[parts.length - 1])
    return isNaN(n) ? null : n
  }).filter(n => n !== null)
}

/**
 * ProteinPreviewViewer
 * Props:
 *   pdbUrl        — URL to fetch PDB from
 *   pdbData       — raw PDB string (if already available)
 *   uniprotFeatures — { domains, activeSites, bindingSites }
 *   selectedPocket  — pocket object { center, residues } or null
 */
function ProteinPreviewViewer({ pdbUrl, pdbData, uniprotFeatures, selectedPocket }) {
  const containerRef = useRef(null)
  const viewerRef = useRef(null)
  const surfaceActiveRef = useRef(false)

  const [viewerError, setViewerError] = useState(null)
  const [viewerLoading, setViewerLoading] = useState(false)
  const [viewerReady, setViewerReady] = useState(false)
  const [currentStyle, setCurrentStyle] = useState('cartoon')
  const [colorMode, setColorMode] = useState('default')
  const [showPocket, setShowPocket] = useState(true)
  const [showAnnotations, setShowAnnotations] = useState(true)

  // ------------------------------------------------------------------
  // Initialize viewer when PDB source changes
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return
    if (!pdbUrl && !pdbData) return

    let cancelled = false
    setViewerLoading(true)
    setViewerReady(false)
    setViewerError(null)

    async function initViewer() {
      try {
        const $3Dmol = await load3DmolLib()
        if (cancelled || !containerRef.current) return

        if (viewerRef.current) {
          try { viewerRef.current.clear() } catch (_) {}
        }
        containerRef.current.innerHTML = ''
        surfaceActiveRef.current = false

        const viewer = $3Dmol.createViewer(containerRef.current, {
          backgroundColor: '#0f1923',
          antialias: true,
        })
        viewerRef.current = viewer

        if (pdbData) {
          viewer.addModel(pdbData, 'pdb')
        } else if (pdbUrl) {
          const resp = await fetch(pdbUrl)
          if (!resp.ok) throw new Error(`Failed to fetch PDB: ${resp.status}`)
          const text = await resp.text()
          viewer.addModel(text, 'pdb')
        }

        viewer.setStyle({}, { cartoon: { color: '#4a9eff', opacity: 0.85 } })
        viewer.zoomTo()
        viewer.render()
        if (!cancelled) setViewerReady(true)
      } catch (err) {
        if (!cancelled) setViewerError(err.message)
      } finally {
        if (!cancelled) setViewerLoading(false)
      }
    }

    initViewer()
    return () => { cancelled = true }
  }, [pdbUrl, pdbData])

  // ------------------------------------------------------------------
  // applyAllStyles — rebuild representation + pocket highlight
  // ------------------------------------------------------------------
  const applyAllStyles = useCallback(() => {
    const viewer = viewerRef.current
    if (!viewer || !viewerReady) return

    const models = viewer.getModelList()
    const proteinModel = models?.[0]
    if (!proteinModel) return

    // Remove surfaces and shapes before rebuilding
    if (surfaceActiveRef.current) {
      try { viewer.removeAllSurfaces() } catch (_) {}
      surfaceActiveRef.current = false
    }
    try { viewer.removeAllShapes() } catch (_) {}

    const colorSpec = previewGetColorSpec(colorMode)

    // Base protein style
    if (currentStyle === 'surface') {
      viewer.setStyle({ model: proteinModel }, {
        cartoon: { ...colorSpec, opacity: 0.25 },
      })
      const $3Dmol = window.$3Dmol
      const surfaceType = $3Dmol?.SurfaceType?.VDW ?? 1
      viewer.addSurface(
        surfaceType,
        { opacity: 0.35, color: '#e2e8f0' },
        { model: proteinModel }
      )
      surfaceActiveRef.current = true
    } else if (currentStyle === 'cartoon') {
      viewer.setStyle({ model: proteinModel }, {
        cartoon: { ...colorSpec, opacity: 0.85 },
      })
    } else if (currentStyle === 'ball+stick') {
      viewer.setStyle({ model: proteinModel }, {
        stick: { ...colorSpec, radius: 0.12 },
        sphere: { ...colorSpec, radius: 0.25 },
      })
    } else {
      // stick
      viewer.setStyle({ model: proteinModel }, {
        stick: { ...colorSpec, radius: 0.15 },
      })
    }

    // Domain coloring overlay (UniProt)
    if (uniprotFeatures?.domains?.length) {
      uniprotFeatures.domains.forEach((d, i) => {
        if (!d.start || !d.end) return
        const resis = []
        for (let r = d.start; r <= d.end; r++) resis.push(r)
        viewer.addStyle(
          { resi: resis, model: proteinModel },
          { cartoon: { color: PREVIEW_DOMAIN_COLORS[i % PREVIEW_DOMAIN_COLORS.length], opacity: 0.95 } }
        )
      })
    }

    // Active sites (UniProt annotations)
    if (showAnnotations && uniprotFeatures?.activeSites?.length) {
      uniprotFeatures.activeSites.forEach(site => {
        if (!site.position) return
        viewer.addStyle(
          { resi: [site.position], model: proteinModel },
          { stick: { color: '#ef4444', radius: 0.18, opacity: 0.9 } }
        )
        viewer.addStyle(
          { resi: [site.position], atom: 'CA', model: proteinModel },
          { sphere: { color: '#ef4444', radius: 0.35, opacity: 0.8 } }
        )
      })
    }

    // Binding sites (UniProt annotations)
    if (showAnnotations && uniprotFeatures?.bindingSites?.length) {
      uniprotFeatures.bindingSites.forEach(site => {
        if (!site.start) return
        const resis = []
        for (let r = site.start; r <= (site.end || site.start); r++) resis.push(r)
        viewer.addStyle(
          { resi: resis, model: proteinModel },
          { stick: { color: '#f97316', radius: 0.16, opacity: 0.85 } }
        )
      })
    }

    // Pocket highlight
    if (showPocket && selectedPocket) {
      const center = selectedPocket.center
      if (Array.isArray(center) && center.length === 3) {
        const [x, y, z] = center
        viewer.addSphere({
          center: { x, y, z },
          radius: 7,
          color: '#facc15',
          opacity: 0.35,
          wireframe: false,
        })
      }

      const residueNums = parsePocketResidues(selectedPocket.residues)
      if (residueNums.length > 0) {
        viewer.addStyle(
          { resi: residueNums, model: proteinModel },
          { stick: { color: '#f59e0b', radius: 0.14, opacity: 0.85 } }
        )
        // Small spheres on pocket residue CA atoms for clarity
        viewer.addStyle(
          { resi: residueNums, atom: 'CA', model: proteinModel },
          { sphere: { color: '#fbbf24', radius: 0.28, opacity: 0.7 } }
        )
      }
    }

    viewer.render()
  }, [viewerReady, currentStyle, colorMode, showPocket, showAnnotations, selectedPocket, uniprotFeatures])

  // Re-apply styles whenever representation or pocket changes
  useEffect(() => {
    applyAllStyles()
  }, [applyAllStyles])

  // Auto-zoom to pocket when it changes
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || !viewerReady || !selectedPocket?.center) return
    const [x, y, z] = selectedPocket.center
    // Zoom to region around pocket center
    viewer.zoomTo({ resi: parsePocketResidues(selectedPocket.residues).slice(0, 5) })
    viewer.zoom(1.1)
    viewer.render()
  }, [selectedPocket, viewerReady])

  const handleReset = () => {
    const viewer = viewerRef.current
    if (!viewer) return
    viewer.zoomTo()
    viewer.render()
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  if (viewerError) {
    return (
      <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-900">
        <div className="h-64 flex flex-col items-center justify-center gap-2">
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-red-400 font-medium">3D viewer unavailable</p>
          <p className="text-[10px] text-gray-500 text-center px-6">{viewerError}</p>
        </div>
      </div>
    )
  }

  const hasPocket = !!selectedPocket?.center

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
      {/* Compact toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#1e3a5f] gap-2 flex-wrap">
        {/* Title */}
        <span className="text-white text-xs font-semibold flex items-center gap-1.5 flex-shrink-0">
          <svg className="w-3.5 h-3.5 text-[#22c55e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          3D Preview
        </span>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Style toggle */}
          <div className="flex rounded overflow-hidden border border-white/20">
            {[
              { id: 'cartoon', label: 'Ribbon' },
              { id: 'surface', label: 'Surface' },
              { id: 'stick', label: 'Stick' },
              { id: 'ball+stick', label: 'Ball+Stick' },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => setCurrentStyle(s.id)}
                className={`px-2 py-1 text-[11px] font-medium transition-colors ${
                  currentStyle === s.id
                    ? 'bg-[#22c55e] text-white'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Color mode dropdown */}
          <select
            value={colorMode}
            onChange={(e) => setColorMode(e.target.value)}
            title="Color mode"
            className="text-[11px] bg-[#2a4f7c] text-white border border-white/20 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#22c55e]"
          >
            {Object.entries(PREVIEW_COLOR_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          {/* Pocket toggle — only shown when a pocket is available */}
          {hasPocket && (
            <button
              onClick={() => setShowPocket(v => !v)}
              title={showPocket ? 'Hide pocket' : 'Show pocket'}
              className={`flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-medium transition-colors ${
                showPocket
                  ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                  : 'border-white/20 text-white/50 hover:text-white/80 hover:bg-white/10'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" style={{ opacity: showPocket ? 1 : 0.4 }} />
              Pocket
            </button>
          )}

          {/* Annotations toggle — only shown when active or binding sites are available */}
          {(uniprotFeatures?.activeSites?.length > 0 || uniprotFeatures?.bindingSites?.length > 0) && (
            <button
              onClick={() => setShowAnnotations(v => !v)}
              title={showAnnotations ? 'Hide annotations' : 'Show annotations'}
              className={`flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-medium transition-colors ${
                showAnnotations
                  ? 'bg-red-500/20 border-red-400/50 text-red-300'
                  : 'border-white/20 text-white/50 hover:text-white/80 hover:bg-white/10'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-red-400 inline-block" style={{ opacity: showAnnotations ? 1 : 0.4 }} />
              Sites
            </button>
          )}

          {/* Reset view */}
          <button
            onClick={handleReset}
            title="Reset view"
            className="p-1 text-white/60 hover:text-white hover:bg-white/10 rounded transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Viewer canvas */}
      <div className="relative bg-gray-900" style={{ height: '340px' }}>
        {viewerLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-[#0f1923]">
            <div className="w-10 h-10 border-2 border-[#22c55e] border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-white/60 text-xs">Loading 3D structure...</p>
          </div>
        )}
        <div
          ref={containerRef}
          className="w-full h-full"
          style={{ visibility: viewerLoading ? 'hidden' : 'visible' }}
        />
      </div>

      {/* Legend bar */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-gray-50 border-t border-gray-100 text-[11px] text-gray-400 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" />
          Protein
        </span>
        {uniprotFeatures?.domains?.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 inline-block" />
            Domains
          </span>
        )}
        {hasPocket && showPocket && (
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
            Selected Pocket
          </span>
        )}
        {showAnnotations && uniprotFeatures?.activeSites?.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
            Active Sites
          </span>
        )}
        {showAnnotations && uniprotFeatures?.bindingSites?.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" />
            Binding Sites
          </span>
        )}
        <span className="ml-auto text-gray-300 hidden sm:inline">
          Drag: rotate  |  Scroll: zoom  |  Right-drag: pan
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Normalize assessment to the format AssessmentCard expects.
// Handles both the full BindX format and the simplified legacy format
// with flat integer scores (overall_score, druggability_score, etc.)
// ---------------------------------------------------------------------------

function normalizeAssessment(raw) {
  if (!raw) return null

  // Already in the correct format (composite_score as 0-1 float with scores object)
  if (raw.composite_score != null && raw.composite_score <= 1 && raw.scores) {
    return raw
  }

  const toFloat = (v) => (v != null ? v / 100 : 0)

  const scores = {
    evidence:     { score: toFloat(raw.data_score     ?? raw.evidence_score) },
    druggability: { score: toFloat(raw.druggability_score) },
    novelty:      { score: toFloat(raw.novelty_score) },
    safety:       { score: toFloat(raw.safety_score) },
    feasibility:  { score: toFloat(raw.structural_score ?? raw.feasibility_score) },
  }

  let composite
  if (raw.overall_score != null) {
    composite = raw.overall_score / 100
  } else {
    const vals = Object.values(scores).map(s => s.score).filter(v => v > 0)
    composite = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  }

  let recommendation = raw.recommendation
  if (!recommendation) {
    if (composite >= 0.65) recommendation = 'GO'
    else if (composite >= 0.40) recommendation = 'CAUTION'
    else recommendation = 'NO-GO'
  }

  return {
    ...raw,
    composite_score: composite,
    scores,
    recommendation,
    rationale: raw.rationale || raw.summary || '',
  }
}

// ---------------------------------------------------------------------------
// TargetSetup — Interactive wizard
// ---------------------------------------------------------------------------

export default function TargetSetup() {
  const { project, targetConfig, isTargetConfigured, refresh } = useProject()
  const navigate = useNavigate()

  // Input mode
  const [inputMode, setInputMode] = useState('uniprot') // 'uniprot' | 'fasta'

  // Form values
  const [uniprotId, setUniprotId] = useState('')
  const [fastaText, setFastaText] = useState('')

  // Preview state
  const [preview, setPreview] = useState(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [previewError, setPreviewError] = useState(null)

  // Selection state
  const [selectedStructureIdx, setSelectedStructureIdx] = useState(0)
  const [selectedPocketIdx, setSelectedPocketIdx] = useState(0)

  // UniProt features for 3D annotations
  const [uniprotFeatures, setUniprotFeatures] = useState(null)

  // Assessment state (BindX)
  const [assessment, setAssessment] = useState(null)
  const [assessmentLoading, setAssessmentLoading] = useState(false)
  const [assessmentError, setAssessmentError] = useState(null)

  // Save state
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  // Pre-fill from existing config
  useEffect(() => {
    if (targetConfig?.uniprot_features) {
      setUniprotFeatures(targetConfig.uniprot_features)
    }
    if (targetConfig?.assessment) {
      const saved = targetConfig.assessment
      // If saved assessment has unavailable agent, clear agent_analysis so re-run picks it up
      if (saved.agent_analysis && !saved.agent_analysis.available) {
        setAssessment({ ...saved, agent_analysis: null })
      } else {
        setAssessment(saved)
      }
    }
    if (targetConfig?.uniprot_id) {
      setUniprotId(targetConfig.uniprot_id)
      setPreview(targetConfig)
      setSelectedStructureIdx(targetConfig.selected_structure_idx || 0)
      setSelectedPocketIdx(targetConfig.selected_pocket_idx || 0)
    } else if (targetConfig?.sequence) {
      // FASTA mode: uniprot_id is null but sequence is set
      setInputMode('fasta')
      setFastaText(targetConfig.sequence)
      setPreview(targetConfig)
      setSelectedStructureIdx(targetConfig.selected_structure_idx || 0)
      setSelectedPocketIdx(targetConfig.selected_pocket_idx || 0)
    } else if (project?.uniprot_id) {
      setUniprotId(project.uniprot_id)
    }
  }, [targetConfig, project])

  const handleValidateFasta = async () => {
    const seq = parseFasta(fastaText)
    if (!seq) {
      setPreviewError('Invalid sequence. Only standard amino acid letters are accepted.')
      return
    }
    setLoadingPreview(true)
    setPreviewError(null)
    setPreview(null)
    try {
      const data = await previewSequence(seq)
      setPreview(data)
      setSelectedStructureIdx(0)
      setSelectedPocketIdx(0)
    } catch (err) {
      setPreviewError(err?.userMessage || err?.message || 'Failed to fold sequence.')
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleValidateUniprot = async () => {
    if (!uniprotId.trim()) return
    setLoadingPreview(true)
    setPreviewError(null)
    setPreview(null)
    try {
      const data = await previewTarget(uniprotId.trim().toUpperCase())
      setPreview(data)
      setSelectedStructureIdx(0)
      setSelectedPocketIdx(0)
    } catch (err) {
      setPreviewError(err?.userMessage || err?.message || 'Failed to validate target.')
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleRunAssessment = async () => {
    const targetId = uniprotId || preview?.uniprot_id
    if (!targetId) return
    setAssessmentLoading(true)
    setAssessmentError(null)
    try {
      const data = await runTargetAssessment(targetId, null, {
        project_id: project?.id,
        include_agents: true,
      })
      setAssessment(data)
    } catch (err) {
      setAssessmentError(err?.userMessage || err?.message || 'Assessment failed')
    } finally {
      setAssessmentLoading(false)
    }
  }

  const handleSave = async () => {
    if (!preview || !project) return
    setSaving(true)
    setSaveError(null)
    const config = {
      ...preview,
      selected_structure_idx: selectedStructureIdx,
      selected_pocket_idx: selectedPocketIdx,
      configured_at: new Date().toISOString(),
      uniprot_features: uniprotFeatures,
      assessment: assessment || null,
    }
    try {
      await updateProject(project.id, { target_preview_json: config })
      await refresh()
      navigate(`/project/${project.id}/runs`)
    } catch (err) {
      setSaveError(err?.userMessage || err?.message || 'Failed to save target configuration.')
    } finally {
      setSaving(false)
    }
  }

  // Normalise: prefer preview.structures (array), fall back to [preview.structure]
  const structures = preview?.structures || (preview?.structure ? [preview.structure] : [])
  const pockets = preview?.pockets || []
  const chembl = preview?.chembl_info || null
  const hasPreview = !!preview && !loadingPreview
  const hasStructures = structures.length > 0
  const hasPockets = pockets.length > 0
  const fastaSeq = fastaText ? parseFasta(fastaText) : null

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-[#1e3a5f]">Target Setup</h1>
        <p className="text-sm text-gray-400 mt-1">
          {isTargetConfigured
            ? 'Reconfigure your target protein, structure, and binding pocket.'
            : 'Validate a target protein, select a 3D structure, and choose a binding pocket.'}
        </p>
      </div>

      {/* Progress stepper */}
      <div className="flex items-center gap-1 mb-8">
        {[
          { num: 1, label: 'Protein' },
          { num: 2, label: 'Structure' },
          { num: 3, label: 'Pocket' },
          { num: 4, label: 'ChEMBL' },
          { num: 5, label: 'Save' },
        ].map((s, i) => {
          const currentStep = !hasPreview ? 1 : !hasStructures ? 2 : !hasPockets ? 3 : !chembl ? 4 : 5
          const isActive = s.num === currentStep
          const isDone = s.num < currentStep
          return (
            <React.Fragment key={s.num}>
              {i > 0 && <div className={`flex-1 h-0.5 ${isDone ? 'bg-[#22c55e]' : 'bg-gray-200'}`} />}
              <div className="flex flex-col items-center gap-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  isDone ? 'bg-[#22c55e] text-white' : isActive ? 'bg-[#1e3a5f] text-white ring-2 ring-[#1e3a5f]/20' : 'bg-gray-200 text-gray-400'
                }`}>
                  {isDone ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : s.num}
                </div>
                <span className={`text-[10px] font-medium ${isActive ? 'text-[#1e3a5f]' : isDone ? 'text-[#22c55e]' : 'text-gray-400'}`}>{s.label}</span>
              </div>
            </React.Fragment>
          )
        })}
      </div>

      {/* Step 1 — Enter Target */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <StepHeader number={1} title="Enter Target" done={hasPreview} active={!hasPreview} />

        {/* Mode toggle */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-4 w-fit">
          <button
            type="button"
            onClick={() => {
              if (inputMode !== 'uniprot') {
                setInputMode('uniprot')
                setPreview(null)
                setPreviewError(null)
              }
            }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              inputMode === 'uniprot' ? 'bg-white text-[#1e3a5f] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            UniProt ID
          </button>
          <button
            type="button"
            onClick={() => {
              if (inputMode !== 'fasta') {
                setInputMode('fasta')
                setPreview(null)
                setPreviewError(null)
              }
            }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              inputMode === 'fasta' ? 'bg-white text-[#1e3a5f] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            FASTA / Sequence
          </button>
        </div>

        {inputMode === 'uniprot' ? (
          <div>
            <div className="flex gap-3">
              <input
                type="text"
                value={uniprotId}
                onChange={(e) => setUniprotId(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleValidateUniprot()}
                placeholder="UniProt ID (e.g. P00533 for EGFR)"
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none"
              />
              <button
                onClick={handleValidateUniprot}
                disabled={loadingPreview || !uniprotId.trim()}
                className="px-5 py-2.5 bg-[#22c55e] text-white font-semibold rounded-lg hover:bg-[#16a34a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm whitespace-nowrap"
              >
                {loadingPreview ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Validating...
                  </>
                ) : 'Validate'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Fetches structure from PDB / AlphaFold and detects binding pockets.
            </p>
          </div>
        ) : (
          <div>
            <textarea
              value={fastaText}
              onChange={(e) => setFastaText(e.target.value)}
              rows={5}
              placeholder={">My_protein\nMTEYKLVVVGAGGVGKSALTIQLIQNHFVDE..."}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none resize-none"
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-gray-400">
                {fastaSeq
                  ? <span className="text-green-600 font-medium">{fastaSeq.length} amino acids detected</span>
                  : 'Paste a FASTA sequence or raw amino acid sequence'}
              </p>
              <button
                onClick={handleValidateFasta}
                disabled={loadingPreview || !fastaText.trim()}
                className="px-4 py-2 bg-[#22c55e] text-white font-semibold rounded-lg hover:bg-[#16a34a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center gap-2"
              >
                {loadingPreview ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Folding...
                  </>
                ) : 'Use this sequence'}
              </button>
            </div>
          </div>
        )}

        {previewError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            {previewError}
          </div>
        )}

        {hasPreview && preview.protein_name && (
          <div className="mt-3 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
            <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm text-green-700 font-medium">{preview.protein_name}</p>
          </div>
        )}
      </div>

      {/* Hint shown when only step 1 is visible and not yet validated */}
      {!hasPreview && (
        <div className="text-center py-8 text-gray-300">
          <svg className="w-8 h-8 mx-auto mb-2 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          <p className="text-sm">Enter a UniProt ID and click Validate to continue</p>
        </div>
      )}

      {/* UniProt Intelligence — shown after UniProt validation */}
      {hasPreview && inputMode === 'uniprot' && uniprotId && (
        <UniProtInfoCard uniprotId={uniprotId} onFeaturesLoaded={setUniprotFeatures} />
      )}

      {/* Step 2 — Structure selection (all available options) */}
      {hasPreview && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <StepHeader number={2} title="Select Structure" done={hasStructures} active={hasPreview && !hasStructures} />
          {hasStructures ? (
            <div className="space-y-3">
              {structures.map((s, idx) => (
                <div
                  key={idx}
                  className={`rounded-xl border-2 p-4 cursor-pointer transition-all ${
                    selectedStructureIdx === idx
                      ? 'border-[#1e3a5f] bg-blue-50/50 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedStructureIdx(idx)}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      checked={selectedStructureIdx === idx}
                      onChange={() => setSelectedStructureIdx(idx)}
                      className="mt-1 accent-[#1e3a5f]"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <StructureBadge source={s.source} />
                        {s.pdb_id && (
                          <a
                            href={`https://www.rcsb.org/structure/${s.pdb_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-mono text-[#1e3a5f] underline underline-offset-2 hover:text-[#22c55e]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {s.pdb_id}
                          </a>
                        )}
                        {s.recommended && (
                          <span className="px-1.5 py-0.5 bg-[#22c55e]/10 text-[#22c55e] text-xs font-bold rounded">
                            Recommended
                          </span>
                        )}
                        <ConfidenceDot value={s.confidence} />
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mb-1">
                        {s.resolution && <span>Resolution: {s.resolution} Å</span>}
                        {s.method && <span>Method: {s.method}</span>}
                        {s.ligand_id && (
                          <span className="text-green-600 font-medium">
                            Co-crystallized: {s.ligand_id}{s.ligand_name ? ` (${s.ligand_name})` : ''}
                          </span>
                        )}
                      </div>
                      {s.explanation && (
                        <p className="text-xs text-gray-400 leading-relaxed">{s.explanation}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No structure available for this target.</p>
          )}
        </div>
      )}

      {/* 3D Protein Viewer — shown after structure is selected */}
      {hasPreview && hasStructures && (() => {
        const sel = structures[selectedStructureIdx] || structures[0]
        if (!sel) return null
        const activePocket = pockets[selectedPocketIdx] || null
        return (
          <ProteinPreviewViewer
            pdbUrl={sel.download_url || null}
            pdbData={sel.pdb_data || null}
            uniprotFeatures={uniprotFeatures}
            selectedPocket={activePocket}
          />
        )
      })()}

      {/* Step 3 — Pocket selection */}
      {hasPreview && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <StepHeader number={3} title="Select Binding Pocket" done={hasPockets} active={true} />
          {hasPockets ? (
            <>
              <p className="text-xs text-gray-400 mb-3">
                {pockets.length} pocket{pockets.length !== 1 ? 's' : ''} detected. Select the one to use for docking.
              </p>
              <div className="space-y-2">
                {pockets.map((pocket, idx) => (
                  <div
                    key={idx}
                    className={`rounded-xl border-2 p-4 cursor-pointer transition-all ${
                      selectedPocketIdx === idx
                        ? 'border-[#1e3a5f] bg-blue-50/50 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedPocketIdx(idx)}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        checked={selectedPocketIdx === idx}
                        onChange={() => setSelectedPocketIdx(idx)}
                        className="mt-1 accent-[#1e3a5f]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-semibold text-[#1e3a5f]">
                            Pocket {pocket.rank || idx + 1}
                          </span>
                          {idx === 0 && (
                            <span className="px-1.5 py-0.5 bg-[#22c55e]/10 text-[#22c55e] text-xs font-bold rounded">
                              Recommended
                            </span>
                          )}
                          {pocket.method && (
                            <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                              pocket.method === 'co-crystallized_ligand' ? 'bg-green-100 text-green-700' :
                              pocket.method === 'p2rank' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {pocket.method === 'co-crystallized_ligand' ? 'Experimental' :
                               pocket.method === 'p2rank' || pocket.method === 'p2rank_mock' ? 'P2Rank ML' :
                               pocket.method === 'fpocket' ? 'fpocket' : pocket.method}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500 mb-2 flex-wrap">
                          {(pocket.residues_count || pocket.n_residues) != null && (
                            <span>{pocket.residues_count || pocket.n_residues} residues</span>
                          )}
                          {pocket.volume > 0 && <span>Volume: {Number(pocket.volume).toFixed(0)} Å³</span>}
                          {pocket.center && Array.isArray(pocket.center) && (
                            <span className="text-gray-400 font-mono text-[10px]">
                              ({pocket.center.map(c => Number(c).toFixed(1)).join(', ')})
                            </span>
                          )}
                        </div>
                        {(pocket.probability != null || pocket.druggability != null) && (
                          <DruggabilityBar value={pocket.probability ?? pocket.druggability} />
                        )}
                        {pocket.explanation && (
                          <p className="text-xs text-gray-400 mt-2 leading-relaxed">{pocket.explanation}</p>
                        )}
                        {pocket.residues && selectedPocketIdx === idx && (() => {
                          const resArr = Array.isArray(pocket.residues) ? pocket.residues : (typeof pocket.residues === 'string' ? pocket.residues.split(',').map(s => s.trim()).filter(Boolean) : [])
                          if (resArr.length === 0) return null
                          return (
                            <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                              <p className="text-[10px] text-gray-400 font-semibold uppercase mb-1">Key Residues</p>
                              <p className="text-xs text-gray-600 font-mono leading-relaxed break-all">
                                {resArr.slice(0, 20).join(', ')}
                                {resArr.length > 20 && <span className="text-gray-400"> +{resArr.length - 20} more</span>}
                              </p>
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-sm text-gray-500">
                {inputMode === 'fasta'
                  ? 'Pockets will be detected automatically when the pipeline runs (structure must be predicted first).'
                  : 'No pockets detected. The pipeline will attempt automatic pocket detection.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Step 4 — ChEMBL info */}
      {hasPreview && chembl && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <StepHeader number={4} title="ChEMBL Data" done={true} active={false} />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Known Actives</p>
              <p className="text-lg font-bold text-[#1e3a5f]">
                {chembl.has_data ? (chembl.n_actives || 0).toLocaleString() : '0'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">IC50 Data Available</p>
              <p className="text-lg font-bold text-[#1e3a5f]">{chembl.has_data ? 'Yes' : 'No'}</p>
            </div>
          </div>
          {!chembl.has_data && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-3">
              No ChEMBL data found. You can still screen using ZINC or custom SMILES.
            </p>
          )}
        </div>
      )}

      {/* Druggability Assessment — computed from all available data */}
      {hasPreview && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-full bg-[#1e3a5f] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-[#1e3a5f]">Druggability Assessment</h3>
          </div>
          {(() => {
            // Compute druggability score from available data
            const factors = []
            let score = 0
            let maxScore = 0

            // Structure quality
            const structSrc = structures?.[0]?.source
            if (structSrc === 'pdb_experimental') { factors.push({ label: 'Experimental structure (PDB)', status: 'green', points: 3 }); score += 3 }
            else if (structSrc === 'alphafold') { factors.push({ label: 'AlphaFold predicted structure', status: 'yellow', points: 2 }); score += 2 }
            else if (structSrc) { factors.push({ label: 'Predicted structure (ESMFold)', status: 'yellow', points: 1 }); score += 1 }
            maxScore += 3

            // Pocket quality
            const topPocket = pockets[0]
            if (topPocket) {
              const prob = topPocket.probability ?? 0
              if (topPocket.method === 'co-crystallized_ligand') { factors.push({ label: 'Experimentally validated pocket', status: 'green', points: 3 }); score += 3 }
              else if (prob >= 0.7) { factors.push({ label: `High-confidence pocket (${(prob * 100).toFixed(0)}%)`, status: 'green', points: 2 }); score += 2 }
              else if (prob >= 0.4) { factors.push({ label: `Moderate pocket confidence (${(prob * 100).toFixed(0)}%)`, status: 'yellow', points: 1 }); score += 1 }
              else { factors.push({ label: `Low pocket confidence (${(prob * 100).toFixed(0)}%)`, status: 'red', points: 0 }) }
            } else {
              factors.push({ label: 'No pocket detected', status: 'red', points: 0 })
            }
            maxScore += 3

            // Known actives
            if (chembl?.has_data && chembl.n_actives > 100) { factors.push({ label: `${chembl.n_actives} known actives (ChEMBL)`, status: 'green', points: 2 }); score += 2 }
            else if (chembl?.has_data && chembl.n_actives > 0) { factors.push({ label: `${chembl.n_actives} known actives (ChEMBL)`, status: 'yellow', points: 1 }); score += 1 }
            else { factors.push({ label: 'No known actives in ChEMBL', status: 'red', points: 0 }) }
            maxScore += 2

            // Resolution (if PDB)
            const resolution = structures?.[0]?.resolution
            if (resolution && resolution <= 2.5) { factors.push({ label: `High resolution (${resolution} Å)`, status: 'green', points: 1 }); score += 1 }
            else if (resolution && resolution <= 3.5) { factors.push({ label: `Moderate resolution (${resolution} Å)`, status: 'yellow', points: 0.5 }); score += 0.5 }
            maxScore += 1

            const pct = Math.round((score / maxScore) * 100)
            const level = pct >= 75 ? 'High' : pct >= 50 ? 'Moderate' : pct >= 25 ? 'Low' : 'Very Low'
            const levelColor = pct >= 75 ? 'text-green-700 bg-green-100' : pct >= 50 ? 'text-yellow-700 bg-yellow-100' : 'text-red-700 bg-red-100'

            return (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${levelColor}`}>{level} Druggability</span>
                      <span className="text-sm font-bold text-[#1e3a5f]">{pct}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${
                        pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-400' : 'bg-red-400'
                      }`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {factors.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        f.status === 'green' ? 'bg-green-500' : f.status === 'yellow' ? 'bg-yellow-400' : 'bg-red-400'
                      }`} />
                      <span className="text-gray-600">{f.label}</span>
                    </div>
                  ))}
                </div>
                {pct < 50 && (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mt-3">
                    Low druggability score suggests this target may be challenging. Consider experimental validation before investing in large-scale screening.
                  </p>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* BindX: Target Assessment */}
      {hasPreview && inputMode === 'uniprot' && uniprotId && (
        <div className="space-y-3">
          {!assessment && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-[#1e3a5f] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-[#1e3a5f]">Target Assessment (BindX)</h3>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Run a comprehensive 5-score assessment of this target before screening. Evaluates evidence, druggability, novelty, safety, and feasibility.
              </p>
              <button
                onClick={handleRunAssessment}
                disabled={assessmentLoading}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#1e3a5f] text-white font-semibold rounded-lg hover:bg-[#2a4f7c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                {assessmentLoading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Assessing target...
                  </>
                ) : 'Run Target Assessment'}
              </button>
              {assessmentError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  {assessmentError}
                </div>
              )}
            </div>
          )}

          {assessment && (
            <div className="space-y-3">
              <AssessmentCard assessment={normalizeAssessment(assessment)} />
              {/* Agent 1: Target Assessment — inline prominent card */}
              {assessment.agent_analysis && (
                <AgentAdvisorCard
                  agentName="target"
                  context={{
                    scores: assessment.scores,
                    composite_score: assessment.composite_score,
                    recommendation: assessment.recommendation,
                    rationale: assessment.rationale,
                    uniprot_id: uniprotId,
                    protein_name: preview?.protein_name,
                    target_name: preview?.protein_name,
                  }}
                  result={assessment.agent_analysis}
                  projectId={project?.id}
                />
              )}
              {!assessment.agent_analysis && (
                <AgentAdvisorCard
                  agentName="target"
                  context={{
                    scores: assessment.scores,
                    composite_score: assessment.composite_score,
                    recommendation: assessment.recommendation,
                    rationale: assessment.rationale,
                    uniprot_id: uniprotId,
                    protein_name: preview?.protein_name,
                    target_name: preview?.protein_name,
                  }}
                  projectId={project?.id}
                />
              )}
              <button
                onClick={handleRunAssessment}
                disabled={assessmentLoading}
                className="text-xs text-[#1e3a5f] hover:underline font-medium flex items-center gap-1"
              >
                {assessmentLoading ? 'Re-assessing...' : 'Re-run Assessment'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 5 — Save */}
      {hasPreview && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <StepHeader number={5} title="Save Configuration" done={false} active={true} />
          {saveError && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {saveError}
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !hasStructures}
              className="flex items-center gap-2 px-6 py-3 bg-[#22c55e] hover:bg-[#16a34a] disabled:bg-gray-300 text-white font-bold rounded-xl shadow transition-colors text-sm"
            >
              {saving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save Target Configuration
                </>
              )}
            </button>
            {isTargetConfigured && (
              <span className="text-xs text-gray-400">This will update the existing configuration.</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
