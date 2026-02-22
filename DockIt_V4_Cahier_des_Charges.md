Cahier des Charges - BindX V4
"Biology-Aware Docking"
Prerequis : V3 fonctionnelle
Date : 21 fevrier 2026

1. VISION V4
V3 = pipeline complet, UX propre, screening massif. V4 = trois choses : rebranding en anglais, fix de la visualisation 3D, et integration de la biologie fonctionnelle pour guider intelligemment le choix de la poche de docking.
On garde uniquement ce qui est utile, simple et CPU only. Pas de conservation evolutive (trop complexe pour la valeur ajoutee, on le garde pour V5 eventuellement).

2. REBRANDING
2.1 Nom
DockIt devient BindX.
2.2 Traduction anglais
Tout le site passe en anglais :

Tous les textes UI (labels, boutons, messages, tooltips, encadres pedagogiques)
Les messages du pipeline en temps reel
Les rapports PDF
Le README

Correspondances principales :
Lancer le screening          ->  Start screening
Identifiant UniProt          ->  UniProt ID
Sequence proteine            ->  Protein sequence
Options avancees             ->  Advanced options
Precision du screening       ->  Screening precision
Rapide / Standard / Deep     ->  Quick / Standard / Deep
Lancer le screening          ->  Start screening
Voir les resultats           ->  View results
Telecharger le rapport       ->  Download report
Voir en 3D                   ->  View in 3D
Genere par IA                ->  AI Generated
Resultats exploratoires...   ->  Exploratory results...
Molecule precedente/suivante ->  Previous/Next molecule
Retour                       ->  Back
Messages pipeline :
Structure 3D                            ->  3D Structure
Site de liaison                         ->  Binding site
Molecules candidates                    ->  Candidate molecules
Docking en cours                        ->  Docking in progress
Analyse ADMET                           ->  ADMET analysis
Retrosynthese                           ->  Retrosynthesis
Rapport final                           ->  Final report

"Cible bien documentee - X composes"    ->  "Well-documented target - X known compounds found in ChEMBL"
"Cible peu etudiee"                     ->  "Poorly studied target"
"Cible non documentee"                  ->  "Undocumented target - generating custom molecules with AI"
Encadres pedagogiques :
"AlphaFold predit la forme 3D..."       ->  "AlphaFold predicts the 3D shape of your protein from its sequence."
"fpocket detecte les cavites..."        ->  "fpocket detects cavities where a molecule could bind."
"Le docking simule comment..."          ->  "Docking simulates how each molecule fits into the binding pocket. More negative scores indicate stronger binding."
"Nous verifions la toxicite..."         ->  "We check the toxicity, absorption and stability of each candidate."
"L IA planifie comment synthetiser..."  ->  "AI plans how to synthesize this molecule in the laboratory."
2.3 Nouveau header
BindX
Biology-Aware Molecular Docking

Find the best inhibitors for your protein target
in minutes, directly from your browser.

3. FIX VISUALISATION 3D
C'est critique. La visu 3D est le moment wow du produit. Si elle ne marche pas, tout le reste perd sa credibilite.
3.1 Problemes a corriger
Probleme 1 : le ligand n'est pas visible sur la proteine
Probleme 2 : quand il est visible, on ne voit qu'un cycle aromatique au lieu de la molecule entiere
Probleme 3 : le mode surface n'a jamais fonctionne
3.2 Implementation correcte de Viewer3D.jsx
Refonte complete de Viewer3D.jsx avec 3Dmol.js :

PROTEINE :
- Charger le fichier PDB complet de la proteine
- Affichage par defaut : cartoon (ruban) en gris clair semi-transparent
- Le mode surface doit utiliser viewer.addSurface(3Dmol.SurfaceType.VDW, {opacity: 0.7, color: "white"})
- Centrer la vue sur la poche detectee, pas sur toute la proteine

POCHE :
- Residus de la poche : cartoon en bleu
- Surface de la poche uniquement (pas toute la proteine) : surface transparente bleue

LIGAND :
- Charger le fichier SDF de la pose dockee (PAS le PDBQT, utiliser le SDF converti car il contient la geometrie complete)
- Si le SDF n est pas disponible, convertir le PDBQT en SDF via RDKit cote backend avant envoi
- Affichage : stick model, couleurs par element (C=vert, N=bleu, O=rouge, S=jaune)
- Ajouter une surface transparente autour du ligand pour mieux le voir
- S assurer que TOUS les atomes du ligand sont charges, pas juste le premier fragment

CAMERA :
- Position initiale : centree sur la poche avec le ligand visible
- Zoom automatique pour que poche + ligand remplissent 70% de l ecran
- Slab clipping pour couper la proteine et voir l interieur de la poche

CONTROLES :
- Rotation : clic gauche
- Zoom : molette
- Translation : clic droit
- Boutons : Reset view, Toggle surface, Toggle cartoon
3.3 Backend - preparation des fichiers
python# Dans report.py ou un nouveau fichier viewer_data.py
# Pour chaque molecule du top 50 :

# 1. Convertir la pose PDBQT en SDF avec coordonnees 3D completes
from rdkit import Chem
mol = Chem.MolFromPDBQTFile(pose_pdbqt_path)  # ou parser manuellement
writer = Chem.SDWriter(output_sdf_path)
writer.write(mol)

# 2. Verifier que le SDF contient tous les atomes
mol_check = Chem.MolFromMolFile(output_sdf_path)
assert mol_check.GetNumAtoms() > 5  # pas juste un fragment

# 3. Endpoint API pour servir le SDF
# GET /api/jobs/{job_id}/pose/{mol_index}.sdf
```

### 3.4 Test de validation visu

- Lancer un screening P00533 (EGFR) avec Erlotinib
- Ouvrir la vue 3D
- Verifier : on voit la proteine en ruban gris
- Verifier : la poche est surlignee en bleu
- Verifier : l Erlotinib est visible en entier (4 cycles aromatiques + chaine laterale)
- Verifier : le mode surface fonctionne (surface blanche semi-transparente)
- Verifier : on peut tourner, zoomer, et le ligand reste dans la poche

---

## 4. INTEGRATION BIOLOGIE FONCTIONNELLE

### 4.1 Nouvelle etape pipeline : analyse fonctionnelle

Apres la detection des poches, ajouter une etape :
```
3D Structure       ✅
Binding pockets    ✅
Functional analysis ✅  NEW
Candidate molecules ...
```

### 4.2 Backend - functional_analysis.py
```
Creer backend/pipeline/functional_analysis.py

Si uniprot_id fourni :
  1. Appel API UniProt : GET https://rest.uniprot.org/uniprotkb/{id}.json
  2. Extraire les features de type :
     - "Active site" (residus catalytiques)
     - "Binding site" (residus de liaison)
     - "Metal binding" (coordination de metaux)
  3. Stocker :
     functional_residues = [57, 102, 195]  # numeros de residus
     functional_labels = {57: "Active site", 102: "Binding site", 195: "Metal binding"}
     functional_source = "uniprot"

Si sequence sans uniprot_id :
  functional_residues = []
  functional_source = "none"
  message = "No functional annotations available for custom sequences"
```

### 4.3 Score de recouvrement poche / site fonctionnel

C'est la feature cle de la V4.
```
Creer backend/pipeline/pocket_overlap.py

Pour chaque poche detectee par fpocket :
  1. Recuperer les coordonnees du centre de la poche et les residus de la poche
  2. Pour chaque residu fonctionnel :
     - Calculer la distance au centre de la poche
     - Si distance < 6 Angstroms : considere comme inclus
  3. Calculer :
     overlap_score = residus_fonctionnels_dans_poche / total_residus_fonctionnels

  4. Classification automatique :
     Si overlap > 0.8  : "Orthosteric site - contains functional residues"
     Si overlap 0.3-0.8 : "Partially overlapping - may affect function"
     Si overlap < 0.3  : "Allosteric site - away from functional residues"
     Si functional_residues vide : "No functional data available"
4.4 Selection automatique de la poche
Modifier pockets.py pour integrer le score fonctionnel :
python# Ancien scoring V3 :
# pocket_score = fpocket_druggability_score

# Nouveau scoring V4 :
# pocket_score = fpocket_druggability * 0.6 + overlap_score * 0.4

# La poche recommandee est celle avec le meilleur pocket_score combine
# Afficher pourquoi cette poche a ete choisie
```

### 4.5 UX - Tableau des poches

Avant de lancer le docking, afficher un tableau des poches detectees :
```
Binding pockets detected: 3

Pocket  Druggability  Functional overlap  Recommendation
#1      ★★★★          100% (3/3)          ★ Recommended - contains all functional residues
#2      ★★★           33% (1/3)           Alternative
#3      ★★★★          0% (0/3)            Allosteric site

Pocket #1 selected automatically. Contains all annotated functional residues.

[Continue with pocket #1]     or     [Choose a different pocket]
```

Par defaut le screening continue automatiquement avec la poche recommandee. L'utilisateur peut cliquer "Choose a different pocket" s'il veut explorer un site allosterique.

### 4.6 Visu 3D - Residus fonctionnels

Dans Viewer3D, ajouter les residus fonctionnels :
```
- Residus fonctionnels : affichage stick en rouge
- Tooltip au survol : "Active site (UniProt)" ou "Binding site (UniProt)"
- Toggle dans les controles : "Show/Hide functional residues"
```

### 4.7 Message pipeline
```
Functional analysis    ✅  3 functional residues found (UniProt)
   Active site: H57, D102 | Binding site: S195
   Pocket #1 contains 100% of functional residues — recommended for docking
```

Ou si pas d'annotations :
```
Functional analysis    ✅  No functional annotations available
   Pocket selection based on druggability score only
```

### 4.8 Options avancees

Ajouter dans l'accordeon options avancees :
```
Biological priority
● Automatic (best combined score)
○ Prioritize functional site
○ Explore allosteric sites
```

Logique :
- Automatic : ponderer druggability + overlap
- Prioritize functional : choisir la poche avec overlap max
- Allosteric : exclure les poches avec overlap > 0.5

---

## 5. NOUVELLE STRUCTURE FICHIERS V4
```
bindx/                                    RENOMME depuis dockit/
├── docker-compose.yml
├── backend/
│   ├── pipeline/
│   │   ├── ... tous les fichiers V3 ...
│   │   ├── functional_analysis.py        NEW analyse UniProt
│   │   └── pocket_overlap.py             NEW score recouvrement
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ... tous les composants V3 ...
│   │   │   ├── PocketSelector.jsx        NEW tableau des poches
│   │   │   └── FunctionalResidues.jsx    NEW overlay residus dans Viewer3D
│   │   └── i18n/                         NEW (optionnel si on veut garder le francais aussi)
```

---

## 6. INSTRUCTIONS CLAUDE CODE - V4

### Prompt unique V4
```
Lis BindX_V4_Cahier_des_Charges.md dans ce repertoire.

La V3 est fonctionnelle. Implemente la V4 dans cet ordre :

ETAPE 1 : Rebranding
- Renomme le projet de DockIt a BindX partout (package.json, titres, README)
- Traduis TOUTE l interface en anglais (labels, boutons, messages pipeline, encadres pedagogiques, rapports PDF)
- Nouveau header : "BindX - Biology-Aware Molecular Docking"
- Nouveau tagline : "Find the best inhibitors for your protein target in minutes"

ETAPE 2 : Fix Viewer3D complet
- Refonte de Viewer3D.jsx avec 3Dmol.js
- Proteine : cartoon gris clair semi-transparent, centree sur la poche
- Poche : residus en bleu, surface transparente bleue locale
- Ligand : charger le SDF complet (PAS le PDBQT), stick model couleurs par element, verifier que TOUS les atomes sont presents
- Cote backend : ajouter conversion PDBQT -> SDF via RDKit, endpoint GET /api/jobs/{job_id}/pose/{mol_index}.sdf
- Camera : centree sur poche + ligand, slab clipping, zoom auto
- Surface : viewer.addSurface avec opacity 0.7, toggle on/off
- Tester avec P00533 + Erlotinib : on doit voir les 4 cycles aromatiques + chaine laterale en entier

ETAPE 3 : Analyse fonctionnelle
- Cree backend/pipeline/functional_analysis.py
- Appel API UniProt pour extraire Active site, Binding site, Metal binding
- Retourne functional_residues (liste de numeros) + labels
- Cree backend/pipeline/pocket_overlap.py
- Pour chaque poche : calcule overlap_score (distance residus fonctionnels < 6A du centre)
- Classification : orthosteric > 0.8, partial 0.3-0.8, allosteric < 0.3
- Integre dans le scoring de poche : combined = druggability * 0.6 + overlap * 0.4

ETAPE 4 : UX poches
- Cree PocketSelector.jsx : tableau des poches avec druggability, overlap, recommendation
- Par defaut : continue automatiquement avec la meilleure poche
- Option "Choose a different pocket" pour les experts
- Dans le pipeline : affiche les residus fonctionnels trouves et pourquoi cette poche a ete choisie
- Dans Viewer3D : residus fonctionnels en sticks rouges avec tooltip
- Dans options avancees : toggle Automatic / Prioritize functional / Explore allosteric

Teste avec P00533 (EGFR) qui a des residus fonctionnels documentes dans UniProt.
Teste avec une proteine sans annotations pour verifier le fallback.
```

---

## 7. TESTS DE VALIDATION V4

- Toute l interface est en anglais, aucun texte francais restant
- Le nom BindX apparait partout
- La vue 3D montre la proteine en cartoon + le ligand COMPLET en sticks dans la poche
- Le mode surface fonctionne (toggle on/off)
- Les residus fonctionnels sont visibles en rouge dans la vue 3D
- Le tableau des poches affiche druggability + overlap + recommendation
- La poche est choisie automatiquement avec le bon score combine
- Le pipeline affiche les residus fonctionnels trouves
- P00533 (EGFR) : overlap score > 0 sur au moins une poche
- Proteine sans annotations : message "No functional data available"
- Le mode allosterique exclut bien les poches avec overlap eleve

---

## 8. ROADMAP POST-V4
```
V4.1 : Conservation evolutive legere (50 homologues UniProt)    +1 semaine
V4.2 : GPU optionnel (RunPod API) pour screening 30 min         +1 semaine
V5.0 : Comptes utilisateurs + historique + deploiement cloud     +2 semaines
V5.1 : Freemium + paiement Stripe                               +2 semaines
V5.2 : API publique                                              +1 semaine
V6.0 : Multi-omiques                                             +1 mois
