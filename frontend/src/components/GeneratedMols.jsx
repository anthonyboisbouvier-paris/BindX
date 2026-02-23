import React, { useState, useMemo } from 'react'
import InfoTip from './InfoTip.jsx'
import MoleculeCard from './MoleculeCard'

// --------------------------------------------------
// Helpers
// --------------------------------------------------
function affinityColor(affinity) {
  if (affinity === null || affinity === undefined) return 'text-gray-500'
  if (affinity < -9) return 'text-green-600'
  if (affinity < -7) return 'text-blue-600'
  return 'text-gray-500'
}

function admetDot(score, colorCode) {
  if (colorCode) {
    if (colorCode.toLowerCase() === 'green')  return 'bg-green-500'
    if (colorCode.toLowerCase() === 'yellow') return 'bg-yellow-400'
    if (colorCode.toLowerCase() === 'red')    return 'bg-red-500'
  }
  if (score === null || score === undefined) return 'bg-gray-300'
  if (score >= 0.65) return 'bg-green-500'
  if (score >= 0.4)  return 'bg-yellow-400'
  return 'bg-red-500'
}

const SORT_OPTIONS = [
  { key: 'composite_score', label: 'Composite Score' },
  { key: 'affinity',        label: 'Affinity' },
  { key: 'novelty',         label: 'Novelty' },
]

// --------------------------------------------------
// Novelty bar
// --------------------------------------------------
function NoveltyBar({ value }) {
  if (value === null || value === undefined) return null
  const pct = Math.round(value * 100)
  const color = pct >= 70 ? 'bg-purple-500' : pct >= 40 ? 'bg-purple-300' : 'bg-gray-300'
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] text-gray-400 flex items-center">
          Novelty
          <InfoTip text="How structurally different this molecule is from known compounds (0-100%). Higher novelty means a more original chemical scaffold." />
        </span>
        <span className="text-[10px] font-semibold text-purple-600">{pct}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// --------------------------------------------------
// Single molecule card in the grid
// --------------------------------------------------
function AICard({ mol, index, isSelected, onSelect }) {
  const name      = mol.name || mol.molecule_name || `Gen-${index + 1}`
  const affinity  = mol.affinity !== undefined ? Number(mol.affinity) : null
  const score     = mol.composite_score !== undefined ? Number(mol.composite_score) : null
  const novelty   = mol.novelty !== undefined ? Number(mol.novelty) : null
  const admetScore = mol.admet?.composite_score ?? mol.admet_score ?? null
  const colorCode  = mol.admet?.color_code ?? null
  const dotClass   = admetDot(admetScore, colorCode)

  return (
    <button
      onClick={() => onSelect(isSelected ? null : index)}
      className={`flex flex-col gap-2 p-3 rounded-xl border-2 text-left transition-all duration-150 hover:shadow-md w-full ${
        isSelected
          ? 'border-purple-500 bg-purple-50 shadow-md'
          : 'border-gray-100 bg-white hover:border-purple-200 hover:bg-purple-50/30'
      }`}
    >
      {/* AI badge */}
      <span className="self-start flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-purple-600 text-white rounded-full font-medium">
        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
        </svg>
        AI Gen
      </span>

      {/* 2D structure thumbnail */}
      <div className="w-full h-36 flex items-center justify-center bg-gray-50 rounded-lg border border-gray-100 [&>svg]:max-w-full [&>svg]:max-h-full [&>svg]:w-auto [&>svg]:h-auto">
        {mol.svg ? (
          <div
            className="w-full h-full flex items-center justify-center [&>svg]:max-w-full [&>svg]:max-h-full [&>svg]:w-auto [&>svg]:h-auto"
            dangerouslySetInnerHTML={{ __html: mol.svg }}
          />
        ) : (
          <svg className="w-8 h-8 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        )}
      </div>

      {/* Name */}
      <p className="text-xs font-semibold text-gray-700 truncate w-full" title={name}>{name}</p>

      {/* Affinity */}
      {affinity !== null && (
        <p className={`text-xs font-mono font-semibold ${affinityColor(affinity)}`}>
          {affinity.toFixed(1)} kcal/mol
        </p>
      )}

      {/* Novelty bar */}
      <NoveltyBar value={novelty} />

      {/* ADMET score row */}
      {(score !== null || admetScore !== null) && (
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`} />
            <span className="text-[10px] text-gray-400">ADMET</span>
          </div>
          <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">
            {(admetScore ?? score ?? 0).toFixed(3)}
          </span>
        </div>
      )}
    </button>
  )
}

// --------------------------------------------------
// Expanded detail panel for a selected molecule
// --------------------------------------------------
function MolDetail({ mol, onClose }) {
  if (!mol) return null
  const name     = mol.name || mol.molecule_name || 'AI Molecule'
  const affinity = mol.affinity !== undefined ? Number(mol.affinity) : null
  const score    = mol.composite_score !== undefined ? Number(mol.composite_score) : null

  return (
    <div className="border-2 border-purple-200 rounded-xl bg-purple-50/50 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-purple-600 text-white rounded-full font-medium">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
            </svg>
            AI Generated
          </span>
          <h4 className="font-semibold text-purple-800 text-sm truncate max-w-[200px]" title={name}>{name}</h4>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 2D Structure */}
      {mol.svg && (
        <div className="bg-white rounded-lg p-2 border border-purple-100 flex items-center justify-center" style={{ minHeight: '120px' }}>
          <div dangerouslySetInnerHTML={{ __html: mol.svg }} />
        </div>
      )}

      {/* SMILES */}
      {mol.smiles && (
        <div
          className="p-2 bg-white rounded text-xs font-mono text-gray-500 truncate border border-purple-100 cursor-pointer"
          title={`Click to copy: ${mol.smiles}`}
          onClick={() => navigator.clipboard?.writeText(mol.smiles).catch(() => {})}
        >
          {mol.smiles}
        </div>
      )}

      {/* Properties grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {affinity !== null && (
          <div className="bg-white rounded px-2 py-1.5 border border-purple-100">
            <p className="text-gray-400 text-[10px]">Affinity</p>
            <p className={`font-semibold ${affinityColor(affinity)}`}>{affinity.toFixed(1)} kcal/mol</p>
          </div>
        )}
        {score !== null && (
          <div className="bg-white rounded px-2 py-1.5 border border-purple-100">
            <p className="text-gray-400 text-[10px]">Composite Score</p>
            <p className="font-semibold text-purple-700">{score.toFixed(3)}</p>
          </div>
        )}
        {mol.mw !== undefined && (
          <div className="bg-white rounded px-2 py-1.5 border border-purple-100">
            <p className="text-gray-400 text-[10px]">Mol. Weight</p>
            <p className="font-semibold text-gray-700">{Math.round(mol.mw)} Da</p>
          </div>
        )}
        {mol.logp !== undefined && (
          <div className="bg-white rounded px-2 py-1.5 border border-purple-100">
            <p className="text-gray-400 text-[10px]">LogP</p>
            <p className="font-semibold text-gray-700">{Number(mol.logp).toFixed(2)}</p>
          </div>
        )}
        {mol.novelty !== undefined && (
          <div className="bg-white rounded px-2 py-1.5 border border-purple-100">
            <p className="text-gray-400 text-[10px]">Novelty</p>
            <p className="font-semibold text-purple-600">{Math.round(mol.novelty * 100)}%</p>
          </div>
        )}
        {mol.qed !== undefined && (
          <div className="bg-white rounded px-2 py-1.5 border border-purple-100">
            <p className="text-gray-400 text-[10px]">QED</p>
            <p className="font-semibold text-gray-700">{Number(mol.qed).toFixed(3)}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// --------------------------------------------------
// GeneratedMols — grid of AI-generated molecules
// Props: { generatedMolecules, onSelectMolecule }
// --------------------------------------------------
const PAGE_SIZE = 12

export default function GeneratedMols({ generatedMolecules, onSelectMolecule }) {
  const [selectedIndex, setSelectedIndex] = useState(null)
  const [sortKey, setSortKey] = useState('composite_score')
  const [page, setPage]       = useState(0)

  const molecules = generatedMolecules || []
  if (!molecules.length) return null

  // Sort
  const sorted = useMemo(() => {
    return [...molecules].sort((a, b) => {
      const va = a[sortKey] ?? -Infinity
      const vb = b[sortKey] ?? -Infinity
      // affinity: lower (more negative) = better
      if (sortKey === 'affinity') return va - vb
      return vb - va
    })
  }, [molecules, sortKey])

  const totalPages  = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage    = Math.min(page, totalPages - 1)
  const pageStart   = safePage * PAGE_SIZE
  const displayMols = sorted.slice(pageStart, pageStart + PAGE_SIZE)

  const selectedMol = selectedIndex !== null ? sorted[selectedIndex] : null
  const generator   = molecules[0]?.source || molecules[0]?.generator || 'REINVENT4'

  const handleSelect = (idx) => {
    // idx is relative to sorted array (absolute index passed from AICard)
    setSelectedIndex(idx)
    if (onSelectMolecule && idx !== null) {
      onSelectMolecule(sorted[idx])
    }
  }

  // When sort changes, reset to page 0
  const handleSortChange = (key) => {
    setSortKey(key)
    setPage(0)
    setSelectedIndex(null)
  }

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-purple-900 to-purple-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-purple-400/30 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm flex items-center">
              AI-Generated Molecules
              <InfoTip text="These molecules were designed by a generative AI model trained on known active ligands. They have not yet been synthesized in a laboratory." />
            </h3>
            <p className="text-purple-200 text-xs">{molecules.length} molecules | {generator}</p>
          </div>
        </div>
        <span className="text-purple-200 text-xs bg-purple-800/50 px-2 py-0.5 rounded-full font-medium">
          {molecules.length} mol.
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Info note */}
        <div className="flex items-start gap-2 p-3 bg-purple-50 rounded-lg border border-purple-100">
          <svg className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-purple-700">
            These molecules were generated by a generative chemistry model
            ({generator}) trained on known active ligands. They have not yet been
            synthesized in a laboratory.
          </p>
        </div>

        {/* Sort controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 font-medium">Sort by:</span>
          <div className="flex gap-1">
            {SORT_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleSortChange(key)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  sortKey === key
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-purple-50 hover:text-purple-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {totalPages > 1 && (
            <span className="ml-auto text-xs text-gray-400 font-medium">
              Page {safePage + 1} of {totalPages}
            </span>
          )}
        </div>

        {/* Card grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {displayMols.map((mol, pageIdx) => {
            const absoluteIdx = pageStart + pageIdx
            return (
              <AICard
                key={absoluteIdx}
                mol={mol}
                index={absoluteIdx}
                isSelected={selectedIndex === absoluteIdx}
                onSelect={handleSelect}
              />
            )
          })}
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => { setPage((p) => Math.max(0, p - 1)); setSelectedIndex(null) }}
              disabled={safePage === 0}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                safePage === 0
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-purple-600 hover:bg-purple-50 border border-purple-200 hover:border-purple-400'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Previous
            </button>

            {/* Page number pills */}
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => { setPage(i); setSelectedIndex(null) }}
                  className={`w-6 h-6 rounded-full text-[10px] font-semibold transition-colors ${
                    i === safePage
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-400 hover:bg-purple-50 hover:text-purple-600'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            <button
              onClick={() => { setPage((p) => Math.min(totalPages - 1, p + 1)); setSelectedIndex(null) }}
              disabled={safePage === totalPages - 1}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                safePage === totalPages - 1
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-purple-600 hover:bg-purple-50 border border-purple-200 hover:border-purple-400'
              }`}
            >
              Next
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        {/* Detail panel */}
        {selectedMol && (
          <div className="border-2 border-purple-200 rounded-xl overflow-hidden">
            {/* Close button row */}
            <div className="flex items-center justify-between px-4 py-2 bg-purple-50 border-b border-purple-100">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-purple-700">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
                AI Generated — Full Details
              </span>
              <button
                onClick={() => handleSelect(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close detail panel"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <MoleculeCard
              molecule={{
                ...selectedMol,
                name: selectedMol.name || selectedMol.molecule_name || selectedMol.smiles?.slice(0, 20),
                svg: selectedMol.svg || '',
              }}
              rank={selectedIndex}
            />
          </div>
        )}
      </div>
    </div>
  )
}
