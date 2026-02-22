import React from 'react'

const TIPS = {
  structure: "AlphaFold predicts the 3D shape of your protein from its amino acid sequence with atomic-level accuracy.",
  pockets: "fpocket detects cavities on the protein surface where a molecule could bind — these are potential binding sites.",
  ligands: "We search for compounds already tested on this protein in global chemical databases.",
  docking: "Docking simulates how each molecule fits into the pocket. A more negative score means stronger predicted binding affinity.",
  admet: "ADMET analysis checks toxicity, intestinal absorption, distribution, and metabolic stability of each candidate.",
  retrosynthesis: "AI plans how to synthesize this molecule in the lab, step by step, from available reagents.",
  generation: "Artificial intelligence generates new candidate molecules optimized for your specific binding pocket.",
  scoring: "Scoring combines binding affinity, pharmacological properties, and synthesis feasibility into a single score.",
  report: "The final report compiles all results with 3D structures, scores, and detailed analyses.",
  default: "The pipeline analyzes your target protein to identify the best therapeutic candidates.",
}

function resolveStepKey(step) {
  const s = (step || '').toLowerCase()
  if (s.includes('structure') || s.includes('alphafold') || s.includes('esmfold') || s.includes('3d')) return 'structure'
  if (s.includes('poche') || s.includes('pocket') || s.includes('binding') || s.includes('site')) return 'pockets'
  if (s.includes('ligand') || s.includes('molecule') || s.includes('chembl') || s.includes('zinc') || s.includes('candid')) return 'ligands'
  if (s.includes('dock') || s.includes('vina') || s.includes('diffdock')) return 'docking'
  if (s.includes('admet') || s.includes('toxicit') || s.includes('absorption') || s.includes('drug')) return 'admet'
  if (s.includes('retro') || s.includes('synthes') || s.includes('route')) return 'retrosynthesis'
  if (s.includes('generat') || s.includes('ia') || s.includes('generatif')) return 'generation'
  if (s.includes('scor') || s.includes('composit') || s.includes('ranking') || s.includes('classement')) return 'scoring'
  if (s.includes('rapport') || s.includes('report') || s.includes('pdf') || s.includes('final')) return 'report'
  return 'default'
}

export default function PedagogicalTip({ step }) {
  const tipKey = resolveStepKey(step)
  const tip = TIPS[tipKey]

  return (
    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
      <span className="text-xl flex-shrink-0" aria-hidden="true">💡</span>
      <p className="text-sm text-blue-800 leading-relaxed">{tip}</p>
    </div>
  )
}
