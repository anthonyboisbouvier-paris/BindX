# Cahier des Charges - DockIt V2
## "De la cible au medicament candidat - pipeline complet"

**Prerequis** : MVP V1 fonctionnel (docking basique)
**Date** : 21 fevrier 2026

---

## 1. VISION V2

La V1 fait du docking basique : proteine → screening de molecules existantes → resultats.
La V2 transforme DockIt en plateforme de drug discovery complete qui couvre le pipeline end-to-end :

```
Cible proteine
  → Prediction de structure (V1 OK)
  → Detection de poches (V1 OK)
  → Docking de molecules existantes (V1 OK)
  → Generation de NOUVELLES molecules optimisees (V2 NEW)
  → Prediction ADMET complete (V2 NEW)
  → Planification de la synthese chimique (V2 NEW)
  → Docking IA avance avec DiffDock (V2 NEW)
  → Rapport complet publication-ready (V2 NEW)
```

**Positionnement V2** : la premiere plateforme web open source qui fait tout ce que Schrodinger + Insilico font, en version exploratoire accessible a tous.

---

## 2. NOUVELLES FONCTIONNALITES V2

### 2.1 - Generation de nouvelles molecules (REINVENT4)

**Outil** : REINVENT4 (AstraZeneca, open source, GitHub : MolecularAI/REINVENT4)

**Ce que ca fait** : au lieu de juste screener des molecules existantes, le systeme GENERE des molecules qui n'existent pas encore, optimisees specifiquement pour se fixer sur la poche de ta proteine cible. C'est du reinforcement learning - le modele apprend a creer des molecules de mieux en mieux adaptees.

**Integration dans DockIt** :
```
Etape existante : docking des top 10 molecules connues (V1)
    |
    v
Nouvelle etape : REINVENT4 genere 100 nouvelles molecules
    → Scoring function = Vina score sur la poche detectee
    → Filtres : drug-likeness, Lipinski, pas de groupes toxiques
    → Output : top 20 molecules generees, jamais vues avant
    |
    v
Docking des molecules generees pour confirmation
```

**Installation** :
```bash
git clone https://github.com/MolecularAI/REINVENT4.git
pip install -e REINVENT4/
```

Ressources : CPU suffit pour le MVP (quelques minutes pour 100 molecules). GPU accelere x10 mais pas necessaire.

**Fichier a creer** : `backend/pipeline/generation.py`

**Logique de generation.py** :
```python
# 1. Charger le modele pre-entraine REINVENT4 (Prior)
# 2. Definir la scoring function :
#    - Score Vina sur la poche detectee (reutiliser docking.py)
#    - Penalite si violations Lipinski > 1
#    - Penalite si QED < 0.3 (drug-likeness)
# 3. Lancer le reinforcement learning (100 iterations)
# 4. Collecter les top 20 molecules generees (SMILES)
# 5. Retourner avec scores et structures 2D/3D
```

### 2.2 - Prediction ADMET complete (ADMET-AI)

**Outil** : ADMET-AI (Swanson Lab, open source, GitHub : swansonk14/admet_ai)

**Ce que ca fait** : predit environ 40 proprietes pharmacologiques pour chaque molecule :
- **Absorption** : permeabilite intestinale, biodisponibilite orale, solubilite
- **Distribution** : liaison aux proteines plasmatiques, passage barriere hemato-encephalique
- **Metabolisme** : inhibition des CYP450 (interactions medicamenteuses)
- **Excretion** : clearance, demi-vie
- **Toxicite** : hepatotoxicite, cardiotoxicite (hERG), mutagenicite (Ames)

La V1 ne faisait que Lipinski (5 criteres basiques). La V2 fait un profil ADMET complet.

**Installation** :
```bash
pip install admet-ai
```

**Fichier a creer** : `backend/pipeline/admet.py`

**Logique de admet.py** :
```python
# 1. Recevoir la liste de SMILES (top molecules)
# 2. Appeler admet_ai.predict() pour chaque molecule
# 3. Retourner un DataFrame avec environ 40 proprietes
# 4. Calculer un score ADMET composite (0-1) :
#    - Vert (bon) / Jaune (attention) / Rouge (probleme)
#    - Flag specifique si toxicite detectee
# 5. Integrer dans le scoring composite final :
#    score_final = vina * 0.4 + admet * 0.3 + drug_likeness * 0.2 + novelty * 0.1
```

**Affichage frontend** :
- Radar chart par molecule montrant les 6 grandes categories ADMET
- Code couleur vert/jaune/rouge sur chaque propriete
- Tooltip explicatif pour chaque propriete

### 2.3 - Planification retrosynthetique (AiZynthFinder)

**Outil** : AiZynthFinder (AstraZeneca, open source, GitHub : MolecularAI/aizynthfinder)

**Ce que ca fait** : une fois qu'on a trouve une molecule prometteuse, la question est "comment la fabriquer en labo ?". AiZynthFinder decompose la molecule en reactifs commerciaux disponibles, en proposant les etapes de synthese.

C'est la **killer feature** qui rend la plateforme unique - aucun outil web gratuit ne propose ca.

**Installation** :
```bash
pip install aizynthfinder
aizynthfinder --download-public-data
```
Les donnees de reactions pesent environ 2GB.

**Fichier a creer** : `backend/pipeline/retrosynthesis.py`

**Logique de retrosynthesis.py** :
```python
# 1. Recevoir un SMILES de la molecule cible
# 2. Configurer AiZynthFinder :
#    - Stock de reactifs : base integree (Sigma-Aldrich, common reagents)
#    - Politique d'expansion : modele pre-entraine USPTO
#    - Profondeur max : 6 etapes de synthese
#    - Temps max : 120 secondes par molecule
# 3. Lancer tree_search()
# 4. Recuperer les routes de synthese trouvees
# 5. Pour chaque route : liste des etapes, reactifs necessaires, score de confiance
# 6. Retourner la meilleure route
```

**Affichage frontend** :
- Arbre de synthese visuel (type organigramme)
- Pour chaque etape : reaction, conditions, reactifs avec lien vers fournisseurs
- Score de faisabilite de la route
- Export de la route en image/PDF

### 2.4 - Docking IA avance (DiffDock)

**Outil** : DiffDock (MIT, open source, GitHub : gcorso/DiffDock)

**Ce que ca fait** : contrairement a Vina qui utilise des fonctions de scoring classiques, DiffDock utilise un modele de diffusion. Resultat : souvent plus precis que Vina, surtout sur des cibles difficiles.

**Installation** :
```bash
pip install torch-geometric
git clone https://github.com/gcorso/DiffDock.git
```

GPU fortement recommande pour DiffDock. Alternative : utiliser comme option "haute precision" que l'utilisateur active manuellement.

```
Mode rapide (defaut) : AutoDock Vina (CPU, ~5 sec/molecule)
Mode precis (opt-in) : DiffDock (GPU si dispo, ~10 sec/molecule)
```

**Fichier a creer** : `backend/pipeline/docking_diffdock.py`

---

## 3. NOUVEAU PIPELINE COMPLET V2

```
Etape 1  - Structure 3D (V1 inchange)
Etape 2  - Detection poches (V1 inchange)
Etape 3  - Preparation proteine (V1 inchange)
Etape 4  - Screening molecules connues (V1 inchange)
Etape 5  - Docking rapide Vina (V1 inchange)
Etape 6  - NEW Generation de nouvelles molecules (REINVENT4)
Etape 7  - NEW Docking des molecules generees (Vina ou DiffDock)
Etape 8  - NEW ADMET complet sur tous les candidats (ADMET-AI)
Etape 9  - NEW Scoring composite final (Vina + ADMET + drug-likeness + novelty)
Etape 10 - NEW Retrosynthese des top 5 (AiZynthFinder)
Etape 11 - Generation rapport PDF enrichi
```

Temps estime du pipeline complet : 20-30 minutes (vs 10-15 min en V1)

---

## 4. NOUVELLE STRUCTURE DES FICHIERS

```
dockit/
├── docker-compose.yml              (mis a jour)
├── backend/
│   ├── Dockerfile                   (mis a jour)
│   ├── requirements.txt             (mis a jour)
│   ├── main.py                      (nouveaux endpoints)
│   ├── pipeline/
│   │   ├── structure.py             (V1 inchange)
│   │   ├── pockets.py               (V1 inchange)
│   │   ├── prepare.py               (V1 inchange)
│   │   ├── ligands.py               (V1 inchange)
│   │   ├── docking.py               (V1 inchange)
│   │   ├── docking_diffdock.py      NEW DiffDock wrapper
│   │   ├── generation.py            NEW REINVENT4 wrapper
│   │   ├── admet.py                 NEW ADMET-AI wrapper
│   │   ├── retrosynthesis.py        NEW AiZynthFinder wrapper
│   │   ├── scoring.py               (mis a jour score composite V2)
│   │   └── report.py                (mis a jour rapport enrichi)
│   ├── tasks.py                     (mis a jour)
│   └── models.py                    (mis a jour)
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── InputForm.jsx        (V1 + option mode avance)
│   │   │   ├── ProgressBar.jsx      (mis a jour + etapes V2)
│   │   │   ├── Viewer3D.jsx         (V1 inchange)
│   │   │   ├── ResultsTable.jsx     (mis a jour + colonnes ADMET)
│   │   │   ├── MoleculeCard.jsx     (mis a jour + details ADMET)
│   │   │   ├── ADMETRadar.jsx       NEW Radar chart ADMET
│   │   │   ├── SynthesisTree.jsx    NEW Arbre de retrosynthese
│   │   │   └── GeneratedMols.jsx    NEW Section molecules generees
├── data/
│   ├── zinc_druglike_1000.sdf       (V1)
│   └── aizynthfinder/               NEW Donnees de reactions
└── README.md
```

---

## 5. NOUVEAUX ENDPOINTS API

```python
POST /api/jobs
    Body: {
        "sequence": "MKTL...",
        "uniprot_id": "P00533",
        "mode": "basic|advanced",
        "enable_generation": true,
        "enable_diffdock": false,
        "enable_retrosynthesis": true,
        "n_generated_molecules": 100
    }

GET /api/jobs/{job_id}
    Response: {
        ...V1 fields...
        "generated_molecules": [
            {
                "smiles": "...",
                "source": "reinvent4",
                "vina_score": -10.1,
                "admet": {
                    "oral_bioavailability": 0.85,
                    "herg_inhibition": 0.12,
                    "hepatotoxicity": 0.08,
                    "ames_mutagenicity": 0.05,
                    "plasma_protein_binding": 0.72,
                    "bbb_permeability": 0.45,
                    "composite_score": 0.82,
                    "flags": ["attention: BBB permeable"]
                },
                "synthesis_route": {
                    "n_steps": 4,
                    "confidence": 0.78,
                    "steps": [
                        {
                            "reaction": "Suzuki coupling",
                            "reactants": ["boronic acid X", "aryl halide Y"],
                            "conditions": "Pd(PPh3)4, K2CO3, DMF, 80C"
                        }
                    ],
                    "all_reagents_available": true
                }
            }
        ]
    }

GET /api/jobs/{job_id}/synthesis/{mol_index}
    Response: arbre de synthese detaille pour une molecule specifique
```

---

## 6. INSTRUCTIONS CLAUDE CODE - V2

### Prompt 1 - Module Generation (REINVENT4)
Installe REINVENT4, cree `backend/pipeline/generation.py` avec scoring Vina + filtres Lipinski/QED/PAINS, 100 iterations RL, top 20 molecules.

### Prompt 2 - Module ADMET
Installe admet-ai, cree `backend/pipeline/admet.py` avec ~40 proprietes, score composite, flags toxicite.

### Prompt 3 - Module Retrosynthese
Installe aizynthfinder, cree `backend/pipeline/retrosynthesis.py` avec tree_search, routes de synthese, reactifs commerciaux.

### Prompt 4 - Integration V2 complete
Met a jour tasks.py, scoring.py, main.py, report.py, Dockerfile, docker-compose.yml. Mode basic vs advanced.

### Prompt 5 - Frontend V2
Met a jour InputForm, ProgressBar, ResultsTable, MoleculeCard. Cree ADMETRadar.jsx, SynthesisTree.jsx, GeneratedMols.jsx.

---

## 7. DEPENDANCES V2 COMPLETES

### requirements.txt
```
# V1 inchange
fastapi==0.115.0
uvicorn==0.30.0
celery==5.4.0
redis==5.0.0
requests==2.32.0
rdkit-pypi==2024.3.5
meeko==0.5.0
openbabel-wheel==3.1.1.1
vina==1.2.5
biopython==1.84
reportlab==4.2.0
pydantic==2.9.0

# V2 ajouts
admet-ai
aizynthfinder
reinvent4
torch>=2.0.0
```

### Espace disque
```
V1 : ~500MB (images Docker + donnees)
V2 : ~4GB (+ modeles REINVENT4 ~200MB + donnees AiZynthFinder ~2GB + DiffDock ~500MB)
```

---

## 8. GUIDE DE LANCEMENT V2

1. Verifier que V1 marche
2. Installer REINVENT4 en local
3. Installer ADMET-AI en local
4. Installer AiZynthFinder en local
5. Tester chaque module individuellement
6. Integrer dans Docker et tester le pipeline complet
7. Valider les resultats

---

## 9. ESTIMATION DES COUTS V2
```
Infra VPS (CPU, 8GB RAM)              : ~50 euros/mois
GPU optionnel (RunPod, pour DiffDock)  : ~20 euros/mois si utilise
Domaine + SSL                          : ~15 euros/an
Total                                  : ~50-70 euros/mois
```

Pas de couts API supplementaires - tout est local et open source.

---

## 10. ROADMAP POST-V2
```
V2.1 : Upload custom de librairies de molecules (SDF)          +3 jours
V2.2 : Comptes utilisateurs + historique des jobs               +1 semaine
V2.3 : Deploiement cloud (Railway/Render)                       +1 semaine
V2.4 : Agent n8n d'enrichissement quotidien                     +1 semaine
V3.0 : Freemium + paiement Stripe                              +2 semaines
V3.1 : API publique pour integration dans d'autres outils       +1 semaine
V4.0 : Multi-omiques (transcriptomique → identification)        +1 mois
```

---

*Ce document est la suite directe du CDC V1. Donner les deux documents a Claude Code. Executer les prompts dans l'ordre apres validation de la V1.*

*Genere le 21 fevrier 2026*
