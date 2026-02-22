import React, { useState } from 'react'
import { createJob } from '../api.js'
import InfoTip from './InfoTip.jsx'

const EXAMPLE_UNIPROT = 'P00533'
const VALID_AA = /^[ACDEFGHIKLMNPQRSTVWY]+$/

export default function InputForm({ onJobCreated }) {
  const [inputMode, setInputMode] = useState('uniprot')
  const [uniprotId, setUniprotId] = useState('')
  const [sequence, setSequence] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [showAdvanced, setShowAdvanced] = useState(false)
  const [precision, setPrecision] = useState('standard')
  const [customSmiles, setCustomSmiles] = useState('')
  const [dockingEngine, setDockingEngine] = useState('auto')
  const [maxLigands, setMaxLigands] = useState(50)
  const [notificationEmail, setNotificationEmail] = useState('')

  const maxLigandsRange = precision === 'deep'
    ? { min: 10, max: 5000 }
    : { min: 10, max: 500 }

  const handlePrecisionChange = (value) => {
    setPrecision(value)
    // Reset max_ligands to the default for the chosen mode
    if (value === 'deep') setMaxLigands(500)
    else setMaxLigands(50)
  }

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

    const smilesLines = customSmiles.trim()
      ? customSmiles.split('\n').map(s => s.trim()).filter(s => s.length > 0)
      : null

    setLoading(true)
    try {
      const params = {
        mode: precision,
        docking_engine: dockingEngine,
      }
      if (precision !== 'rapid') {
        params.max_ligands = Number(maxLigands)
      }
      if (submitUniprotId) params.uniprot_id = submitUniprotId
      if (submitSequence) params.sequence = submitSequence
      if (smilesLines) params.smiles_list = smilesLines
      if (precision === 'deep' && notificationEmail.trim()) {
        params.notification_email = notificationEmail.trim()
      }

      const result = await createJob(params)
      onJobCreated(result.job_id)
    } catch (err) {
      setError(err.userMessage || 'Unable to create the job.')
    } finally {
      setLoading(false)
    }
  }

  const cleanSequence = sequence.replace(/^>.*\n?/gm, '').replace(/\s/g, '')

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

          {/* Input field — changes based on mode */}
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

          {/* Advanced options accordion */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <span className="font-medium">Advanced Options</span>
              <svg
                className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showAdvanced && (
              <div className="px-4 pb-4 border-t border-gray-100 pt-4 space-y-5">

                {/* Precision */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block flex items-center">
                    Analysis Precision
                    <InfoTip text="Choose the depth of analysis. Higher precision includes more features but takes longer." />
                  </label>
                  <div className="space-y-2">
                    {[
                      { value: 'rapid', label: 'Quick', desc: '50 molecules, ~5 min — docking + scoring', icon: '⚡' },
                      { value: 'standard', label: 'Standard', desc: '500 molecules, ~15 min — docking + ADMET + retrosynthesis', icon: '🎯', recommended: true },
                      { value: 'deep', label: 'Deep', desc: 'Full ChEMBL database 2.4M, ~3h — 5 passes + ADMET + retrosynthesis', icon: '🔬' },
                    ].map(opt => (
                      <label
                        key={opt.value}
                        className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-all ${
                          precision === opt.value
                            ? 'border-dockit-blue bg-blue-50/50'
                            : 'border-gray-100 hover:border-gray-200'
                        }`}
                      >
                        <input
                          type="radio"
                          name="precision"
                          value={opt.value}
                          checked={precision === opt.value}
                          onChange={() => handlePrecisionChange(opt.value)}
                          className="mt-0.5 text-dockit-blue"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-700">
                            {opt.icon} {opt.label}
                            {opt.recommended && (
                              <span className="ml-2 text-xs px-2 py-0.5 bg-dockit-blue text-white rounded-full">
                                Recommended
                              </span>
                            )}
                          </span>
                          <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Email notification for deep mode */}
                {precision === 'deep' && (
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
                )}

                {/* Custom SMILES */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Add your own molecules (SMILES, one per line)
                  </label>
                  <textarea
                    value={customSmiles}
                    onChange={(e) => setCustomSmiles(e.target.value)}
                    placeholder={"CCO\nCCN\n..."}
                    rows={3}
                    disabled={loading}
                    className="input-field font-mono text-xs resize-none w-full"
                  />
                </div>

                {/* Docking engine + Max candidates — standard and deep only */}
                {(precision === 'standard' || precision === 'deep') && (
                  <>
                    {/* Docking engine */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block flex items-center">
                        Docking Engine
                        <InfoTip text="Algorithm used to predict how molecules bind to the protein pocket. Auto selects GNINA when available, falling back to Vina." />
                      </label>
                      <div className="flex gap-3">
                        {[
                          { value: 'auto',  label: 'Auto',  desc: 'GNINA if available' },
                          { value: 'gnina', label: 'GNINA', desc: 'CNN-scored, slow ~15s/mol' },
                          { value: 'vina',  label: 'Vina',  desc: 'Fast ~2s/mol' },
                        ].map(opt => (
                          <label
                            key={opt.value}
                            className={`flex-1 flex items-center gap-2 p-3 rounded-lg cursor-pointer border transition-all ${
                              dockingEngine === opt.value
                                ? 'border-dockit-blue bg-blue-50/50'
                                : 'border-gray-100 hover:border-gray-200'
                            }`}
                          >
                            <input
                              type="radio"
                              name="docking_engine"
                              value={opt.value}
                              checked={dockingEngine === opt.value}
                              onChange={() => setDockingEngine(opt.value)}
                              className="text-dockit-blue"
                            />
                            <div>
                              <span className="text-sm font-medium text-gray-700">{opt.label}</span>
                              <p className="text-xs text-gray-400">{opt.desc}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Max candidates */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block flex items-center">
                        Max Candidates
                        <InfoTip text={`Maximum number of molecules to screen. Range: ${maxLigandsRange.min}–${maxLigandsRange.max} for ${precision} mode.`} />
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          value={maxLigands}
                          min={maxLigandsRange.min}
                          max={maxLigandsRange.max}
                          step={precision === 'deep' ? 100 : 10}
                          onChange={(e) => {
                            const v = Math.max(maxLigandsRange.min, Math.min(maxLigandsRange.max, Number(e.target.value)))
                            setMaxLigands(v)
                          }}
                          disabled={loading}
                          className="input-field w-36 text-sm font-mono"
                        />
                        <input
                          type="range"
                          value={maxLigands}
                          min={maxLigandsRange.min}
                          max={maxLigandsRange.max}
                          step={precision === 'deep' ? 100 : 10}
                          onChange={(e) => setMaxLigands(Number(e.target.value))}
                          disabled={loading}
                          className="flex-1 accent-dockit-blue"
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {precision === 'deep'
                          ? 'Deep mode: 10 to 5000 candidates. Large values significantly increase run time.'
                          : 'Standard mode: 10 to 500 candidates.'}
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
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

          {/* Mode summary */}
          <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-lg px-4 py-2.5">
            <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {precision === 'rapid' ? (
              <span>Mode <strong className="text-gray-600">Quick</strong>: docking + scoring only. Switch to Standard mode for ADMET analysis and retrosynthesis.</span>
            ) : precision === 'standard' ? (
              <span>Mode <strong className="text-dockit-blue">Standard</strong>: docking + <strong className="text-dockit-blue">ADMET</strong> (toxicity) + <strong className="text-dockit-blue">retrosynthesis</strong> (feasibility).</span>
            ) : (
              <span>Mode <strong className="text-purple-600">Deep</strong>: massive screening 5 passes + <strong className="text-purple-600">ADMET</strong> + <strong className="text-purple-600">retrosynthesis</strong> on top 50.</span>
            )}
          </div>

          {/* Submit */}
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
