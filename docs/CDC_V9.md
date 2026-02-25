# BindX V9 — Cahier des Charges Produit
## Refonte structurelle : Project > Campaign > Phase > Run

**Version** : 9.0 — CDC Final
**Date** : 25 fevrier 2026
**Auteur** : Anthony Boisbouvier + Claude Opus 4.6

---

## 1. Vision produit

BindX est une plateforme open-source de drug discovery in silico. La V9 transforme le pipeline monolithique actuel (1 job = tout) en une architecture modulaire pensee pour le workflow reel d'un chimiste computationnel :

- **Project** : une cible therapeutique
- **Campaign** : une strategie d'exploration (cible + pocket + regles)
- **Phase** : une etape du funnel (Hit Discovery > Hit-to-Lead > Lead Optimization)
- **Run** : une unite de calcul atomique qui enrichit le dashboard de la phase

**Principe fondamental** : le dashboard de la phase est la vue centrale. Chaque run ajoute des colonnes (proprietes calculees) aux molecules. L'utilisateur travaille toujours dans un seul tableau qui s'enrichit progressivement.

---

## 2. Personas

### Chimiste computationnel (utilisateur principal)
Expert drug discovery. Lance des campagnes de screening virtuel, selectionne des hits, optimise des leads. Veut un outil rapide, pas de friction, des resultats exploitables immediatement.

### Bioinformaticien
Prepare les structures proteiques, configure les poches de binding. Veut du controle sur les parametres techniques.

### Chef de projet pharma
Suit l'avancement des campagnes, compare les phases, exporte les resultats pour les comites.

---

## 3. Modele conceptuel

### 3.1 PROJECT
Conteneur organisationnel. 1 projet = 1 cible therapeutique principale.

| Champ | Description |
|-------|-------------|
| name | Nom du projet (ex: EGFR Inhibitors) |
| description | Contexte scientifique |
| target | Cible principale (proteine, PDB ID) |
| status | active, completed, archived |

V10 : support multi-cibles par projet (polypharmacologie).

### 3.2 CAMPAIGN
Programme scientifique concret. Definit la strategie d'exploration.

| Champ | Description |
|-------|-------------|
| project_id | FK vers Project |
| name | Nom (ex: ATP pocket - Chembl screening) |
| target_config | Cible + pocket selectionnee |
| scoring_weights | Poids par defaut du scoring composite |
| docking_defaults | Parametres par defaut (box size, exhaustiveness) |
| rules | Regles globales (filtres Lipinski, PAINS, etc.) |

- 1 campagne par defaut a la creation du projet
- UI pour en ajouter (pas prioritaire V9)
- La campagne choisit UNE cible + UNE pocket du projet
### 3.3 PHASE
Etape du funnel de drug discovery. L'utilisateur cree chaque phase quand il en a besoin.

| Type | Objectif | Input typique |
|------|----------|---------------|
| A — Hit Discovery | Trouver des hits dans une librairie | Librairie externe (SDF/SMILES) |
| B — Hit-to-Lead | Optimiser les hits, generer des analogues | Molecules selectionnees de Phase A |
| C — Lead Optimization | Affiner les leads, ADMET, selectivite | Molecules selectionnees de Phase B |

Chaque phase possede :
- Un dashboard unique : tableau cumulatif de toutes les molecules + proprietes calculees par les runs
- Des presets de colonnes : colonnes visibles par defaut adaptees a la phase, full custom par l'utilisateur
- Un etat : active, frozen, completed

#### Freeze / Unfreeze
- Bookmark : tag interne, modifiable a tout moment
- Freeze : verrouille la selection bookmarkee, disponible comme input phase suivante
- Unfreeze : possible avec warning si la phase suivante a deja des runs

V10 : 1 instance par type par campagne en V9 (pas de phases multiples meme type).

### 3.4 RUN
Unite de calcul atomique. Un run = un type de calcul applique a une liste de molecules.

#### Types de run

| Type | Description | Colonnes ajoutees |
|------|-------------|-------------------|
| import | Importer des molecules (SDF, SMILES, source externe ou selection interne) | SMILES, name, source |
| docking | Docking moleculaire (Vina, GNINA, GNINA GPU) | docking_score, CNNscore, CNNaffinity, poses |
| admet | Proprietes ADMET | logP, solubility, BBB, hERG, metabolic_stability |
| scoring | Score composite pondere | composite_score |
| enrichment | Enrichissement (ProLIF, interactions, clusters) | interactions, cluster_id, scaffold |
| generation | Generation de novo (1 molecule -> iterations) | generation_level, parent_smiles, tous calculs |
| clustering | Analyse de diversite, scaffolds | cluster_id, scaffold_smiles, tanimoto |

#### Input d'un run
- Import : fichier SDF/SMILES externe OU selection de molecules internes
- Calcul : les lignes cochees dans le dashboard de la phase (selection manuelle)
- Pas de multi-source : un run prend soit un import externe, soit des cochees du dashboard
- Select all filtered : bouton selectionner toutes les molecules filtrees (pas juste les visibles)

#### Run generation — detail
Specifique aux Phases B et C :
- Input : 1 molecule cochee dans la phase
- Output : N molecules generees avec TOUS les calculs coches par defaut (docking + ADMET + scoring)
- Metadonnees : generation_level (0=originale, 1=gen1, 2=gen2...), parent_smiles pour tracer la lignee
- Chaque iteration ajoute des lignes dans le dashboard de la phase
- Config : toutes les options actuelles de generation disponibles

#### Cycle de vie d'un run
created -> queued -> running -> completed / failed
- Pas de suppression : archive seulement
- 1 run simultane par utilisateur en V9 (file d'attente visible)
- V10 : concurrence augmentee

#### Cache
Hash(smiles + run_type + params) -> resultat. Reutilisation sans relancer si deja calcule.
---

## 4. Dashboard Phase — La vue centrale

Le dashboard est LE lieu de travail de l'utilisateur. Tableau enrichi progressivement par les runs.

### 4.1 Principes
- 1 molecule = 1 ligne (dedupliquee par SMILES canonique)
- Chaque run ajoute des colonnes, pas des lignes (sauf import et generation)
- Presets de colonnes par phase, full custom
- Pas de filtre par run source en V9

### 4.2 Fonctionnalites du dashboard
- Tri : toutes colonnes, multi-sort
- Filtres : range sliders numeriques, texte categoriel
- Selection : checkbox par ligne + select all filtered + select bookmarked
- Bookmark : toggle par molecule
- Actions sur selection : New Run, Export, Bookmark All
- Vue 3D : clic molecule -> Viewer3D drawer lateral

### 4.3 Viewer 3D
- Drawer lateral 40%, table compressee a 60%
- Toggle plein ecran (overlay)
- Reutilise Viewer3D existant (NGL/3Dmol.js)
- Affiche : proteine + ligand pose + interactions ProLIF + surface pocket

### 4.4 Column presets par phase

Phase A — Hit Discovery :
SMILES, name, docking_score, CNNscore, logP, MW, HBD, HBA, TPSA, Lipinski_pass, bookmark

Phase B — Hit-to-Lead :
SMILES, name, docking_score, CNNscore, composite_score, generation_level, parent_smiles, cluster_id, scaffold, bookmark

Phase C — Lead Optimization :
SMILES, name, composite_score, logP, solubility, BBB, hERG, metabolic_stability, selectivity, interactions_count, bookmark

L'utilisateur peut ajouter/retirer n'importe quelle colonne disponible.

---

## 5. Scoring composite

### Niveau campagne
Poids par defaut : docking_score 0.3, CNNscore 0.2, logP 0.15, solubility 0.1, selectivity 0.15, novelty 0.1

### Override par run
Un run scoring peut utiliser des poids differents (composite_score_v2).

---

## 6. Agents IA

Operent au niveau campagne. Acces lecture : toutes phases, tous runs, toutes molecules.

Capacites :
- Analyser tendances cross-phases (attrition, enrichment factor)
- Recommander prochains runs
- Identifier scaffolds prometteurs
- Suggerer parametres scoring
- Alerter red flags ADMET

---

## 7. Optimisation multi-objectifs (Pareto)

Niveau phase : toutes les molecules de la phase.
Front de Pareto sur N objectifs, scatter/parallel coordinates, tag Pareto-optimales.

---

## 8. Export

Scope : selection cochee.

| Format | Contenu |
|--------|---------|
| CSV | Colonnes visibles, molecules cochees |
| SDF | Structures 3D + proprietes |
| PDF | Rapport synthetique campagne |

Raccourcis : Export bookmarked, Export Pareto.
---

## 9. Navigation & UX

### Sidebar gauche
Project: EGFR Inhibitors
  Campaign: ATP Pocket ChEMBL
    Phase A — Hit Discovery [active]
    Phase B — Hit-to-Lead [frozen]
    Phase C — Lead Optimization [locked]

### Flow principal
1. Creer projet (nom + cible PDB)
2. Campagne par defaut creee (choisir pocket)
3. Creer Phase A
4. Run import : charger librairie SDF
5. Run docking : docker toutes les molecules
6. Run ADMET : calculer proprietes
7. Run scoring : score composite
8. Dashboard : trier, filtrer, bookmarker hits
9. Freeze Phase A -> input Phase B
10. Creer Phase B, runs generation sur hits

### RunCreator (modal)
Remplace InputForm. Modal depuis dashboard :
- Etape 1 : Choix type de run
- Etape 2 : Configuration (moteur, parametres)
- Etape 3 : Confirmation (nb molecules, estimation temps)
- Lancement -> bandeau Run in progress + progress bar

### File d'attente
Run en cours -> message clair + run queued grise dans historique.

---

## 10. Infrastructure

### 10.1 Base de donnees — Supabase Cloud (PostgreSQL)

Schema SQL :

`sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  description TEXT,
  target_pdb_id TEXT,
  target_name TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  pocket_config JSONB,
  scoring_weights JSONB DEFAULT '{"docking_score":0.3,"CNNscore":0.2,"logP":0.15,"solubility":0.1,"selectivity":0.15,"novelty":0.1}',
  docking_defaults JSONB,
  rules JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('hit_discovery','hit_to_lead','lead_optimization')),
  status TEXT DEFAULT 'active',
  frozen_at TIMESTAMPTZ,
  column_presets JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID REFERENCES phases(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('import','docking','admet','scoring','enrichment','generation','clustering')),
  status TEXT DEFAULT 'created',
  config JSONB NOT NULL,
  input_molecule_ids UUID[],
  input_source TEXT,
  input_file_path TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE molecules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID REFERENCES phases(id) ON DELETE CASCADE,
  smiles TEXT NOT NULL,
  canonical_smiles TEXT NOT NULL,
  name TEXT,
  source_run_id UUID REFERENCES runs(id),
  bookmarked BOOLEAN DEFAULT false,
  generation_level INTEGER DEFAULT 0,
  parent_molecule_id UUID REFERENCES molecules(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(phase_id, canonical_smiles)
);

CREATE TABLE molecule_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  molecule_id UUID REFERENCES molecules(id) ON DELETE CASCADE,
  run_id UUID REFERENCES runs(id),
  property_name TEXT NOT NULL,
  property_value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(molecule_id, property_name, run_id)
);

CREATE TABLE calculation_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT UNIQUE NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES runs(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_molecules_phase ON molecules(phase_id);
CREATE INDEX idx_molecules_canonical ON molecules(phase_id, canonical_smiles);
CREATE INDEX idx_mol_props_molecule ON molecule_properties(molecule_id);
CREATE INDEX idx_mol_props_name ON molecule_properties(property_name);
CREATE INDEX idx_runs_phase ON runs(phase_id);
CREATE INDEX idx_cache_key ON calculation_cache(cache_key);
`

Performance EAV : index + vue materialisee pivot + limit 10k mols/phase V9.

### 10.2 Auth — Supabase Auth
Email/password, magic link, RLS toutes tables. SSO V10.

### 10.3 Stockage — Supabase Storage
Buckets : structures, artifacts, exports.

### 10.4 Backend — Celery + Redis
Conserve. Progress tracking via task state. Edge Functions V10 pour micro-calculs.

### 10.5 Docking Engine
Choix par run : Vina (CPU), GNINA (CPU CNN), GNINA GPU (RunPod serverless).
Auto-detection : RUNPOD_API_KEY -> GPU, sinon local -> mock.
---

## 11. Legacy V8

Projets V8 en lecture seule, vue legacy separee.
Route /legacy/projects/:id. Pas de migration auto. V9 = clean slate.

---

## 12. Mapping features existantes

| Feature V8 | Composant | V9 |
|------------|-----------|-----|
| Job pipeline monolithique | tasks.py | Runs par type |
| ResultsDashboard | ResultsDashboard.jsx | Dashboard Phase cumulatif |
| Viewer3D | Viewer3D.jsx | Drawer 40% + plein ecran |
| InputForm | InputForm.jsx | RunCreator modal |
| HitSelector | HitSelector.jsx | Bookmark + Freeze |
| ParetoFront | ParetoFront.jsx | Conserve, scope phase |
| OptimizationView | OptimizationView.jsx | Conserve, scope phase |
| ProLIF | InteractionAnalysis.jsx | Enrichment run |
| Scaffolds | ScaffoldAnalysis.jsx | Clustering run |
| Target assessment | TargetAssessment.jsx | Niveau campagne |
| Agents IA | AgentPanel.jsx | Campagne, cross-phases |
| Export | ExportButton.jsx | Selection cochee |
| MoleculeCard | MoleculeCard.jsx | Drawer 3D |

---

## 13. Composants frontend

Conserves : Viewer3D, MoleculeCard, ParetoFront, OptimizationView, InteractionAnalysis, ScaffoldAnalysis, TargetAssessment

Modifies :
- ResultsDashboard -> Dashboard Phase
- InputForm -> RunCreator modal
- Sidebar -> Arbre Project > Campaign > Phase

Nouveaux :
- CampaignContext : header persistent
- PhaseSelector : onglets Phase A/B/C
- SelectionToolbar : New Run, Export, Bookmark All
- RunProgress : bandeau progression
- RunHistory : liste runs + statut
- FreezeDialog : confirmation avec warnings
- QueueIndicator : message file attente

---

## 14. API Endpoints

### V9
POST/GET /api/v9/projects
GET/PUT/DELETE /api/v9/projects/:id
POST/GET /api/v9/projects/:id/campaigns
GET/PUT /api/v9/campaigns/:id
POST/GET /api/v9/campaigns/:id/phases
GET/PUT /api/v9/phases/:id
POST /api/v9/phases/:id/freeze
POST /api/v9/phases/:id/unfreeze
POST/GET /api/v9/phases/:id/runs
GET /api/v9/runs/:id
GET /api/v9/runs/:id/progress
GET /api/v9/phases/:id/molecules
PUT /api/v9/molecules/:id/bookmark
GET /api/v9/phases/:id/molecules/export
POST /api/v9/campaigns/:id/agent/analyze
GET /api/v9/campaigns/:id/agent/recommendations
POST /api/v9/phases/:id/pareto

### Legacy
GET /api/legacy/projects, /projects/:id, /projects/:id/jobs, /jobs/:id/results

---

## 15. Backlog (7 semaines)

Epic 1 — Fondations Supabase (S1-S2) : setup, schema, migration SQLAlchemy, auth
Epic 2 — Modele Project/Campaign/Phase (S2-S3) : CRUD, freeze/unfreeze
Epic 3 — Runs par type (S3-S4) : import, docking, ADMET, scoring, enrichment, generation, clustering, cache, queue
Epic 4 — Dashboard Phase (S4-S5) : table cumulative, selection, bookmark, presets, viewer 3D
Epic 5 — Navigation UX (S5-S6) : sidebar, RunCreator, RunProgress, RunHistory
Epic 6 — Polish Legacy (S6-S7) : legacy view, agents, Pareto, export, tests

---

## 16. Exemple — EGFR Kinase

Projet EGFR Inhibitors (PDB 1M17)
Campagne ATP Pocket ChEMBL (residus 718-860)

Phase A : import 2000 mols -> docking GPU 3min -> ADMET 30s -> scoring -> bookmark top 50 -> freeze
Phase B : generation sur hits -> 250 mols -> Pareto -> 15 leads -> freeze
Phase C : ADMET detaille -> enrichment ProLIF -> 15 leads profil complet -> export PDF

---

## 17. Risques

| Risque | Mitigation |
|--------|------------|
| EAV lent >5k mols | Vue materialisee + limit 10k |
| Migration Supabase | Schema pret, bonne doc |
| Navigation 4 niveaux | Sidebar + header persistent |
| Freeze edge cases | Warnings explicites |
| RunPod cold start | Indicateur warming up + fallback CPU |
| Trop de colonnes | Presets + colonnes cachees |

---

## 18. Model Factory (V10)

3 niveaux : Global, Famille, Target-specific. Prediction activite sans docking.

---

## 19. Decisions consolidees

| # | Decision |
|---|----------|
| Q1 | Cible = niveau projet |
| Q2 | Campagne = cible + pocket |
| Q3 | 1 campagne defaut, ajout possible |
| Q4 | Phases creation manuelle |
| Q5 | 1 phase par type en V9 |
| Q6 | Freeze reversible avec warning |
| Q7 | Input = lignes cochees dashboard |
| Q8 | 1 source par run |
| Q9 | Run import valide |
| Q10 | Colonnes partagees, presets par phase |
| Q11 | 1 mol = 1 ligne dedup |
| Q12 | Pas filtre par run V9 |
| Q13 | Viewer 40% + plein ecran |
| Q14 | Presets full custom |
| Q15 | Generation = run type separe |
| Q16 | Supabase Cloud |
| Q17 | Supabase Auth |
| Q18 | Supabase Storage |
| Q19 | Celery + Redis |
| Q20 | Legacy lecture seule |
| Q21 | Scoring defauts campagne, override run |
| Q22 | Pareto niveau phase |
| Q23 | Agents niveau campagne |
| Q24 | Export = selection cochee |
| Q25 | Docking engine par run |
| Q26 | Archive seulement |
| Q27 | 1 run simultane V9 |

---

*Fin du CDC BindX V9 — Pret pour implementation.*