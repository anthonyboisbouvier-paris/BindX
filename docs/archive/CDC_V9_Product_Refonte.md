# BindX V9 -- Cahier des Charges : Refonte Produit / UX / Architecture
## De DockIt (screening monolithique) a BindX (plateforme de discovery structuree)
### Date : 24 fevrier 2026
### Auteur : Anthony Boisbouvier + Claude (Anthropic)

---

# TABLE DES MATIERES

1. Audit de l'existant
2. Objectifs et non-objectifs
3. Personas et user journeys
4. Modele conceptuel (Project / Campaign / Phase / Run)
5. UX cible et navigation
6. La Regle Unique de selection et transition
7. Systeme de calculs (Run types, cache, incremental)
8. Module Model Factory (prevu V10)
9. Schema de base de donnees Supabase
10. API endpoints
11. Strategie frontend
12. Mapping features existantes vers nouvelle vision
13. Backlog (epics et stories)
14. Plan de migration progressif
15. Exemples concrets de campagnes
16. Risques et points ouverts

---

# 1. AUDIT DE L'EXISTANT

## 1.1 Architecture technique actuelle

Backend : FastAPI + Celery + Redis + SQLAlchemy (SQLite)
Frontend : React (Vite) + Tailwind CSS
Containerisation : Docker Compose (redis, backend, celery_worker, frontend)
Auth : JWT tokens (bcrypt)

## 1.2 Modele de donnees actuel

3 tables SQLAlchemy :
- UserORM : id, email, username, password_hash
- ProjectORM : id, user_id, name, uniprot_id, sequence, description, target_preview_json
- JobORM : id, project_id, user_id, uniprot_id, status, progress, results_json, generated_json, ~30 champs
- TargetAssessmentORM : id, project_id, uniprot_id, assessment_json

Hierarchie actuelle : User -> Project -> Job (1 job = 1 run monolithique complet)

## 1.3 Pipeline actuel (tasks.py)

Un seul pipeline sequentiel "run_pipeline" en 10 etapes :
1. Fetch protein structure (PDB/AlphaFold/ESMFold)
2. Detect binding pockets (P2Rank)
3. Prepare receptor (PDB->PDBQT)
4. Fetch ligands (ChEMBL/ZINC/PubChem/custom SMILES)
5. Dock all ligands (GNINA GPU/CPU, Vina, mock)
6. Score + ADMET + hard cutoffs
7. Enrich (interactions ProLIF, off-target, retrosynthesis)
8. Generate report PDF
9. Persist results (JSON in SQLite)
10. Notify (email)

Tout est execute en un seul bloc : pas de granularite, pas de re-run partiel.

## 1.4 Frontend : composants et pages existants

### Pages (routes)
- / : ProjectListPage (si auth) ou HomeHero (si anon)
- /project/:id/overview : ProjectOverview
- /project/:id/target : TargetSetup (preview target, pocket selection)
- /project/:id/runs : RunsList (liste des jobs du projet)
- /project/:id/results : ProjectResults (resultats agreges)
- /project/:id/optimization : ProjectOptimization
- /project/:id/reports : ProjectReports
- /run : InputForm (saisie job) + HomeHero
- /login, /register : Auth pages
- /references, /methodology

### Composants cles
- InputForm.jsx : formulaire de creation de job (target, sources, engine, toggles)
- TargetSetup.jsx : preview target, selection pocket, configuration
- ResultsDashboard.jsx : tableau principal des resultats (scores, ADMET, badges)
- ResultsTable.jsx : tableau detaille avec tri
- Viewer3D.jsx : visualisation 3D NGL/3Dmol.js
- MoleculeCard.jsx : fiche detaillee molecule
- OptimizationView.jsx : interface lead optimization (scaffold analysis, iterations)
- HitSelector.jsx : tagging molecules (Hit / Investigate / Reject)
- ParetoFront.jsx : visualisation multi-objectif Pareto
- ClusterView.jsx : regroupement chimique Butina
- ADMETRadar.jsx : radar ADMET
- InteractionView.jsx + InteractionDiagram.jsx : ProLIF interactions
- PipelineSummary.jsx : resume du pipeline post-run
- SafetyReport.jsx : rapport de securite off-target
- ConfidenceBreakdown.jsx : decomposition confiance
- SynthesisTree.jsx : arbre retrosynthese
- ScaffoldAnalyzer.jsx : analyse R-groups
- ScoringWeights.jsx : configuration poids scoring
- AgentChat.jsx + AgentAdvisorCard.jsx : interface agents IA

### Contextes React
- AuthContext : gestion JWT / user
- ProjectContext : project detail + jobs
- HitSelectionContext : selection molecules (tags)

## 1.5 API endpoints existants

Auth : POST /api/auth/register, /login, GET /me
Projects : POST /api/projects, GET /api/projects, GET/PUT /api/projects/:id
Jobs : POST /api/jobs, GET /api/jobs, GET /api/jobs/:id, GET /api/jobs/:id/results
Files : GET /api/jobs/:id/report, /download, /protein, /pose/:idx, /audit_log
Optimization : POST /api/jobs/:id/optimize, GET /api/jobs/:id/optimization/:opt_id
Analysis : POST /api/molecule/analyze-scaffold
Target : POST /api/preview-target, /api/preview-sequence, /api/target-assessment
Agents : POST /api/agent/:name/query, POST /api/jobs/:id/agent-analysis

## 1.6 Forces et faiblesses

Forces :
- Pipeline scientifique complet (structure->pocket->dock->score->ADMET->offtarget->retro)
- UI riche (3D, Pareto, clusters, scaffold analysis, interactions)
- GNINA GPU via RunPod (2.49s par batch)
- Agents IA (target, candidate, optimization, research)
- Hit tagging (Hit/Investigate/Reject)
- Auth + Projects

Faiblesses :
- 1 job = 1 pipeline monolithique (pas de re-run partiel, pas d'incremental)
- Pas de notion de "phase" scientifique
- Resultats en JSON blob dans SQLite (pas scalable, pas queryable)
- Pas de selection formelle pour passer d'une etape a l'autre
- Pas de separation source de donnees / calcul / selection
- Pas de cache : on recalcule tout a chaque job

---

# 2. OBJECTIFS ET NON-OBJECTIFS

## 2.1 Objectifs V9

O1. Structurer le workflow en Project > Campaign > Phase > Run
O2. Permettre le re-run partiel et l'incremental (memes molecules, nouveaux calculs)
O3. Introduire des selections formalisees (select for next run / select for next phase)
O4. Migrer vers Supabase (Postgres) pour des molecules queryables et scalables
O5. Conserver l'UX actuelle en l'adaptant (pas de rewrite from scratch)
O6. Permettre le filtrage avance sur les sources de donnees chimiques
O7. Restreindre la generation de novo a la phase Lead Optimization

## 2.2 Non-objectifs

N1. Pas d'editeur de workflow visuel (DAG editor, node editor)
N2. Pas de multi-cibles dans une meme campagne (V10)
N3. Pas de Model Factory fonctionnel (prevu V10, placeholder en V9)
N4. Pas de deploiement cloud (on reste Docker local + Supabase hosted)
N5. Pas de gestion d'equipe multi-utilisateurs avec roles (V10)
N6. Pas de rewrite du pipeline Celery (on encapsule les etapes existantes dans des Run types)

---

# 3. PERSONAS ET USER JOURNEYS

## 3.1 Personas

P1. Chercheur en chimie medicinale (pharma/biotech)
- Connait sa cible, veut trouver des hits, les optimiser
- Veut comparer plusieurs passes de docking avec des parametres differents
- Ne veut PAS coder, veut un dashboard clair

P2. Bioinformaticien / cheminformaticien
- Configure les campagnes, ajuste les parametres
- Veut du re-run partiel et de l'incremental
- Veut exporter les donnees (CSV, SDF)

P3. Chef de projet drug discovery
- Vue d'ensemble sur les projets et campagnes
- KPI : nombre de hits, taux de survie par phase, temps ecoule

## 3.2 User Journey principal (P1 - chimiste medicinal)

1. Se connecte, voit ses projets
2. Cree un projet "EGFR Inhibitors" avec un commentaire
3. Dans le projet, cree une campagne "ATP-site Inhibitors"
   - Configure la cible (UniProt P00533), selectionne la pocket ATP
   - Selectionne les sources de donnees (ChEMBL actifs IC50 < 10uM)
4. Demarre la Phase A "Hit Discovery"
   - Cree un Run "Docking pass 1" : docking + ADMET + scoring
   - Visualise les resultats dans le dashboard
   - Selectionne les top 20 en "select for next phase"
   - Freeze la selection -> Phase A terminee
5. La Phase B "Hit-to-Lead" s'ouvre avec les 20 molecules
   - Cree un Run "Enrichment" : ProLIF + off-target + retrosynthesis
   - Cree un Run "Re-rank" : nouveau scoring avec poids differents
   - Selectionne les top 10 pour la phase suivante
6. Phase C "Lead Optimization"
   - Selectionne 3 molecules pour optimisation
   - Interface dediee : scaffold analysis, generation d'analogs, re-docking
   - Itere jusqu'a satisfaction
   - Exporte le rapport PDF final

---

# 4. MODELE CONCEPTUEL

## 4.1 Hierarchie

`
User
  |
  +-- Project (nom, description, KPIs agreges)
        |
        +-- Campaign (cible, pocket, sources, regles globales)
              |
              +-- Phase A: Hit Discovery
              |     +-- Run 1 (docking pass)
              |     +-- Run 2 (re-scoring)
              |     +-- [Selection freeze -> sortie de phase]
              |
              +-- Phase B: Hit-to-Lead
              |     +-- Run 3 (enrichment)
              |     +-- Run 4 (re-rank)
              |     +-- [Selection freeze -> sortie de phase]
              |
              +-- Phase C: Lead Optimization
                    +-- Run 5 (optimization mol A)
                    +-- Run 6 (optimization mol B)
                    +-- [Export final]
`

## 4.2 Definitions

PROJECT : conteneur organisationnel. Nom libre + commentaire + KPIs agreges (nb campagnes, nb molecules total, meilleur score).

CAMPAIGN : programme scientifique centre sur une cible + pocket + sources. Contient toute la configuration "target" actuelle (UniProt/sequence, structure source, pocket selection). Dans un premier temps : 1 cible par campagne. A terme : contre-cibles optionnelles.

PHASE : etape scientifique avec un role defini.
- Phase A "Hit Discovery" : screening large, identification des premiers hits
- Phase B "Hit-to-Lead" : enrichissement, filtrage, comparaison
- Phase C "Lead Optimization" : optimisation iterative, generation de novo
Chaque campagne a exactement 3 phases creees automatiquement.

RUN : execution calculatoire atomique. Un run a :
- Un type (docking, admet, scoring, enrichment, generation, custom)
- Des inputs : soit une source externe (ChEMBL, ZINC, SMILES), soit la sortie d'un ou plusieurs runs precedents (via selections)
- Des parametres specifiques au type
- Des resultats : colonnes ajoutees a la table molecules de la campagne

## 4.3 La table molecules

REGLE FONDAMENTALE : une campagne = une seule table "molecules" partagee.
Chaque run ENRICHIT cette table en ajoutant des colonnes (pas de tables separees par run).
Les selections sont des flags sur les lignes de cette table.

Cela signifie :
- Run "docking" ajoute les colonnes vina_score, cnn_score, cnn_affinity, consensus_rank
- Run "ADMET" ajoute les colonnes oral_bioavailability, herg_inhibition, composite_score, etc.
- Run "scoring" recalcule composite_score avec de nouveaux poids
- La table grandit horizontalement (colonnes), pas verticalement (sauf generation de novo)

---

# 5. UX CIBLE ET NAVIGATION

## 5.1 Navigation

`
[Sidebar gauche]                    [Zone principale]
  Projects                          
    +-- Mon Projet EGFR             
          +-- Campaign ATP-site     
          |     +-- Hit Discovery   -> Dashboard molecules (preset Hit Discovery)
          |     +-- Hit-to-Lead     -> Dashboard molecules (preset Hit-to-Lead)
          |     +-- Lead Opt        -> Dashboard molecules (preset Lead Opt)
          +-- Campaign Allosteric   
`

## 5.2 Dashboard molecules (vue unique, presets par phase)

Le MEME composant ResultsDashboard est utilise dans toutes les phases.
Ce qui change selon la phase :

### Hit Discovery (Phase A)
- Colonnes par defaut : name, smiles, affinity, cnn_score, composite_score, QED, MW, logP, source
- Outils visibles : scatter plot, Pareto, cluster view, filtres
- Boutons : "Select for next run", "Select for next phase"
- Generation de novo : DESACTIVEE

### Hit-to-Lead (Phase B)
- Colonnes par defaut : + off_target, synthesis_steps, interaction_quality, herg
- Outils visibles : + safety report, interaction diagram, synthesis tree
- Boutons : "Select for next run", "Select for next phase"
- Generation de novo : DESACTIVEE (mais design analog "manuel" possible)

### Lead Optimization (Phase C)
- Colonnes par defaut : toutes + optimization_score, iteration, parent_molecule
- Outils visibles : + scaffold analyzer, optimization chart
- Bouton special : "Select for optimization" (lance l'interface OptimizationView)
- Generation de novo : ACTIVEE (seule phase)

## 5.3 Panel 3D

Le viewer 3D s'ouvre en panneau lateral (drawer droit, 50% largeur) quand on clique sur "View Docking" dans une ligne du tableau. Disponible dans TOUTES les phases des qu'un docking a ete calcule.
Contient : pose 3D, interactions, metriques de pose.

## 5.4 Barre d'outils sous le dashboard

Toujours visible sous le tableau :
- Selection tools : checkbox multi-select, "Select all visible", "Invert"
- Actions : "Select for next run" (flag interne a la phase), "Select for next phase" (freeze)
- Visualisation : Scatter, Pareto, Clusters (onglets)
- Export : CSV, SDF, rapport PDF

## 5.5 Creation d'un Run

Modal ou panel lateral :
1. Nom du run (auto-genere ou libre)
2. Source d'entree :
   - "External source" : ChEMBL, ZINC, PubChem, Custom SMILES
     - Avec filtres avances : IC50 < X, MW range, logP range, etc.
     - Nombre max de composes
   - "From previous run(s)" : liste des runs de la meme phase
     - Selectionner les molecules taguees "select for next run"
   - "From previous phase" : molecules taguees "select for next phase" de la phase precedente
3. Calculs a executer (checkboxes) :
   - Docking (engine, exhaustiveness, box size) -- RECOMMANDE en Phase A
   - ADMET prediction -- RECOMMANDE toutes phases
   - Scoring composite (poids configurables) -- RECOMMANDE toutes phases
   - Off-target selectivity -- RECOMMANDE Phase B+
   - Retrosynthesis -- RECOMMANDE Phase B+
   - Interaction analysis (ProLIF) -- RECOMMANDE Phase B+
   - hERG specialized -- RECOMMANDE Phase B+
   - Clustering (Butina) -- optionnel
   Chaque checkbox porte un badge "Recommended" selon la phase.
4. Bouton "Launch Run"

## 5.6 Interface d'optimisation (Phase C uniquement)

Identique a l'actuelle OptimizationView :
- Selection d'une molecule
- Scaffold analysis (R-groups)
- Configuration : n_iterations, variants_per_iter, weights, structural rules
- Execution : generation + docking + scoring iteratif
- Resultats : graphe d'evolution, tableau des variants
Les molecules generees sont ajoutees a la table molecules de la campagne avec source="generated".

---

# 6. LA REGLE UNIQUE DE SELECTION ET TRANSITION

## La Regle

> Une phase se termine quand l'utilisateur FREEZE une selection "for next phase".
> Le freeze est irreversible. Les molecules selectionnees deviennent l'entree de la phase suivante.
> Au sein d'une phase, les selections "for next run" sont des bookmarks temporaires reutilisables.

### En detail

1. DANS une phase : l'utilisateur peut creer autant de runs qu'il veut. Chaque run enrichit la table molecules. Il peut taguer des molecules "select for next run" -- c'est un bookmark modifiable, pas un freeze.

2. Quand il cree un nouveau run dans la meme phase, il peut choisir comme input :
   - Une source externe (nouvelles molecules)
   - Les molecules taguees "select for next run" d'un ou plusieurs runs precedents
   - Toutes les molecules de la phase (pas de filtre)

3. POUR PASSER a la phase suivante : il selectionne des molecules et clique "Freeze for next phase". C'est irreversible. Les molecules selectionnees (avec toutes leurs colonnes calculees) sont copiees dans la phase suivante comme point de depart.

4. La phase suivante est automatiquement ouverte avec ces molecules pre-chargees.

5. Exception Phase C (Lead Optimization) : pas de freeze necessaire. Le "livrable" est le rapport PDF final ou l'export CSV/SDF.

### Simplification UX

Deux boutons seulement dans la toolbar de selection :
- "Bookmark for next run" (etoile jaune) : tag modifiable, interne a la phase
- "Freeze for next phase" (verrou vert) : irreversible, ouvre la phase suivante

---

# 7. SYSTEME DE CALCULS

## 7.1 Run types

Chaque run correspond a un ou plusieurs "calculs" cochables :

| Run Type | Description | Etapes pipeline existantes reutilisees |
|----------|-------------|----------------------------------------|
| docking | Docking moleculaire | dock_all_ligands() (gnina/gpu/vina) |
| admet | Prediction ADMET | pipeline/admet.py |
| scoring | Scoring composite | pipeline/scoring.py + scoring_rapid.py |
| enrichment | ProLIF + off-target + retro | interaction_analysis + off_target + retrosynthesis |
| generation | Generation de novo | pipeline/generation.py + lead_optimization.py |
| clustering | Clustering Butina | pipeline/scoring.py (cluster_results) |
| full_screen | Pipeline complet (legacy) | tasks.py run_pipeline complet |

Le type "full_screen" correspond au job actuel -- mode compatibilite arriere.

## 7.2 Cache et incremental

### Principe : cle de cache = (smiles, calcul_type, parametres_hash)

Pour chaque molecule, avant de lancer un calcul :
1. Calculer le hash : sha256(smiles + calcul_type + json(params))
2. Chercher dans la table calculation_cache
3. Si present : reutiliser le resultat (pas de recalcul)
4. Si absent : calculer, stocker dans le cache

### Cas d'usage

Cas 1 : memes molecules, meme docking -> cache hit, 0 calcul
Cas 2 : memes molecules, docking + ADMET -> docking cached, ADMET calcule
Cas 3 : nouvelles molecules -> tout calcule
Cas 4 : memes molecules, docking avec exhaustiveness different -> nouveau hash, recalcul

### Colonnes configurables par phase

L'utilisateur peut configurer quelles colonnes sont affichees dans le dashboard.
Un preset par phase est fourni par defaut (voir section 5.2).
L'utilisateur peut ajouter/retirer des colonnes via un panneau "Column settings".

---

# 8. MODULE MODEL FACTORY (prevu V10)

Note : ce module est documente ici pour reference mais ne sera pas implemente en V9.
Un placeholder (page/onglet) sera visible dans l'UI avec un message "Coming in V10".

## 8.1 Concept

Permettre a l'utilisateur de :
1. Importer des donnees experimentales (CSV IC50 ou depuis ChEMBL)
2. Entrainer un modele SAR (Structure-Activity Relationship) ligand-only
3. Utiliser ce modele comme critere de scoring additionnel dans les runs

## 8.2 Trois niveaux de modeles

Niveau 1 : Modele global generique
- Pre-entraine sur tout ChEMBL
- Utilisable immediatement, sans donnees utilisateur
- Usage : pre-filtrage large (eliminer les composes clairement inactifs)

Niveau 2 : Modele famille / proteines similaires
- Transfer learning depuis le modele global
- Fine-tune sur des donnees IC50 de cibles proches (via Target Similarity Agent)
- Usage : re-ranking informer meme sans IC50 sur la cible exacte

Niveau 3 : Modele target-specific
- Fine-tune sur les IC50 utilisateur (importes ou ChEMBL)
- Usage : prediction IC50, scoring de confiance, ranking

## 8.3 Artefact modele

Chaque modele entraine est un artefact versionne :
- Stocke dans la base (ou S3)
- Associe a une campagne
- Reutilisable dans plusieurs runs
- Versionne (v1, v2, v3...) pour comparaison

---

# 9. SCHEMA DE BASE DE DONNEES SUPABASE

## 9.1 Tables principales

`sql
-- Utilisateurs (migre de UserORM)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Projets (migre de ProjectORM, enrichi)
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Campagnes (NOUVEAU)
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    -- Target config (migre de ProjectORM + TargetSetup)
    uniprot_id TEXT,
    sequence TEXT,
    structure_source TEXT, -- pdb_experimental | alphafold | esmfold
    structure_pdb_path TEXT,
    pocket_center FLOAT[3],
    pocket_size FLOAT[3],
    pocket_method TEXT, -- p2rank | co-crystallized | manual
    -- Data source defaults
    default_sources JSONB, -- {chembl: true, zinc: false, pubchem: false}
    default_filters JSONB, -- {ic50_max: 10000, mw_range: [100,600], logp_range: [-2,5]}
    -- Status
    current_phase TEXT DEFAULT 'hit_discovery', -- hit_discovery | hit_to_lead | lead_optimization
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Phases (NOUVEAU)
CREATE TABLE phases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) NOT NULL,
    phase_type TEXT NOT NULL, -- hit_discovery | hit_to_lead | lead_optimization
    status TEXT DEFAULT 'active', -- active | frozen | completed
    frozen_at TIMESTAMPTZ,
    column_preset JSONB, -- colonnes affichees par defaut
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Runs (remplace JobORM)
CREATE TABLE runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phase_id UUID REFERENCES phases(id) NOT NULL,
    campaign_id UUID REFERENCES campaigns(id) NOT NULL, -- denormalise pour perf
    name TEXT NOT NULL,
    run_type TEXT NOT NULL, -- docking | admet | scoring | enrichment | generation | clustering | full_screen
    status TEXT DEFAULT 'queued', -- queued | running | completed | failed
    progress INT DEFAULT 0,
    current_step TEXT DEFAULT 'Queued',
    -- Configuration
    params JSONB NOT NULL DEFAULT '{}', -- parametres specifiques au run type
    input_source JSONB, -- {type: "external", source: "chembl", filters: {...}} ou {type: "runs", run_ids: [...], selection: "bookmarked"}
    calculations JSONB, -- ["docking", "admet", "scoring"] -- calculs selectionnes
    -- Resultats meta
    n_molecules_input INT DEFAULT 0,
    n_molecules_output INT DEFAULT 0,
    error_message TEXT,
    pipeline_summary JSONB,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- Molecules (NOUVEAU - table denormalisee pour perf)
CREATE TABLE molecules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) NOT NULL,
    smiles TEXT NOT NULL,
    inchi_key TEXT, -- identifiant unique chimique
    name TEXT,
    source TEXT, -- chembl | zinc | pubchem | custom | generated
    source_id TEXT, -- ChEMBL ID ou ZINC ID
    -- Phase tracking
    current_phase TEXT, -- dans quelle phase cette molecule est
    -- Selection flags
    bookmarked_for_run BOOLEAN DEFAULT FALSE,
    frozen_for_phase BOOLEAN DEFAULT FALSE,
    selected_for_optimization BOOLEAN DEFAULT FALSE,
    -- Identifiers
    created_at TIMESTAMPTZ DEFAULT now(),
    -- INDEX pour recherche rapide
    UNIQUE(campaign_id, inchi_key)
);

-- Molecule properties (colonnes calculees par les runs)
-- Approche JSONB pour flexibilite (vs colonnes fixes)
CREATE TABLE molecule_properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    molecule_id UUID REFERENCES molecules(id) NOT NULL,
    run_id UUID REFERENCES runs(id) NOT NULL,
    property_name TEXT NOT NULL, -- ex: vina_score, cnn_score, oral_bioavailability
    property_value FLOAT,
    property_text TEXT, -- pour valeurs non-numeriques
    property_json JSONB, -- pour valeurs complexes (ex: admet detail, interactions)
    created_at TIMESTAMPTZ DEFAULT now(),
    -- INDEX pour requetes rapides
    UNIQUE(molecule_id, run_id, property_name)
);
CREATE INDEX idx_molprops_mol ON molecule_properties(molecule_id);
CREATE INDEX idx_molprops_run ON molecule_properties(run_id);
CREATE INDEX idx_molprops_name ON molecule_properties(property_name);

-- Cache de calculs
CREATE TABLE calculation_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key TEXT UNIQUE NOT NULL, -- sha256(smiles + calc_type + params_hash)
    calc_type TEXT NOT NULL,
    result_json JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_cache_key ON calculation_cache(cache_key);

-- Artefacts (fichiers : PDB, SDF, rapports PDF)
CREATE TABLE artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES runs(id),
    campaign_id UUID REFERENCES campaigns(id),
    artifact_type TEXT NOT NULL, -- pdb | sdf | pdf | csv | model
    file_path TEXT NOT NULL,
    file_size INT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Models (prevu V10 - Model Factory)
CREATE TABLE models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id),
    model_type TEXT NOT NULL, -- global | family | target_specific
    version INT DEFAULT 1,
    status TEXT DEFAULT 'draft', -- draft | training | ready | failed
    config_json JSONB,
    metrics_json JSONB, -- R2, RMSE, etc.
    file_path TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
`

## 9.2 Strategie molecule_properties

Deux approches possibles :

Option A (JSONB sur molecules) : ajouter une colonne JSONB "properties" sur la table molecules qui contient tous les calculs. Simple mais pas queryable par propriete.

Option B (table molecule_properties EAV) : table Entity-Attribute-Value comme ci-dessus. Flexible, queryable, mais plus de JOINs.

RECOMMANDATION : Option hybride.
- Les proprietes les plus communes (affinity, cnn_score, composite_score, qed, mw) sont des colonnes directes sur la table molecules (ALTER TABLE ADD COLUMN au fur et a mesure).
- Les proprietes complexes (admet detail, interactions, off_target) sont en JSONB dans molecule_properties.
- La table molecule_properties sert de "overflow" et d'historique (quel run a calcule quoi).

---

# 10. API ENDPOINTS

## 10.1 Nouveaux endpoints

Campaigns :
POST /api/projects/:pid/campaigns - Creer campagne
GET /api/projects/:pid/campaigns - Lister campagnes
GET /api/campaigns/:cid - Detail campagne
PUT /api/campaigns/:cid - Modifier config

Phases :
GET /api/campaigns/:cid/phases - Lister phases
GET /api/phases/:phid - Detail phase (runs + molecules)
POST /api/phases/:phid/freeze - Freeze selection -> ouvre phase suivante

Runs :
POST /api/phases/:phid/runs - Creer et lancer un run
GET /api/phases/:phid/runs - Lister runs
GET /api/runs/:rid - Detail run
GET /api/runs/:rid/results - Resultats run

Molecules :
GET /api/campaigns/:cid/molecules - Liste paginee (filtres, tri, colonnes)
PUT /api/molecules/:mid/bookmark - Toggle bookmark
POST /api/phases/:phid/freeze-selection - Freeze molecules
GET /api/campaigns/:cid/molecules/export - Export CSV/SDF

Optimization (Phase C) :
POST /api/phases/:phid/optimize - Lancer optimisation
GET /api/optimizations/:oid - Status

Columns :
GET /api/phases/:phid/columns - Colonnes configurees
PUT /api/phases/:phid/columns - Modifier preset

## 10.2 Endpoints conserves (backward compat)

POST /api/jobs -> redirige vers run full_screen
GET /api/jobs/:id -> GET /api/runs/:id
GET /api/jobs/:id/results -> GET /api/runs/:id/results
POST /api/preview-target -> inchange
POST /api/preview-sequence -> inchange
POST /api/target-assessment -> inchange
POST /api/molecule/analyze-scaffold -> inchange
GET /api/health -> inchange
Auth endpoints -> inchanges

---

# 11. STRATEGIE FRONTEND

## 11.1 Principe : evolution, pas revolution

### Composants conserves tels quels
AuthContext, LoginPage, RegisterPage, Viewer3D, MoleculeCard, ADMETRadar,
InteractionView, InteractionDiagram, SafetyReport, ConfidenceBreakdown,
SynthesisTree, ScaffoldAnalyzer, OptimizationView (Phase C only),
ParetoFront, ClusterView, ScoringWeights, MethodologyPage, ReferencesPage

### Composants modifies
SidebarLayout : navigation Campaign > Phase
ResultsDashboard : column presets + selection toolbar + panel 3D drawer
InputForm : transform en RunCreator (sources, calculs, parametres)
ProjectContext : enrichi avec campaigns, phases, runs
HitSelectionContext : renomme SelectionContext (bookmark/freeze)

### Nouveaux composants
CampaignContext, PhaseSelector (tabs), RunCreator (modal),
ColumnConfigurator, SelectionToolbar, Viewer3DDrawer

## 11.2 Routing

/ -> ProjectListPage
/project/:pid -> ProjectOverview (liste campagnes)
/project/:pid/campaign/:cid -> CampaignView (tabs phases)
/project/:pid/campaign/:cid/phase/:type -> PhaseDashboard
/project/:pid/campaign/:cid/optimization -> OptimizationView
/project/:pid/reports -> Reports

---

# 12. MAPPING FEATURES EXISTANTES

Feature -> Composant actuel -> Destination V9

Project creation -> ProjectListPage -> INCHANGE
Target setup -> TargetSetup.jsx -> Campaign creation
Pocket selection -> TargetSetup.jsx -> Campaign config
Job creation -> InputForm.jsx -> RunCreator.jsx
Pipeline execution -> tasks.py run_pipeline -> Run execution par type
Results table -> ResultsDashboard.jsx -> PhaseDashboard (presets)
3D viewer -> Viewer3D.jsx -> Viewer3DDrawer (panel lateral)
Molecule card -> MoleculeCard.jsx -> INCHANGE
Hit tagging -> HitSelector.jsx -> SelectionToolbar (bookmark/freeze)
Pareto front -> ParetoFront.jsx -> INCHANGE (sous dashboard)
Cluster view -> ClusterView.jsx -> INCHANGE
ADMET radar -> ADMETRadar.jsx -> INCHANGE
Interactions ProLIF -> InteractionView.jsx -> INCHANGE
Safety report -> SafetyReport.jsx -> INCHANGE
Synthesis tree -> SynthesisTree.jsx -> INCHANGE
Scaffold analysis -> ScaffoldAnalyzer.jsx -> Phase C only
Optimization -> OptimizationView.jsx -> Phase C only
Report PDF -> ReportPreview.jsx -> INCHANGE
Agent chat -> AgentChat.jsx -> INCHANGE
Auth (JWT) -> AuthContext.jsx -> INCHANGE (Supabase Auth en V10)

---

# 13. BACKLOG

## Epic 1 : Infrastructure Supabase (2-3j)
S1.1 Setup Supabase (hosted ou Docker local)
S1.2 Migration SQLAlchemy -> Supabase Python client
S1.3 Script migration donnees SQLite -> Postgres

## Epic 2 : Modele Campaign/Phase/Run (3-4j)
S2.1 Tables campaigns, phases, runs
S2.2 API CRUD campaigns
S2.3 Auto-creation 3 phases par campagne
S2.4 API CRUD runs
S2.5 Execution run par type (encapsulation pipeline existant)

## Epic 3 : Table molecules + incremental (3-4j)
S3.1 Table molecules + properties dans Supabase
S3.2 API molecules paginee avec filtres et tri
S3.3 Cache de calculs (hash smiles+type+params)
S3.4 Sources avec filtres avances (IC50, MW, logP)

## Epic 4 : Selection et transitions (2-3j)
S4.1 Bookmark molecules pour next run
S4.2 Freeze selection pour next phase (irreversible)
S4.3 Input run depuis selections precedentes

## Epic 5 : Frontend refonte progressive (5-7j)
S5.1 Sidebar navigation Campaign > Phase
S5.2 PhaseSelector tabs + column presets
S5.3 RunCreator modal
S5.4 SelectionToolbar (bookmark + freeze)
S5.5 Viewer3D drawer lateral
S5.6 Generation de novo restreinte Phase C

## Epic 6 : Backward compat + polish (2j)
S6.1 POST /api/jobs legacy -> run full_screen
S6.2 Migration projets existants
S6.3 Tests E2E P00533 parcours complet

Total estime : 5 semaines (1 dev senior)

---

# 14. PLAN DE MIGRATION PROGRESSIF

Phase M1 (semaine 1) : Fondations
- Setup Supabase, schema DB, API campaigns/phases/runs, migration donnees

Phase M2 (semaine 2) : Execution
- Run par type, table molecules, cache calculs, sources avec filtres

Phase M3 (semaines 3-4) : Frontend
- Sidebar, RunCreator, SelectionToolbar, column presets, Viewer3D drawer

Phase M4 (semaine 5) : Polish
- Backward compat, migration projets, tests E2E, documentation

---

# 15. EXEMPLES CONCRETS DE CAMPAGNES

## Exemple 1 : Kinase EGFR avec docking + boucle optimisation

Projet "EGFR Resistance Program" > Campaign "T790M Mutant Inhibitors"
Target : P00533, PDB 4HJO, pocket ATP-binding. Sources : ChEMBL actifs IC50<10uM + ZINC 200 mols

Phase A - Hit Discovery :
  Run 1 "Initial Screen" : docking GPU + ADMET + scoring -> 450 mols, top 50
  Run 2 "Re-score" : scoring poids affinite 0.5 -> selection 30 mols
  Freeze 30 molecules -> Phase B

Phase B - Hit-to-Lead :
  Run 3 "Safety" : off-target + hERG + retro -> 5 eliminees, 25 restantes
  Run 4 "Interactions" : ProLIF -> 15 mols avec H-bond MET793
  Freeze 15 molecules -> Phase C

Phase C - Lead Optimization :
  Run 5 "Optimize mol 1" : 200 variants, 10 iter -> score 72->89
  Run 6 "Optimize mol 3" : meilleure selectivite
  Export PDF final

## Exemple 2 : Cible sans IC50, family model + docking

Projet "Novel GPR Target" > Campaign "GPR142 Agonists"
Target : Q7Z601, AlphaFold (pas de PDB). Sources : ZINC 500 mols + 50 SMILES custom

Phase A - Hit Discovery :
  Run 1 "Broad docking" : GNINA GPU + ADMET -> 550 mols
  Run 2 "Cluster + filter" : Butina + cutoffs -> 12 familles, 80 passent
  Freeze 40 mols (top 3/cluster) -> Phase B

Phase B - Hit-to-Lead :
  Run 3 "Enrichment" : off-target + interactions + retro -> 32 restantes
  Run 4 (V10) "Family model scoring" : re-rank avec modele famille GPCRs
  Freeze 10 mols -> Phase C

Phase C - Lead Optimization :
  Run 5 : generation analogs top 3. Export.

---

# 16. RISQUES ET POINTS OUVERTS

## Risques

R1. Performance EAV molecule_properties avec 500K lignes
  -> Mitigation : colonnes communes en direct sur molecules, indexes, pagination

R2. Migration Supabase change le deploiement
  -> Mitigation : Supabase local Docker possible, migration progressive

R3. Complexite frontend (Campaign/Phase/Run = profondeur navigation)
  -> Mitigation : sidebar fixe, breadcrumbs, dashboard unique

R4. Backward compat (anciens jobs)
  -> Mitigation : endpoint legacy, migration auto projets

R5. Generation de novo restreinte a Phase C (surprise utilisateurs)
  -> Mitigation : message explicatif, lien Phase C

## Points ouverts

PO1. Supabase hosted vs local Docker ?
PO2. Migrer vers Supabase Auth ou garder JWT custom ?
PO3. Model Factory V10 : quel framework ML ?
PO4. Contre-cibles : campagne separee ou config dans la meme ?
PO5. Multi-utilisateurs : partage projet, roles ?
PO6. Real-time Supabase pour progress runs vs polling ?

---

FIN DU CDC V9
Document genere le 24 fevrier 2026.
