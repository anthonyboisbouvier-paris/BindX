import React, { useState } from 'react'
import InfoTip from './InfoTip.jsx'
import Badge from './Badge.jsx'

function ScoreBadge({ value, low, high, reverse = false }) {
  // Color based on whether value is good (green) or bad (red)
  // reverse=true means lower is better (e.g., affinity which is negative)
  let color = 'text-gray-600 bg-gray-100'
  if (value !== null && value !== undefined) {
    const normalized = (value - low) / (high - low)
    const isGood = reverse ? normalized < 0.4 : normalized > 0.6
    const isBad = reverse ? normalized > 0.7 : normalized < 0.3
    if (isGood) color = 'text-green-700 bg-green-100'
    else if (isBad) color = 'text-red-700 bg-red-100'
    else color = 'text-yellow-700 bg-yellow-100'
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${color}`}>
      {value !== null && value !== undefined ? Number(value).toFixed(2) : 'N/A'}
    </span>
  )
}

function SortIcon({ active, direction }) {
  if (!active) {
    return (
      <svg className="w-3 h-3 text-gray-300 inline ml-1" fill="currentColor" viewBox="0 0 20 20">
        <path d="M5 10l5-5 5 5H5z" />
      </svg>
    )
  }
  return direction === 'asc' ? (
    <svg className="w-3 h-3 text-dockit-blue inline ml-1" fill="currentColor" viewBox="0 0 20 20">
      <path d="M5 10l5-5 5 5H5z" />
    </svg>
  ) : (
    <svg className="w-3 h-3 text-dockit-blue inline ml-1" fill="currentColor" viewBox="0 0 20 20">
      <path d="M15 10l-5 5-5-5h10z" />
    </svg>
  )
}

// Derive V2 column flags from the dataset
function detectV2Fields(rows) {
  const hasSource = rows.some(r => r.source !== undefined && r.source !== null)
  const hasAdmet  = rows.some(r => r.admet !== undefined && r.admet !== null)
  const hasMethod = rows.some(r => r.docking_method !== undefined && r.docking_method !== null)
  const hasAgreement = rows.some(r => r.consensus_detail?.agreement !== undefined)
  return { hasSource, hasAdmet, hasMethod, hasAgreement }
}

function SourceBadge({ source }) {
  if (!source) return <span className="text-xs text-gray-400">—</span>
  const lower = source.toLowerCase()
  const isAI = lower.includes('reinvent') || lower.includes('mock_generation') || lower.includes('generated')
  const isZinc = lower.includes('zinc')
  if (isAI) return <Badge variant="purple">AI</Badge>
  if (isZinc) return <Badge variant="blue">ZINC</Badge>
  return <Badge variant="green">ChEMBL</Badge>
}

function AdmetDot({ admet }) {
  if (!admet) return <span className="text-xs text-gray-300">—</span>
  const score = typeof admet === 'number'
    ? admet
    : (admet.composite_score ?? admet.score ?? null)
  const colorCode = admet.color_code || null

  let dotClass = 'bg-yellow-400'
  let label = null
  if (colorCode) {
    if (colorCode.toLowerCase() === 'green')  dotClass = 'bg-green-500'
    if (colorCode.toLowerCase() === 'red')    dotClass = 'bg-red-500'
    if (colorCode.toLowerCase() === 'yellow') dotClass = 'bg-yellow-400'
  } else if (score !== null) {
    if (score >= 0.6)     dotClass = 'bg-green-500'
    else if (score < 0.4) dotClass = 'bg-red-500'
  }
  if (score !== null) label = Number(score).toFixed(2)

  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotClass}`} />
      {label && <span className="text-xs text-gray-500 font-mono">{label}</span>}
    </span>
  )
}

function MethodBadge({ method }) {
  if (!method) return <span className="text-xs text-gray-400">—</span>
  const isDiffDock = method.toLowerCase().includes('diffdock')
  return isDiffDock
    ? <Badge variant="blue">DiffDock</Badge>
    : <Badge variant="gray">Vina</Badge>
}

/**
 * Agreement badge: shows "X/3" based on consensus_detail.agreement value.
 * 3 = green, 2 = yellow, 1 = red, otherwise gray dash.
 */
function AgreementBadge({ agreement }) {
  if (agreement === null || agreement === undefined) {
    return <span className="text-xs text-gray-400">—</span>
  }
  const n = Number(agreement)
  const variant = n >= 3 ? 'green' : n === 2 ? 'yellow' : 'red'
  return <Badge variant={variant}>{n}/3</Badge>
}

export default function ResultsTable({ results, selectedIndex, onSelect }) {
  const [sortKey, setSortKey] = useState('composite_score')
  const [sortDir, setSortDir] = useState('desc')
  const [showMoreCols, setShowMoreCols] = useState(false)

  const rawResults = results?.results || []
  const top10 = rawResults.slice(0, 10)

  const { hasSource, hasAdmet, hasMethod, hasAgreement } = detectV2Fields(top10)

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      const defaultDesc = ['composite_score', 'qed']
      setSortDir(defaultDesc.includes(key) ? 'desc' : 'asc')
    }
  }

  const sorted = [...top10].sort((a, b) => {
    const va = a[sortKey] ?? -Infinity
    const vb = b[sortKey] ?? -Infinity
    if (sortDir === 'asc') return va - vb
    return vb - va
  })

  // Columns that are hidden on mobile by default, revealed with "More columns"
  const MOBILE_HIDDEN = new Set(['logp', 'mw'])

  const BASE_COLUMNS = [
    { key: 'rank',            label: 'Rank',                sticky: true,  sortable: false, tooltip: null },
    { key: 'name',            label: 'Name',                sticky: true,  sortable: false, tooltip: null },
    { key: 'affinity',        label: 'Affinity (kcal/mol)', sticky: false, sortable: true,  tooltip: 'Predicted binding energy. More negative = stronger binding.' },
    { key: 'composite_score', label: 'Composite Score',     sticky: false, sortable: true,  tooltip: 'Combined score (0-1) from affinity, drug-likeness, and ADMET.' },
    { key: 'logp',            label: 'LogP',                sticky: false, sortable: true,  tooltip: 'Lipophilicity measure. Optimal range: 0-5 for oral drugs.' },
    { key: 'mw',              label: 'MW (Da)',             sticky: false, sortable: true,  tooltip: 'Molecular weight in Daltons. Should be below 500 Da (Lipinski rule).' },
    { key: 'qed',             label: 'QED',                 sticky: false, sortable: true,  tooltip: 'Quantitative Estimate of Drug-likeness (0-1). Higher is better.' },
  ]

  const EXTRA_COLUMNS = [
    ...(hasAgreement ? [{ key: 'agreement',      label: 'Agreement', sticky: false, sortable: false, tooltip: 'Consensus between scoring methods. 3/3 = all agree (green).' }] : []),
    ...(hasSource    ? [{ key: 'source',          label: 'Source',    sticky: false, sortable: false, tooltip: 'Database origin of this molecule (ChEMBL, ZINC, or AI-generated).' }] : []),
    ...(hasAdmet     ? [{ key: 'admet',           label: 'ADMET',     sticky: false, sortable: false, tooltip: 'Drug safety score. Green = favorable, yellow = acceptable, red = problematic.' }] : []),
    ...(hasMethod    ? [{ key: 'docking_method',  label: 'Method',    sticky: false, sortable: false, tooltip: 'Docking algorithm used to compute binding pose and affinity.' }] : []),
  ]

  const COLUMNS = [...BASE_COLUMNS, ...EXTRA_COLUMNS]

  const getName = (r) => r.name || r.molecule_name || r.smiles?.slice(0, 20) || 'Unknown'

  if (!top10.length) {
    return (
      <div className="card p-8 text-center text-gray-400">
        <svg className="w-12 h-12 mx-auto mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p>No docking results available.</p>
      </div>
    )
  }

  // Sticky column shadow utility (applied to the last sticky column — "name")
  const STICKY_SHADOW = 'after:absolute after:right-0 after:top-0 after:bottom-0 after:w-4 after:bg-gradient-to-r after:from-gray-900/10 after:to-transparent after:pointer-events-none'

  return (
    <div className="card overflow-hidden">
      {/* Table header bar */}
      <div className="px-4 py-3 bg-dockit-blue flex items-center justify-between">
        <h3 className="text-white font-semibold text-sm flex items-center gap-2">
          <svg className="w-4 h-4 text-dockit-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Top {top10.length} docking results
        </h3>
        <div className="flex items-center gap-3">
          {/* Mobile "More columns" toggle */}
          <button
            type="button"
            onClick={() => setShowMoreCols(v => !v)}
            className="md:hidden text-white/70 hover:text-white text-xs flex items-center gap-1 px-2 py-1 bg-white/10 hover:bg-white/20 rounded transition-colors"
            aria-pressed={showMoreCols}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            {showMoreCols ? 'Fewer columns' : 'More columns'}
          </button>
          <span className="text-white/60 text-xs">
            {rawResults.length} ligands tested in total
          </span>
        </div>
      </div>

      {/* Scrollable table wrapper */}
      <div className="overflow-x-auto">
        <table className="w-full results-table">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {COLUMNS.map((col) => {
                const isMobileHidden = MOBILE_HIDDEN.has(col.key) && !showMoreCols
                // Sticky classes for first two columns
                const stickyClass = col.sticky
                  ? 'sticky left-0 bg-gray-50 z-10'
                  : ''
                // Offset the "name" sticky column so it doesn't overlap "rank"
                const stickyOffset = col.key === 'name' ? 'left-[52px]' : ''

                return (
                  <th
                    key={col.key}
                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                    className={[
                      'px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap',
                      col.sortable ? 'cursor-pointer hover:text-dockit-blue select-none' : '',
                      sortKey === col.key ? 'text-dockit-blue' : '',
                      stickyClass,
                      stickyOffset,
                      // Shadow separator on last sticky column
                      col.key === 'name' ? `relative ${STICKY_SHADOW}` : '',
                      // Mobile visibility
                      isMobileHidden ? 'hidden md:table-cell' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <span className="inline-flex items-center">
                      {col.label}
                      {col.tooltip && <InfoTip text={col.tooltip} />}
                      {col.sortable && (
                        <SortIcon active={sortKey === col.key} direction={sortDir} />
                      )}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((result, displayIdx) => {
              const originalIdx = top10.indexOf(result)
              const isSelected = selectedIndex === originalIdx
              const isTop = originalIdx === 0

              const rowBase = isSelected
                ? 'bg-dockit-blue/5 border-l-4 border-l-dockit-blue'
                : isTop
                ? 'bg-green-50/50 hover:bg-green-50'
                : 'hover:bg-blue-50/50'

              const stickyBg = isSelected
                ? 'bg-blue-50'
                : isTop
                ? 'bg-green-50/80'
                : 'bg-white'

              return (
                <tr
                  key={originalIdx}
                  onClick={() => onSelect(originalIdx)}
                  className={`border-b border-gray-100 cursor-pointer transition-colors duration-150 ${rowBase}`}
                >
                  {/* Rank — sticky left */}
                  <td className={`px-3 py-3 sticky left-0 z-10 ${stickyBg}`}>
                    <div className="flex items-center gap-1.5">
                      {originalIdx === 0 ? (
                        <span className="w-6 h-6 bg-dockit-green text-white text-xs font-bold rounded-full flex items-center justify-center">
                          1
                        </span>
                      ) : (
                        <span className="w-6 h-6 bg-gray-100 text-gray-500 text-xs font-medium rounded-full flex items-center justify-center">
                          {originalIdx + 1}
                        </span>
                      )}
                      {isTop && (
                        <span className="text-yellow-500 text-xs">★</span>
                      )}
                    </div>
                  </td>

                  {/* Name — sticky second column */}
                  <td className={`px-3 py-3 sticky left-[52px] z-10 relative ${stickyBg} ${STICKY_SHADOW}`}>
                    <div className="flex flex-col">
                      <span className={`text-sm font-medium truncate max-w-[150px] ${
                        result.eliminated ? 'text-red-400 line-through' : isTop ? 'text-dockit-green' : 'text-gray-800'
                      }`}
                        title={getName(result)}>
                        {getName(result)}
                      </span>
                      {result.eliminated && (
                        <span className="text-[10px] text-red-500 font-semibold">{result.elimination_reason || 'Eliminated'}</span>
                      )}
                      {result.chembl_id && (
                        <span className="text-xs text-gray-400 font-mono">{result.chembl_id}</span>
                      )}
                    </div>
                  </td>

                  {/* Affinity */}
                  <td className="px-3 py-3">
                    <span className={`text-sm font-mono font-semibold ${
                      (result.affinity || 0) < -9 ? 'text-green-600' :
                      (result.affinity || 0) < -7 ? 'text-blue-600' :
                      'text-gray-600'
                    }`}>
                      {result.affinity !== undefined ? Number(result.affinity).toFixed(1) : 'N/A'}
                    </span>
                  </td>

                  {/* Composite score */}
                  <td className="px-3 py-3">
                    <ScoreBadge value={result.composite_score} low={0} high={1} />
                  </td>

                  {/* LogP — hidden on mobile by default */}
                  <td className={`px-3 py-3 ${!showMoreCols ? 'hidden md:table-cell' : ''}`}>
                    <span className="text-sm text-gray-600 font-mono">
                      {result.logp !== undefined ? Number(result.logp).toFixed(2) : 'N/A'}
                    </span>
                  </td>

                  {/* MW — hidden on mobile by default */}
                  <td className={`px-3 py-3 ${!showMoreCols ? 'hidden md:table-cell' : ''}`}>
                    <span className="text-sm text-gray-600">
                      {result.mw !== undefined ? Math.round(result.mw) : 'N/A'}
                    </span>
                  </td>

                  {/* QED */}
                  <td className="px-3 py-3">
                    <ScoreBadge value={result.qed} low={0} high={1} />
                  </td>

                  {/* Agreement (optional) */}
                  {hasAgreement && (
                    <td className="px-3 py-3">
                      <AgreementBadge agreement={result.consensus_detail?.agreement} />
                    </td>
                  )}

                  {/* Source (V2) */}
                  {hasSource && (
                    <td className="px-3 py-3">
                      <SourceBadge source={result.source} />
                    </td>
                  )}

                  {/* ADMET (V2) */}
                  {hasAdmet && (
                    <td className="px-3 py-3">
                      <AdmetDot admet={result.admet} />
                    </td>
                  )}

                  {/* Docking method (V2) */}
                  {hasMethod && (
                    <td className="px-3 py-3">
                      <MethodBadge method={result.docking_method} />
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
          Good
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
          Moderate
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
          Weak
        </span>
        <span className="ml-auto">Click a row to view the 3D pose</span>
      </div>
    </div>
  )
}
