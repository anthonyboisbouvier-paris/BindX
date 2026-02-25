Cahier des Charges - DockIt V3
"Screening massif, UX pro, séquences custom"
Prerequis : V2 fonctionnelle (REINVENT4 + ADMET + retrosynthese)
Date : 21 fevrier 2026

1. VISION V3
La V2 a le pipeline scientifique complet. La V3 transforme DockIt en produit utilisable par n'importe quel biologiste sans formation. Trois axes : screening massif sans GPU, UX radicalement simplifiee, et input flexible (UniProt ou sequence brute).

2. AXE 1 — INPUT FLEXIBLE (sequence custom)
2.1 Toggle mode d'entree
Dans InputForm.jsx, ajouter un segmented control au-dessus du formulaire :
  ○ Identifiant UniProt    ● Séquence protéine
Mode UniProt : le formulaire actuel, inchange.
Mode Sequence : remplace le champ UniProt par un textarea multiligne avec :

Placeholder : >ma_proteine\nMKTLLPFLVLALVSSYARA...
Validation : commence par M, que des acides amines valides (ACDEFGHIKLMNPQRSTVWY), minimum 50 caracteres
Label : Collez votre sequence FASTA ou la sequence brute d'acides amines
Compteur de caracteres en bas a droite

2.2 Backend
Verifier que structure.py gere correctement les deux cas :

Si uniprot_id fourni : chercher AlphaFold DB, fallback ESMFold
Si sequence fournie sans uniprot_id : ESMFold directement
Afficher la source dans les resultats : "Structure: AlphaFold DB" ou "Structure: ESMFold (prediction IA)"

2.3 Logique automatique intelligente
Quand l'utilisateur entre un UniProt ID :

Chercher dans AlphaFold DB
Si pas trouve, proposer automatiquement : "Structure non trouvee dans AlphaFold. Voulez-vous predire la structure avec ESMFold ?" avec un bouton pour recuperer la sequence depuis UniProt API et lancer ESMFold


3. AXE 2 — UX RADICALEMENT SIMPLIFIEE
3.1 Nouveau formulaire principal
L'ecran d'accueil ne montre que l'essentiel :
Un champ (UniProt ou sequence selon le toggle)
Un bouton "Lancer le screening"
Un lien "Options avancees" (accordeon ferme par defaut)
Supprimer de la vue par defaut :

Les checkboxes ChEMBL/ZINC (le systeme choisit automatiquement)
Le slider nombre de ligands (le systeme choisit automatiquement)
Le champ SMILES personnalises (deplace dans options avancees)

3.2 Logique automatique de selection des sources
Le backend decide automatiquement la meilleure strategie :
python# Logique dans ligands.py
chembl_count = query_chembl_count(uniprot_id)

if chembl_count > 100:
    # Cible bien documentee
    source = "chembl"
    n_ligands = 50  # les plus diversifies
    message = f"Cible bien documentee - {chembl_count} composes connus trouves dans ChEMBL"

elif chembl_count > 10:
    # Cible peu documentee
    source = "chembl + zinc"
    n_ligands = 50  # mix ChEMBL + ZINC
    message = f"Cible peu etudiee - {chembl_count} composes connus, complement avec ZINC"

elif chembl_count <= 10:
    # Cible inconnue
    source = "zinc + reinvent4"
    n_ligands = 50  # ZINC + generation IA
    message = "Cible non documentee - generation de molecules sur mesure avec l'IA"
```

L'utilisateur voit le message explicatif dans le pipeline en temps reel.

### 3.3 Options avancees (accordeon)

Seulement 3 options, cachees par defaut :
```
Options avancees

  Precision du screening
  ○ Rapide (50 molecules, ~5 min)
  ● Standard (500 molecules, ~15 min)
  ○ Deep (toute la base ChEMBL 2.4M, ~3 heures)

  Ajouter vos propres molecules (SMILES, un par ligne)
  [textarea]

  Mode de docking
  ● AutoDock Vina (rapide, CPU)
  ○ DiffDock (precis, plus lent)
```

### 3.4 Pipeline transparent en temps reel

Quand l'utilisateur clique "Lancer", il voit chaque etape avec :
- Le statut (en attente / en cours / termine)
- Le resultat chiffre de l'etape
- Une explication en langage simple

Format de chaque etape :
```
✅ Structure 3D          AlphaFold DB — 1,210 acides amines
   Resolution: haute confiance (pLDDT 92.4)

✅ Site de liaison        Poche #1 detectee
   Volume: 847 A3 — Score fpocket: 0.89

✅ Molecules candidates   2,847 trouvees (ChEMBL)
   50 selectionnees par diversite chimique

🔄 Docking en cours       32/50 testees
   ████████████████░░░░░░  64%  ~3 min restantes
   Meilleur score actuel: -9.8 kcal/mol

○  Analyse ADMET           en attente
○  Retrosynthese           en attente
○  Rapport final           en attente
```

Encadre pedagogique en bas qui change a chaque etape :

- Structure : "AlphaFold predit la forme 3D de votre proteine a partir de sa sequence."
- Poches : "fpocket detecte les cavites ou une molecule pourrait se fixer."
- Molecules : "Nous avons trouve X composes deja testes sur cette proteine dans la base ChEMBL."
- Docking : "Le docking simule comment chaque molecule se fixe. Plus le score est negatif, meilleure est l'affinite."
- ADMET : "Nous verifions la toxicite, l'absorption et la stabilite de chaque candidat."
- Retrosynthese : "L'IA planifie comment synthetiser cette molecule en laboratoire."

Quand le systeme prend une decision automatique, il l'affiche :
```
"Votre proteine est bien documentee — 2,847 composes connus trouves. 
 Nous utilisons ces donnees plutot que de generer des molecules de novo."
```

ou
```
"Votre proteine Q9Y6K9 n'a que 3 composes connus. 
 Nous lancons la generation IA pour creer des candidats sur mesure."
```

### 3.5 Ecran recapitulatif avant les resultats

Quand le pipeline est termine, afficher un resume avant les resultats :
```
Screening termine en 14 min 32s

Resume du pipeline
  Structure     AlphaFold DB, confiance haute
  Poche         #1 (score 0.89, volume 847 A3)
  Source        2,847 composes ChEMBL
  Testes        50 (selection par diversite)
  Docking       AutoDock Vina, mode standard
  ADMET         40 proprietes predites par molecule
  Retrosynthese Top 5 analyses (AiZynthFinder)

  3 candidats prometteurs identifies
  8 candidats secondaires
  39 elimines (toxicite ou faible affinite)

  [Voir les resultats]

  Ces resultats sont exploratoires et doivent etre valides 
  experimentalement avant toute application clinique.
```

### 3.6 Page de resultats simplifiee

Pas de tableau brut. Un dashboard clair avec les top 3 visibles immediatement :
```
1. Erlotinib         Score: 94/100
   Affinite: 5/5    Toxicite: faible (vert)
   Synthese: 3 etapes, reactifs disponibles (vert)
   [Voir en 3D]

2. Gefitinib         Score: 87/100
   Affinite: 4/5    Toxicite: faible (vert)
   Synthese: 4 etapes, reactifs disponibles (vert)
   [Voir en 3D]

3. AI-Mol-0042       Score: 82/100    [badge: Genere par IA]
   Affinite: 5/5    Toxicite: moderee (jaune)
   Synthese: 6 etapes, complexe (jaune)
   [Voir en 3D]

[Telecharger le rapport complet PDF]
[Voir tous les resultats (47 autres)]
```

Le score est sur 100 au lieu de kcal/mol. Des icones vert/jaune/rouge. Le detail technique accessible en cliquant sur une molecule.

### 3.7 Vue 3D simplifiee

Quand l'utilisateur clique "Voir en 3D", plein ecran avec seulement :
```
[Retour]  [Molecule precedente]  [Molecule suivante]  [Telecharger PDF]
```

Pas 40 boutons. La proteine en surface transparente, la molecule en sticks colores dans la poche.

---

## 4. AXE 3 — SCREENING MASSIF SANS GPU

### 4.1 Architecture multi-passes

Le mode "Deep" screene toute la base ChEMBL (2.4M molecules) en ~3 heures sur CPU uniquement :
```
Pass 1 — Filtre pharmacologique (2 min, 2.4M -> 200K)
  RDKit en Python pur :
  - Lipinski Rule of 5
  - Poids moleculaire compatible avec le volume de la poche
  - Pas de PAINS (pan-assay interference compounds)
  - QED > 0.3 (drug-likeness minimum)

Pass 2 — Filtre de forme 3D (10 min, 200K -> 10K)
  RDKit shape screening ou Open Babel :
  - Compare la forme 3D de chaque molecule avec le volume de la poche
  - Elimine les molecules physiquement incompatibles (trop grosses, trop plates)

Pass 3 — Scoring rapide Vinardo (1-2h, 10K -> 500)
  smina (fork optimise de Vina) avec scoring Vinardo :
  - Scoring function simplifiee, 10x plus rapide que Vina complet
  - Commande : smina --receptor protein.pdbqt --ligand ligand.pdbqt --autobox_ligand pocket.pdb --scoring vinardo

Pass 4 — Docking Vina precis (30 min, 500 -> top 50)
  AutoDock Vina avec exhaustiveness=32 uniquement sur les survivants

Pass 5 — ADMET + retrosynthese (15 min, top 50)
  Pipeline V2 normal sur les meilleurs candidats
4.2 Installation smina
bash# smina est un drop-in replacement de Vina, plus rapide
# Ajouter dans le Dockerfile
RUN wget https://sourceforge.net/projects/smina/files/smina.static/download -O /usr/local/bin/smina \
    && chmod +x /usr/local/bin/smina
```

### 4.3 Fichiers a creer
```
backend/pipeline/
    screening_massive.py     # Orchestration multi-passes
    filter_pharma.py         # Pass 1 - filtres RDKit
    filter_shape.py          # Pass 2 - filtre forme 3D
    scoring_rapid.py         # Pass 3 - smina/Vinardo
4.4 Logique de screening_massive.py
python# 1. Telecharger le dump ChEMBL complet (ou utiliser un cache local)
#    Format : fichier SDF ou SMILES pre-telecharge (~2GB)
#    A telecharger une fois et stocker dans /data/chembl_all.smi
#
# 2. Pass 1 : filter_pharma.py
#    Input : 2.4M SMILES
#    Output : ~200K SMILES filtres
#    Methode : RDKit Lipinski + QED + PAINS filter
#    Temps : ~2 minutes (traitement batch vectorise)
#
# 3. Pass 2 : filter_shape.py
#    Input : 200K SMILES + poche PDB
#    Output : ~10K SMILES compatibles
#    Methode : generer conformere 3D rapide (RDKit ETKDG)
#              comparer volume vs volume poche
#    Temps : ~10 minutes
#
# 4. Pass 3 : scoring_rapid.py
#    Input : 10K molecules + protein PDBQT
#    Output : 500 meilleurs scores
#    Methode : smina avec scoring Vinardo
#    Temps : 1-2 heures (paralleliser sur tous les CPUs)
#
# 5. Pass 4 : docking.py (existant)
#    Input : 500 molecules
#    Output : top 50
#    Methode : AutoDock Vina exhaustiveness=32
#    Temps : ~30 minutes
#
# 6. Pass 5 : pipeline V2 (ADMET + retrosynthese)
#    Input : top 50
#    Temps : ~15 minutes
4.5 Parallelisation CPU
python# Utiliser multiprocessing pour paralleliser les passes 3 et 4
import multiprocessing

n_cpus = multiprocessing.cpu_count()
# Sur un VPS 8 CPUs : 8 dockings en parallele
# Pass 3 : 10K / 8 CPUs = 1250 par CPU, ~15 min chacun = ~1h total
# Pass 4 : 500 / 8 CPUs = 63 par CPU, ~4 min chacun = ~30 min total

pool = multiprocessing.Pool(n_cpus)
results = pool.map(dock_single_ligand, ligand_list)
4.6 Cache ChEMBL local
bash# Telecharger une fois le fichier complet ChEMBL
# A faire au premier lancement ou dans le Dockerfile
wget https://ftp.ebi.ac.uk/pub/databases/chembl/ChEMBLdb/latest/chembl_34_chemreps.txt.gz
gunzip chembl_34_chemreps.txt.gz
# ~2GB, contient tous les SMILES de ChEMBL
Stocker dans /data/chembl_all.smi et monter en volume Docker.
4.7 Mode Deep en tache de fond
Le mode Deep tourne en background. L'utilisateur peut fermer son navigateur :
python# Dans tasks.py, creer une tache Celery dediee
@celery.task(bind=True, time_limit=14400)  # timeout 4 heures
def run_deep_screening(self, job_id, uniprot_id):
    # ... pipeline multi-passes ...
    # A chaque pass, mettre a jour le statut :
    update_job_status(job_id, {
        "current_step": "scoring_rapid",
        "progress": 45,
        "step_details": "Scoring rapide: 4,500/10,000 molecules testees"
    })
```

### 4.8 Notification quand c'est pret

Ajouter un champ email optionnel dans le formulaire pour le mode Deep :
```
○ Deep (toute la base ChEMBL, ~3 heures)
  Email pour notification (optionnel) : [____________]
  Vous recevrez un lien vers les resultats quand le screening sera termine.
```

Backend : envoyer un email simple avec le lien quand le job est termine.

---

## 5. NOUVELLE STRUCTURE DES FICHIERS V3
```
dockit/
├── docker-compose.yml                   (mis a jour)
├── backend/
│   ├── Dockerfile                        (mis a jour + smina)
│   ├── requirements.txt                  (mis a jour)
│   ├── main.py                           (mis a jour)
│   ├── pipeline/
│   │   ├── structure.py                  (V1, verifie fallback ESMFold)
│   │   ├── pockets.py                    (V1 inchange)
│   │   ├── prepare.py                    (V1 inchange)
│   │   ├── ligands.py                    (mis a jour, logique auto source)
│   │   ├── docking.py                    (V1 inchange)
│   │   ├── docking_diffdock.py           (V2 inchange)
│   │   ├── generation.py                 (V2 inchange)
│   │   ├── admet.py                      (V2 inchange)
│   │   ├── retrosynthesis.py             (V2 inchange)
│   │   ├── scoring.py                    (V2 inchange)
│   │   ├── report.py                     (mis a jour)
│   │   ├── screening_massive.py          NEW orchestration multi-passes
│   │   ├── filter_pharma.py              NEW filtre pharmacologique RDKit
│   │   ├── filter_shape.py               NEW filtre forme 3D
│   │   └── scoring_rapid.py              NEW scoring smina/Vinardo
│   ├── tasks.py                          (mis a jour, tache deep screening)
│   ├── models.py                         (mis a jour)
│   └── notifications.py                  NEW envoi email
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── InputForm.jsx             REFONTE toggle UniProt/Sequence + auto config
│   │   │   ├── ProgressBar.jsx           REFONTE pipeline transparent
│   │   │   ├── PipelineSummary.jsx       NEW recapitulatif avant resultats
│   │   │   ├── ResultsDashboard.jsx      NEW dashboard top 3 simplifie
│   │   │   ├── Viewer3D.jsx              SIMPLIFIE navigation minimale
│   │   │   ├── ResultsTable.jsx          (V2, deplace dans "voir tous")
│   │   │   ├── MoleculeCard.jsx          (V2 inchange)
│   │   │   ├── ADMETRadar.jsx            (V2 inchange)
│   │   │   ├── SynthesisTree.jsx         (V2 inchange)
│   │   │   ├── GeneratedMols.jsx         (V2 inchange)
│   │   │   └── PedagogicalTip.jsx        NEW encadre pedagogique par etape
├── data/
│   ├── zinc_druglike_1000.sdf            (V1)
│   ├── aizynthfinder/                    (V2)
│   └── chembl_all.smi                    NEW dump ChEMBL complet
└── README.md

6. ENDPOINTS MIS A JOUR
pythonPOST /api/jobs
    Body: { 
        "uniprot_id": "P00533",          # OU
        "sequence": "MKTLLPFLVL...",      # NEW sequence brute
        "mode": "rapid|standard|deep",    # NEW remplace basic/advanced
        "custom_smiles": ["CCO...", ...],  # optionnel
        "docking_engine": "vina|diffdock", # optionnel, defaut vina
        "notification_email": "a@b.com"    # optionnel, pour mode deep
    }

GET /api/jobs/{job_id}
    Response: {
        "status": "pending|running|completed|failed",
        "current_step": "scoring_rapid",
        "progress": 45,
        "step_details": "Scoring rapide: 4,500/10,000 molecules",
        "strategy_message": "Cible bien documentee - 2,847 composes...",
        "pedagogical_tip": "Le scoring rapide pre-filtre les molecules...",
        "structure_source": "alphafold|esmfold",
        "pipeline_summary": {
            "structure": {"source": "AlphaFold DB", "confidence": 92.4},
            "pocket": {"rank": 1, "score": 0.89, "volume": 847},
            "ligands": {"source": "ChEMBL", "total_found": 2847, "selected": 50},
            "screening_passes": [
                {"name": "Filtre pharma", "input": 2400000, "output": 200000, "time": "2 min"},
                {"name": "Filtre forme", "input": 200000, "output": 10000, "time": "10 min"},
                {"name": "Scoring rapide", "input": 10000, "output": 500, "time": "1h"},
                {"name": "Docking precis", "input": 500, "output": 50, "time": "30 min"}
            ]
        },
        "results_summary": {
            "promising": 3,
            "secondary": 8,
            "eliminated": 39,
            "total_screened": 50
        },
        "top_molecules": [
            {
                "rank": 1,
                "name": "Erlotinib",
                "score_100": 94,
                "affinity_stars": 5,
                "toxicity_level": "low",
                "toxicity_color": "green",
                "synthesis_steps": 3,
                "synthesis_feasibility": "easy",
                "synthesis_color": "green",
                "source": "chembl",
                ...tous les champs V2...
            }
        ]
    }
```

---

## 7. INSTRUCTIONS CLAUDE CODE - V3

### Prompt unique V3
```
Lis DockIt_V3_Cahier_des_Charges.md dans ce repertoire.

La V2 est fonctionnelle. Implemente la V3 dans cet ordre :

ETAPE 1 : Input flexible
- Dans InputForm.jsx, ajoute un segmented control toggle entre "Identifiant UniProt" et "Sequence proteine"
- Mode Sequence : textarea multiligne, validation FASTA (commence par M, acides amines valides, min 50 chars)
- Verifie que structure.py gere bien le fallback ESMFold quand sequence fournie sans uniprot_id
- Affiche la source dans les resultats : "AlphaFold DB" ou "ESMFold (prediction IA)"

ETAPE 2 : UX simplifiee - Formulaire
- Supprime de la vue par defaut : checkboxes ChEMBL/ZINC, slider ligands, champ SMILES
- Garde uniquement : champ input (UniProt ou sequence) + bouton Lancer
- Ajoute un accordeon "Options avancees" avec 3 options : precision (rapide/standard/deep), SMILES custom, moteur de docking
- Implemente la logique auto dans ligands.py : si ChEMBL > 100 -> ChEMBL seul, si < 100 -> ChEMBL + ZINC, si < 10 -> ZINC + REINVENT4
- Affiche un message explicatif de la strategie choisie dans le pipeline

ETAPE 3 : Pipeline transparent
- Refonte de ProgressBar.jsx : chaque etape affiche statut + resultat chiffre + explication
- Cree PedagogicalTip.jsx : encadre en bas qui explique l'etape en cours en langage simple
- Les decisions automatiques du systeme sont affichees explicitement
- Cree PipelineSummary.jsx : ecran recapitulatif entre la fin du pipeline et les resultats

ETAPE 4 : Page de resultats
- Cree ResultsDashboard.jsx : top 3 candidats visibles immediatement avec score sur 100, etoiles affinite, couleurs toxicite/synthese
- Convertir le score composite en score sur 100 (plus intuitif que kcal/mol)
- Badge "Genere par IA" violet pour les molecules REINVENT4
- Bouton "Voir tous les resultats" pour le tableau complet
- Simplifier Viewer3D : navigation minimale (retour, precedent, suivant, PDF)
- Disclaimer en bas : "Resultats exploratoires, validation experimentale necessaire"

ETAPE 5 : Screening massif CPU
- Installe smina dans le Dockerfile (wget depuis sourceforge)
- Cree filter_pharma.py : filtre RDKit (Lipinski + QED + PAINS), 2.4M -> 200K en 2 min
- Cree filter_shape.py : filtre forme 3D RDKit, 200K -> 10K en 10 min
- Cree scoring_rapid.py : wrapper smina avec scoring Vinardo, 10K -> 500 en 1-2h
- Cree screening_massive.py : orchestration des 5 passes avec parallelisation multiprocessing
- Telecharge chembl_34_chemreps.txt.gz dans le Dockerfile ou au premier lancement
- Ajoute la tache Celery deep_screening avec timeout 4h
- Mode Deep dans le formulaire avec champ email optionnel pour notification
- Cree notifications.py : envoi email simple quand le job Deep est termine

Teste chaque etape avant de passer a la suivante. Si une installation echoue, implemente un fallback/mock et continue.

8. DEPENDANCES V3
Ajouts requirements.txt
txt# V3 ajouts
smtplib          # natif Python, pour notifications email
Ajouts Dockerfile
dockerfile# smina pour scoring rapide
RUN wget https://sourceforge.net/projects/smina/files/smina.static/download -O /usr/local/bin/smina \
    && chmod +x /usr/local/bin/smina

# Dump ChEMBL (telecharge au premier lancement si absent)
# Gere dans screening_massive.py avec un check au demarrage
```

### Espace disque
```
V2 : ~4GB
V3 : ~6GB (+ dump ChEMBL ~2GB)
```

---

## 9. TESTS DE VALIDATION V3

- Le toggle UniProt/Sequence fonctionne, ESMFold est appele pour les sequences
- Le formulaire simplifie n'a qu'un champ et un bouton par defaut
- La logique auto choisit la bonne strategie (tester avec P00533 cible connue et Q9Y6K9 cible peu connue)
- Le pipeline affiche chaque etape avec resultats chiffres et explications
- Le recap s'affiche avant les resultats
- Le dashboard montre le top 3 avec scores sur 100 et couleurs
- Le mode Deep lance le screening multi-passes en background
- Le screening 2.4M molecules se termine en moins de 4 heures
- L'email de notification est envoye quand le mode Deep est termine
- Le disclaimer est visible sur la page de resultats

---

## 10. ESTIMATION COUTS V3
```
Infra VPS (CPU 8 coeurs, 16GB RAM)     : ~70 euros/mois
Stockage supplementaire (ChEMBL dump)   : inclus
Domaine + SSL                           : ~15 euros/an
Email (SMTP gratuit type Gmail/Resend)  : 0 euros
Total                                   : ~70 euros/mois
```

---

## 11. ROADMAP POST-V3
```
V3.1 : GPU optionnel (RunPod API) pour screening en 30 min    +1 semaine
V3.2 : Comptes utilisateurs + historique des jobs              +1 semaine
V3.3 : Deploiement cloud (Railway/Render)                      +1 semaine
V4.0 : Freemium + paiement Stripe                             +2 semaines
V4.1 : API publique                                            +1 semaine
V5.0 : Multi-omiques                                           +1 mois

Ce document est la suite directe des CDC V1 et V2. Donner les trois documents a Claude Code. Le prompt unique de la section 7 suffit pour implementer toute la V3.
Genere le 21 fevrier 2026