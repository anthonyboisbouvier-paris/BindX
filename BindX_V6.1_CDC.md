# Cahier des Charges - BindX V6.1
### "GNINA CNN Scoring + Consensus"
### Prerequis : V6.0 fonctionnelle
### Date : 22 fevrier 2026

---

## SCOPE V6.1

Remplacer AutoDock Vina par GNINA (meme interface, meme usage, mais scoring CNN en plus).
Ajouter le consensus scoring sur 3 methodes pour eliminer les faux positifs.

Drop-in replacement : GNINA est un fork de Vina. Meme arguments CLI, meme format.
Temps estime : 2-3 jours.

---

## 1. GNINA : CE QUI SE PASSE DERRIERE

GNINA (McNutt et al., J Cheminf 2021) = Vina + CNN 3D scoring.

### 1.1 Docking identique a Vina
- Meme algorithme Iterated Local Search (Monte Carlo + local minimization)
- Meme fonction de score empirique (Gauss + repulsion + H-bond + hydrophobic + torsion)
- Meme exploration des conformations du ligand

### 1.2 CNN scoring en plus
Apres le docking Vina, pour chaque pose :
1. Voxelisation 3D de la poche + ligand (grille 24x24x24, 0.5A par voxel)
2. 28 canaux dans la grille :
   - 14 pour la proteine : type d'atome (C,N,O,S,H), hydrophobicite, aromaticite,
     donneur/accepteur H-bond, charge (7 features x 2 pour grains fin/gros)
   - 14 identiques pour le ligand
3. CNN DenseNet traite la grille 3D -> 2 predictions :
   - CNNscore : probabilite que la pose soit correcte (0 a 1)
   - CNNaffinity : affinite predite en echelle pK (plus haut = meilleur)
4. Entraine sur PDBbind (~20K complexes proteine-ligand avec Kd experimental)

### 1.3 Benchmark
- Enrichment factor EF1% : GNINA ~2x meilleur que Vina seul
- Pose prediction : 72% des poses < 2A RMSD vs cristal (vs 58% Vina)
- Pas besoin de GPU : le CNN est petit, tourne sur CPU

### 1.4 Installation

```
# Binaire statique Linux (pas de compilation)
wget https://github.com/gnina/gnina/releases/download/v1.1/gnina
chmod +x gnina
mv gnina /usr/local/bin/

# Verification :
gnina --version

# Usage IDENTIQUE a Vina :
gnina --receptor protein.pdbqt --ligand ligand.pdbqt \
      --center_x 10 --center_y 20 --center_z 30 \
      --size_x 25 --size_y 25 --size_z 25 \
      --out docked.sdf --cnn_scoring rescore --num_modes 3
```

---

## 2. CONSENSUS SCORING

### 2.1 Pourquoi

Aucune fonction de score n'est parfaite. Le R-carre entre Vina score et
affinite experimentale est ~0.5. Combiner plusieurs methodes reduit les
faux positifs de maniere significative (Wang et al., J Med Chem 2004).

### 2.2 Trois scores par molecule

Pour chaque molecule dockee, GNINA retourne :
  - minimizedAffinity : score Vina classique (kcal/mol, negatif = mieux)
  - CNNscore : probabilite pose correcte (0-1, plus haut = mieux)
  - CNNaffinity : affinite predite (pK, plus haut = mieux)

### 2.3 Methode du consensus

```
1. Collecter les 3 scores pour toutes les N molecules
2. Z-score normalisation par methode :
   z = (score - mean) / std
   (pour Vina, inverser le signe car negatif = mieux)
3. Consensus score = z_vina * 0.33 + z_cnn * 0.34 + z_aff * 0.33
4. Ranking par chaque methode independamment
5. Garder les molecules dans le top 50 d'AU MOINS 2 des 3 methodes
6. Molecules top 50 dans les 3 methodes : badge "High confidence"
   Molecules top 50 dans 2/3 : badge "Moderate"
   Molecules top 50 dans 1/3 seulement : ELIMINEES (faux positif probable)
```

### 2.4 Backend : docking.py

Remplacer appels Vina par GNINA. Parser les 3 scores du SDF output.
Ajouter consensus_scoring() qui prend la liste complete et retourne
les molecules filtrees et classees.

### 2.5 UX

```
Docking results :
  Molecule      Vina     CNNscore  CNNaff   Consensus  Agreement
  Erlotinib     -9.2     0.91      8.1      #1         3/3 HIGH
  AI-Opt-0037   -8.7     0.85      7.9      #2         3/3 HIGH
  ZINC_12345    -9.5     0.42      5.2      ---        1/3 ELIMINATED
  (Vina liked it but CNN says the pose is wrong)
```

---

## 3. FICHIERS

```
backend/pipeline/docking.py  MODIFIED  GNINA remplace Vina + consensus
```

---

## 4. INSTRUCTIONS CLAUDE CODE

```
V6.0 fonctionnelle. Implementer V6.1 :

ETAPE 1 : Installer GNINA
- Telecharger binaire statique
- Verifier que gnina --version fonctionne

ETAPE 2 : Modifier docking.py
- Remplacer tous les appels "vina" par "gnina"
- Ajouter --cnn_scoring rescore aux arguments
- Parser 3 scores du SDF : minimizedAffinity, CNNscore, CNNaffinity
- Retourner les 3 scores par molecule

ETAPE 3 : Consensus scoring
- Implementer consensus_scoring()
- Z-score normalisation
- Filtre 2/3 methodes minimum
- Badge "High confidence" (3/3) et "Moderate" (2/3)

TESTS :
- P00533 (EGFR) avec erlotinib : doit etre top 3 dans les 3 methodes
- Molecules random ZINC : certaines eliminees par CNN (consensus 1/3)
- Les 3 scores sont bien affiches dans les resultats
```

---

## 5. EFFORT : 2-3 jours. Cout : inchange. References : McNutt et al. 2021, Wang et al. 2004.
