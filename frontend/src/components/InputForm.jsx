import React, { useState, useEffect, useRef } from 'react'
import { createJob, previewTarget } from '../api.js'
import InfoTip from './InfoTip.jsx'
import AnalysisToggles, { DEFAULT_VALUES } from './AnalysisToggles'

const EXAMPLE_UNIPROT = 'P00533'
const VALID_AA = /^[ACDEFGHIKLMNPQRSTVWY]+$/

// ---------------------------------------------------------------------------
// TargetPreviewCard — purely informational, renders preview API response
// ---------------------------------------------------------------------------
function TargetPreviewCard({ preview, loading }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 animate-pulse space-y-2">
        <div className="h-4 bg-blue-200 rounded w-2/3" />
        <div className="h-3 bg-blue-100 rounded w-1/2" />
        <div className="h-3 bg-blue-100 rounded w-3/4" />
      </div>
    )
  }

  if (!preview) return null

  const {
    structure_source,
    pdb_id,
    resolution,
    method,
    cocrystal_ligand,
    explanation,
    pockets,
    selected_pocket,
    chembl_actives,
    chembl_ic50,
  } = preview

  const sourceLabel = structure_source === 'experimental'
    ? 'PDB Experimental'
    : structure_source === 'alphafold'
    ? 'AlphaFold Predicted'
    : structure_source === 'esmfold'
    ? 'ESMFold Predicted'
    : structure_source || 'Unknown'

  const sourceColor = structure_source === 'experimental'
    ? 'text-dockit-green'
    : 'text-amber-600'

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 space-y-3 text-sm">

      {/* Structure row */}
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-base leading-none">🏗</span>
        <div>
          <span className="font-semibold text-dockit-blue">Structure: </span>
          <span className={`font-medium ${sourceColor}`}>{sourceLabel}</span>
          {pdb_id && (
            <a
              href={`https://www.rcsb.org/structure/${pdb_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1.5 font-mono text-xs text-dockit-blue underline hover:text-blue-700"
            >
              {pdb_id}
            </a>
          )}
          <div className="text-xs text-gray-500 mt-0.5 space-x-2">
            {resolution && <span>Resolution: {resolution} A</span>}
            {method && <span>| Method: {method}</span>}
            {cocrystal_ligand && (
              <span>| Co-crystallized ligand: <strong>{cocrystal_ligand}</strong></span>
            )}
          </div>
        </div>
      </div>

      {/* Explanation */}
      {explanation && (
        <div className="flex items-start gap-2">
          <span className="mt-0.5 text-base leading-none">📝</span>
          <p className="text-xs text-gray-600 leading-relaxed">{explanation}</p>
        </div>
      )}

      {/* Pockets */}
      {pockets && pockets.length > 0 && (
        <div className="flex items-start gap-2">
          <span className="mt-0.5 text-base leading-none">📍</span>
          <div>
            <span className="font-semibold text-dockit-blue">
              Pockets: {pockets.length} detected
            </span>
            {selected_pocket && (
              <div className="mt-0.5 text-xs text-dockit-green font-medium">
                Selected: #{selected_pocket.rank} {selected_pocket.source}
                {selected_pocket.probability != null && (
                  <span className="ml-1 text-gray-500">
                    ({(selected_pocket.probability * 100).toFixed(0)}% probability
                    {selected_pocket.residues ? `, ${selected_pocket.residues} residues` : ''})
                  </span>
                )}
              </div>
            )}
            {pockets.length > 1 && (
              <div className="mt-0.5 text-xs text-gray-400">
                {'Others: '}
                {pockets
                  .filter((_, i) => i !== 0)
                  .slice(0, 3)
                  .map((p, i) => (
                    <span key={i}>
                      {i > 0 && ', '}
                      #{p.rank} {p.method || p.source || 'P2Rank'}
                      {p.probability != null && ` (${(p.probability * 100).toFixed(0)}%)`}
                    </span>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ChEMBL stats */}
      {chembl_actives != null && (
        <div className="flex items-center gap-2 text-xs text-gray-500 border-t border-blue-100 pt-2 mt-1">
          <span className="text-base leading-none">💊</span>
          <span>
            ChEMBL: <strong className="text-dockit-blue">{chembl_actives.toLocaleString()}</strong> known actives
            {chembl_ic50 != null && (
              <>, <strong className="text-dockit-blue">{chembl_ic50.toLocaleString()}</strong> with IC50</>
            )}
          </span>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function InputForm({ onJobCreated }) {
  const [inputMode, setInputMode] = useState('uniprot')
  const [uniprotId, setUniprotId] = useState('')
  const [sequence, setSequence] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Target preview state
  const [targetPreview, setTargetPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const debounceRef = useRef(null)

  // Screening options
  const [maxLigands, setMaxLigands] = useState(20)
  const [dockingEngine, setDockingEngine] = useState('gnina')
  const [analyses, setAnalyses] = useState(DEFAULT_VALUES)
  const [boxSize, setBoxSize] = useState([null, null, null])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [notificationEmail, setNotificationEmail] = useState('')

  // ------------------------------------------------------------------
  // Debounced preview fetch whenever uniprotId changes (uniprot mode)
  // ------------------------------------------------------------------
  useEffect(() => {
    if (inputMode !== 'uniprot') return

    const trimmed = uniprotId.trim().toUpperCase()

    if (trimmed.length < 4) {
      setTargetPreview(null)
      setPreviewLoading(false)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      setPreviewLoading(true)
      try {
        const raw = await previewTarget(trimmed)
        const struct = raw.structure || {}
        const chembl = raw.chembl_info || {}
        const pocketsList = (raw.pockets || [])
        const selected = pocketsList.find(p => p.selected) || null
        setTargetPreview({
          uniprot_id: raw.uniprot_id,
          protein_name: raw.protein_name,
          structure_source: struct.source?.replace('pdb_experimental', 'experimental') || null,
          pdb_id: struct.pdb_id || null,
          resolution: struct.resolution || null,
          method: struct.method || null,
          cocrystal_ligand: struct.ligand_id || struct.ligand_name || null,
          explanation: struct.explanation || null,
          pockets: pocketsList,
          selected_pocket: selected ? {
            rank: selected.rank,
            source: selected.method || 'P2Rank',
            probability: selected.probability,
            residues: selected.residues_count || null,
          } : null,
          chembl_actives: chembl.has_data ? chembl.n_actives : null,
          chembl_ic50: chembl.has_data ? chembl.n_with_ic50 : null,
        })
      } catch {
        setTargetPreview(null)
      } finally {
        setPreviewLoading(false)
      }
    }, 600)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [uniprotId, inputMode])

  // Clear preview when switching to sequence mode
  useEffect(() => {
    if (inputMode === 'sequence') {
      setTargetPreview(null)
      setPreviewLoading(false)
    }
  }, [inputMode])

  const validateSequence = (seq) => {
    const clean = seq.replace(/^>.*\n?/gm, '').replace(/\s/g, '').toUpperCase()
    if (clean.length < 50) return 'The sequence must contain at least 50 amino acids.'
    if (!clean.startsWith('M')) return 'The sequence must start with M (methionine).'
    if (!VALID_AA.test(clean)) return 'The sequence contains invalid characters. Use only standard amino acids.'
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    let submitUniprotId = null
    let submitSequence = null

    if (inputMode === 'uniprot') {
      const trimmed = uniprotId.trim().toUpperCase()
      if (!trimmed) { setError('Please enter a UniProt identifier.'); return }
      if (trimmed.length < 4) { setError('UniProt identifier is too short.'); return }
      submitUniprotId = trimmed
    } else {
      const seqError = validateSequence(sequence)
      if (seqError) { setError(seqError); return }
      submitSequence = sequence.replace(/^>.*\n?/gm, '').replace(/\s/g, '').toUpperCase()
    }

    setLoading(true)
    try {
      const params = {
        mode: 'standard',
        docking_engine: dockingEngine,
        max_ligands: Number(maxLigands),
        enable_dmpk: Object.values(analyses).every(v => v),
        ...analyses,
        enable_generation: false,
        enable_retrosynthesis: analyses.enable_synthesis,
        box_size: boxSize.some(v => v != null && v > 0) ? boxSize.map(v => v || 25) : null,
      }

      if (submitUniprotId) params.uniprot_id = submitUniprotId
      if (submitSequence)  params.sequence   = submitSequence
      if (notificationEmail.trim()) params.notification_email = notificationEmail.trim()

      const result = await createJob(params)
      onJobCreated(result.job_id)
    } catch (err) {
      setError(err.userMessage || 'Unable to create the job.')
    } finally {
      setLoading(false)
    }
  }

  const cleanSequence = sequence.replace(/^>.*\n?/gm, '').replace(/\s/g, '')
  const showPreview = inputMode === 'uniprot' && (previewLoading || targetPreview !== null)

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <p className="text-gray-500 text-lg max-w-xl mx-auto">
          Enter your target protein to start an automated screening.
          The system automatically chooses the best strategy.
        </p>
      </div>

      <div className="card p-8">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* --- 1. Target input --- */}

          {/* Segmented control */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setInputMode('uniprot')}
              className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${
                inputMode === 'uniprot'
                  ? 'bg-white text-dockit-blue shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              UniProt ID
              <InfoTip text="UniProt is a database of protein sequences. Enter the accession ID (e.g. P00533 for EGFR)." />
            </button>
            <button
              type="button"
              onClick={() => setInputMode('sequence')}
              className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${
                inputMode === 'sequence'
                  ? 'bg-white text-dockit-blue shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Protein Sequence
              <InfoTip text="Paste the raw amino acid sequence of your target protein (FASTA format without header)." />
            </button>
          </div>

          {/* Input field */}
          {inputMode === 'uniprot' ? (
            <div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={uniprotId}
                  onChange={(e) => setUniprotId(e.target.value.toUpperCase())}
                  placeholder="e.g. P00533 for EGFR"
                  className="input-field font-mono text-base tracking-wider flex-1"
                  maxLength={10}
                  disabled={loading}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => { setUniprotId(EXAMPLE_UNIPROT); setError(null) }}
                  disabled={loading}
                  className="flex-shrink-0 px-4 py-2 text-sm font-medium text-dockit-blue border border-dockit-blue rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50"
                >
                  EGFR Example
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-400">E.g.: P00533, Q9Y6K9</p>
            </div>
          ) : (
            <div>
              <textarea
                value={sequence}
                onChange={(e) => setSequence(e.target.value)}
                placeholder={">my_protein\nMKTLLPFLVLALVSSYARA..."}
                rows={6}
                disabled={loading}
                className="input-field font-mono text-xs resize-none w-full"
              />
              <div className="flex justify-between mt-1">
                <p className="text-xs text-gray-400">
                  Paste your FASTA sequence or the raw amino acid sequence
                </p>
                <span className={`text-xs font-mono ${cleanSequence.length >= 50 ? 'text-dockit-green' : 'text-gray-400'}`}>
                  {cleanSequence.length} aa
                </span>
              </div>
            </div>
          )}

          {/* Target Preview Card */}
          {showPreview && (
            <TargetPreviewCard preview={targetPreview} loading={previewLoading} />
          )}

          {/* --- 2. Compounds count slider --- */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              How many compounds to screen?
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={5}
                max={500}
                value={maxLigands}
                onChange={(e) => setMaxLigands(Number(e.target.value))}
                disabled={loading}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#1e3a5f]"
              />
              <input
                type="number"
                min={5}
                max={5000}
                value={maxLigands}
                onChange={(e) => setMaxLigands(Number(e.target.value))}
                disabled={loading}
                className="w-20 px-2 py-1 text-sm border rounded text-center"
              />
            </div>
            {maxLigands > 200 && (
              <p className="text-xs text-gray-400">
                Large library -- will use extended screening (up to 4h)
              </p>
            )}
          </div>

          {/* --- 3. Docking engine --- */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Docking engine</label>
            <div className="space-y-2">
              <label
                className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                style={dockingEngine === 'gnina' ? { borderColor: '#1e3a5f', backgroundColor: '#f0f4f8' } : {}}
              >
                <input
                  type="radio"
                  name="engine"
                  value="gnina"
                  checked={dockingEngine === 'gnina'}
                  onChange={() => setDockingEngine('gnina')}
                  disabled={loading}
                  className="mt-0.5 accent-[#1e3a5f]"
                />
                <div>
                  <span className="font-medium text-sm">GNINA</span>
                  <p className="text-xs text-gray-500">CNN-scored (~15s/mol) -- More accurate poses</p>
                </div>
              </label>
              <label
                className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                style={dockingEngine === 'vina' ? { borderColor: '#1e3a5f', backgroundColor: '#f0f4f8' } : {}}
              >
                <input
                  type="radio"
                  name="engine"
                  value="vina"
                  checked={dockingEngine === 'vina'}
                  onChange={() => setDockingEngine('vina')}
                  disabled={loading}
                  className="mt-0.5 accent-[#1e3a5f]"
                />
                <div>
                  <span className="font-medium text-sm">Vina</span>
                  <p className="text-xs text-gray-500">Fast (~2s/mol) -- Recommended for large libraries</p>
                </div>
              </label>
            </div>
          </div>

          {/* --- 4. Analysis toggles --- */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Analyses</label>
            <AnalysisToggles values={analyses} onChange={setAnalyses} />
          </div>

          {/* --- 4b. Advanced settings (collapsible) --- */}
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-gray-400 hover:text-[#1e3a5f] transition-colors"
            >
              {showAdvanced ? '▼' : '▶'} Advanced settings
            </button>
            {showAdvanced && (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-2">
                <label className="block text-xs font-medium text-gray-600">Docking box size (auto if empty)</label>
                <div className="flex gap-2">
                  {['X', 'Y', 'Z'].map((axis, i) => (
                    <div key={axis} className="flex-1">
                      <label className="text-[10px] text-gray-400">{axis} (A)</label>
                      <input
                        type="number"
                        min="5"
                        max="100"
                        step="1"
                        placeholder="auto"
                        value={boxSize[i] || ''}
                        onChange={e => {
                          const v = [...boxSize]
                          v[i] = e.target.value ? Number(e.target.value) : null
                          setBoxSize(v)
                        }}
                        className="w-full px-2 py-1 text-sm border rounded"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* --- 5. Notification email --- */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Email for notification (optional)
            </label>
            <input
              type="email"
              value={notificationEmail}
              onChange={(e) => setNotificationEmail(e.target.value)}
              placeholder="you@email.com"
              className="input-field text-sm"
              disabled={loading}
            />
            <p className="text-xs text-gray-400 mt-1">
              Receive a link to results when the screening is complete.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* --- 6. Submit --- */}
          <button
            type="submit"
            disabled={loading || (inputMode === 'uniprot' ? !uniprotId.trim() : cleanSequence.length < 50)}
            className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-dockit-green hover:bg-dockit-green-dark text-white font-semibold text-lg rounded-xl transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Creating job...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Start Screening
              </>
            )}
          </button>
        </form>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-dockit-blue mb-1">Auto</div>
          <div className="text-xs text-gray-500">Adaptive strategy</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-dockit-green mb-1">Score/100</div>
          <div className="text-xs text-gray-500">Clear results</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-dockit-blue mb-1">PDF</div>
          <div className="text-xs text-gray-500">Full report</div>
        </div>
      </div>
    </div>
  )
}
