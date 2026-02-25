# Cahier des Charges - BindX V6.3
### "SEA Off-Target + ADMET Applicability + ENAMINE REAL + Retrosynthese Verifiee"
### Prerequis : V6.2 fonctionnelle
### Date : 22 fevrier 2026

---

## SCOPE V6.3

Derniere sous-version V6. Quatre ameliorations :
1. SEA off-target large panel (~3000 cibles) via SwissTargetPrediction
2. Domaine d'applicabilite ADMET + hERG specialise (CardioTox)
3. ENAMINE REAL sourcing + fragments + clustering diversite
4. Retrosynthese avec verification disponibilite reactifs + estimation cout

Temps estime : 3-4 jours.

---

## 1. SEA OFF-TARGET ELARGI

### 1.1 Pourquoi

Le panel V5 (10 anti-cibles dockees) ne couvre que les plus connues.
En pharma, on screene contre 400+ cibles (panel Eurofins SafetyScreen44+).
SEA (Similarity Ensemble Approach, Keiser et al. 2007) predit les cibles
d'une molecule par similarite chimique avec les ligands connus de ~3000 cibles.

### 1.2 Implementation

Tier 1 (rapide, large) : SwissTargetPrediction API
  POST http://www.swisstargetprediction.ch/predict
  Input : SMILES + organism "Homo sapiens"
  Output : liste de cibles predites avec probabilite

  Pour chaque cible predite avec probabilite > 0.3 :
    - Si dans la liste DANGEROUS_TARGETS (hERG, CYP, 5-HT2B, etc.) : WARNING
    - 5-HT2B est critique (valvulopathie cardiaque, cas Fen-Phen)

Tier 2 (precis, lent) : docking Vina sur panel 10 cibles (V5 inchange)
  - Ne tourne que si Tier 1 detecte un hit dangereux -> confirmation
  - Ou systematiquement sur les top 5 candidats Pareto

Score selectivite combine :
  selectivity = (n_docking_safe / 10) * 0.6 + min(n_sea_clear / 20, 1.0) * 0.4

### 1.3 Fichier

Modifier : backend/pipeline/off_target.py
  - predict_off_targets_sea(smiles) : API SwissTargetPrediction
  - combined_off_target_screening(smiles) : Tier 1 + Tier 2
  - DANGEROUS_TARGETS : set elargi (~30 cibles, dont 5-HT2B, Nav1.5, PDE3)

---

## 2. DOMAINE D'APPLICABILITE ADMET + hERG SPECIALISE

### 2.1 Applicability Domain

ADMET-AI est entraine sur ~10K molecules historiques. Pour un chemotype AI-generated
totalement nouveau, les predictions peuvent etre fausses sans qu'on le sache.

Solution : calculer la similarite Tanimoto entre la molecule query et le
plus proche voisin dans le training set d'ADMET-AI.

  Si Tanimoto < 0.3 : OUT OF DOMAIN -> WARNING affiche
  "ADMET predictions may be unreliable for this novel chemotype"

Pre-calculer les fingerprints du training set (une fois, stocke dans /data/).

### 2.2 hERG specialise

ADMET-AI hERG : AUROC ~0.85.
CardioTox (modele specialise) : AUROC > 0.90. Predit l'IC50 hERG, pas juste safe/unsafe.

Pour les top 20 candidats (post hard cutoffs) : lancer CardioTox en plus.
  IC50 > 30 uM : LOW risk (vert)
  IC50 10-30 uM : MODERATE risk (jaune)
  IC50 < 10 uM : HIGH risk -> ELIMINATE (hard cutoff)

### 2.3 Fichiers

Modifier : backend/pipeline/admet.py
  - check_applicability_domain(smiles, training_fps)
  - predict_herg_specialized(smiles) via CardioTox
Creer : frontend/src/components/ApplicabilityBadge.jsx

---

## 3. ENAMINE REAL + FRAGMENTS

### 3.1 ENAMINE REAL

~6.5 milliards de molecules synthetisables a la demande en 3-4 semaines.
Le pont entre virtuel et reel.

Utiliser le sous-ensemble REAL Drug-Like disponible sur ZINC22 (~270M molecules).
OU le REAL Diversity Set (~50K, plus petit, pour mode Quick).

### 3.2 Fragments

Fragment-based drug design : screener des molecules tres petites (MW < 300, "Rule of 3").
Un fragment qui se lie meme faiblement est un excellent point de depart
pour le growing via REINVENT4 en lead optimization.

### 3.3 Nouveau workflow sourcing

```
ChEMBL actives (IC50 < 10 uM) comptees :
  > 100 : ChEMBL actives seulement (bien documente)
  10-100 : ChEMBL actives + 500 ENAMINE REAL diverse
  < 10 : 1000 ENAMINE REAL + AI generation (REINVENT4)

Mode fragment (option avancee) :
  ZINC fragments (~500K) avec Rule of 3

Toujours : Butina clustering pour diversite chimique (max 500 representants)
```

### 3.4 ChEMBL filtre par activite

V1-V5 : on comptait TOUS les composes dans ChEMBL pour cette cible.
V6.3 : on ne compte que les composes avec IC50/Ki/EC50 < 10 uM.
Un compose teste a 100 uM sans effet n'est pas utile.

### 3.5 Fichier

Modifier : backend/pipeline/ligands.py
  - query_chembl_actives(uniprot_id, ic50_cutoff=10000) : filtre par activite
  - sample_enamine_real(n, diversity) : echantillon ENAMINE REAL
  - load_fragment_library() : ZINC fragments
  - cluster_butina(molecules, n_clusters=500) : diversite chimique

---

## 4. RETROSYNTHESE VERIFIEE

### 4.1 Verification catalogue

AiZynthFinder (V2) trouve des routes de synthese mais ne verifie pas
si les reactifs sont disponibles commercialement.

Ajouter : pour chaque reactif de chaque route, verifier la disponibilite
via ZINC purchasability (API gratuite) ou catalogues (Sigma, Enamine, TCI).

### 4.2 Estimation cout

Cout estime = somme(prix reactifs) + n_etapes * 500 USD (main d'oeuvre labo estimee)
Routes avec reactifs non disponibles marquees WARNING.

### 4.3 Fichier

Modifier : backend/pipeline/retrosynthesis.py
  - verify_reagent_availability(smiles) : ZINC purchasability
  - estimate_synthesis_cost(route) : reactifs + main d'oeuvre

---

## 5. FICHIERS COMPLETS V6.3

```
backend/pipeline/
  off_target.py       MODIFIED  SEA broad + docking combine
  admet.py            MODIFIED  Applicability domain + hERG CardioTox
  ligands.py          MODIFIED  ENAMINE REAL + fragments + Butina + ChEMBL actives
  retrosynthesis.py   MODIFIED  Verification catalogue + estimation cout
frontend/src/components/
  ApplicabilityBadge.jsx  NEW  Badge in-domain / out-of-domain
```

---

## 6. INSTRUCTIONS CLAUDE CODE

```
V6.2 fonctionnelle. Implementer V6.3 :

ETAPE 1 : SEA off-target
- Modifier off_target.py : SwissTargetPrediction API
- Tier 1 (SEA broad) + Tier 2 (docking confirmatoire)
- Score selectivite combine
- DANGEROUS_TARGETS elargi (ajouter 5-HT2B, Nav1.5, PDE3)

ETAPE 2 : ADMET applicabilite + hERG
- Modifier admet.py : check_applicability_domain()
- Pré-calculer training fingerprints (stocker /data/admet_training_fps.pkl)
- predict_herg_specialized() via CardioTox
- Warning OUT OF DOMAIN si Tanimoto NN < 0.3

ETAPE 3 : Sourcing ENAMINE REAL + fragments
- Modifier ligands.py : query_chembl_actives() avec filtre IC50
- sample_enamine_real() + load_fragment_library()
- cluster_butina() diversite chimique
- Option fragment dans les parametres avances

ETAPE 4 : Retrosynthese verifiee
- Modifier retrosynthesis.py : verify_reagent_availability()
- estimate_synthesis_cost() : reactifs + main d'oeuvre
- WARNING si reactif non disponible

ETAPE 5 : Frontend
- ApplicabilityBadge.jsx : vert (in-domain) / orange (out-of-domain)

TESTS :
- Erlotinib : in-domain ADMET, hERG LOW risk
- Molecule AI-generated novel : out-of-domain WARNING
- SEA sur erlotinib : doit predire EGFR comme cible (validation positive)
- SEA sur molecule toxique : doit detecter hit 5-HT2B ou hERG
- ChEMBL EGFR : > 100 actives (IC50 < 10 uM)
- Retrosynthese erlotinib : reactifs disponibles, cout estime < 5000 USD
```

---

## 7. EFFORT : 3-4 jours. Cout : inchange 70 euros/mois.

## 8. BILAN V6 COMPLET (V6.0 + V6.1 + V6.2 + V6.3)

Apres V6.3, toutes les ameliorations CPU sont deployees :
  V6.0 : PDB experimental + P2Rank (2-3 jours)
  V6.1 : GNINA + consensus scoring (2-3 jours)
  V6.2 : ProLIF + hard cutoffs + Pareto + clustering (3-4 jours)
  V6.3 : SEA + ADMET applicabilite + ENAMINE + retrosynthese (3-4 jours)

Total V6 : ~12 jours de travail
Cout : toujours 70 euros/mois (CPU only)
Gain : pipeline state-of-the-art 2025 sans aucun GPU
