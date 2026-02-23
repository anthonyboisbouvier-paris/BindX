import React from 'react'
import InfoTip from './InfoTip.jsx'

// Format seconds into "Xh Ym Zs" or "Xm Ys" or "Xs"
function formatElapsed(seconds) {
  if (!seconds || seconds < 0) return '--'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m ${s.toString().padStart(2, '0')}s`
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`
  return `${s}s`
}

// Classify a single result into a category
function classifyResult(mol) {
  const score = mol.score_100 ?? (mol.composite_score != null ? mol.composite_score * 100 : null)
  const affinity = mol.affinity ?? mol.affinity_kcal ?? null

  // Bad ADMET flag
  if (mol.admet_flags && mol.admet_flags.some(f => f.severity === 'high')) {
    return 'eliminated'
  }
  if (score !== null) {
    if (score >= 80) return 'promising'
    if (score >= 50) return 'secondary'
    return 'eliminated'
  }
  // Fallback to affinity
  if (affinity !== null) {
    const a = parseFloat(affinity)
    if (a <= -9.0) return 'promising'
    if (a <= -7.0) return 'secondary'
    return 'eliminated'
  }
  return 'secondary'
}

// Summary row component
function SummaryRow({ label, value, highlight, tooltip }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500 flex items-center">
        {label}
        {tooltip && <InfoTip text={tooltip} />}
      </span>
      <span className={`text-sm font-medium ${highlight ? 'text-dockit-blue' : 'text-gray-700'}`}>
        {value}
      </span>
    </div>
  )
}

// Category badge
function CategoryBadge({ count, label, color }) {
  if (count === 0) return null
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${color}`}>
      <span className="text-lg font-bold">{count}</span>
      <span className="text-xs leading-tight">{label}</span>
    </div>
  )
}

export default function PipelineSummary({ results, elapsed, onViewResults }) {
  const molecules = results?.results || []
  const pipelineSummary = results?.pipeline_summary || null

  // Categorize results
  const categorized = molecules.reduce(
    (acc, mol) => {
      acc[classifyResult(mol)]++
      return acc
    },
    { promising: 0, secondary: 0, eliminated: 0 }
  )

  // Pipeline summary data — prefer backend-provided pipeline_summary when available
  const structureInfo = pipelineSummary?.structure
    || (results?.structure_source === 'alphafold' ? 'AlphaFold DB, high confidence' : 'ESMFold, moderate confidence')
    || 'AlphaFold DB'

  const pocketInfo = pipelineSummary?.pocket
    || (results?.pocket_score
      ? `#1 (score ${Number(results.pocket_score).toFixed(2)}, volume ${results.pocket_volume || '--'} A3)`
      : '#1 detected')

  const sourceInfo = pipelineSummary?.source
    || (molecules.length > 0 ? `${molecules.length} compounds tested` : 'ChEMBL compounds')

  const testedInfo = pipelineSummary?.tested
    || (molecules.length > 0 ? `${molecules.length} (diversity selection)` : '--')

  const dockingInfo = pipelineSummary?.docking
    || (results?.docking_engine === 'diffdock' ? 'DiffDock, standard mode' : 'AutoDock Vina, standard mode')

  const stepsCompleted = pipelineSummary?.steps_completed || []
  const hasAdmet = stepsCompleted.includes('admet')
  const hasRetro = stepsCompleted.includes('retrosynthesis')

  const admetInfo = pipelineSummary?.admet
    || (hasAdmet
      ? `${pipelineSummary?.n_admet || molecules.length} molecules evaluated (absorption, toxicity, metabolism)`
      : 'Not performed (quick mode)')

  const retroInfo = pipelineSummary?.retrosynthesis
    || (hasRetro
      ? `Top ${Math.min(5, categorized.promising + categorized.secondary)} analyzed (synthesis route)`
      : 'Not performed (quick mode)')

  // V5bis: structure source detail
  const structureSource = pipelineSummary?.structure_source || results?.structure_source || null
  const pdbId = pipelineSummary?.pdb_id || results?.pdb_id || null
  const pdbResolution = pipelineSummary?.pdb_resolution || results?.pdb_resolution || null
  const pdbMethod = pipelineSummary?.pdb_method || results?.pdb_method || null
  const p2rankProb = pipelineSummary?.p2rank_probability ?? results?.pocket?.p2rank_probability ?? null
  const hasGnina = pipelineSummary?.docking_engine === 'gnina' || results?.docking_engine === 'gnina'
  const cutoffsPassed = pipelineSummary?.cutoffs_passed ?? null
  const cutoffsTotal = pipelineSummary?.cutoffs_total ?? null
  const interactionMethod = pipelineSummary?.interaction_method || null
  const clusterCount = pipelineSummary?.cluster_count ?? results?.cluster_count ?? null
  const chemblActive = pipelineSummary?.chembl_active ?? null
  const chemblTotal = pipelineSummary?.chembl_total ?? null

  // Build extended structure info for V5bis
  const buildStructureInfo = () => {
    if (structureSource === 'pdb_experimental' && pdbId) {
      let info = `PDB Experimental (${pdbId})`
      if (pdbResolution) info += ` — ${pdbResolution} A`
      if (pdbMethod) info += `, ${pdbMethod}`
      return info
    }
    return pipelineSummary?.structure
      || (results?.structure_source === 'alphafold' ? 'AlphaFold DB, high confidence' : 'ESMFold, moderate confidence')
      || 'AlphaFold DB'
  }

  // Build pocket info with P2Rank probability
  const buildPocketInfo = () => {
    const base = pipelineSummary?.pocket
      || (results?.pocket_score
        ? `#1 (score ${Number(results.pocket_score).toFixed(2)}, volume ${results.pocket_volume || '--'} A3)`
        : '#1 detected')
    if (p2rankProb !== null) {
      return `${base} — P2Rank probability: ${(p2rankProb * 100).toFixed(0)}%`
    }
    return base
  }

  // Build docking info with GNINA mention
  const buildDockingInfo = () => {
    if (hasGnina) return 'GNINA (3-score consensus: Vina + CNN + CNNaffinity)'
    return pipelineSummary?.docking
      || (results?.docking_engine === 'diffdock' ? 'DiffDock, standard mode' : 'AutoDock Vina, standard mode')
  }

  // Build ChEMBL source info
  const buildSourceInfo = () => {
    if (chemblActive !== null && chemblTotal !== null) {
      return `ChEMBL: ${chemblActive} active / ${chemblTotal} total`
    }
    return pipelineSummary?.source
      || (molecules.length > 0 ? `${molecules.length} compounds tested` : 'ChEMBL compounds')
  }

  const extStructureInfo = buildStructureInfo()
  const extPocketInfo = buildPocketInfo()
  const extDockingInfo = buildDockingInfo()
  const extSourceInfo = buildSourceInfo()

  const totalScreened = molecules.length
  const hasResults = totalScreened > 0

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Completion header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-dockit-green/10 rounded-full mb-4">
          <svg className="w-8 h-8 text-dockit-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-dockit-blue mb-1">Screening Complete</h2>
        {elapsed !== undefined && elapsed !== null && (
          <p className="text-gray-400 text-sm">
            Total duration: <span className="font-mono font-semibold text-gray-600">{formatElapsed(elapsed)}</span>
          </p>
        )}
      </div>

      {/* Results categories */}
      {hasResults && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide flex items-center">
            Candidate Classification
            <InfoTip text="Molecules are ranked by composite score combining binding affinity, drug-likeness, and ADMET properties." />
          </h3>
          <div className="flex gap-3 flex-wrap">
            <CategoryBadge
              count={categorized.promising}
              label="promising candidates"
              color="bg-dockit-green/10 text-dockit-green"
            />
            <CategoryBadge
              count={categorized.secondary}
              label="secondary candidates"
              color="bg-blue-50 text-dockit-blue"
            />
            <CategoryBadge
              count={categorized.eliminated}
              label="eliminated"
              color="bg-gray-100 text-gray-500"
            />
          </div>
          {categorized.eliminated > 0 && (
            <p className="text-xs text-gray-400 mt-3">
              {categorized.eliminated} eliminated due to toxicity or low affinity.
            </p>
          )}
        </div>
      )}

      {/* Pipeline summary */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
          Pipeline Summary
        </h3>
        <div className="space-y-0">
          <SummaryRow
            label="Structure"
            value={extStructureInfo}
            highlight
            tooltip="3D protein structure source. Experimental PDB structures are preferred over computational predictions (AlphaFold, ESMFold)."
          />
          <SummaryRow
            label="Pocket"
            value={extPocketInfo}
            tooltip="Binding pocket detected on the protein surface. P2Rank probability indicates confidence in pocket detection."
          />
          <SummaryRow
            label="Source"
            value={extSourceInfo}
            tooltip="Database source of the tested molecules. ChEMBL actives are experimentally validated binders."
          />
          <SummaryRow
            label="Tested"
            value={testedInfo}
            tooltip="Total number of molecules screened against the target."
          />
          <SummaryRow
            label="Docking"
            value={extDockingInfo}
            highlight
            tooltip="Algorithm that predicts how each molecule fits into the binding pocket. GNINA uses a 3-score consensus for higher reliability."
          />
          {/* V5bis: Filters row */}
          {cutoffsPassed !== null && cutoffsTotal !== null && (
            <SummaryRow
              label="Filters"
              value={`${cutoffsPassed}/${cutoffsTotal} passed hard cutoffs`}
              tooltip="Hard cutoffs eliminate molecules with unacceptable properties (PAINS, reactive groups, Lipinski violations, ADMET failures) before ranking."
            />
          )}
          <SummaryRow
            label="ADMET"
            value={admetInfo}
            tooltip="Absorption, Distribution, Metabolism, Excretion, Toxicity — pharmacological safety predictions."
          />
          <SummaryRow
            label="Retrosynthesis"
            value={retroInfo}
            tooltip="Computational planning of how to synthesize the molecule from available reagents."
          />
          {/* V5bis: Interactions row */}
          {interactionMethod && (
            <SummaryRow
              label="Interactions"
              value={interactionMethod === 'prolif' ? 'ProLIF analysis (protein-ligand fingerprints)' : 'Mock interaction analysis (estimated)'}
              tooltip="Protein-ligand interaction fingerprinting identifies which residues contact the ligand (H-bonds, hydrophobic, pi-stacking)."
            />
          )}
          {/* V5bis: Clustering row */}
          {clusterCount !== null && (
            <SummaryRow
              label="Clustering"
              value={`${clusterCount} chemical ${clusterCount !== 1 ? 'families' : 'family'} (Butina algorithm)`}
              tooltip="Structural clustering groups molecules by scaffold similarity, ensuring chemical diversity in the final candidate set."
            />
          )}
        </div>
      </div>

      {/* CTA button */}
      <button
        onClick={onViewResults}
        className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-dockit-green hover:bg-dockit-green-dark text-white font-semibold text-lg rounded-xl transition-all duration-200 shadow-md hover:shadow-lg"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        View Results
      </button>

      {/* Scientific disclaimer */}
      <p className="text-xs text-gray-400 text-center leading-relaxed px-4 pb-2">
        These results are exploratory and must be validated experimentally
        before any clinical application.
      </p>
    </div>
  )
}
