# Cahier des Charges - BindX V6.2
### "ProLIF Interactions + Hard Cutoffs + Pareto Scoring"
### Prerequis : V6.1 fonctionnelle
### Date : 22 fevrier 2026

---

## SCOPE V6.2

Ameliorer la qualite du scoring et du filtrage :
1. ProLIF : analyser les interactions 3D proteine-ligand (H-bond, pi-stack, etc.)
2. Hard cutoffs : eliminer les molecules dangereuses (pas de compensation)
3. Pareto multi-objectif : presenter des trade-offs au lieu d'un score unique
4. Clustering chimique : grouper les variantes du meme scaffold

Temps estime : 3-4 jours.

---

## 1. ProLIF INTERACTION FINGERPRINTS

### 1.1 Pourquoi

Un bon score docking ne garantit pas de "bonnes" interactions. Une molecule
peut avoir un score GNINA eleve mais ne faire que des contacts hydrophobes
non-specifiques au lieu de H-bonds avec les residus catalytiques.

### 1.2 Ce qui se passe derriere ProLIF

ProLIF (Bouysset & Fiorucci, J Cheminf 2021) analyse chaque paire residu-ligand :

Pour chaque residu proteique a moins de 6A du ligand :
  - H-bond donneur : N-H...O ou O-H...N, distance < 3.5A, angle > 130 deg
  - H-bond accepteur : O...H-N ou N...H-O, memes criteres
  - Hydrophobe : contact C-C, distance < 4.5A
  - Pi-stacking parallele : anneaux aromatiques face a face, 3.5-5.5A
  - Pi-stacking T-shape : anneaux perpendiculaires, 4.5-6.5A
  - Pi-cation : aromatique face a charge+, distance < 6.5A
  - Pont salin : charge+ face a charge-, distance < 5.5A
  - Halogen bond : C-X...O/N, angle > 140 deg (X = Cl, Br, I)

Resultat : fingerprint binaire (interaction_type x residue_id)

### 1.3 Quality assessment

```
Pour chaque molecule dockee, apres ProLIF :

  Compter : n_hbonds, n_hydrophobic, n_pi_stacking, n_functional_contacts

  Quality = "excellent" si >= 2 H-bonds ET >= 1 contact fonctionnel
  Quality = "good" si >= 1 H-bond OU >= 1 contact fonctionnel
  Quality = "moderate" si >= 3 contacts totaux (meme sans H-bond)
  Quality = "poor" si < 3 contacts totaux et 0 H-bonds

  "poor" -> molecule ELIMINEE (malgre bon score docking)
  "excellent" -> bonus +10% sur consensus score
```

### 1.4 Implementation

Creer : backend/pipeline/interactions.py
  - analyze_interactions(protein_pdb, ligand_sdf, functional_residues)
  - Retourne : liste interactions, quality, n_hbonds, n_functional_contacts
  - pip install prolif

---

## 2. HARD CUTOFFS ELIMINATOIRES

### 2.1 Pourquoi

Le scoring lineaire V5 (0.35 * affinity + 0.25 * tox + ...) permet a une
molecule tres toxique d'etre "sauvee" par une excellente affinite.
En drug discovery : INACCEPTABLE. Une molecule qui inhibe hERG est ELIMINEE,
pas "penalisee".

### 2.2 Cutoffs

```
Eliminatoire (echec = molecule supprimee, pas de recours) :
  hERG IC50 predit < 10 uM           -> ELIMINATED (cardiac risk)
  QED < 0.25                          -> ELIMINATED (poor drug-likeness)
  SA score > 6                        -> ELIMINATED (unsynthesizable)
  Lipinski violations > 1             -> ELIMINATED
  PAINS alerts > 0                    -> ELIMINATED (reactive/promiscuous)
  Consensus scoring methods < 2/3     -> ELIMINATED (scoring disagreement)
  ProLIF interaction quality = "poor" -> ELIMINATED (wrong binding mode)
```

Ordre d'application : PAINS et Lipinski d'abord (rapides), puis ADMET, puis consensus.

---

## 3. PARETO MULTI-OBJECTIF

### 3.1 Pourquoi

Un score unique cache les trade-offs. L'utilisateur doit comprendre POURQUOI
une molecule est recommandee et CE QU'IL SACRIFIE en la choisissant.

### 3.2 Comment

4 objectifs simultanes (apres hard cutoffs) :
  - Affinite (consensus docking score) -> maximiser
  - Securite (ADMET composite + selectivite) -> maximiser
  - Biodisponibilite (absorption, solubilite) -> maximiser
  - Faisabilite synthese (SA score inverse) -> maximiser

Front de Pareto : ensemble des molecules non-dominees.
Molecule A domine B si A est meilleure sur TOUS les objectifs.
Les non-dominees = aucune autre molecule n'est meilleure partout.

### 3.3 UX

```
Pareto Front (5 non-dominated solutions)

  Mol A: AI-Opt-0037   Affinity: BEST      Safety: good     Synth: complex
  Mol B: Erlotinib      Affinity: good      Safety: BEST     Synth: easy
  Mol C: AI-Opt-0012   Affinity: moderate  Safety: good     Synth: BEST

  No molecule is better on ALL criteria. Choose based on priorities:
  -> Need strongest binding? Mol A
  -> Need safest candidate? Mol B
  -> Need easiest synthesis? Mol C
```

---

## 4. CLUSTERING CHIMIQUE DES RESULTATS

Butina clustering (Tanimoto, cutoff 0.4) sur le Pareto front elargi.
Presenter 1 representant par serie chimique + "12 similar molecules".
Evite de montrer 30 variantes du meme scaffold.

---

## 5. FICHIERS

```
backend/pipeline/
  interactions.py   NEW       ProLIF analysis + quality assessment
  scoring.py        MODIFIED  Hard cutoffs + Pareto + clustering
frontend/src/components/
  InteractionDiagram.jsx  NEW  Visualisation interactions 2D
  ParetoFront.jsx         NEW  Front de Pareto interactif
  ChemicalSeries.jsx      NEW  Resultats groupes par serie
```

---

## 6. INSTRUCTIONS CLAUDE CODE

```
V6.1 fonctionnelle. Implementer V6.2 :

ETAPE 1 : ProLIF interactions
- pip install prolif
- Creer backend/pipeline/interactions.py
- analyze_interactions() pour chaque molecule dockee
- Quality assessment, bonus/elimination

ETAPE 2 : Hard cutoffs
- Modifier scoring.py : apply_hard_cutoffs()
- Ordre : PAINS > Lipinski > QED > SA > hERG > consensus > interactions
- Log raison d'elimination pour chaque molecule rejetee

ETAPE 3 : Pareto
- Implementer pareto_ranking() dans scoring.py
- 4 objectifs : affinity, safety, bioavailability, synthesis
- Retourner front non-domine

ETAPE 4 : Clustering
- Butina clustering Morgan fingerprints, cutoff 0.4
- 1 representant (meilleur score) par cluster
- Cluster size affiche

ETAPE 5 : Frontend
- InteractionDiagram.jsx : residus autour du ligand + types
- ParetoFront.jsx : scatter plot interactif
- ChemicalSeries.jsx : accordeon expandable par serie

TESTS :
- Erlotinib sur EGFR : quality "excellent" (H-bonds ASP855, MET793)
- Molecule random : quality "poor" -> eliminee
- Hard cutoff hERG : molecule avec hERG < 10 uM eliminee
- Pareto front >= 3 solutions non-dominees
- Clustering regroupe analogues erlotinib ensemble
```

---

## 7. EFFORT : 3-4 jours. Cout : inchange. 
## References : Bouysset 2021, Wang 2004, Butina 1999.
