# Cahier des Charges - BindX V5bis
### Scientific Rigor Upgrade
### Prerequis : V4 fonctionnelle
### Date : 22 fevrier 2026

## 0. POURQUOI V5bis

V5bis conserve tout le scope V5 (lead optimization, off-target, confiance) mais corrige les faiblesses scientifiques. Chaque changement classe par impact/effort. Seules les briques fort impact + effort raisonnable. Changements lourds (MD, AlphaFold3, Uni-Dock GPU) repousses.

Principe : chaque resultat doit etre fiable, explicable, et honnete sur ses limites.

## 1. PDB AVANT ALPHAFOLD (Impact: critique / Effort: faible)

### Probleme
Si une structure cristallographique experimentale existe dans la PDB, elle est TOUJOURS superieure a AlphaFold : resolution reelle, conformation de liaison reelle, souvent ligand co-cristallise. Ignorer la PDB est une erreur scientifique.

### Implementation : backend/pipeline/structure.py
1. Query RCSB PDB API (POST https://search.rcsb.org/rcsbsearch/v2/query) par UniProt accession
2. Filtrer : resolution < 3.0A, methode X-ray preferee
3. Trier : (a) presence ligand co-cristallise +15 bonus, (b) meilleure resolution, (c) X-ray +5 bonus
4. Si PDB trouvee : telecharger, stocker ligand_id, confidence = 0.98
5. Si pas de PDB : AlphaFold DB (inchange)
6. Si pas AlphaFold : ESMFold (inchange)

### Impact pipeline
Si PDB avec ligand : poche connue directement (skip detection), re-docking validation RMSD < 2A
Affichage : 'PDB experimental - 2GS6 (X-ray, 2.1A) - Co-crystallized: Erlotinib (AQ4) - Confidence: 98%'

### Validation
P00533 (EGFR) : doit trouver structures PDB (1M17, 4HJO). Fallback AlphaFold si aucune PDB.

## 2. P2RANK REMPLACE FPOCKET (Impact: eleve / Effort: faible)

### Probleme
fpocket (2009) = Voronoi geometrique. P2Rank (2018+) = ML sur features geometriques + physicochimiques. Benchmarks : P2Rank ~85% vs fpocket ~75%. Gain 10% fiabilite, remplacement drop-in.

### Installation
wget P2Rank 2.4.2 tar.gz, extraire dans /opt/p2rank. Necessite Java 11+.
Usage : /opt/p2rank/prank predict -f protein.pdb -o output_dir/

### Implementation : backend/pipeline/pocket_detection.py
Dispatcher detect_pockets() :
- CAS 1 : Ligand co-cristallise (Phase 2) -> extraire poche = residus dans 6A du ligand. Source = co-crystallized_ligand, confidence = 0.99. Runner P2Rank aussi pour sites allosteriques.
- CAS 2 : Pas de ligand -> P2Rank ML. Parser CSV : rank, score, probability, center_xyz, residue_ids.
P2Rank donne une PROBABILITE (0-1) pas juste un score druggabilite. Beaucoup plus informatif.

### Dockerfile
apt-get install default-jre-headless + wget p2rank_2.4.2.tar.gz

### Validation
P00533 : P2Rank pocket #1 = ATP-binding, probability > 0.8. Si PDB avec Erlotinib : poche ligand couvre residus 718-855.

## 3. GNINA REMPLACE VINA (Impact: eleve / Effort: faible)

### Probleme
Vina = 1 score empirique. GNINA (McNutt et al., J Cheminf 2021) = Vina + CNN PDBbind. EF1% ~2x meilleur. Meme CLI.

GNINA produit 3 scores par pose :
- vina_score : affinite classique (kcal/mol, plus negatif = meilleur)
- cnn_score : confiance pose CNN (0-1, plus haut = meilleur)
- cnn_affinity : affinite CNN (pK, plus haut = meilleur)

### Installation
wget gnina v1.1 binaire statique -> /usr/local/bin/gnina

### Implementation : backend/pipeline/docking.py
dock_gnina() : memes args que Vina + --cnn_scoring rescore --cnn crossdock_default2018
GNINA sort directement en SDF (plus besoin conversion PDBQT -> SDF).

### Consensus scoring
consensus_rank() :
1. Rang chaque molecule selon chacun des 3 scores
2. Consensus rank = moyenne des 3 rangs
3. Filtre robustesse : garder UNIQUEMENT molecules dans top 50 d au moins 2/3 methodes
4. Elimine faux positifs (bon Vina + mauvais CNN = pose incorrecte)

### Validation
Erlotinib EGFR : CNN score > 0.7. Re-docking natif RMSD < 2A. Mauvais CNN < 0.3 elimines.

## 4. HARD CUTOFFS AVANT SCORING (Impact: critique / Effort: trivial)

### Probleme
Le scoring lineaire permet a une molecule toxique de compenser par excellente affinite. En drug discovery, certains criteres sont ELIMINATOIRES, pas compensables.

### Implementation : backend/pipeline/scoring.py
apply_hard_cutoffs() AVANT le scoring composite :
- hERG pIC50 predit > 6.0 -> ELIMINATED (risque cardiaque)
- Violations Lipinski > 1 -> ELIMINATED (biodisponibilite orale)
- QED < 0.25 -> ELIMINATED (drug-likeness)
- SA score > 6.0 -> ELIMINATED (pas synthetisable)
- PAINS alert -> ELIMINATED (faux positif probable)
- CNN score < 0.2 -> ELIMINATED (pose incorrecte)
Chaque elimination loggee avec raison exacte.
Affichage : '38/50 passed. 12 eliminated: 4x hERG, 3x PAINS, 3x QED, 2x CNN pose'

## 5. PROLIF INTERACTION ANALYSIS (Impact: eleve / Effort: faible)

### Probleme
Le docking score dit 'se fixe bien' mais pas COMMENT. Deux molecules meme score, modes de liaison differents. L une fait H-bond avec residu catalytique (vrai inhibiteur), l autre non (artefact).
ProLIF (Bouysset et Fiorucci, J Cheminf 2021) analyse interactions specifiques.

### Installation : pip install prolif

### Implementation : backend/pipeline/interaction_analysis.py (NOUVEAU)
analyze_interactions(protein_pdb, ligand_sdf) :
- Charge avec MDAnalysis, calcule fingerprint ProLIF
- Types : HBDonor, HBAcceptor, PiStacking, Hydrophobic, CationPi, etc.
- Retourne liste {residue, residue_number, interaction_type}

score_interaction_quality(interactions, functional_residues) :
- Croise residus contactes avec residus fonctionnels UniProt
- interaction_quality = contacts_fonctionnels / total_fonctionnels
- Compte H-bonds avec residus fonctionnels (haute valeur)

### Integration scoring composite (nouveau poids)
consensus_docking 0.25 + admet 0.20 + interaction_quality 0.15 + selectivity 0.15 + bioavailability 0.15 + synthesis 0.10

### Affichage par molecule
Tableau : type interaction, residu, fonctionnel oui/non
'Functional contacts: 2/3 key residues (67%) - 2 key H-bonds'

### Validation
Erlotinib EGFR : H-bonds MET793 (hinge) et THR790 (gatekeeper). Molecules sans contacts fonctionnels flaguees 'weak binding mode'.

## 6. DOMAINE APPLICABILITE ADMET (Impact: eleve / Effort: faible)

### Probleme
ADMET-AI predit bien pour molecules similaires a son training set. Pour AI-generees avec scaffolds nouveaux, predictions peu fiables. Pas de warning actuellement.

### Implementation : backend/pipeline/admet.py
Pre-calculer fingerprints Morgan (rayon 2, 2048 bits) du training set ADMET-AI -> /data/admet_training_fps.pkl
check_applicability_domain(smiles) :
- Tanimoto au plus proche voisin du training set
- Tanimoto > 0.5 : IN DOMAIN (predictions fiables)
- Tanimoto 0.3-0.5 : PARTIAL (warning moderee)
- Tanimoto < 0.3 : OUT OF DOMAIN (warning fort, predictions non fiables)

### Affichage
Connue : 'IN DOMAIN (Tanimoto: 0.85) - High confidence'
AI : 'PARTIAL (Tanimoto: 0.42) - Warning: predictions less reliable'
Novel : 'OUT OF DOMAIN (Tanimoto: 0.18) - ADMET predictions unreliable'

## 7. CLUSTERING BUTINA DES RESULTATS (Impact: moyen / Effort: trivial)

### Probleme
Top 50 souvent 50 variantes du meme scaffold. Utilisateur croit 50 options, en realite 5 familles x 10 analogues.

### Implementation : backend/pipeline/scoring.py
cluster_results() : Butina clustering Morgan fingerprints, cutoff Tanimoto 0.4. Marquer representant chaque cluster (best consensus score). Compter taille cluster.

### Affichage
'Results: 47 candidates in 8 chemical families'. Grouper par famille, representant en premier, analogues collapsibles.

## 8. CHEMBL FILTRAGE ACTIVITE (Impact: moyen / Effort: faible)

### Probleme
On prend tous composes ChEMBL. Beaucoup testes mais INACTIFS (IC50 > 100uM). Dilue les vrais positifs.

### Implementation : backend/pipeline/ligand_sourcing.py
Filtrer par activite mesuree : standard_type in [IC50, Ki, EC50, Kd], standard_value < 10000 nM (= 10 uM).
Separer actifs vs inactifs dans logs. Stocker pchembl_value.

### Affichage
'ChEMBL: 2,847 tested - 892 active (IC50 < 10uM) USED - 1,955 inactive EXCLUDED'

---

## 9. V5 ORIGINAL INCLUS INTEGRALEMENT

V5bis inclut TOUT le scope V5 en plus des 8 changements :
- Lead optimization iteratif (REINVENT4 scaffold decoration, 10 iterations x 50 variantes)
- Off-target screening (panel 10 anti-cibles : hERG, CYP3A4, CYP2D6, COX-1, COX-2, MAO-A, Muscarinic M1, Dopamine D2, 5-HT2A, GABA-A)
- Confidence score par composant (ajuste pour PDB/P2Rank/GNINA)
- Page /methodology avec references scientifiques
- Audit log complet (JSON + CSV)
- Rapport PDF 11 pages
Specs detaillees dans DockIt_V5_Cahier_des_Charges.md original.

---

## 10. STRUCTURE FICHIERS V5bis

backend/pipeline/
  structure.py              MODIFIED (PDB check + RCSB API)
  pocket_detection.py       MODIFIED (P2Rank + ligand pocket extraction)
  docking.py                MODIFIED (GNINA + consensus scoring)
  scoring.py                MODIFIED (hard cutoffs + clustering Butina)
  interaction_analysis.py   NEW (ProLIF)
  admet.py                  MODIFIED (domaine applicabilite)
  ligand_sourcing.py        MODIFIED (ChEMBL activity filter)
  lead_optimization.py      V5 original
  off_target.py             V5 original
  confidence.py             MODIFIED (ajuste PDB/P2Rank/GNINA)
  audit_log.py              V5 original

frontend/src/components/
  InteractionView.jsx       NEW (ProLIF tableau + contacts)
  ClusterView.jsx           NEW (familles chimiques)
  + tous composants V5 inchanges

data/
  admet_training_fps.pkl    NEW
  off_targets/              V5 original

---

## 11. INSTRUCTIONS CLAUDE CODE - V5bis

Prompt unique :

Lis BindX_V5bis_Cahier_des_Charges.md et BindX_V5_Cahier_des_Charges.md.
V4 fonctionnelle. V5bis remplace V5 et inclut tout son scope.
Ordre strict :

ETAPE 1 : PDB avant AlphaFold
- Modifier structure.py : query RCSB API avant AlphaFold
- Trier PDB par resolution + presence ligand
- Si PDB avec ligand : stocker ligand_id

ETAPE 2 : P2Rank remplace fpocket
- Installer Java JRE + P2Rank 2.4.2 dans Dockerfile
- Modifier pocket_detection.py : P2Rank au lieu de fpocket
- Si ligand co-cristallise : extraire poche (residus dans 6A)
- Parser CSV P2Rank (rank, score, probability, center, residues)

ETAPE 3 : GNINA remplace Vina
- Installer GNINA binaire dans Dockerfile
- Modifier docking.py : 3 scores (vina, cnn_score, cnn_affinity)
- Consensus rank = moyenne 3 rangs
- Garder molecules top 50 dans au moins 2/3 methodes
- GNINA sort SDF nativement

ETAPE 4 : Hard cutoffs
- Ajouter apply_hard_cutoffs() dans scoring.py
- hERG > 6 pIC50, Lipinski > 1, QED < 0.25, SA > 6, PAINS, CNN < 0.2
- Logger elimination + raison

ETAPE 5 : ProLIF interaction analysis
- pip install prolif dans Dockerfile
- Creer interaction_analysis.py
- Analyser H-bonds, pi-stacking, hydrophobic
- Score interaction_quality avec residus fonctionnels
- Integrer scoring composite (weight 0.15)

ETAPE 6 : Domaine applicabilite ADMET
- Modifier admet.py : check_applicability_domain()
- Pre-calculer fingerprints training set
- Tanimoto nearest neighbor : IN / PARTIAL / OUT + warnings

ETAPE 7 : Clustering Butina
- cluster_results() dans scoring.py
- Morgan FP, cutoff 0.4, marquer representants

ETAPE 8 : ChEMBL filtrage activite
- Modifier ligand_sourcing.py : IC50/Ki < 10uM
- Separer actifs/inactifs, afficher ratio

ETAPE 9 : V5 original complet
- lead_optimization.py (V5 sections 2.1-2.7)
- off_target.py (V5 sections 3.1-3.7)
- confidence.py (V5 section 4.2, ajuster PDB/P2Rank/GNINA)
- audit_log.py (V5 section 4.5)
- Rapport PDF 11 pages (V5 section 4.6)
- Page /methodology (V5 section 4.4)

ETAPE 10 : Frontend
- Tous composants V5 : OptimizationView, OptimizationChart, SafetyReport, ConfidenceBreakdown, MethodologyPage
- PLUS : InteractionView.jsx, ClusterView.jsx
- Pipeline : source structure PDB/AF, ratio ChEMBL, consensus 3 scores

Tests P00533 (EGFR) :
- PDB experimentale trouvee
- P2Rank pocket #1 = ATP-binding
- GNINA Erlotinib CNN > 0.7
- ProLIF H-bonds MET793 + THR790
- Hard cutoffs eliminent toxiques
- ADMET domain : Erlotinib in-domain, AI = partial
- 8-15 clusters chimiques
- Off-target 10/10 safe
- Lead opt score ameliore
- PDF + audit log complets

---

## 12. TESTS DE VALIDATION V5bis

- P00533 structure PDB trouvee resolution < 3A
- PDB avec ligand : poche = site ATP
- P2Rank pocket #1 probability > 0.8
- GNINA 3 scores par molecule
- Erlotinib CNN score > 0.7
- Re-docking natif RMSD < 2A
- Consensus top 2/3 methodes
- Hard cutoffs fonctionnels
- ProLIF Erlotinib H-bond MET793
- ADMET domain correct (known vs AI)
- 8-15 familles chimiques
- ChEMBL ratio actives/total
- Off-target Erlotinib 10/10 safe
- Lead optimization ameliore
- PDF 11 pages + audit log

---

## 13. COUTS

VPS 8 coeurs 16GB : ~70 EUR/mois (inchange)
P2Rank/GNINA/ProLIF : gratuit, open source, CPU
Total : ~70 EUR/mois

---

## 14. RESUME GAINS V5bis vs V5

Structure       : AlphaFold only      -> PDB > AlphaFold > ESM     (+experimentale)
Pocket          : fpocket (2009)       -> P2Rank ML (2018+)        (+10% accuracy)
Docking         : Vina (1 score)       -> GNINA (3 scores)         (+consensus)
Scoring         : Lineaire             -> Hard cutoffs + soft      (+zero toxique passe)
Interactions    : Aucune               -> ProLIF fingerprints      (+mecanisme)
ADMET           : Prediction brute     -> + domaine applicabilite  (+honnetete)
Resultats       : Liste plate          -> Clusters chimiques       (+diversite)
ChEMBL          : Tous composes        -> Actifs seulement         (+pertinence)
Lead opt        : Identique            -> Identique
Off-target      : Identique            -> Identique

---

Ce document REMPLACE le CDC V5 original. Genere le 22 fevrier 2026.
