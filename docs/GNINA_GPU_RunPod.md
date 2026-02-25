# BindX -- GNINA GPU RunPod Integration Spec
## Docking GPU serverless via RunPod
### Date : 23 fevrier 2026

---

## 0. CONTEXTE

### Situation actuelle
- `docking.py` supporte 3 engines : `gnina` (local CPU), `vina` (local CPU), `mock` (fallback)
- GNINA local fonctionne mais est LENT en CPU (~30-60s par molecule, pas de CNN GPU acceleration)
- Le CNN scoring de GNINA est ~10x plus rapide sur GPU que CPU
- Le docking massif (500+ molecules, mode deep) prend des heures en CPU

### Ce qui existe deja
- Endpoint RunPod serverless : `weeeiy6z4jdsv3` (nom: gnina-docking)
- Template : `eg9eagm693` (nom: gnina-gpu, image: ghcr.io/anthonyboisbouvier-paris/gnina-runpod:latest)
- GPU : AMPERE_16 (RTX A4000 16GB), 0 min workers, 1 max worker
- Repo GitHub : github.com/anthonyboisbouvier-paris/gnina-runpod
- TESTE ET FONCTIONNEL : 3 poses dockees en 2.49s GPU

### API RunPod endpoint
POST https://api.runpod.ai/v2/weeeiy6z4jdsv3/run
Authorization: Bearer RUNPOD_API_KEY

Input: receptor_pdb (string PDB), ligand_sdf (string SDF multi-mol), center_x/y/z, size_x/y/z, exhaustiveness, num_modes, cnn_scoring
Output: results (rank, minimizedAffinity, CNNscore, CNNaffinity), docked_sdf, n_molecules, elapsed_seconds, gpu_used

### Contraintes
- Cold start : ~60-150s (image 6GB, premier appel apres idle)
- Payload max : ~10MB. Pour >500 molecules, splitter en batches.
- Timeout : 600s par defaut.
- Cout : ~0.30 USD/h GPU. ~0.03 USD pour 50 molecules.

---

## 1. ARCHITECTURE CIBLE

Avant (CPU only) : dock_all_ligands() boucle sur chaque molecule -> gnina local CPU (~30-60s chacune). 50 mols = ~25-50 min.
Apres (GPU RunPod) : dock_all_ligands() -> prepare SDF combine -> 1 seul appel RunPod batch -> GPU (~30-120s). 50 mols = ~2-5 min.

### Principe cle : BATCH au lieu de ONE-BY-ONE
Actuellement : 1 appel subprocess gnina par molecule (sequentiel).
Cible : 1 seul appel RunPod avec TOUTES les molecules en un SDF multi-molecule.
GNINA gere nativement les SDF multi-molecule et les docke en parallele sur GPU.

---

## 2. NOUVEAU ENGINE : gnina_gpu

### Engines disponibles apres implementation
- gnina : GNINA local CPU (actuel, inchange)
- vina : AutoDock Vina local CPU (actuel, inchange)
- gnina_gpu : GNINA sur RunPod GPU (NOUVEAU)
- mock : Hash-based mock (actuel, inchange)
- auto : gnina_gpu si RUNPOD_API_KEY set, sinon gnina local, sinon vina, sinon mock

### Logique auto mise a jour
Priorite : GPU si dispo > local GNINA > local Vina > mock.
Si GPU echoue -> fallback transparent vers local.

### Batch docking GPU (le vrai gain)
Dans dock_all_ligands(), AVANT la boucle sequentielle :
Si engine GPU et RunPod disponible -> appeler dock_all_runpod_batch().
Sinon -> boucle sequentielle actuelle (inchange).

---

## 3. IMPLEMENTATION : backend/pipeline/docking_gpu.py (NOUVEAU)

Nouveau fichier dedie (~150 lignes). Fonctions :

### is_gpu_available()
Check RUNPOD_API_KEY et GNINA_ENDPOINT_ID dans env vars. Return bool.

### dock_batch_gpu(receptor_pdb_content, ligands_sdf_content, center, size, exhaustiveness, num_modes)
1. POST payload vers RunPod /run
2. Poll /status/{job_id} toutes les 5s
3. Timeout 600s
4. Return dict avec results, docked_sdf, n_molecules, elapsed_seconds, error

### dock_all_runpod_batch(receptor_pdbqt, ligands, center, work_dir, progress_callback, size, exhaustiveness)
1. Lire receptor PDB content (preferer .pdb a .pdbqt)
2. Pour chaque ligand : SMILES -> RDKit Mol -> 3D EmbedMolecule -> MolToMolBlock -> SDF block
3. Concatener tous les SDF blocks
4. Splitter en batches de 100 molecules max (payload ~10MB limite)
5. Pour chaque batch : appeler dock_batch_gpu()
6. Parser resultats : num_modes poses par molecule, prendre best (rank 1)
7. Mapper champs : minimizedAffinity->vina_score, CNNscore->cnn_score, CNNaffinity->cnn_affinity
8. Appliquer consensus_rank() (importe de docking.py)
9. Retourner dans meme format que dock_all_ligands()

### Variables d environnement
RUNPOD_API_KEY (obligatoire pour GPU)
GNINA_ENDPOINT_ID (default: weeeiy6z4jdsv3)
RUNPOD_TIMEOUT = 600s
BATCH_SIZE = 100

---

## 4. MODIFICATIONS FICHIERS EXISTANTS

### 4.1 backend/pipeline/docking.py
- Import en haut : from pipeline.docking_gpu import is_gpu_available, dock_all_runpod_batch
- Dans dock_all_ligands(), AVANT la boucle for : ajouter check GPU batch
- Si GPU echoue : logger.warning + continuer vers boucle locale
- ~10 lignes ajoutees, zero lignes modifiees

### 4.2 backend/models.py (3 endroits)
- Ligne ~187 (JobCreate.docking_engine) : ajouter gnina_gpu dans description
- Ligne ~429 (DockingResult.docking_engine) : ajouter gnina_gpu dans commentaire
- Ligne ~550 (OptimizeRequest.docking_engine) : ajouter gnina_gpu dans description

### 4.3 backend/tasks.py
- Ligne ~634, engine_label dict, ajouter : "gnina_gpu": "GNINA GPU (RunPod)"
- Modifier "auto" en : "Auto (GPU/GNINA/Vina)"

### 4.4 docker-compose.yml
- Dans celery_worker.environment, ajouter :
  RUNPOD_API_KEY et GNINA_ENDPOINT_ID (avec defaults vides/weeeiy6z4jdsv3)

### 4.5 .env
- Ajouter : RUNPOD_API_KEY=rpa_YOUR_RUNPOD_API_KEY
- Ajouter : GNINA_ENDPOINT_ID=weeeiy6z4jdsv3

### 4.6 frontend/src/components/InputForm.jsx
- Ajouter radio button GNINA GPU entre GNINA local (~ligne 414) et Vina (~ligne 432)
- Couleur verte (#22c55e) pour distinguer du bleu local
- Icone eclair, sous-texte "Cloud GPU - 10x faster, ~0.03 USD/run"

---

## 5. GESTION DES ERREURS ET FALLBACK

### Hierarchie
gnina_gpu -> echoue -> gnina local CPU -> echoue -> vina -> echoue -> mock
auto -> GPU si RUNPOD_API_KEY -> sinon gnina local -> sinon vina -> sinon mock

### Erreurs RunPod
1. Pas de credits (402) -> fallback local + log warning
2. Queue pleine / timeout -> fallback local
3. Handler crash (FAILED) -> fallback local + log error
4. Payload >10MB -> splitter en batches plus petits
5. Network error -> fallback local

### Cold start UX
Si >30s en IN_QUEUE : afficher "GPU warming up (~60s)..." dans progress_callback.

---

## 6. PERFORMANCE

GNINA GPU RunPod : 50 mols ~2-5 min, 500 mols ~20-30 min, cout ~0.03-0.15 USD
GNINA local CPU : 50 mols ~25-50 min, 500 mols ~4-8h, cout 0
Vina local CPU : 50 mols ~15-30 min, 500 mols ~2-5h, cout 0
Mock : 50 mols ~1s, 500 mols ~5s, cout 0

---

## 7. SECURITE

- RUNPOD_API_KEY dans .env (gitignored)
- Fichiers PDB/SDF transitent HTTPS (TLS)
- Handler RunPod ephemere (rien stocke)
- Pas de donnees personnelles

---

## 8. TESTS

### Test unitaire
- is_gpu_available() == True quand env vars set, False sinon
- dock_batch_gpu() avec EGFR + erlotinib -> CNNscore > 0.5

### Test E2E
- Job P00533 avec engine gnina_gpu -> complete avec vrais scores
- Verifier 3 scores reels (pas mock)
- Verifier label GNINA GPU (RunPod) dans pipeline summary

### Test fallback
- Retirer RUNPOD_API_KEY -> auto fallback vers local
- RUNPOD_API_KEY invalide -> fallback vers local (pas crash)

---

## 9. ESTIMATION EFFORT

backend/pipeline/docking_gpu.py : NOUVEAU, ~150 lignes
backend/pipeline/docking.py : MODIFIE, ~10 lignes ajoutees
backend/models.py : MODIFIE, 3 descriptions
backend/tasks.py : MODIFIE, 1 label
docker-compose.yml : MODIFIE, 2 env vars
.env : MODIFIE, 2 lignes
frontend InputForm.jsx : MODIFIE, ~15 lignes

Total : 3-4 heures de dev

---

## 10. INSTRUCTIONS CLAUDE CODE

Lis BindX_GNINA_GPU_RunPod_Spec.md.

L endpoint RunPod GNINA GPU est deja deploye et teste.
Endpoint ID : weeeiy6z4jdsv3. API Key : dans .env (RUNPOD_API_KEY).
Image : ghcr.io/anthonyboisbouvier-paris/gnina-runpod:latest.

ETAPE 1 : Creer backend/pipeline/docking_gpu.py
- is_gpu_available(), dock_batch_gpu(), dock_all_runpod_batch()
- Ajouter requests dans requirements.txt si absent

ETAPE 2 : Modifier backend/pipeline/docking.py
- Import docking_gpu, branchement GPU batch dans dock_all_ligands()
- Fallback transparent, ne PAS toucher au reste

ETAPE 3 : Modifier backend/models.py - gnina_gpu dans descriptions

ETAPE 4 : Modifier backend/tasks.py - label GNINA GPU (RunPod)

ETAPE 5 : Modifier docker-compose.yml - env vars RunPod

ETAPE 6 : Modifier .env - RUNPOD_API_KEY + GNINA_ENDPOINT_ID

ETAPE 7 : Modifier frontend InputForm.jsx - radio button GPU vert

ETAPE 8 : Test E2E + fallback

IMPORTANT :
- Docking GPU est en BATCH (1 seul appel pour toutes les molecules)
- Ne PAS boucler molecule par molecule
- Fallback transparent si GPU echoue
- Cold start ~60s, afficher message dans progress
- Mapper champs : minimizedAffinity->vina_score, CNNscore->cnn_score, CNNaffinity->cnn_affinity
