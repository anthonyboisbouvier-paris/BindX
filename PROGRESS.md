# DockIt — Progress Tracking

## V1 — MVP (COMPLETE)

### Phase 1 — Backend Pipeline
| Step | Description | Status |
|------|-------------|--------|
| 1.1 | Scaffold FastAPI + structure fichiers | DONE |
| 1.2 | models.py — Pydantic schemas | DONE |
| 1.3 | pipeline/structure.py — AlphaFold DB + ESMFold + UniProt PDB fallback | DONE |
| 1.4 | pipeline/pockets.py — fpocket wrapper + geometric fallback | DONE |
| 1.5 | pipeline/prepare.py — Open Babel + Meeko conversions + fallbacks | DONE |
| 1.6 | pipeline/ligands.py — ChEMBL API + ZINC loader + user SMILES | DONE |
| 1.7 | pipeline/docking.py — AutoDock Vina wrapper + mock fallback | DONE |
| 1.8 | pipeline/scoring.py — RDKit properties + composite score + SVG 2D | DONE |
| 1.9 | pipeline/report.py — PDF + CSV + ZIP generation | DONE |
| 1.10 | tasks.py — Celery task pipeline (8 steps) | DONE |
| 1.11 | main.py — 8 API endpoints with CORS | DONE |
| 1.12 | Dockerfile backend + requirements.txt | DONE |
| 1.13 | TEST: pipeline E2E P00533 -> 10 ligands scored | DONE |

### Phase 2 — Frontend React (V1)
| Step | Description | Status |
|------|-------------|--------|
| 2.1-2.10 | All V1 components + build | DONE |

### Phase 3 — Docker Integration (V1)
| Step | Description | Status |
|------|-------------|--------|
| 3.1-3.6 | docker-compose + tests | DONE |

### Phase 4 — Validation (V1)
| Step | Description | Status |
|------|-------------|--------|
| 4.1-4.8 | All V1 criteria met | DONE |

---

## V2 — Advanced Pipeline (COMPLETE)

### Phase V2.1 — New Backend Modules
| Step | Description | Status |
|------|-------------|--------|
| V2.1.1 | pipeline/generation.py — REINVENT4 wrapper + RDKit scaffold-hopping mock (1165 lines) | DONE |
| V2.1.2 | pipeline/admet.py — ADMET-AI wrapper + RDKit heuristics mock (927 lines) | DONE |
| V2.1.3 | pipeline/retrosynthesis.py — AiZynthFinder wrapper + RDKit disconnection mock (1311 lines) | DONE |
| V2.1.4 | pipeline/docking_diffdock.py — DiffDock wrapper + deterministic mock (951 lines) | DONE |

### Phase V2.2 — Backend Integration
| Step | Description | Status |
|------|-------------|--------|
| V2.2.1 | models.py — V2 schemas (JobCreate mode, ADMETResult, SynthesisRoute, DockingResult V2) | DONE |
| V2.2.2 | scoring.py — V2 composite score (vina*0.4 + admet*0.3 + qed*0.2 + novelty*0.1) | DONE |
| V2.2.3 | tasks.py — 11-step pipeline with basic/advanced mode | DONE |
| V2.2.4 | main.py — V2 endpoints (synthesis route, mode param, generated_molecules) | DONE |
| V2.2.5 | report.py — Enriched PDF with ADMET + retrosynthesis sections | DONE |
| V2.2.6 | database.py — V2 params (mode, enable_generation, etc.) | DONE |

### Phase V2.3 — Docker Config
| Step | Description | Status |
|------|-------------|--------|
| V2.3.1 | requirements.txt — V2 deps (admet-ai, aizynthfinder as optional) | DONE |
| V2.3.2 | Dockerfile — V2 installs with fallbacks | DONE |
| V2.3.3 | docker-compose.yml — aizynthfinder_data volume | DONE |

### Phase V2.4 — Frontend V2
| Step | Description | Status |
|------|-------------|--------|
| V2.4.1 | ADMETRadar.jsx — SVG hexagonal radar chart (6 axes, color-coded) | DONE |
| V2.4.2 | SynthesisTree.jsx — Retrosynthesis tree + step timeline | DONE |
| V2.4.3 | GeneratedMols.jsx — AI-generated molecules grid with purple badges | DONE |
| V2.4.4 | InputForm.jsx — Advanced mode toggle + V2 options | DONE |
| V2.4.5 | ProgressBar.jsx — Dynamic V2 step names | DONE |
| V2.4.6 | ResultsTable.jsx — ADMET + Source + Method columns | DONE |
| V2.4.7 | MoleculeCard.jsx — Tabbed detail (Docking|ADMET|Synthesis) | DONE |
| V2.4.8 | App.jsx — GeneratedMols section integration | DONE |
| V2.4.9 | api.js — getSynthesisRoute endpoint | DONE |
| V2.4.10 | Frontend build: 0 errors, 261 KB JS bundle | DONE |

### Phase V2.5 — Testing
| Step | Description | Status |
|------|-------------|--------|
| V2.5.1 | Docker build (all 3 images) | DONE |
| V2.5.2 | All 4 containers healthy | DONE |
| V2.5.3 | Health endpoint: v2.0.0 | DONE |
| V2.5.4 | Advanced mode: P00533, 10 known + 20 generated | DONE |
| V2.5.5 | ADMET predictions on all molecules | DONE |
| V2.5.6 | Retrosynthesis on top molecules | DONE |
| V2.5.7 | Synthesis route endpoint working | DONE |
| V2.5.8 | PDF report (6 KB, enriched) | DONE |
| V2.5.9 | ZIP archive (432 KB) | DONE |
| V2.5.10 | Basic mode backward compatible: 5 ligands, 0 generated | DONE |

## V2 Test Results

### Advanced Mode: EGFR (P00533) — 10 known + 20 AI-generated
**Known Ligands (Top 3):**
| Rank | Name | Affinity | Score | ADMET | Synth Steps |
|------|------|----------|-------|-------|-------------|
| 1 | CHEMBL306988 | -9.0 | 0.648 | 0.29 (red) | 4 steps, 46% |
| 2 | CHEMBL66879 | -9.7 | 0.617 | 0.29 (red) | 3 steps, 63% |
| 3 | CHEMBL76979 | -8.2 | 0.611 | 0.29 (red) | 5 steps, 36% |

**AI-Generated (Top 3):**
| Rank | Name | Affinity | Score | Novelty | ADMET |
|------|------|----------|-------|---------|-------|
| 1 | GEN_004 | -9.7 | 0.679 | 0.323 | 0.37 (yellow) |
| 2 | GEN_001 | -9.3 | 0.639 | 0.262 | 0.27 (red) |
| 3 | GEN_005 | -9.5 | 0.634 | 0.197 | 0.27 (red) |

### Basic Mode: P00533 — backward compatible
| Rank | Name | Affinity | Score |
|------|------|----------|-------|
| 1 | CHEMBL306988 | -9.0 | 0.942 |

## Architecture V2
- 4 Docker containers: redis, backend, celery_worker, frontend
- **Basic mode**: V1 pipeline unchanged (8 steps)
- **Advanced mode**: 11-step pipeline with generation + ADMET + retrosynthesis
- All V2 modules have 3-tier fallback: real tool → RDKit heuristic → hash-based mock
- New V2 scoring: vina × 0.4 + admet × 0.3 + drug-likeness × 0.2 + novelty × 0.1
- 3 new frontend components: ADMETRadar, SynthesisTree, GeneratedMols
- Tabbed molecule detail: Docking | ADMET | Synthesis
- Total pipeline code: ~4,354 new lines backend + ~1,046 new lines frontend

---

## V3 — UX Simplifiee + Screening Massif (COMPLETE)

### Phase V3.1 — Input Flexible (AXE 1)
| Step | Description | Status |
|------|-------------|--------|
| V3.1.1 | InputForm.jsx — UniProt/Sequence toggle, FASTA validation, AA counter | DONE |
| V3.1.2 | models.py — sequence, notification_email, docking_engine fields | DONE |
| V3.1.3 | database.py — V3 columns (sequence, notification_email, structure_source, etc.) | DONE |
| V3.1.4 | structure.py — fetch_structure_from_sequence() for ESMFold direct | DONE |
| V3.1.5 | tasks.py — sequence input branch, structure_source tracking | DONE |
| V3.1.6 | Auto-ZINC fallback for sequence-only input (no UniProt → ZINC) | DONE |

### Phase V3.2 — UX Simplifiee (AXE 2)
| Step | Description | Status |
|------|-------------|--------|
| V3.2.1 | InputForm.jsx — One field + button, advanced accordion (precision, engine, email) | DONE |
| V3.2.2 | ligands.py — auto_select_ligand_strategy(), query_chembl_count() | DONE |
| V3.2.3 | main.py — _map_mode_to_params() for rapid/standard/deep | DONE |
| V3.2.4 | PedagogicalTip.jsx — 9 educational tips per pipeline step | DONE |
| V3.2.5 | ProgressBar.jsx — Vertical step list, strategy messages, tips | DONE |
| V3.2.6 | PipelineSummary.jsx — Recap screen (elapsed, steps, classification, CTA) | DONE |
| V3.2.7 | ResultsDashboard.jsx — Top 3 cards, score/100, stars, toxicity/synthesis colors | DONE |
| V3.2.8 | App.jsx — summary view, dashboard↔full results toggle, v3.0.0 | DONE |
| V3.2.9 | main.py — score_100, affinity_stars, toxicity_info, synthesis_info helpers | DONE |
| V3.2.10 | main.py — pedagogical_tip in status endpoint | DONE |
| V3.2.11 | main.py — pipeline_summary in status + results endpoints | DONE |

### Phase V3.3 — Screening Massif CPU (AXE 3)
| Step | Description | Status |
|------|-------------|--------|
| V3.3.1 | filter_pharma.py — Pass 1: Lipinski+QED+PAINS filter (738 lines) | DONE |
| V3.3.2 | filter_shape.py — Pass 2: 3D shape filter (696 lines) | DONE |
| V3.3.3 | scoring_rapid.py — Pass 3: smina/Vinardo rapid scoring (927 lines) | DONE |
| V3.3.4 | screening_massive.py — 5-pass orchestrator (1038 lines) | DONE |
| V3.3.5 | tasks.py — run_deep_screening Celery task (time_limit=4h) | DONE |
| V3.3.6 | notifications.py — SMTP email notification on completion | DONE |
| V3.3.7 | Dockerfile — smina installation, /data/chembl directory | DONE |
| V3.3.8 | docker-compose.yml — chembl_data volume, SMTP env vars | DONE |

### Phase V3.4 — Docker Build + E2E Testing
| Step | Description | Status |
|------|-------------|--------|
| V3.4.1 | Docker build: all 4 images (--no-cache) | DONE |
| V3.4.2 | All 4 containers healthy, v3.0.0 | DONE |
| V3.4.3 | Rapid mode: P00533, 10 ligands, score/100, no ADMET | DONE |
| V3.4.4 | Standard mode: P00533, 20 ligands, ADMET + retro | DONE |
| V3.4.5 | Sequence input: ESMFold + auto-ZINC fallback, 5 results | DONE |
| V3.4.6 | Pipeline summary in status + results endpoints | DONE |
| V3.4.7 | Pedagogical tips in status endpoint | DONE |
| V3.4.8 | PDF report + ZIP + protein download (200 OK) | DONE |
| V3.4.9 | Frontend build: 0 errors, 280 KB JS bundle | DONE |

## V3 Test Results

### Standard Mode: EGFR (P00533) — 20 ligands with ADMET + retrosynthesis
| Rank | Name | Affinity | Score/100 | Stars | ADMET | Toxicity | Synthesis |
|------|------|----------|-----------|-------|-------|----------|-----------|
| 1 | CHEMBL306988 | -11.2 | 65 | 5 | YES | high | moderate (4 steps) |
| 2 | CHEMBL421877 | -8.8 | 63 | 4 | YES | high | moderate (4 steps) |
| 3 | CHEMBL420385 | -4.2 | 63 | 2 | YES | high | easy (2 steps) |
| 4 | CHEMBL1009 | -8.4 | 62 | 4 | YES | high | — |
| 5 | CHEMBL66879 | -9.2 | 62 | 4 | YES | high | — |

### Rapid Mode: P00533 — 10 ligands, no ADMET
| Rank | Name | Affinity | Score/100 |
|------|------|----------|-----------|
| 1 | CHEMBL306988 | -11.7 | 95 |

### Sequence Input: 184aa peptide via ESMFold
| Rank | Name | Affinity | Score/100 |
|------|------|----------|-----------|
| 1 | Ibuprofen | -11.1 | 95 |
| 2 | Acetaminophen | -6.0 | 88 |
| 3 | Aspirin | -10.9 | 86 |

## Architecture V3
- 4 Docker containers: redis, backend, celery_worker, frontend
- **Rapid mode**: V1-style pipeline (8 steps), ~50 ligands, ~5 min
- **Standard mode**: V2+ pipeline (9 steps: structure→pockets→prepare→ligands→docking→ADMET→scoring→retrosynthesis→report), ~500 ligands, ~15 min
- **Deep mode**: Massive 5-pass screening (4h), email notification on completion
- Auto ligand strategy: based on ChEMBL hit count (>100=ChEMBL, >10=ChEMBL+ZINC, ≤10=ZINC+generation)
- Score/100 (composite*100), affinity stars (1-5), toxicity levels, synthesis feasibility
- Pipeline summary: step-by-step recap with pedagogical tips
- Results dashboard: top 3 cards before full table view
- Sequence input: ESMFold folding + auto-ZINC fallback
- 4 new screening modules: filter_pharma, filter_shape, scoring_rapid, screening_massive (~3,400 lines)
- 4 new frontend components: PedagogicalTip, PipelineSummary, ResultsDashboard, InputForm rewrite
- Total new V3 code: ~5,000 lines backend + ~2,500 lines frontend

---

## V5bis — Scientific Rigor Upgrade (COMPLETE)

### Phase V5bis.1 — Backend Scientific Pipeline
| Step | Description | Status |
|------|-------------|--------|
| V5bis.1.1 | PDB before AlphaFold — RCSB API query in structure.py | DONE |
| V5bis.1.2 | P2Rank pocket detection — ML-based pocket finder in pockets.py | DONE |
| V5bis.1.3 | GNINA docking — CNN-scored 3-score system in docking.py | DONE |
| V5bis.1.4 | Hard eliminatory cutoffs — hERG, Lipinski, QED, SA, PAINS, CNN in scoring.py | DONE |
| V5bis.1.5 | ProLIF interaction analysis — interaction fingerprinting (mock fallback) | DONE |
| V5bis.1.6 | ADMET applicability domain — Tanimoto nearest-neighbor checking | DONE |
| V5bis.1.7 | Butina clustering — Morgan fingerprint chemical families | DONE |
| V5bis.1.8 | ChEMBL activity filtering — IC50 < 10uM filter in ligands.py | DONE |

### Phase V5bis.2 — Pipeline Integration
| Step | Description | Status |
|------|-------------|--------|
| V5bis.2.1 | tasks.py — 15-step V5bis pipeline with all new modules | DONE |
| V5bis.2.2 | models.py — V5bis fields (eliminated, cnn_score, cluster_id, etc.) | DONE |
| V5bis.2.3 | main.py — V5bis API parsing with all new fields | DONE |
| V5bis.2.4 | Consensus ranking across GNINA 3-score system | DONE |
| V5bis.2.5 | Pipeline summary with hard_cutoffs breakdown + reasons | DONE |

### Phase V5bis.3 — Frontend V5bis
| Step | Description | Status |
|------|-------------|--------|
| V5bis.3.1 | ResultsDashboard.jsx — Eliminated molecule badges, cutoff stats | DONE |
| V5bis.3.2 | ResultsTable.jsx — Strikethrough + red text for eliminated molecules | DONE |
| V5bis.3.3 | InteractionView.jsx — ProLIF interaction display component | DONE |
| V5bis.3.4 | ClusterView.jsx — Chemical family visualization | DONE |
| V5bis.3.5 | Pipeline badges: PDB Experimental, chemical families, interactions | DONE |

### Phase V5bis.4 — Calibration & Fixes
| Step | Description | Status |
|------|-------------|--------|
| V5bis.4.1 | CNN score clamping — GNINA PDBQT produces out-of-range values | DONE |
| V5bis.4.2 | hERG formula calibration — reduced penalties for kinase inhibitors | DONE |
| V5bis.4.3 | CNN cutoff fix — skip elimination when CNN=0.0 (unreliable) | DONE |
| V5bis.4.4 | Include eliminated molecules in stored results (passed first, eliminated last) | DONE |
| V5bis.4.5 | Docking engine auto-detection — show actual gnina instead of default vina | DONE |

### Phase V5bis.5 — E2E Validation
| Step | Description | Status |
|------|-------------|--------|
| V5bis.5.1 | Docker build: all 4 images | DONE |
| V5bis.5.2 | All 4 containers healthy | DONE |
| V5bis.5.3 | EGFR P00533 test: 8/10 passed, 2 eliminated (PAINS, QED) | DONE |
| V5bis.5.4 | PDB experimental structure: 8A27 at 1.07 A resolution | DONE |
| V5bis.5.5 | GNINA docking engine detected and displayed | DONE |
| V5bis.5.6 | 6 Butina clusters | DONE |
| V5bis.5.7 | Hard cutoff reasons breakdown in API | DONE |
| V5bis.5.8 | Eliminated molecules visible in UI with red badges | DONE |
| V5bis.5.9 | Playwright screenshots: all views verified | DONE |

## V5bis Test Results

### Rapid Mode: EGFR (P00533) — 10 ligands, GNINA + hard cutoffs
| Rank | Name | Affinity | Score | CNN | Cluster | Status |
|------|------|----------|-------|-----|---------|--------|
| 1 | CHEMBL76589 | -0.7 | 0.879 | 1.0 | 5 | PASS |
| 2 | CHEMBL77825 | -1.1 | 0.878 | 0.0 | 4 | PASS |
| 3 | CHEMBL68920 | -1.7 | 0.375 | 0.99 | 0 | PASS |
| 4 | CHEMBL77737 | -0.8 | 0.373 | 0.6 | 3 | PASS |
| 5 | CHEMBL77381 | 17.3 | 0.351 | 0.86 | 2 | PASS |
| 6 | CHEMBL69960 | 19.5 | 0.347 | 1.0 | 0 | PASS |
| 7 | CHEMBL443268 | 89.0 | 0.319 | 0.0 | 0 | PASS |
| 8 | CHEMBL137635 | 96.9 | 0.317 | 0.0 | 1 | PASS |
| 9 | CHEMBL310798 | -2.1 | 0.840 | 0.0 | — | ELIM (PAINS) |
| 10 | CHEMBL304271 | 75.2 | 0.274 | 0.1 | — | ELIM (QED) |

**Pipeline Summary:**
- Structure: PDB 8A27 (X-ray, 1.07 A)
- Docking engine: GNINA v1.1 (CNN scoring)
- Hard cutoffs: 8 passed, 2 eliminated
- Elimination reasons: 1 PAINS, 1 QED, 0 hERG, 0 CNN
- Chemical families: 6 Butina clusters
- 15 pipeline steps completed

## Architecture V5bis
- GNINA CNN-scored docking with 3-score consensus (vina_score, cnn_score, cnn_affinity)
- Hard eliminatory cutoffs: hERG > 0.7, Lipinski > 1 violation, QED < 0.25, SA > 6.0, PAINS, CNN < 0.2
- hERG heuristic calibrated for kinase inhibitors (reduced penalties, avoids over-elimination)
- CNN cutoff skipped when score = 0.0 (GNINA PDBQT input artifact)
- ProLIF interaction fingerprinting (mock fallback when not installed)
- ADMET applicability domain via Tanimoto nearest-neighbor
- Butina clustering on Morgan fingerprints (cutoff 0.4)
- Eliminated molecules stored and displayed (red badges, strikethrough)
- Docking engine auto-detected from actual results

---

## V6.0 — Disorder Prediction + Confidence Hierarchy (COMPLETE)

### Phase V6.0.1 — Backend
| Step | Description | Status |
|------|-------------|--------|
| V6.0.1.1 | predict_disorder() in structure.py — IUPred3 API + mock fallback | DONE |
| V6.0.1.2 | Confidence hierarchy: PDB holo 0.98, PDB apo 0.90, AF 0.85, ESMFold 0.60 | DONE |
| V6.0.1.3 | Disorder penalty (-0.10) when fraction_disordered > 0.3 | DONE |
| V6.0.1.4 | IDR-pocket overlap check in tasks.py | DONE |

### Phase V6.0.2 — Frontend UI/UX Overhaul
| Step | Description | Status |
|------|-------------|--------|
| V6.0.2.1 | FeatureBadge component (8 variants) in ResultsDashboard | DONE |
| V6.0.2.2 | Collapsible CandidateCard with showDetails toggle | DONE |
| V6.0.2.3 | Eliminated molecules separated into collapsed accordion | DONE |
| V6.0.2.4 | StructureSourceHierarchy in ConfidenceBreakdown | DONE |
| V6.0.2.5 | Disorder warning display in confidence modal | DONE |

---

## V6.1 — Consensus Detail + UI Table & Mobile (COMPLETE)

### Phase V6.1.1 — Backend
| Step | Description | Status |
|------|-------------|--------|
| V6.1.1.1 | enrich_consensus_detail() in scoring.py — z-scores, agreement, per-method ranks | DONE |
| V6.1.1.2 | consensus_detail field in DockingResult model | DONE |
| V6.1.1.3 | consensus_detail serialized in main.py _parse_results() | DONE |

### Phase V6.1.2 — Frontend UI/UX
| Step | Description | Status |
|------|-------------|--------|
| V6.1.2.1 | Badge.jsx — Shared badge component (6 variants, 2 sizes) | DONE |
| V6.1.2.2 | ResultsTable.jsx — Sticky columns, Agreement badges, mobile toggle | DONE |
| V6.1.2.3 | MoleculeCard.jsx — CTA buttons (View Interactions, View Synthesis) | DONE |
| V6.1.2.4 | App.jsx — Tablet layout fix (md:grid-cols-3, min-h-[400px]) | DONE |

---

## V6.2 — Pareto Multi-Objective Ranking + Interaction Diagram (COMPLETE)

### Phase V6.2.1 — Backend
| Step | Description | Status |
|------|-------------|--------|
| V6.2.1.1 | pareto_ranking() in scoring.py — 4 objectives, iterative front peeling | DONE |
| V6.2.1.2 | DockingResult: pareto_rank, pareto_front, pareto_objectives fields | DONE |
| V6.2.1.3 | Wired into standard + deep pipelines in tasks.py | DONE |

### Phase V6.2.2 — Frontend
| Step | Description | Status |
|------|-------------|--------|
| V6.2.2.1 | ParetoFront.jsx — SVG scatter plot, axis selectors, hover tooltip | DONE |
| V6.2.2.2 | InteractionDiagram.jsx — Radial SVG with color-coded interaction lines | DONE |
| V6.2.2.3 | GeneratedMols.jsx — Pagination (12/page, prev/next buttons) | DONE |
| V6.2.2.4 | ResultsDashboard.jsx — "Multi-Objective Trade-Off" section | DONE |
| V6.2.2.5 | MoleculeCard.jsx — Table/Diagram toggle for interactions | DONE |

---

## V6.3 — SEA Off-Target, ENAMINE REAL, Retrosynthesis Cost (COMPLETE)

### Phase V6.3.1 — Backend (Off-Target + hERG)
| Step | Description | Status |
|------|-------------|--------|
| V6.3.1.1 | predict_off_targets_sea() in off_target.py — mock SEA screening | DONE |
| V6.3.1.2 | Expanded DANGEROUS_TARGETS to 33 entries | DONE |
| V6.3.1.3 | combined_off_target_screening() — 2-tier screening, combined selectivity | DONE |
| V6.3.1.4 | predict_herg_specialized() in admet.py — RDKit IC50 estimation | DONE |

### Phase V6.3.2 — Backend (Ligands + Retrosynthesis)
| Step | Description | Status |
|------|-------------|--------|
| V6.3.2.1 | load_fragment_library() — 50 Rule-of-3 fragments | DONE |
| V6.3.2.2 | sample_enamine_real() — combinatorial SMILES from fragment pools | DONE |
| V6.3.2.3 | auto_select_ligand_strategy() — ENAMINE REAL integration | DONE |
| V6.3.2.4 | verify_reagent_availability() — 50 common building blocks | DONE |
| V6.3.2.5 | estimate_synthesis_cost() — reagent + labor cost estimation | DONE |

### Phase V6.3.3 — Frontend
| Step | Description | Status |
|------|-------------|--------|
| V6.3.3.1 | SafetyReport.jsx — SEA section, combined selectivity badge | DONE |
| V6.3.3.2 | SynthesisTree.jsx — Cost breakdown, reagent availability table | DONE |
| V6.3.3.3 | CandidateCard — SEA hits, hERG badge, cost estimate, reagent ratio | DONE |

### Phase V6.3.4 — API Serialization Fix
| Step | Description | Status |
|------|-------------|--------|
| V6.3.4.1 | DockingResult model: V6.2 + V6.3 fields added | DONE |
| V6.3.4.2 | SynthesisRoute model: cost_estimate, reagent_availability fields | DONE |
| V6.3.4.3 | _parse_results(): pareto, combined_off_target, herg_specialized | DONE |
| V6.3.4.4 | SafetyReport prop: merged off_target + combined_off_target | DONE |

---

## V6 E2E Test Results

### Standard Mode: EGFR (P00533) — 15 known + 20 generated, GNINA
**Pipeline Summary:**
- Structure: PDB 8A27 (X-ray, 1.07 A) — holo with ligand AQ4
- Disorder: 0% disordered (mock), no IDR warning
- Docking engine: GNINA v1.1
- Hard cutoffs: 9 passed (4 known + 5 generated), 26 eliminated
- Elimination: 19 hERG, 3 PAINS, 4 CNN too low
- Butina clusters: 8 chemical families
- Pareto front: 5 molecules on front
- Combined off-target: 5 molecules screened (SEA + docking panel)
- hERG specialized: 1 LOW, 7 MODERATE, 1 HIGH (informational)
- 19 pipeline steps completed

**Top 3 Known Molecules (V6):**
| Rank | Name | Score | Pareto | Affinity | hERG | Cost | Agreement |
|------|------|-------|--------|----------|------|------|-----------|
| 1 | CHEMBL441343 | 0.654 | Front (0) | -3.7 | LOW (50uM) | $1,408 | 3/3 |
| 2 | CHEMBL91867 | 0.540 | Front (0) | -8.1 | MOD (12uM) | $3,767 | 1/3 |
| 3 | CHEMBL76589 | 0.552 | Rank 1 | -5.3 | MOD (25uM) | $2,200 | 1/3 |

**V6.2 Pareto Objectives (Top Molecule):**
| Affinity | Safety | Bioavailability | Synthesis |
|----------|--------|-----------------|-----------|
| 0.375 | 0.440 | 0.610 | 0.862 |

**V6.3 Coverage:**
| Feature | Count |
|---------|-------|
| Pareto objectives | 9/9 passed molecules |
| Combined off-target | 5 (top 5) |
| Specialized hERG | 9/9 passed molecules |
| Synthesis cost | 5 (top 5 with retrosynthesis) |

## Architecture V6
- V6.0: IUPred3 disorder prediction with IDR-pocket overlap check, confidence hierarchy (holo 0.98 → mock 0.20)
- V6.1: Consensus detail with z-score normalization, agreement metric (N/3), per-method rank tracking
- V6.2: Pareto 4-objective ranking (affinity, safety, bioavailability, synthesis), iterative front peeling
- V6.3: Combined off-target screening (SEA broad + 10-panel docking), specialized hERG IC50, ENAMINE REAL fragments, reagent availability + cost estimation
- Frontend: ParetoFront SVG scatter plot, InteractionDiagram radial SVG, collapsible CandidateCard, Badge component, SEA section in SafetyReport, cost/availability in SynthesisTree
- Total V6 new code: ~1,500 lines backend + ~1,200 lines frontend + model/serialization updates
