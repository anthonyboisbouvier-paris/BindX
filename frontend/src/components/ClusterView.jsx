import React, { useState, useMemo } from 'react'
import InfoTip from './InfoTip.jsx'

// --------------------------------------------------
// Deterministic color palette for cluster borders
// --------------------------------------------------
const CLUSTER_COLORS = [
  'border-blue-400',
  'border-dockit-green',
  'border-purple-400',
  'border-orange-400',
  'border-pink-400',
  'border-teal-400',
  'border-indigo-400',
  'border-amber-400',
  'border-cyan-400',
  'border-rose-400',
]

const CLUSTER_BG = [
  'bg-blue-50',
  'bg-green-50',
  'bg-purple-50',
  'bg-orange-50',
  'bg-pink-50',
  'bg-teal-50',
  'bg-indigo-50',
  'bg-amber-50',
  'bg-cyan-50',
  'bg-rose-50',
]

function clusterColor(clusterId) {
  const idx = (clusterId || 0) % CLUSTER_COLORS.length
  return CLUSTER_COLORS[idx]
}

function clusterBg(clusterId) {
  const idx = (clusterId || 0) % CLUSTER_BG.length
  return CLUSTER_BG[idx]
}

// --------------------------------------------------
// Score badge
// --------------------------------------------------
function ScoreBadge({ score }) {
  if (score === undefined || score === null) return null
  const pct = Math.round((score || 0) * 100)
  let colorClass = 'bg-red-100 text-red-700'
  if (pct >= 80) colorClass = 'bg-green-100 text-green-700'
  else if (pct >= 60) colorClass = 'bg-yellow-100 text-yellow-700'
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${colorClass}`}>
      {pct}/100
    </span>
  )
}

// --------------------------------------------------
// Single molecule row (analogue in cluster)
// --------------------------------------------------
function AnalogueRow({ mol, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect && onSelect(mol)}
      className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/70 transition-colors text-left group"
    >
      <span className="text-xs font-medium text-gray-700 group-hover:text-dockit-blue transition-colors truncate max-w-[160px]">
        {mol.name || mol.ligand_name || 'Unknown'}
      </span>
      <ScoreBadge score={mol.composite_score} />
    </button>
  )
}

// --------------------------------------------------
// Cluster family card
// --------------------------------------------------
function ClusterCard({ clusterId, molecules, onSelect }) {
  const [expanded, setExpanded] = useState(false)

  const representative = molecules.find(m => m.is_representative) || molecules[0]
  const analogues = molecules.filter(m => m !== representative)
  const colorBorder = clusterColor(clusterId)
  const colorBg = clusterBg(clusterId)
  const repName = representative?.name || representative?.ligand_name || `Molecule`

  return (
    <div className={`bg-white rounded-xl border-l-4 ${colorBorder} border border-gray-100 shadow-sm overflow-hidden`}>
      {/* Family header */}
      <div className={`px-4 py-2 ${colorBg} border-b border-gray-100 flex items-center justify-between`}>
        <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">
          Family {clusterId + 1}
        </span>
        <span className="text-xs text-gray-400">
          {molecules.length} molecule{molecules.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Representative molecule */}
      {representative && (
        <div className="px-4 py-3 border-b border-gray-50">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => onSelect && onSelect(representative)}
                  className="text-sm font-bold text-dockit-blue hover:underline truncate max-w-[160px] text-left"
                  title={repName}
                >
                  {repName}
                </button>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-dockit-blue text-white flex-shrink-0">
                  Representative
                </span>
              </div>
              {representative.smiles && (
                <p className="text-[10px] font-mono text-gray-300 truncate max-w-[200px] mt-0.5" title={representative.smiles}>
                  {representative.smiles}
                </p>
              )}
            </div>
            <ScoreBadge score={representative.composite_score} />
          </div>
        </div>
      )}

      {/* Analogues (collapsible) */}
      {analogues.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            className="w-full flex items-center justify-between px-4 py-2 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <span>{expanded ? 'Hide' : 'Show'} {analogues.length} analogue{analogues.length !== 1 ? 's' : ''}</span>
            <svg
              className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {expanded && (
            <div className={`px-2 pb-2 ${colorBg}/40 space-y-0.5`}>
              {analogues.map((mol, idx) => (
                <AnalogueRow
                  key={mol.name || mol.ligand_name || idx}
                  mol={mol}
                  onSelect={onSelect}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// --------------------------------------------------
// Flat fallback list when no cluster data
// --------------------------------------------------
function FlatList({ molecules, onSelect }) {
  return (
    <div className="space-y-2">
      {molecules.map((mol, idx) => (
        <button
          key={mol.name || mol.ligand_name || idx}
          type="button"
          onClick={() => onSelect && onSelect(mol)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-dockit-blue/20 transition-all text-left"
        >
          <span className="text-sm font-medium text-dockit-blue truncate max-w-[220px]">
            {mol.name || mol.ligand_name || `Molecule ${idx + 1}`}
          </span>
          <ScoreBadge score={mol.composite_score} />
        </button>
      ))}
    </div>
  )
}

// --------------------------------------------------
// Main ClusterView
// --------------------------------------------------
export default function ClusterView({ molecules = [], onSelect }) {
  // Group by cluster_id
  const clusters = useMemo(() => {
    const hasClusters = molecules.some(m => m.cluster_id !== undefined && m.cluster_id !== null)
    if (!hasClusters) return null

    const map = new Map()
    for (const mol of molecules) {
      const cid = mol.cluster_id ?? 0
      if (!map.has(cid)) map.set(cid, [])
      map.get(cid).push(mol)
    }
    // Sort clusters by id
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([cid, mols]) => ({ clusterId: cid, molecules: mols }))
  }, [molecules])

  const clusterCount = clusters?.length ?? 0
  const totalCount = molecules.length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-dockit-blue">Chemical Families</h3>
          <InfoTip text="Molecules are grouped by structural similarity using Butina clustering. Each family shares a common scaffold, helping you pick diverse candidates for experimental validation." />
        </div>
        {clusters && (
          <span className="text-xs text-gray-400 font-medium">
            {totalCount} candidate{totalCount !== 1 ? 's' : ''} in {clusterCount} chemical {clusterCount !== 1 ? 'families' : 'family'}
          </span>
        )}
      </div>

      {/* Content */}
      {!molecules || molecules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-300">
          <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p className="text-sm">No molecules to display</p>
        </div>
      ) : clusters ? (
        <div className="space-y-3">
          {clusters.map(({ clusterId, molecules: mols }) => (
            <ClusterCard
              key={clusterId}
              clusterId={clusterId}
              molecules={mols}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400 italic">Clustering data not available — showing flat list</p>
          <FlatList molecules={molecules} onSelect={onSelect} />
        </>
      )}
    </div>
  )
}
