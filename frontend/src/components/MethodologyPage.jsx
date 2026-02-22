import React, { useState } from 'react'

// --------------------------------------------------
// Section icons
// --------------------------------------------------
const ICONS = {
  structure: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  ),
  pocket: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  ),
  docking: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  ),
  generation: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  admet: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  retrosynthesis: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  safety: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  optimization: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
}

// --------------------------------------------------
// Section data
// --------------------------------------------------
const SECTIONS = [
  {
    id: 'structure',
    icon: 'structure',
    title: 'Structure Prediction',
    tool: 'AlphaFold2 (DeepMind) or ESMFold (Meta)',
    description:
      'Predicts the 3D atomic structure of a protein from its amino acid sequence using deep learning. AlphaFold2 is used first (via the EBI AlphaFold DB); ESMFold provides a fallback when no precomputed structure is available. The predicted structure is provided as a PDB file, which is used in all downstream steps.',
    accuracy: 'Median GDT-TS 92.4 on CASP14 for AlphaFold2. ESMFold achieves similar performance in single-chain prediction.',
    limitation:
      'Less reliable for intrinsically disordered regions, large multi-chain complexes, and proteins with few homologs in the training set (orphan proteins).',
    reference: 'Jumper et al., Nature 2021 (AlphaFold2); Lin et al., Science 2023 (ESMFold)',
    badge: 'Step 1',
    badgeColor: 'bg-blue-100 text-blue-700',
  },
  {
    id: 'pocket',
    icon: 'pocket',
    title: 'Pocket Detection',
    tool: 'fpocket 4.0',
    description:
      'Identifies druggable binding pockets on the protein surface using Voronoi tessellation and alpha sphere methods. The largest or highest-scoring pocket is selected automatically as the docking box. Pocket druggability scores are reported alongside volume and hydrophobicity.',
    accuracy: 'Detects known binding sites in >80% of benchmark structures when a co-crystal ligand is present.',
    limitation:
      'Performance decreases for allosteric sites, cryptic pockets, and protein-protein interaction interfaces that require conformational change to become accessible.',
    reference: 'Le Guilloux et al., BMC Bioinformatics 2009; Schmidtke et al., J Chem Inf Model 2010',
    badge: 'Step 2',
    badgeColor: 'bg-indigo-100 text-indigo-700',
  },
  {
    id: 'docking',
    icon: 'docking',
    title: 'Molecular Docking',
    tool: 'AutoDock Vina 1.2',
    description:
      'Samples and scores small-molecule binding poses inside the detected pocket using a physics-based scoring function. Vina optimizes a hybrid energy function combining van der Waals, hydrogen bonds, electrostatics, and entropy terms. The top poses are ranked by predicted free energy of binding (kcal/mol).',
    accuracy: 'Reproduces co-crystal poses within 2 Angstroms RMSD in ~60-70% of benchmark cases. Relative ranking of congeneric series is generally reliable.',
    limitation:
      'Rigid receptor approximation does not capture induced-fit binding. Scoring accuracy decreases for metals, covalent binders, and highly flexible ligands (>15 rotatable bonds).',
    reference: 'Eberhardt et al., J Chem Inf Model 2021 (Vina 1.2); Trott & Olson, J Comput Chem 2010',
    badge: 'Step 3',
    badgeColor: 'bg-purple-100 text-purple-700',
  },
  {
    id: 'generation',
    icon: 'generation',
    title: 'AI Molecule Generation',
    tool: 'REINVENT4 (generative RL-based SMILES model)',
    description:
      'Generates novel drug-like molecules optimized toward the target pocket using reinforcement learning. A transformer-based SMILES generator is fine-tuned with a reward signal derived from the docking score and ADMET properties. Generated molecules are then re-docked to confirm their predicted affinity.',
    accuracy: 'Generated molecules typically show 10-30% improvement in docking score versus ChEMBL screening hits. Novelty (Tanimoto < 0.4 to training set) is typically >80%.',
    limitation:
      'Generated molecules may be chemically unusual or difficult to synthesize. SMILES validity can drop for very long sequences. Experimental confirmation is required for all AI-generated candidates.',
    reference: 'Loeffler et al., J Chem Inf Model 2024 (REINVENT4)',
    badge: 'Step 4',
    badgeColor: 'bg-pink-100 text-pink-700',
  },
  {
    id: 'admet',
    icon: 'admet',
    title: 'ADMET Prediction',
    tool: 'ADMET-AI (graph neural network ensemble)',
    description:
      'Predicts absorption, distribution, metabolism, excretion, and toxicity (ADMET) properties from molecular structure. The model ensemble covers >40 endpoints including Caco-2 permeability, hERG inhibition, CYP450 metabolism, aqueous solubility, plasma protein binding, and LD50 toxicity. A composite ADMET score (0-1) is computed and color-coded green/yellow/red.',
    accuracy: 'Typical AUROC 0.80-0.90 on internal test sets. Performance varies by endpoint; simpler endpoints (e.g. LogD) are more accurate than complex ones (e.g. CNS penetration).',
    limitation:
      'Predictions are based on molecular fingerprints/graphs and may not capture metabolic soft spots, reactive intermediates, or species-specific differences. In vitro confirmation is required before progressing candidates.',
    reference: 'Swanson et al., Bioinformatics 2023 (ADMET-AI)',
    badge: 'Step 5',
    badgeColor: 'bg-green-100 text-green-700',
  },
  {
    id: 'retrosynthesis',
    icon: 'retrosynthesis',
    title: 'Retrosynthesis Planning',
    tool: 'AiZynthFinder (Monte Carlo Tree Search + template library)',
    description:
      'Plans a synthetic route for each candidate molecule by recursively applying retrosynthetic disconnection rules until commercial starting materials are reached. Each step uses a trained reaction template selector. Routes are ranked by number of steps, availability of reagents, and estimated yield.',
    accuracy: 'Finds a valid route in 80-90% of drug-like molecules in 60 seconds (Monte Carlo Tree Search, up to 5 steps). Route quality may be lower for novel scaffolds not in the template library.',
    limitation:
      'Does not consider stereoselectivity, regioselectivity, or actual reaction conditions (solvent, temperature, catalyst). Route feasibility should be validated by a medicinal chemist.',
    reference: 'Genheden et al., J Cheminform 2020 (AiZynthFinder)',
    badge: 'Step 6',
    badgeColor: 'bg-yellow-100 text-yellow-700',
  },
  {
    id: 'safety',
    icon: 'safety',
    title: 'Off-Target Safety Screening',
    tool: 'DockIt V5 — multi-target docking panel',
    description:
      'Screens each candidate against a panel of 10 key anti-targets: hERG (cardiac arrhythmia), CYP3A4, CYP2D6, CYP2C9 (drug metabolism), hNAV1.5 (cardiac), PXR (drug induction), COX-1/2 (GI toxicity), carbonic anhydrase II, and acetylcholinesterase. Uses AutoDock Vina with pre-prepared anti-target structures from the Protein Data Bank. A selectivity score (0-1) summarizes overall off-target safety.',
    accuracy: 'Off-target binding predictions have lower accuracy than primary target docking due to less experimental data for validation. Use as a triage tool only.',
    limitation:
      'Computational selectivity predictions must be confirmed with experimental assays (e.g., Cerep selectivity panel, hERG patch-clamp, CYP inhibition IC50). False negatives and positives are common.',
    reference: 'DockIt V5 internal pipeline. Anti-target structures from PDB (updated quarterly).',
    badge: 'V5 New',
    badgeColor: 'bg-orange-100 text-orange-700',
  },
  {
    id: 'optimization',
    icon: 'optimization',
    title: 'Lead Optimization',
    tool: 'DockIt V5 — multi-objective RL optimization',
    description:
      'Iteratively improves a selected lead molecule using multi-objective reinforcement learning. A generative model proposes structural variants each iteration; each variant is scored against a weighted combination of binding affinity, predicted toxicity, oral bioavailability, and synthesis complexity. The Pareto front is tracked across iterations. Users can adjust objective weights to reflect their project priorities.',
    accuracy: 'Improvement of 10-30% in composite score is typical over 10-20 iterations. Quality of results depends strongly on the quality of scoring functions used.',
    limitation:
      'Optimization is constrained to the scoring functions\' ability to capture desired properties. Unexpected failure modes (e.g., novel toxicophores introduced during optimization) may not be detected. Wet lab follow-up is mandatory.',
    reference: 'DockIt V5 internal pipeline. Based on REINVENT4 and multi-objective optimization literature.',
    badge: 'V5 New',
    badgeColor: 'bg-orange-100 text-orange-700',
  },
]

// --------------------------------------------------
// Section card
// --------------------------------------------------
function SectionCard({ section, isOpen, onToggle }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header — always visible */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="w-10 h-10 rounded-lg bg-dockit-blue flex items-center justify-center text-dockit-green flex-shrink-0">
          {ICONS[section.icon]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-dockit-blue text-base">{section.title}</h3>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${section.badgeColor}`}>
              {section.badge}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{section.tool}</p>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded content */}
      {isOpen && (
        <div className="px-5 pb-5 border-t border-gray-50">
          {/* Tool name */}
          <div className="mt-4 mb-3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Tool</span>
            <p className="text-sm font-medium text-dockit-blue mt-0.5">{section.tool}</p>
          </div>

          {/* Description */}
          <div className="mb-4">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">What it does</span>
            <p className="text-sm text-gray-600 mt-1 leading-relaxed">{section.description}</p>
          </div>

          {/* Accuracy / Limitation / Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-green-50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <svg className="w-3.5 h-3.5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Accuracy</span>
              </div>
              <p className="text-xs text-green-800 leading-relaxed">{section.accuracy}</p>
            </div>

            <div className="bg-amber-50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <svg className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Limitation</span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">{section.limitation}</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <svg className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Reference</span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed italic">{section.reference}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// --------------------------------------------------
// MethodologyPage
// --------------------------------------------------
export default function MethodologyPage({ onBack }) {
  const [openSection, setOpenSection] = useState(null)

  const toggleSection = (id) => {
    setOpenSection((prev) => (prev === id ? null : id))
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back + header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-dockit-blue">Methodology</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Scientific description of each tool and algorithm used in the DockIt pipeline
          </p>
        </div>
      </div>

      {/* Expand all / Collapse all */}
      <div className="flex justify-end gap-2">
        <button
          onClick={() => setOpenSection('all')}
          className="text-xs text-dockit-blue hover:underline"
        >
          Expand all
        </button>
        <span className="text-gray-300">|</span>
        <button
          onClick={() => setOpenSection(null)}
          className="text-xs text-dockit-blue hover:underline"
        >
          Collapse all
        </button>
      </div>

      {/* Pipeline overview */}
      <div className="bg-dockit-blue rounded-xl p-5 text-white">
        <h2 className="font-bold text-lg mb-2">DockIt Computational Pipeline</h2>
        <p className="text-white/70 text-sm leading-relaxed mb-4">
          DockIt automates a complete structure-based virtual screening and hit-to-lead workflow.
          Each step is performed by a best-in-class computational tool with fallback mechanisms to ensure robustness.
        </p>
        <div className="flex flex-wrap gap-2">
          {SECTIONS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1.5 text-xs text-white/80">
              {i > 0 && <svg className="w-3 h-3 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>}
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.badgeColor}`}>{i + 1}</span>
              <span>{s.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Section cards */}
      <div className="space-y-3">
        {SECTIONS.map((section) => (
          <SectionCard
            key={section.id}
            section={section}
            isOpen={openSection === 'all' || openSection === section.id}
            onToggle={() => toggleSection(section.id)}
          />
        ))}
      </div>

      {/* General disclaimer */}
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-800 mb-1">General Disclaimer</p>
            <p className="text-xs text-amber-700 leading-relaxed">
              All predictions produced by DockIt are computational and exploratory in nature.
              They do not constitute medical advice and should not be used to make clinical decisions.
              All candidates must be synthesized and validated experimentally (biochemical assays, cell-based assays, in vivo studies)
              before any consideration for further development.
              Computational scores are indicative only and may not correlate with experimental activity.
              DockIt is a research tool for early-stage drug discovery support.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
