# Cahier des Charges - BindX V6.0
### "Experimental Structures + ML Pocket Detection"
### Prerequis : V5 fonctionnelle
### Date : 22 fevrier 2026

---

## SCOPE V6.0

Deux changements a fort impact et faible effort :
1. Prioriser les structures experimentales PDB (avec ligand co-cristallise)
2. Remplacer fpocket par P2Rank (ML-based, +10% de succes)

Pas de changement de scoring, docking, ou ADMET.
Upgrade silencieux : meilleures donnees en entree, meme pipeline en aval.

Temps estime : 2-3 jours.

---

## 1. STRUCTURE PDB EXPERIMENTALE

### 1.1 Pourquoi

Structure cristallographique avec ligand co-cristallise = TOUJOURS superieure
a AlphaFold pour le docking. Vraie conformation holo, vrais residus de poche.

### 1.2 Nouveau workflow

```
UniProt ID -> Query RCSB PDB API (resolution < 3.0A, X-ray ou cryo-EM)
  -> PDB holo (avec ligand) : confidence 0.98, poche = 6A autour du ligand
  -> PDB apo (sans ligand) : confidence 0.90
  -> AlphaFold DB : confidence 0.85 (selon pLDDT)
  -> ESMFold : confidence 0.60
+ IUPred3 : detecter regions desordonnees, warning si poche dans IDR
```

### 1.3 Backend : structure.py

Ajouter :
- query_pdb(uniprot_id) : RCSB Search API, filtre resolution, tri
- has_cocrystallized_ligand(pdb_id) : check non-solvant ligands (exclure HOH, SO4, GOL, etc.)
- download_pdb(pdb_id) : telecharger depuis files.rcsb.org
- predict_disorder(sequence) : IUPred3 per-residue scores
- Modifier get_structure() : hierarchie PDB holo > apo > AlphaFold > ESMFold

### 1.4 Details techniques PDB API

```
POST https://search.rcsb.org/rcsbsearch/v2/query
Body :
  - Filter by UniProt accession (exact match)
  - Filter resolution < 3.0
  - Sort by resolution ascending
  - Paginate: first 10 results

GET https://data.rcsb.org/rest/v1/core/entry/{pdb_id}
  -> nonpolymer_entity_count (nombre de ligands)

GET https://data.rcsb.org/rest/v1/core/nonpolymer_entity/{pdb_id}/{entity_id}
  -> comp_id (identifiant du ligand, ex: "AQ4" pour erlotinib)
  -> Exclure solvants : HOH, SO4, PO4, GOL, EDO, ACT, NA, CL, MG, ZN, CA
```


---

## 2. P2RANK REMPLACE FPOCKET

### 2.1 Pourquoi

fpocket (2009) = geometrique pur (alpha spheres + Voronoi). ~75% top-1 success.
P2Rank (2018+) = Random Forest sur features surface. ~85% top-1 success. +10%.

### 2.2 Ce qui se passe derriere P2Rank

1. Surface de Connolly (surface accessible solvant)
2. ~10,000 points echantillonnes sur la surface
3. Features par point (rayon 6A) : hydrophobicite, charge, aromaticite, profondeur, courbure, B-factor
4. Random Forest (entraine sur scPDB, ~17K complexes) : "binding site ?" -> proba 0-1
5. DBSCAN clustering des points positifs -> poches
6. Score druggabilite = proba moyenne des points du cluster

### 2.3 Installation

```
conda install -c conda-forge p2rank
# ou : wget https://github.com/rdk/p2rank/releases/download/2.4.2/p2rank-2.4.2.tar.gz
# Necessite Java 11+
```

### 2.4 Poche du ligand co-cristallise

Si structure_info.source == "pdb_holo" :
  -> Ne PAS lancer P2Rank
  -> BioPython NeighborSearch : tous les residus proteiques < 6A du ligand
  -> Centre = centre de masse du ligand
  -> C'est la meilleure poche possible (experimentale)

### 2.5 Backend : pockets.py

Remplacer detect_pockets_fpocket() par detect_pockets_p2rank() :
  - Appel : prank predict -f structure.pdb -o output/ -threads 4
  - Parse output CSV : name, score, probability, center_x/y/z, residue_ids
  - Retourner liste triee par score

Ajouter extract_pocket_from_ligand(pdb_path, ligand_id, cutoff=6.0) :
  - BioPython PDBParser + NeighborSearch
  - Retourner poche avec centre, residus, score=1.0

Modifier get_best_pocket(pdb_path, structure_info, functional_residues) :
  - Si PDB holo -> extract_pocket_from_ligand()
  - Sinon -> P2Rank + overlap fonctionnel (V4 inchange)

---

## 3. FICHIERS MODIFIES

```
backend/pipeline/structure.py   MODIFIED  PDB API + IUPred3 + hierarchie
backend/pipeline/pockets.py     MODIFIED  P2Rank + ligand pocket extraction
```

Frontend : messages pipeline mis a jour, pas de nouveau composant.

---

## 4. INSTRUCTIONS CLAUDE CODE

```
V5 fonctionnelle. Implementer V6.0 :

ETAPE 1 : structure.py - PDB experimental
- query_pdb(), has_cocrystallized_ligand(), download_pdb()
- predict_disorder() avec IUPred3 ou fallback
- get_structure() hierarchique

ETAPE 2 : pockets.py - P2Rank
- Installer P2Rank (conda ou JAR)
- detect_pockets_p2rank(), extract_pocket_from_ligand()
- get_best_pocket() hierarchique

ETAPE 3 : Integration + tests
- Pipeline utilise nouveau get_structure() + get_best_pocket()
- Messages pipeline mis a jour

TESTS :
- P00533 (EGFR) : PDB 4HJO holo, poche erlotinib, confidence 98%
- P0DTC2 (Spike) : PDB experimental, P2Rank poche
- Sequence FASTA : ESMFold, P2Rank, confidence 60%
```

---

## 5. EFFORT : 2-3 jours. Cout : inchange 70 euros/mois.
