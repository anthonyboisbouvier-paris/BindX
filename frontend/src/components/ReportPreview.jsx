import React from 'react'

// -----------------------------------------------------------------------
// Colour config for tag badges (mirrors HitSelector)
// -----------------------------------------------------------------------
const TAG_STYLES = {
  hit: {
    classes: 'bg-green-100 text-green-700 border border-green-300',
    label: 'Hit',
  },
  investigate: {
    classes: 'bg-yellow-100 text-yellow-700 border border-yellow-300',
    label: 'Investigate',
  },
  discard: {
    classes: 'bg-red-100 text-red-700 border border-red-300',
    label: 'Discard',
  },
}

// -----------------------------------------------------------------------
// Small presentational helpers
// -----------------------------------------------------------------------

function SectionHeading({ children }) {
  return (
    <h3 className="font-semibold text-[#1e3a5f] text-base border-b border-gray-200 pb-1 mb-3">
      {children}
    </h3>
  )
}

function InfoRow({ label, value }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="flex items-start gap-2 py-1 text-sm">
      <span className="font-medium text-gray-500 w-40 flex-shrink-0">{label}</span>
      <span className="text-gray-800 break-all">{value}</span>
    </div>
  )
}

function TagBadge({ tag }) {
  const style = TAG_STYLES[tag] ?? { classes: 'bg-gray-100 text-gray-600 border border-gray-200', label: tag }
  return (
    <span className={`inline-block rounded-full text-xs font-semibold px-2 py-0.5 ${style.classes}`}>
      {style.label}
    </span>
  )
}

// -----------------------------------------------------------------------
// Table helpers
// -----------------------------------------------------------------------

function TableHeader({ columns }) {
  return (
    <thead>
      <tr>
        {columns.map((col) => (
          <th
            key={col}
            className="border border-gray-200 bg-gray-100 px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap"
          >
            {col}
          </th>
        ))}
      </tr>
    </thead>
  )
}

function TableRow({ cells, isOdd }) {
  return (
    <tr className={isOdd ? 'bg-gray-50' : 'bg-white'}>
      {cells.map((cell, i) => (
        <td
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          className="border border-gray-200 px-3 py-2 text-sm text-gray-700 align-top"
        >
          {cell}
        </td>
      ))}
    </tr>
  )
}

// -----------------------------------------------------------------------
// Section 1 — Target Information
// -----------------------------------------------------------------------
function TargetSection({ results }) {
  const summary = results?.pipeline_summary ?? {}
  const structureSource =
    summary.structure_source ?? results?.structure_source ?? null

  let sourceLine = structureSource
  if (structureSource === 'pdb_experimental' && results?.pdb_id) {
    sourceLine = `PDB Experimental (${results.pdb_id})`
    if (results.pdb_resolution) sourceLine += ` — ${results.pdb_resolution} Å`
    if (results.pdb_method) sourceLine += `, ${results.pdb_method}`
  } else if (structureSource === 'alphafold') {
    sourceLine = 'AlphaFold DB (computational prediction)'
  } else if (structureSource === 'esmfold') {
    sourceLine = 'ESMFold (computational prediction)'
  }

  return (
    <section className="mb-6">
      <SectionHeading>Target Information</SectionHeading>
      <div className="divide-y divide-gray-100">
        <InfoRow label="Protein Name" value={results?.protein_name} />
        <InfoRow label="UniProt ID" value={results?.uniprot_id} />
        <InfoRow label="Structure Source" value={sourceLine} />
        {results?.pdb_id && structureSource === 'pdb_experimental' && (
          <InfoRow label="PDB ID" value={results.pdb_id} />
        )}
      </div>
    </section>
  )
}

// -----------------------------------------------------------------------
// Section 2 — Run Configuration
// -----------------------------------------------------------------------
function RunConfigSection({ results }) {
  const summary = results?.pipeline_summary ?? {}

  const mode = results?.mode ?? summary?.mode ?? null
  const engine =
    results?.docking_engine ?? summary?.docking_engine ?? null
  const total =
    results?.total_ligands_tested ??
    summary?.tested ??
    (results?.results?.length ?? null)
  const date = results?.completed_at ?? results?.created_at ?? null

  const formatDate = (iso) => {
    if (!iso) return null
    try {
      return new Date(iso).toLocaleString('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    } catch {
      return iso
    }
  }

  return (
    <section className="mb-6">
      <SectionHeading>Run Configuration</SectionHeading>
      <div className="divide-y divide-gray-100">
        <InfoRow label="Mode" value={mode ? mode.charAt(0).toUpperCase() + mode.slice(1) : null} />
        <InfoRow label="Docking Engine" value={engine} />
        <InfoRow
          label="Total Ligands Tested"
          value={total !== null ? String(total) : null}
        />
        <InfoRow label="Date" value={formatDate(date)} />
      </div>
    </section>
  )
}

// -----------------------------------------------------------------------
// Section 3 — Top Results table
// -----------------------------------------------------------------------
function TopResultsSection({ molecules }) {
  const top10 = molecules.slice(0, 10)

  if (top10.length === 0) return null

  const columns = ['Rank', 'Name', 'Affinity (kcal/mol)', 'Score', 'QED', 'Safety']

  return (
    <section className="mb-6">
      <SectionHeading>Top Results</SectionHeading>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <TableHeader columns={columns} />
          <tbody>
            {top10.map((mol, i) => {
              const name = mol.name || mol.molecule_name || mol.smiles?.slice(0, 24) || `Ligand ${i + 1}`
              const affinity =
                mol.affinity !== null && mol.affinity !== undefined
                  ? Number(mol.affinity).toFixed(2)
                  : 'N/A'
              const score =
                mol.composite_score !== null && mol.composite_score !== undefined
                  ? Number(mol.composite_score).toFixed(3)
                  : 'N/A'
              const qed =
                mol.qed !== null && mol.qed !== undefined
                  ? Number(mol.qed).toFixed(2)
                  : 'N/A'
              const safety =
                mol.safety_score !== null && mol.safety_score !== undefined
                  ? Number(mol.safety_score).toFixed(2)
                  : 'N/A'

              return (
                <TableRow
                  key={mol.chembl_id ?? mol.smiles ?? i}
                  isOdd={i % 2 === 1}
                  cells={[i + 1, name, affinity, score, qed, safety]}
                />
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// -----------------------------------------------------------------------
// Section 4 — Selected Hits
// -----------------------------------------------------------------------
function SelectedHitsSection({ molecules, selections }) {
  const entries = Object.entries(selections ?? {})
  if (entries.length === 0) return null

  const columns = ['Rank', 'Name', 'Tag', 'Note', 'Affinity (kcal/mol)', 'Score']

  return (
    <section className="mb-6">
      <SectionHeading>Selected Hits</SectionHeading>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <TableHeader columns={columns} />
          <tbody>
            {entries.map(([idxStr, sel], rowIdx) => {
              const idx = Number(idxStr)
              const mol = molecules[idx]
              if (!mol) return null

              const name = mol.name || mol.molecule_name || mol.smiles?.slice(0, 24) || `Ligand ${idx + 1}`
              const affinity =
                mol.affinity !== null && mol.affinity !== undefined
                  ? Number(mol.affinity).toFixed(2)
                  : 'N/A'
              const score =
                mol.composite_score !== null && mol.composite_score !== undefined
                  ? Number(mol.composite_score).toFixed(3)
                  : 'N/A'

              return (
                <TableRow
                  key={idxStr}
                  isOdd={rowIdx % 2 === 1}
                  cells={[
                    idx + 1,
                    name,
                    <TagBadge key="tag" tag={sel.tag} />,
                    sel.note || <span className="text-gray-400 italic">—</span>,
                    affinity,
                    score,
                  ]}
                />
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// -----------------------------------------------------------------------
// Section 5 — Pipeline Summary
// -----------------------------------------------------------------------
function PipelineSummarySection({ results }) {
  const summary = results?.pipeline_summary ?? {}

  const structureSource = summary?.structure_source ?? results?.structure_source ?? null
  const pocketScore = results?.pocket_score ?? null
  const pocketVolume = results?.pocket_volume ?? null
  const p2rankProb = summary?.p2rank_probability ?? results?.pocket?.p2rank_probability ?? null
  const confidenceScore = results?.confidence_score ?? null
  const confidenceLabel = results?.confidence_label ?? null
  const stepsCompleted = summary?.steps_completed ?? []
  const clusterCount = summary?.cluster_count ?? results?.cluster_count ?? null

  const buildPocketLine = () => {
    let line = 'Pocket #1'
    if (pocketScore !== null) line += ` — score ${Number(pocketScore).toFixed(2)}`
    if (pocketVolume !== null) line += `, volume ${pocketVolume} Å³`
    if (p2rankProb !== null) line += ` (P2Rank: ${(p2rankProb * 100).toFixed(0)}%)`
    return line
  }

  return (
    <section className="mb-2">
      <SectionHeading>Pipeline Summary</SectionHeading>
      <div className="divide-y divide-gray-100">
        {structureSource && (
          <InfoRow
            label="Effective Structure"
            value={
              structureSource === 'pdb_experimental'
                ? `PDB Experimental (${results?.pdb_id ?? ''})`
                : structureSource === 'alphafold'
                ? 'AlphaFold DB'
                : 'ESMFold'
            }
          />
        )}
        <InfoRow label="Pocket" value={buildPocketLine()} />
        {confidenceScore !== null && (
          <InfoRow
            label="Confidence"
            value={`${Number(confidenceScore).toFixed(2)}${confidenceLabel ? ` (${confidenceLabel})` : ''}`}
          />
        )}
        {stepsCompleted.length > 0 && (
          <InfoRow
            label="Pipeline Steps"
            value={stepsCompleted.join(', ')}
          />
        )}
        {clusterCount !== null && (
          <InfoRow
            label="Chemical Clusters"
            value={`${clusterCount} families (Butina algorithm)`}
          />
        )}
      </div>
    </section>
  )
}

// -----------------------------------------------------------------------
// ReportPreview — main component
// -----------------------------------------------------------------------
/**
 * ReportPreview — on-screen HTML preview of the job report.
 *
 * Props:
 *   results    {object} — full results object from the API
 *                         { uniprot_id, protein_name, pipeline_summary,
 *                           results, mode, docking_engine, ... }
 *   selections {object} — hit selections from HitSelectionContext:
 *                         { [idx]: { tag, note } }
 */
export default function ReportPreview({ results, selections = {} }) {
  if (!results) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
        No results available to preview.
      </div>
    )
  }

  const molecules = results?.results ?? []
  const hasSelections = Object.keys(selections).length > 0

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
      role="region"
      aria-label="Report preview"
    >
      {/* Report header */}
      <div className="px-6 py-4 bg-[#1e3a5f] text-white">
        <h2 className="text-lg font-bold tracking-tight">DockIt — Screening Report</h2>
        <p className="text-white/60 text-xs mt-0.5">
          {results.protein_name
            ? `${results.protein_name} (${results.uniprot_id ?? ''})`
            : results.uniprot_id ?? 'Unknown Target'}
        </p>
      </div>

      {/* Report body */}
      <div className="px-6 py-5 space-y-0">
        <TargetSection results={results} />
        <RunConfigSection results={results} />
        <TopResultsSection molecules={molecules} />

        {hasSelections && (
          <SelectedHitsSection molecules={molecules} selections={selections} />
        )}

        <PipelineSummarySection results={results} />
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
        <p className="text-[10px] text-gray-400 leading-relaxed">
          These results are exploratory and must be validated experimentally before any clinical
          application. Generated by DockIt — {new Date().toLocaleDateString('en-GB', { dateStyle: 'long' })}.
        </p>
      </div>
    </div>
  )
}
