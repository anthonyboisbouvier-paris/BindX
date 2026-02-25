Cahier des Charges - BindX V5"Lead Optimization & Off-Target Safety"Prerequis : V4 fonctionnelleDate : 21 fevrier 20261. VISION V5V4 = biology-aware docking. V5 = passer du "one-shot" a un vrai workflow iteratif de drug discovery. Deux axes : lead optimization (raffiner un hit en lead) et off-target screening (verifier que le candidat ne fait pas de degats ailleurs). Plus un axe confiance et transparence scientifique totale.La V5 est ce qui transforme BindX d'un outil de screening en un vrai outil de drug discovery credible.2. AXE 1 — LEAD OPTIMIZATION ITERATIF2.1 Le conceptAujourd'hui BindX fait du one-shot : on screene, on obtient des hits, c'est fini. En vrai drug discovery, un hit n'est jamais utilisable tel quel. Il faut l'optimiser sur plusieurs criteres simultanement : meilleure affinite, moins de toxicite, meilleure solubilite, synthese plus simple.C'est une boucle iterative qui part d'un hit et converge vers un lead optimise.2.2 Workflow utilisateurApres les resultats du screening, sur chaque molecule l'utilisateur voit un nouveau bouton :Erlotinib         Score: 72/100
Affinity: 4/5    Toxicity: moderate (yellow)
Synthesis: 4 steps

[View in 3D]    [Optimize this molecule]Quand il clique "Optimize this molecule" :Lead Optimization — Starting from Erlotinib

Optimization targets (pre-configured, user can adjust) :
  ✅ Maximize binding affinity     weight: 0.35
  ✅ Minimize toxicity (hERG)      weight: 0.25
  ✅ Maximize oral bioavailability  weight: 0.20
  ✅ Minimize synthesis complexity  weight: 0.20

Number of iterations : 10
Variants per iteration : 50

[Start optimization]    [Advanced settings]2.3 Pipeline d'optimisationIteration 1 :
  Input : molecule de depart (hit)
  REINVENT4 genere 50 variantes proches (scaffolding mode)
  → Docking de chaque variante
  → ADMET de chaque variante
  → Score multi-objectif pour chaque variante
  → Garder le top 5
  
Iteration 2 :
  Input : le meilleur de l'iteration 1
  REINVENT4 genere 50 nouvelles variantes
  → Meme pipeline
  → Garder le top 5
  
... repeter 10 fois ...

Resultat final :
  Le meilleur lead apres 10 iterations
  + historique complet de l'evolution
  + comparaison avant/apres sur chaque critere2.4 Backend - lead_optimization.pyCreer backend/pipeline/lead_optimization.py

Logique :
1. Recevoir le SMILES de depart + les poids des objectifs
2. Configurer REINVENT4 en mode "scaffold decoration" :
   - Garder le squelette principal de la molecule
   - Varier les groupes fonctionnels
   - Contrainte de similarite Tanimoto > 0.5 avec la molecule parent
     (pour rester dans le meme espace chimique)
3. Scoring function multi-objectif :
   score = (vina_score_normalized * w_affinity
          + admet_herg_safe * w_toxicity
          + admet_oral_bio * w_bioavailability  
          + synthesis_score * w_synthesis)
4. A chaque iteration :
   - Generer 50 variantes
   - Docker chacune (Vina)
   - ADMET chacune
   - Retrosynthese du top 1 (pour le score synthese)
   - Calculer le score multi-objectif
   - Selectionner le top 5
   - Logger iteration_number, best_score, best_smiles, all_scores
5. Apres 10 iterations :
   - Retourner le meilleur lead
   - Retourner l'historique complet
   - Retourner la comparaison hit initial vs lead final2.5 Validation chimique a chaque iterationC'est critique pour la confiance. A chaque variante generee, verifier :python# Dans lead_optimization.py, pour chaque molecule generee :

def validate_molecule(smiles):
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return False, "Invalid SMILES"
    
    # 1. Validite chimique
    try:
        Chem.SanitizeMol(mol)
    except:
        return False, "Failed sanitization"
    
    # 2. Pas de groupes reactifs dangereux
    pains = FilterCatalog.FilterCatalog(FilterCatalog.FilterCatalogParams.FilterCatalogs.PAINS)
    if pains.HasMatch(mol):
        return False, "PAINS alert"
    
    # 3. Drug-likeness minimum
    qed = QED.qed(mol)
    if qed < 0.2:
        return False, f"QED too low: {qed}"
    
    # 4. Synthetically accessible
    sa_score = sascorer.calculateScore(mol)
    if sa_score > 7:
        return False, f"SA score too high: {sa_score}"
    
    # 5. Similarity to parent (pas trop different)
    parent_fp = AllChem.GetMorganFingerprintAsBitVect(parent_mol, 2, 2048)
    child_fp = AllChem.GetMorganFingerprintAsBitVect(mol, 2, 2048)
    tanimoto = DataStructs.TanimotoSimilarity(parent_fp, child_fp)
    if tanimoto < 0.3:
        return False, f"Too different from parent: {tanimoto}"
    
    return True, "Valid"Chaque molecule rejetee est loggee avec la raison. L'utilisateur peut voir pourquoi dans le detail.2.6 UX - Suivi en temps reel de l'optimisationLead Optimization — Iteration 4/10

Starting molecule: Erlotinib (score 72/100)
Current best: AI-Opt-0037 (score 84/100)

Score evolution :
  It.1: 72 → 76  (+4)
  It.2: 76 → 79  (+3)
  It.3: 79 → 82  (+3)
  It.4: 82 → 84  (+2)   ← current
  
  [graph showing score evolution over iterations]

Detail per objective :
                    Start    Current   Change
  Affinity          -7.2     -9.1      +26% ✅
  Toxicity (hERG)   0.45     0.12      -73% ✅
  Bioavailability   0.62     0.78      +26% ✅
  Synthesis         5 steps  4 steps   -20% ✅

Current best molecule :
  [2D structure SVG]
  SMILES: CCOc1cc2ncnc(Nc3ccc(F)c(Cl)c3)c2cc1OCC
  Tanimoto to parent: 0.67
  
  50 variants tested this iteration, 12 valid, 3 improved

  ████████████████████░░░░░░░░░░  40%  ~6 min remaining2.7 Rapport final d'optimisationLead Optimization Report

Starting molecule : Erlotinib
Final lead : AI-Opt-0037
Iterations : 10
Total molecules tested : 500
Total molecules valid : 187 (37%)
Total molecules improved : 42 (8.4%)

Score evolution : 72 → 91 (+26%)

Detailed comparison :
                    Hit         Lead        Change
  Vina score        -7.2        -9.8        +36%
  hERG inhibition   0.45        0.08        -82%
  Oral bioavail.    0.62        0.89        +44%
  Synthesis steps   5           3           -40%
  SA score          3.2         2.1         -34%
  QED               0.61        0.78        +28%
  Lipinski viol.    0           0           =

Chemical modifications applied :
  - Replaced methoxy group at position 6 with ethoxy (iteration 2)
  - Added fluorine at position 3' (iteration 4)  
  - Simplified side chain (iteration 7)

Confidence notes :
  - All Vina scores are computational predictions, not experimental
  - ADMET predictions based on ADMET-AI models (AUROC ~0.85)
  - Synthesis routes verified by AiZynthFinder with commercial reagents
  - Final lead should be validated experimentally before any application

  [Download full report PDF]
  [Download all molecules SDF]
  [Download optimization log CSV]3. AXE 2 — OFF-TARGET SCREENING3.1 Le conceptUn bon candidat ne doit pas seulement bien se fixer sur la cible. Il doit aussi NE PAS se fixer sur d'autres proteines, sinon = effets secondaires.3.2 Panel anti-cibles standardUtiliser un panel fixe de proteines connues pour causer des effets secondaires :pythonOFF_TARGET_PANEL = {
    "hERG (KCNH2)": {
        "uniprot": "Q12809",
        "risk": "Cardiac arrhythmia",
        "threshold": -7.0  # si vina_score < threshold = danger
    },
    "CYP3A4": {
        "uniprot": "P08684",
        "risk": "Drug-drug interactions",
        "threshold": -7.5
    },
    "CYP2D6": {
        "uniprot": "P10635",
        "risk": "Drug-drug interactions",
        "threshold": -7.5
    },
    "COX-1": {
        "uniprot": "P23219",
        "risk": "GI bleeding",
        "threshold": -7.0
    },
    "COX-2": {
        "uniprot": "P35354",
        "risk": "Cardiovascular risk",
        "threshold": -7.0
    },
    "MAO-A": {
        "uniprot": "P21397",
        "risk": "Hypertensive crisis",
        "threshold": -6.5
    },
    "Muscarinic M1": {
        "uniprot": "P11229",
        "risk": "Anticholinergic effects",
        "threshold": -6.5
    },
    "Dopamine D2": {
        "uniprot": "P14416",
        "risk": "Extrapyramidal effects",
        "threshold": -6.5
    },
    "Serotonin 5-HT2A": {
        "uniprot": "P28223",
        "risk": "Hallucinations, serotonin syndrome",
        "threshold": -6.5
    },
    "GABA-A": {
        "uniprot": "P14867",
        "risk": "Sedation, respiratory depression",
        "threshold": -6.5
    }
}3.3 Backend - off_target.pyCreer backend/pipeline/off_target.py

Logique :
1. Recevoir le SMILES du candidat (ou top 5 candidats)
2. Pour chaque proteine du panel :
   a. Telecharger/cacher la structure AlphaFold (une fois)
   b. Detecter la poche principale (fpocket, une fois, cacher)
   c. Docker le candidat contre cette poche (Vina)
   d. Comparer le score au threshold
3. Resultat par molecule :
   off_target_results = {
       "hERG": {"score": -5.2, "threshold": -7.0, "status": "safe", "color": "green"},
       "CYP3A4": {"score": -8.1, "threshold": -7.5, "status": "risk", "color": "red"},
       ...
   }
   selectivity_score = nombre de "safe" / total
4. Si une anti-cible est touchee, generer un warning explicite :
   "WARNING: This molecule shows significant binding to CYP3A4 (-8.1 kcal/mol).
    This may cause drug-drug interactions. Consider optimization to reduce CYP3A4 affinity."3.4 Cache des structures off-targetLes 10 structures + poches du panel ne changent jamais. Les pre-calculer une fois :bash# Au premier lancement ou dans le Dockerfile :
# Telecharger les 10 structures AlphaFold
# Executer fpocket sur chacune
# Preparer les fichiers PDBQT
# Stocker dans /data/off_targets/Apres ca, chaque off-target docking prend ~5 sec. 10 cibles x 5 candidats = ~4 minutes. Negligeable.3.5 Integration dans le pipelineL'off-target screening s'execute automatiquement apres le scoring, sur le top 5 candidats :...
Scoring composite      ✅
Off-target screening   🔄  Testing 5 candidates against 10 anti-targets
   ████████████░░░░░░  60%  Candidate 3/5 — Anti-target: CYP2D6
Retrosynthesis         ○  waiting3.6 UX - Resultats off-targetDans le dashboard de resultats, chaque molecule montre un indicateur de selectivite :1. AI-Opt-0037        Score: 91/100
   Affinity: 5/5     Toxicity: low (green)
   Selectivity: 10/10 anti-targets clear (green)
   Synthesis: 3 steps
   [View in 3D]  [Optimize]  [Safety report]Quand l'utilisateur clique "Safety report" :Off-Target Safety Report — AI-Opt-0037

Anti-target        Score     Threshold   Status    Risk
hERG (cardiac)     -5.2      -7.0        ✅ Safe    Cardiac arrhythmia
CYP3A4             -4.8      -7.5        ✅ Safe    Drug interactions
CYP2D6             -5.5      -7.5        ✅ Safe    Drug interactions
COX-1              -3.2      -7.0        ✅ Safe    GI bleeding
COX-2              -4.1      -7.0        ✅ Safe    Cardiovascular
MAO-A              -3.8      -6.5        ✅ Safe    Hypertensive crisis
Muscarinic M1      -4.5      -6.5        ✅ Safe    Anticholinergic
Dopamine D2        -5.9      -6.5        ✅ Safe    Extrapyramidal
5-HT2A             -4.2      -6.5        ✅ Safe    Hallucinations
GABA-A             -3.1      -6.5        ✅ Safe    Sedation

Selectivity index: 10/10 (100%)
Overall safety assessment: LOW RISK

Note: These are computational predictions based on molecular docking.
Off-target binding should be confirmed experimentally with in vitro assays.
Docking scores below threshold indicate potential binding, not confirmed activity.Si un anti-target est touche :CYP3A4             -8.1      -7.5        ⚠️ RISK   Drug interactions

⚠️ This molecule shows significant predicted binding to CYP3A4.
   CYP3A4 metabolizes ~50% of marketed drugs. Inhibition may cause
   dangerous drug-drug interactions.
   
   Recommendation: Use the "Optimize" feature with increased weight
   on CYP3A4 avoidance to generate safer variants.3.7 Integration avec le lead optimizationL'off-target peut etre integre dans la scoring function de l'optimisation :python# Dans lead_optimization.py, ajouter optionnellement :
score = (vina_score_normalized * w_affinity
       + admet_herg_safe * w_toxicity
       + admet_oral_bio * w_bioavailability  
       + synthesis_score * w_synthesis
       + selectivity_score * w_selectivity)   # NEWAinsi l'optimisation evite automatiquement les molecules qui touchent des anti-cibles.4. AXE 3 — TRANSPARENCE ET CONFIANCE SCIENTIFIQUE4.1 PrincipeLa drug discovery ne tolere pas l'approximation. L'utilisateur doit comprendre exactement ce qui s'est passe, quelles sont les limites, et quel niveau de confiance accorder a chaque resultat.4.2 Confidence score par moleculeChaque molecule recoit un score de confiance detaille :pythondef calculate_confidence(molecule):
    confidence = {
        "overall": 0,
        "components": {}
    }
    
    # Confiance structure proteine
    if structure_source == "alphafold" and plddt > 90:
        confidence["components"]["structure"] = {"score": 0.95, "note": "High-confidence AlphaFold structure"}
    elif structure_source == "alphafold" and plddt > 70:
        confidence["components"]["structure"] = {"score": 0.75, "note": "Moderate-confidence AlphaFold structure"}
    elif structure_source == "esmfold":
        confidence["components"]["structure"] = {"score": 0.60, "note": "ESMFold prediction — lower confidence than AlphaFold"}
    
    # Confiance pocket
    if functional_overlap > 0.8:
        confidence["components"]["pocket"] = {"score": 0.95, "note": "Pocket contains known functional residues"}
    elif functional_overlap > 0:
        confidence["components"]["pocket"] = {"score": 0.70, "note": "Partial overlap with functional residues"}
    else:
        confidence["components"]["pocket"] = {"score": 0.50, "note": "Pocket selected by druggability only — no functional validation"}
    
    # Confiance docking
    if molecule_source == "chembl_known_active":
        confidence["components"]["docking"] = {"score": 0.85, "note": "Known active compound — docking confirms existing data"}
    elif molecule_source == "chembl":
        confidence["components"]["docking"] = {"score": 0.65, "note": "Known compound — docking score is computational prediction"}
    elif molecule_source == "reinvent4":
        confidence["components"]["docking"] = {"score": 0.45, "note": "AI-generated molecule — no experimental validation"}
    
    # Confiance ADMET
    confidence["components"]["admet"] = {"score": 0.70, "note": "ADMET-AI predictions (typical AUROC 0.80-0.90)"}
    
    # Confiance synthese
    if synthesis_route and all_reagents_available:
        confidence["components"]["synthesis"] = {"score": 0.80, "note": "Synthesis route found with commercial reagents"}
    elif synthesis_route:
        confidence["components"]["synthesis"] = {"score": 0.50, "note": "Synthesis route found but some reagents may be unavailable"}
    else:
        confidence["components"]["synthesis"] = {"score": 0.20, "note": "No synthesis route found"}
    
    # Score global
    confidence["overall"] = mean([c["score"] for c in confidence["components"].values()])
    
    return confidence4.3 UX - Affichage de la confianceSur chaque molecule dans le dashboard :1. AI-Opt-0037        Score: 91/100     Confidence: 78%Quand l'utilisateur clique sur le score de confiance :Confidence Breakdown — AI-Opt-0037

Component          Confidence   Note
Structure          95%          High-confidence AlphaFold structure (pLDDT 92.4)
Pocket selection   95%          Contains 100% of known functional residues
Docking score      45%          AI-generated molecule — no experimental data
ADMET prediction   70%          ADMET-AI model (typical AUROC 0.80-0.90)
Off-target safety  85%          10/10 anti-targets clear
Synthesis route    80%          3-step route with commercial reagents

Overall: 78%

⚠️ Key limitation: This is an AI-generated molecule with no experimental
   validation. The docking score (-9.8 kcal/mol) is a computational
   prediction. Experimental binding assays are required to confirm activity.
   
   Vina docking has a typical success rate of 50-70% for identifying
   true binders in the top-scoring compounds.4.4 Methodology cardAccessible depuis le menu ou le rapport PDF. Explique exactement ce que chaque outil fait, ses limites connues, et les references scientifiques :Creer une page /methodology accessible depuis le header

Methodology — How BindX works

STRUCTURE PREDICTION
  Tool: AlphaFold2 (DeepMind) or ESMFold (Meta)
  What it does: Predicts 3D protein structure from amino acid sequence
  Accuracy: Median GDT-TS 92.4 on CASP14 (AlphaFold)
  Limitation: Less reliable for disordered regions, multi-chain complexes
  Reference: Jumper et al., Nature 2021

POCKET DETECTION  
  Tool: fpocket 4.0
  What it does: Detects druggable cavities using Voronoi tessellation
  Accuracy: Identifies known binding sites in ~85% of cases
  Limitation: May miss cryptic or allosteric sites
  Reference: Le Guilloux et al., BMC Bioinformatics 2009

MOLECULAR DOCKING
  Tool: AutoDock Vina 1.2
  What it does: Predicts binding pose and affinity score
  Accuracy: ~70% of top-scored poses within 2A RMSD of crystal pose
  Limitation: Rigid receptor, scoring function approximations
  Scoring: Empirical function combining van der Waals, H-bonds, 
           electrostatics, desolvation
  Reference: Eberhardt et al., J Chem Inf Model 2021

MOLECULE GENERATION
  Tool: REINVENT4 (AstraZeneca)
  What it does: Generates novel molecules using reinforcement learning
  Limitation: Generates 1D SMILES, not 3D poses. Chemical validity ~90%.
              No experimental validation.
  Reference: Loeffler et al., J Cheminf 2024

ADMET PREDICTION
  Tool: ADMET-AI (Swanson Lab)
  What it does: Predicts ~40 pharmacological properties
  Accuracy: Typical AUROC 0.80-0.90 per endpoint
  Limitation: Predictions based on training data distribution.
              Novel chemotypes may be less reliable.
  Reference: Swanson et al., 2024

RETROSYNTHESIS
  Tool: AiZynthFinder (AstraZeneca)  
  What it does: Plans synthesis routes from commercial reagents
  Accuracy: Finds routes for ~85% of drug-like molecules
  Limitation: Route feasibility is computational prediction.
              Actual synthesis may require optimization.
  Reference: Genheden et al., J Cheminf 2020

OFF-TARGET SCREENING
  Method: Docking against panel of 10 known anti-targets
  Limitation: Only covers major off-targets. True selectivity requires
              experimental profiling across hundreds of targets.
  
GENERAL DISCLAIMER
  All results are computational predictions intended for research use only.
  No result should be interpreted as a validated drug candidate.
  Experimental validation (binding assays, cell assays, animal models)
  is required before any therapeutic application.4.5 Audit logChaque job genere un log complet telechargeable :Creer backend/pipeline/audit_log.py

Pour chaque job, logger :
- Timestamp de chaque etape
- Version exacte de chaque outil utilise
- Parametres exacts (exhaustiveness, scoring function, thresholds)
- Nombre de molecules testees / filtrees / rejetees a chaque etape avec raisons
- Scores bruts avant normalisation
- Warnings et erreurs rencontres

Format : JSON structure + version CSV lisible

Endpoint : GET /api/jobs/{job_id}/audit_log4.6 Rapport PDF enrichiLe rapport PDF V5 contient :Page 1 : Executive summary (top 3 candidates, key metrics)
Page 2 : Pipeline summary (all steps, parameters, decisions)
Page 3 : Pocket analysis (functional overlap, selection rationale)
Page 4-6 : Top candidates detail (structure, scores, ADMET radar, synthesis)
Page 7 : Off-target safety report (full panel results)
Page 8 : Lead optimization history (if applicable)
Page 9 : Confidence assessment (per-component breakdown)
Page 10 : Methodology and references
Page 11 : Disclaimer and limitations

Footer on every page :
"BindX v5.0 — Computational predictions for research use only"
"Job ID: xxx — Generated: [date] — Audit log available"5. STRUCTURE FICHIERS V5bindx/
├── backend/
│   ├── pipeline/
│   │   ├── ... tous les fichiers V4 ...
│   │   ├── lead_optimization.py      NEW boucle iterative
│   │   ├── off_target.py             NEW screening anti-cibles
│   │   ├── confidence.py             NEW score de confiance
│   │   └── audit_log.py              NEW log d'audit
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ... tous les composants V4 ...
│   │   │   ├── OptimizationView.jsx  NEW suivi optimisation temps reel
│   │   │   ├── OptimizationChart.jsx NEW graphique evolution score
│   │   │   ├── SafetyReport.jsx      NEW rapport off-target
│   │   │   ├── ConfidenceBreakdown.jsx NEW detail confiance
│   │   │   └── MethodologyPage.jsx   NEW page methodologie
├── data/
│   ├── ... V4 ...
│   └── off_targets/                  NEW structures pre-calculees panel6. INSTRUCTIONS CLAUDE CODE - V5Prompt unique V5Lis BindX_V5_Cahier_des_Charges.md dans ce repertoire.

La V4 est fonctionnelle. Implemente la V5 dans cet ordre :

ETAPE 1 : Off-target panel setup
- Telecharge les 10 structures AlphaFold du panel anti-cibles (hERG, CYP3A4, CYP2D6, COX-1, COX-2, MAO-A, Muscarinic M1, Dopamine D2, 5-HT2A, GABA-A)
- Execute fpocket sur chacune, pre-calcule les poches et fichiers PDBQT
- Stocke tout dans /data/off_targets/ avec un fichier index.json
- Ce setup se fait une seule fois au premier lancement

ETAPE 2 : Off-target screening
- Cree backend/pipeline/off_target.py
- Pour chaque candidat du top 5 : docker contre les 10 anti-cibles
- Comparer chaque score au threshold defini
- Retourner selectivity_score + details + warnings si risque detecte
- Integrer dans le pipeline apres le scoring, avant la retrosynthese
- Afficher dans le pipeline : "Testing 5 candidates against 10 anti-targets"

ETAPE 3 : Lead optimization
- Cree backend/pipeline/lead_optimization.py
- Mode scaffold decoration de REINVENT4 : garder le squelette, varier les groupes
- Contrainte Tanimoto > 0.3 avec le parent
- Validation chimique a chaque molecule : sanitize, PAINS, QED, SA score
- Scoring multi-objectif : affinity * 0.35 + toxicity * 0.25 + bioavailability * 0.20 + synthesis * 0.20
- 10 iterations de 50 variantes chacune
- Logger chaque iteration : best_score, best_smiles, n_valid, n_improved
- Celery task avec mise a jour du statut a chaque iteration

ETAPE 4 : Confiance et transparence
- Cree backend/pipeline/confidence.py : score de confiance par composant
- Cree backend/pipeline/audit_log.py : log complet de chaque job
- Endpoint GET /api/jobs/{job_id}/audit_log
- Mets a jour report.py : rapport PDF 11 pages avec toutes les sections V5

ETAPE 5 : Frontend V5
- Ajoute bouton "Optimize this molecule" sur chaque candidat dans le dashboard
- Cree OptimizationView.jsx : formulaire objectifs + suivi temps reel
- Cree OptimizationChart.jsx : graphique Recharts de l'evolution du score
- Cree SafetyReport.jsx : tableau off-target avec couleurs et warnings
- Cree ConfidenceBreakdown.jsx : detail du score de confiance par composant
- Cree MethodologyPage.jsx : page /methodology avec description de chaque outil et references
- Dans le rapport de resultats : afficher Confidence % a cote du Score
- Disclaimer sur chaque page de resultats

Teste avec P00533 (EGFR) :
- Le off-target screening doit montrer 10/10 safe pour Erlotinib (inhibiteur selectif connu)
- L'optimisation doit ameliorer le score sur 10 iterations
- Le confidence score d'Erlotinib (molecule connue) doit etre > 80%
- Le confidence score d'une molecule generee doit etre < 60% (pas de donnees experimentales)
- Le rapport PDF doit contenir toutes les sections
- L'audit log doit etre complet et telechargeable7. TESTS DE VALIDATION V5
Le panel off-target est pre-calcule et cache dans /data/off_targets/
Le off-target screening tourne en moins de 5 minutes pour 5 candidats
Erlotinib montre un profil safe sur les 10 anti-cibles
L'optimisation complete 10 iterations en moins de 30 minutes
Le score augmente au fil des iterations (pas forcement monotone mais tendance positive)
Toutes les molecules generees passent la validation chimique
Le confidence score varie logiquement selon la source (known > generated)
La page methodology est accessible et complete
L'audit log contient tous les parametres et decisions
Le rapport PDF fait 11 pages avec toutes les sections
Le disclaimer apparait sur chaque page de resultats et dans le PDF
8. ESTIMATION COUTS V5Infra VPS (CPU 8 coeurs, 16GB RAM)     : ~70 euros/mois (inchange)
Stockage off-targets (~500MB)           : inclus
Total                                   : ~70 euros/moisPas de cout supplementaire. Tout est CPU et local.