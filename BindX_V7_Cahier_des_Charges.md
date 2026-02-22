# Cahier des Charges - BindX V7
### "GPU-Accelerated Drug Discovery"
### Prerequis : V6 fonctionnelle
### Date : 22 fevrier 2026

---

## 0. VISION V7

V6 = meilleure plateforme possible en CPU only (PDB, P2Rank, GNINA, ProLIF, SEA, Pareto).
V7 = accelerer et ameliorer avec du GPU la ou ca change vraiment la donne.

Trois axes GPU :
1. DiffSBDD : generation de molecules 3D directement dans la poche
2. Uni-Dock : docking massif GPU (100-1000x plus rapide que Vina CPU)
3. OpenMM : dynamique moleculaire courte (verification stabilite du complexe)

Le GPU est OPTIONNEL. V6 CPU reste le mode par defaut.
Le GPU est disponible a la demande via RunPod serverless.

---

## 1. AXE 1 -- DiffSBDD : GENERATION 3D DANS LA POCHE

### 1.1 Pourquoi

REINVENT4 (V2-V6) genere des SMILES 1D. Le docking Vina/GNINA doit ensuite
trouver comment placer la molecule en 3D. Deux etapes decouplees.

DiffSBDD genere des molecules 3D directement dans la poche, atome par atome.
La molecule est "nee" dans la poche, optimisee pour sa geometrie.

### 1.2 Ce qui se passe derriere DiffSBDD

```
DiffSBDD (Schneuing et al., 2023) - Diffusion model for SBDD

Architecture :
  - Equivariant Graph Neural Network (EGNN)
  - SE(3)-invariant : le modele respecte les symetries 3D
  - Entraine sur CrossDocked2020 (~22K complexes proteine-ligand)

Processus de generation :
1. Encoder la poche :
   - Extraire residus a 10A du centre
   - Chaque atome = noeud dans un graphe
   - Features : type d'atome, charge, aromaticite, coordonnees 3D

2. Diffusion forward (entrainement seulement) :
   - Ajouter du bruit gaussien progressivement aux coordonnees des atomes du ligand
   - T=1000 steps de bruit

3. Diffusion reverse (generation) :
   - Partir de bruit pur (atomes aleatoires dans la poche)
   - Debruiter progressivement via le EGNN conditionne sur la poche
   - A chaque step :
     a. Le EGNN predit le bruit a retirer
     b. Mise a jour des coordonnees 3D
     c. Mise a jour des types d'atomes (C, N, O, S, etc.)
   - 1000 steps -> molecule complete

4. Post-traitement :
   - Conversion nuage d'atomes -> graphe moleculaire (liaisons inferees par distance)
   - Sanitization RDKit
   - Conversion en SMILES pour ADMET/retrosynthese
   - Calcul du score Vina sur la pose generee

Limites connues :
  - Validite chimique : ~60-70% (30-40% de molecules invalides)
  - Synthetisabilite : SA scores souvent eleves (molecules complexes)
  - Necessite GPU (inference ~30 sec/molecule sur RTX 3090)
```

### 1.3 Alternative : Pocket2Mol

```
Pocket2Mol (Peng et al., ICML 2022)
  - Autoregressive au lieu de diffusion
  - Genere atome par atome sequentiellement
  - Meilleure validite chimique (~80%) que DiffSBDD
  - Moins diversifie

DecompDiff (Guan et al., ICML 2024)
  - Decompose generation en bras + scaffold
  - Meilleure synthetisabilite
  - Plus recent, moins teste

Strategie : implementer DiffSBDD comme principal, Pocket2Mol comme fallback
si DiffSBDD genere trop de molecules invalides (< 50% valid).
```

### 1.4 Implementation

```python
# backend/pipeline/generation_3d.py

import torch
import subprocess
import tempfile

def generate_3d_diffsbdd(pocket_pdb, n_molecules=50, gpu_mode="runpod"):
    """
    Generate 3D molecules in pocket using DiffSBDD.
    Returns list of molecules with 3D coordinates + SMILES.
    """
    if gpu_mode == "local" and torch.cuda.is_available():
        return _run_diffsbdd_local(pocket_pdb, n_molecules)
    elif gpu_mode == "runpod":
        return _run_diffsbdd_runpod(pocket_pdb, n_molecules)
    else:
        raise ValueError("No GPU available. Use REINVENT4 (CPU) instead.")


def _run_diffsbdd_local(pocket_pdb, n_molecules):
    """Run DiffSBDD locally with GPU."""
    from diffsbdd.sample import sample_molecules

    results = sample_molecules(
        pocket_path=pocket_pdb,
        n_samples=n_molecules,
        device="cuda",
        num_steps=1000,
        # Use conditional generation on pocket atoms
    )

    valid_molecules = []
    for mol_data in results:
        mol = mol_data_to_rdkit(mol_data)
        if mol is not None:
            try:
                Chem.SanitizeMol(mol)
                smiles = Chem.MolToSmiles(mol)
                # Verify drug-likeness minimum
                qed = QED.qed(mol)
                sa = sascorer.calculateScore(mol)
                if qed > 0.2 and sa < 7:
                    valid_molecules.append({
                        "smiles": smiles,
                        "mol_3d": mol,  # with 3D coords
                        "qed": qed,
                        "sa_score": sa,
                        "source": "diffsbdd",
                        "pose_preoptimized": True
                    })
            except:
                continue

    validity_rate = len(valid_molecules) / n_molecules
    if validity_rate < 0.5:
        # Fallback to Pocket2Mol if too many invalid
        logger.warning(f"DiffSBDD validity {validity_rate:.0%}. Consider Pocket2Mol.")

    return valid_molecules


def _run_diffsbdd_runpod(pocket_pdb, n_molecules):
    """Run DiffSBDD on RunPod serverless GPU."""
    import requests, time

    RUNPOD_API_KEY = os.environ.get("RUNPOD_API_KEY")
    ENDPOINT_ID = os.environ.get("DIFFSBDD_ENDPOINT_ID")

    if not RUNPOD_API_KEY or not ENDPOINT_ID:
        raise ValueError("RunPod not configured. Set RUNPOD_API_KEY and DIFFSBDD_ENDPOINT_ID.")

    # Read pocket PDB content
    with open(pocket_pdb) as f:
        pocket_content = f.read()

    # Submit job
    response = requests.post(
        f"https://api.runpod.ai/v2/{ENDPOINT_ID}/run",
        headers={"Authorization": f"Bearer {RUNPOD_API_KEY}"},
        json={
            "input": {
                "pocket_pdb": pocket_content,
                "n_molecules": n_molecules,
                "num_steps": 1000
            }
        }
    )
    job_id = response.json()["id"]

    # Poll for result (timeout 15 min)
    for _ in range(90):
        time.sleep(10)
        status = requests.get(
            f"https://api.runpod.ai/v2/{ENDPOINT_ID}/status/{job_id}",
            headers={"Authorization": f"Bearer {RUNPOD_API_KEY}"}
        ).json()
        if status["status"] == "COMPLETED":
            return parse_runpod_results(status["output"])
        elif status["status"] == "FAILED":
            raise RuntimeError(f"RunPod job failed: {status.get('error')}")

    raise TimeoutError("RunPod job timed out after 15 minutes")
```

### 1.5 Integration dans le pipeline V7

```
Les molecules DiffSBDD SAUTENT l'etape docking (pose deja optimisee).
Mais elles passent par :
  - Calcul du score GNINA sur la pose generee (pour comparaison)
  - ProLIF interaction analysis
  - ADMET + off-target (identique V6)
  - Hard cutoffs + Pareto (identique V6)

Les molecules DiffSBDD et REINVENT4 sont MELANGEES dans le Pareto final.
L'utilisateur voit la source de chaque molecule.
```

### 1.6 RunPod Docker image

```dockerfile
# runpod/Dockerfile

FROM nvidia/cuda:12.1-runtime-ubuntu22.04

RUN apt-get update && apt-get install -y python3 python3-pip git
RUN pip3 install torch torch-geometric rdkit-pypi

# Install DiffSBDD
RUN git clone https://github.com/arneschneuing/DiffSBDD.git /app/DiffSBDD
WORKDIR /app/DiffSBDD
RUN pip3 install -e .

# Download pre-trained weights (~500MB)
RUN python3 -c "from diffsbdd.utils import download_weights; download_weights()"

# RunPod handler
COPY handler.py /app/handler.py

CMD ["python3", "-u", "/app/handler.py"]
```

```python
# runpod/handler.py

import runpod
from diffsbdd.sample import sample_molecules

def handler(event):
    input_data = event["input"]
    pocket_pdb = input_data["pocket_pdb"]
    n_molecules = input_data.get("n_molecules", 50)

    # Write pocket to temp file
    with open("/tmp/pocket.pdb", "w") as f:
        f.write(pocket_pdb)

    # Generate molecules
    results = sample_molecules(
        pocket_path="/tmp/pocket.pdb",
        n_samples=n_molecules,
        device="cuda"
    )

    # Convert to serializable format
    output = []
    for mol_data in results:
        mol = mol_data_to_rdkit(mol_data)
        if mol:
            output.append({
                "sdf": Chem.MolToMolBlock(mol),
                "smiles": Chem.MolToSmiles(mol),
                "n_atoms": mol.GetNumAtoms()
            })

    return {"molecules": output, "n_valid": len(output), "n_total": n_molecules}

runpod.serverless.start({"handler": handler})
```


---

## 2. AXE 2 -- UNI-DOCK : DOCKING MASSIF GPU

### 2.1 Pourquoi

GNINA (V6) est excellent pour le scoring CNN mais reste CPU.
Pour le mode Deep screening (2.4M molecules), ca prend ~3 heures.

Uni-Dock (Yu et al., JCTC 2023) est Vina accelere GPU.
Meme algorithme, meme fonction de score, mais 100-1000x plus rapide.
2.4M molecules en ~15 minutes au lieu de 3 heures.

### 2.2 Ce qui se passe derriere Uni-Dock

```
Uni-Dock = AutoDock Vina porte sur CUDA.

Architecture GPU :
1. Batch processing : au lieu de docker 1 molecule a la fois,
   Uni-Dock docke 1000+ molecules EN PARALLELE sur les milliers
   de coeurs CUDA du GPU.

2. Pour chaque molecule en parallele :
   a. Meme algorithme Iterated Local Search (ILS) que Vina
   b. Meme fonction de score (Gauss + repulsion + H-bond + hydrophobic + torsion)
   c. Meme exploration Monte Carlo des conformations
   d. Mais chaque molecule est un thread GPU independant

3. Memory management :
   - La grille du recepteur est calculee une fois, stockee en GPU shared memory
   - Chaque ligand est un thread block
   - Exhaustiveness parallele intra-molecule aussi

Benchmark :
  - Vina CPU (8 cores) : ~5 sec/molecule = ~3.3h pour 2400 molecules
  - Uni-Dock GPU (RTX 3090) : ~0.05 sec/molecule = ~2 min pour 2400 molecules
  - Pour 2.4M molecules : Uni-Dock GPU ~20 min vs impossible en CPU Vina direct

Precision : identique a Vina (meme algorithme), difference < 0.01 kcal/mol.
```

### 2.3 Integration dans le screening massif V7

```
Ancien pipeline Deep (V3-V6, CPU only) :
  Pass 1: Filtre pharma RDKit (2.4M -> 200K)           ~2 min
  Pass 2: Filtre shape 3D (200K -> 10K)                 ~10 min
  Pass 3: smina/Vina scoring rapide (10K -> 500)         ~1-2h
  Pass 4: GNINA precise (500 -> 50)                      ~30 min
  Total : ~3 heures

Nouveau pipeline Deep (V7, GPU available) :
  Pass 1: Filtre pharma RDKit (2.4M -> 200K)           ~2 min (CPU)
  Pass 2: Uni-Dock GPU (200K -> 1000)                    ~15 min (GPU!)
  Pass 3: GNINA CNN rescore (1000 -> 100)                ~10 min (CPU)
  Pass 4: Consensus + ProLIF (100 -> 50)                 ~5 min (CPU)
  Total : ~30 minutes (6x plus rapide)

Le GPU ne sert QUE pour Uni-Dock. Le reste reste CPU.
```

### 2.4 Installation

```bash
# Uni-Dock necessite CUDA toolkit
pip install unidock

# Ou binaire pre-compile :
wget https://github.com/dptech-corp/Uni-Dock/releases/download/v1.1.0/unidock
chmod +x unidock

# Usage (identique a Vina) :
unidock --receptor protein.pdbqt \
        --gpu_batch ligands_dir/ \
        --center_x 10 --center_y 20 --center_z 30 \
        --size_x 25 --size_y 25 --size_z 25 \
        --dir results/ \
        --exhaustiveness 32 \
        --num_modes 3
```

### 2.5 Backend

```python
# Modifier backend/pipeline/docking.py pour mode GPU

def dock_unidock_batch(receptor_pdbqt, ligands_dir, center, size, exhaustiveness=32):
    """
    Batch docking with Uni-Dock (GPU accelerated Vina).
    Docks ALL ligands in ligands_dir in one GPU batch.
    """
    results_dir = tempfile.mkdtemp()
    cmd = [
        "unidock",
        "--receptor", receptor_pdbqt,
        "--gpu_batch", ligands_dir,
        "--center_x", str(center[0]),
        "--center_y", str(center[1]),
        "--center_z", str(center[2]),
        "--size_x", str(size[0]),
        "--size_y", str(size[1]),
        "--size_z", str(size[2]),
        "--exhaustiveness", str(exhaustiveness),
        "--num_modes", "3",
        "--dir", results_dir
    ]
    subprocess.run(cmd, check=True)

    # Parse results
    results = []
    for sdf_file in glob.glob(os.path.join(results_dir, "*.sdf")):
        supplier = Chem.SDMolSupplier(sdf_file)
        for mol in supplier:
            if mol:
                results.append({
                    "vina_score": float(mol.GetProp("minimizedAffinity")),
                    "mol": mol,
                    "source_file": sdf_file
                })
    return sorted(results, key=lambda r: r["vina_score"])
```

### 2.6 References

- Yu et al., "Uni-Dock: GPU-Accelerated Docking", JCTC 2023
- Eberhardt et al., "AutoDock Vina 1.2.0", JCIM 2021

---

## 3. AXE 3 -- DYNAMIQUE MOLECULAIRE COURTE (OpenMM)

### 3.1 Pourquoi

Le docking est STATIQUE : il dit si la molecule FIT dans la poche.
Il ne dit pas si elle y RESTE.

Une dynamique moleculaire (MD) courte (10-50 ns) simule le mouvement
du complexe proteine-ligand dans l'eau. Si le ligand quitte la poche
pendant la simulation, il n'est pas un bon candidat.

### 3.2 Ce qui se passe derriere la MD

```
Dynamique moleculaire (OpenMM, Eastman et al., PLOS Comp Bio 2017) :

1. Preparation du systeme :
   a. Prendre la pose dockee (proteine + ligand)
   b. Parametriser la proteine (champ de force AMBER ff14SB)
   c. Parametriser le ligand (champ de force GAFF2 ou OpenFF 2.0)
      - Attribuer des types d'atomes au ligand
      - Calculer les charges partielles (AM1-BCC)
      - Generer les parametres de liaison, angle, torsion
   d. Solvater : ajouter une boite d'eau (TIP3P) autour du complexe
      - ~10A de padding
      - ~10,000-50,000 molecules d'eau
   e. Neutraliser : ajouter Na+/Cl- pour equilibrer la charge

2. Minimisation d'energie :
   - Gradient descent sur l'energie potentielle
   - Supprime les chevauchements atomiques (clashes)
   - ~5000 steps

3. Equilibration :
   - NVT (temperature constante 300K, 100 ps)
     Thermostat de Langevin, gamma = 1/ps
   - NPT (pression constante 1 atm, 100 ps)
     Barostat de Monte Carlo

4. Production :
   - NPT, 10-50 ns
   - Pas d'integration : 2 fs (avec contraintes H via SHAKE)
   - Sauvegarde frames toutes les 10 ps
   - 10 ns = 5,000,000 steps = ~1000 frames sauvegardees

5. Analyse post-MD :
   a. RMSD du ligand : mesure combien le ligand bouge
      - RMSD < 2A : ligand stable dans la poche = BON
      - RMSD 2-4A : mouvement modere, poche flexible
      - RMSD > 4A : ligand quitte la poche = MAUVAIS
   b. Contacts proteine-ligand au cours du temps
      - ProLIF sur chaque frame : quelles interactions persistent ?
      - Interactions presentes > 70% du temps = stables
   c. Energie de liaison MM-GBSA :
      - Calcul d'energie libre plus rigoureux que Vina
      - DG = E(complexe) - E(proteine) - E(ligand)
      - Correle mieux avec l'affinite experimentale

Temps GPU :
  - 10 ns sur RTX 3090 : ~30 min (systeme ~50K atomes)
  - 50 ns : ~2.5 heures
  - Recommandation : 10 ns pour screening, 50 ns pour validation
```

### 3.3 Implementation

```python
# Creer backend/pipeline/molecular_dynamics.py

from openmm.app import *
from openmm import *
from openmm.unit import *
import mdtraj

def run_short_md(complex_pdb, ligand_sdf, duration_ns=10, gpu_mode="runpod"):
    """
    Run short MD simulation to verify complex stability.
    Returns RMSD analysis and binding energy estimate.
    """
    if gpu_mode == "local" and torch.cuda.is_available():
        return _run_md_local(complex_pdb, ligand_sdf, duration_ns)
    elif gpu_mode == "runpod":
        return _run_md_runpod(complex_pdb, ligand_sdf, duration_ns)


def _run_md_local(complex_pdb, ligand_sdf, duration_ns):
    """Local GPU MD simulation."""

    # 1. Prepare system
    pdb = PDBFile(complex_pdb)
    forcefield = ForceField("amber14-all.xml", "amber14/tip3pfb.xml")

    # Parametrize ligand with OpenFF
    from openff.toolkit import Molecule
    ligand = Molecule.from_file(ligand_sdf)
    # ... (parametrization code)

    modeller = Modeller(pdb.topology, pdb.positions)
    modeller.addSolvent(forcefield, padding=1.0*nanometers, ionicStrength=0.15*molar)

    system = forcefield.createSystem(
        modeller.topology,
        nonbondedMethod=PME,
        nonbondedCutoff=1.0*nanometers,
        constraints=HBonds
    )

    # 2. Minimization
    integrator = LangevinMiddleIntegrator(300*kelvin, 1/picosecond, 0.002*picoseconds)
    platform = Platform.getPlatformByName("CUDA")
    simulation = Simulation(modeller.topology, system, integrator, platform)
    simulation.context.setPositions(modeller.positions)
    simulation.minimizeEnergy(maxIterations=5000)

    # 3. Equilibration (200 ps)
    simulation.step(100_000)

    # 4. Production
    n_steps = int(duration_ns * 1e6 / 2)  # 2 fs timestep
    reporter = mdtraj.reporters.HDF5Reporter("trajectory.h5", 5000)  # save every 10 ps
    simulation.reporters.append(reporter)
    simulation.step(n_steps)

    # 5. Analysis
    traj = mdtraj.load("trajectory.h5")
    return analyze_md_trajectory(traj, ligand_residue_name="LIG")


def analyze_md_trajectory(traj, ligand_residue_name="LIG"):
    """
    Analyze MD trajectory for ligand stability.
    """
    import mdtraj
    import numpy as np

    # Get ligand atom indices
    lig_atoms = traj.topology.select(f"resname {ligand_residue_name}")

    # RMSD of ligand relative to initial pose
    rmsd = mdtraj.rmsd(traj, traj, atom_indices=lig_atoms) * 10  # nm -> Angstroms

    # Classify stability
    mean_rmsd = np.mean(rmsd)
    max_rmsd = np.max(rmsd)

    if max_rmsd < 2.0:
        stability = "STABLE"
        confidence_boost = 0.15
        message = f"Ligand stable in pocket (RMSD < 2A throughout). High confidence."
    elif max_rmsd < 4.0:
        stability = "MODERATE"
        confidence_boost = 0.05
        message = f"Ligand shows moderate movement (max RMSD {max_rmsd:.1f}A). Pocket may be flexible."
    else:
        stability = "UNSTABLE"
        confidence_boost = -0.15
        message = f"Ligand leaves pocket during simulation (max RMSD {max_rmsd:.1f}A). Poor candidate."

    return {
        "stability": stability,
        "mean_rmsd_A": float(mean_rmsd),
        "max_rmsd_A": float(max_rmsd),
        "confidence_boost": confidence_boost,
        "message": message,
        "rmsd_timeseries": rmsd.tolist(),
        "duration_ns": len(traj) * 0.01  # 10 ps/frame
    }
```

### 3.4 Integration pipeline V7

```
La MD ne tourne que sur les TOP 3-5 candidats du Pareto front (V6).
C'est une etape de VALIDATION, pas de screening.

Pipeline :
  ... V6 complet ...
  -> Pareto front (5-10 candidats)
  -> MD courte 10 ns sur chaque (GPU, ~30 min/molecule)
  -> Analyse RMSD :
     STABLE : confidence += 15%, badge "MD Validated"
     MODERATE : confidence += 5%, note "flexible pocket"
     UNSTABLE : confidence -= 15%, WARNING "leaves pocket"
  -> Re-ranking final avec MD results
```

### 3.5 UX impact

```
Molecular Dynamics Validation (top 5 candidates)

  AI-Opt-0037    10 ns MD    STABLE (RMSD 1.2A)     +15% confidence
    Ligand remains tightly bound. All key H-bonds maintained > 85% of simulation.
    [View MD trajectory animation]

  Erlotinib      10 ns MD    STABLE (RMSD 1.5A)     +15% confidence
    Known drug, confirmed stable. Expected result.
    [View MD trajectory animation]

  DiffSBDD-0012  10 ns MD    UNSTABLE (RMSD 6.3A)   -15% confidence
    Ligand exits pocket after 4.2 ns. Poor candidate despite good docking score.
    WARNING: Docking score was misleading for this molecule.
    [View MD trajectory animation]
```

### 3.6 References

- Eastman et al., "OpenMM 7", PLOS Comp Bio 2017
- Shirts et al., "Lessons from MM-GBSA", JCAMD 2010


### 4.2 Pipeline display avec GPU

```
  3D Generation       DiffSBDD generating 50 molecules (GPU cloud)
    Job submitted to RunPod -- estimated 10 min
    19/50 molecules valid so far

  Massive Docking     Uni-Dock GPU: 200,000 molecules
    45,000/200,000 completed -- estimated 8 min remaining

  MD Validation       Simulating top 5 in explicit water (GPU cloud)
    Candidate 2/5 -- AI-Opt-0037 -- 6.2 ns / 10 ns
    RMSD so far: 1.1 Angstroms (STABLE)
```

### 4.3 Resultats avec MD badges

```
Pareto Front (MD-validated)

  AI-Opt-0037    Score: 91    Confidence: 93%    MD: STABLE
    Affinity: BEST    Safety: good    Synthesis: 4 steps
    MD validated: ligand stable 10 ns, RMSD 1.2A

  Erlotinib       Score: 87    Confidence: 95%    MD: STABLE
    Known drug     Safety: excellent    Synthesis: commercial
    MD validated: confirmed stable

  DiffSBDD-0012   Score: 85    Confidence: 37%    MD: UNSTABLE
    Affinity: good    Safety: good    Synthesis: 5 steps
    MD WARNING: ligand exits pocket at 4.2 ns
    [Demoted from Pareto rank 1 to rank 3]
```

---

## 5. STRUCTURE FICHIERS V7

```
bindx/
  backend/pipeline/
    ... tous les fichiers V6 ...
    generation_3d.py       NEW   DiffSBDD + Pocket2Mol wrapper
    docking_gpu.py         NEW   Uni-Dock GPU batch docking
    molecular_dynamics.py  NEW   OpenMM short MD + analysis
  frontend/src/components/
    ... tous les composants V6 ...
    GenerationComparison.jsx  NEW   REINVENT4 vs DiffSBDD side-by-side
    MDTrajectory.jsx          NEW   RMSD timeseries plot + stability badge
    GPUOptions.jsx            NEW   GPU feature toggles
  runpod/
    Dockerfile.diffsbdd       NEW   DiffSBDD GPU image
    Dockerfile.md             NEW   OpenMM GPU image
    handler_diffsbdd.py       NEW   DiffSBDD serverless handler
    handler_md.py             NEW   MD serverless handler
```

---

## 6. INSTRUCTIONS CLAUDE CODE - V7

```
Lis BindX_V7_Cahier_des_Charges.md dans ce repertoire.
La V6 est fonctionnelle. Implemente la V7 :

ETAPE 1 : DiffSBDD integration
- Creer backend/pipeline/generation_3d.py
- GPU local : run DiffSBDD directement
- GPU cloud : RunPod serverless API
- Fallback REINVENT4 si pas de GPU
- Post-traitement : sanitize, QED, SA, conversion SMILES
- Si validity < 50% : log warning, suggest Pocket2Mol

ETAPE 2 : RunPod setup DiffSBDD
- Creer runpod/Dockerfile.diffsbdd et handler_diffsbdd.py
- Image : CUDA 12.1 + DiffSBDD + poids pre-entraines
- Handler : recoit pocket PDB, retourne SDF + SMILES

ETAPE 3 : Uni-Dock GPU docking
- Creer backend/pipeline/docking_gpu.py
- Wrapper autour de Uni-Dock pour batch docking GPU
- Integrer dans le pipeline Deep screening :
  Si GPU dispo : Uni-Dock (200K molecules en 15 min)
  Sinon : smina CPU (10K molecules en 1-2h, comme V6)
- Les scores Uni-Dock alimentent le consensus scoring V6

ETAPE 4 : Dynamique moleculaire courte
- Creer backend/pipeline/molecular_dynamics.py
- OpenMM : preparation systeme, minimisation, equilibration, production 10 ns
- Analyse : RMSD ligand, classification STABLE/MODERATE/UNSTABLE
- RunPod handler pour GPU cloud
- Ne tourne que sur top 5 Pareto front
- Resultat : confidence boost/malus + stability badge

ETAPE 5 : Frontend V7
- GPUOptions.jsx : toggles GPU features dans options avancees
- GenerationComparison.jsx : REINVENT4 vs DiffSBDD table
- MDTrajectory.jsx : graphique RMSD over time + stability badge
- Mettre a jour le pipeline display pour les etapes GPU

Teste avec P00533 (EGFR) :
- Si GPU dispo : DiffSBDD genere des molecules, verifier > 50% valid
- Si pas de GPU : fallback REINVENT4 fonctionne
- Uni-Dock scores < 0.01 kcal/mol de difference avec Vina
- MD sur Erlotinib : doit etre STABLE (RMSD < 2A)
- MD sur molecule fictive mauvaise : doit etre UNSTABLE
- GPU options desactivees par defaut, V6 CPU fonctionne seul
```

---

## 7. ESTIMATION COUTS V7

```
VPS CPU (inchange, V6 mode par defaut)     : ~70 euros/mois

GPU a la demande (RunPod serverless) :
  DiffSBDD (50 molecules)                   : ~0.50 euros/job
  Uni-Dock (200K molecules)                  : ~0.30 euros/job
  MD 10 ns x 5 candidats                    : ~1.00 euros/job
  Total GPU par job complet V7              : ~1.80 euros

Si 5 jobs/jour avec GPU complet             : ~270 euros/mois GPU
Si 1 job/jour                               : ~55 euros/mois GPU
Si GPU optionnel, usage occasionnel         : ~20 euros/mois GPU

Total typique : ~90-100 euros/mois (VPS + GPU occasionnel)
```

---

## 8. BILAN FINAL APRES V7

```
                          BindX V7    Insilico Medicine
Structure (experimental)    V6           oui
Structure (predicted)       V1           oui
Pocket detection (ML)       V6           oui
Functional biology          V4           oui
Classical docking           V1           oui
CNN docking (GNINA)         V6           oui
GPU docking (Uni-Dock)      V7           oui
Massive screening           V3           oui
Consensus scoring           V6           oui
Interaction analysis        V6           oui
1D molecule generation      V2           oui
3D molecule generation      V7           oui
Lead optimization           V5           oui (mieux)
ADMET (+ applicability)     V6           oui (mieux calibre)
Off-target (SEA + docking)  V6           oui
Retrosynthesis (+ cost)     V6           oui
Confidence scoring          V5           oui
Audit trail                 V5           oui
Pareto optimization         V6           oui
Molecular dynamics          V7           oui
Experimental validation     non          oui (lab)
Clinical pipeline           non          oui ($100M+)
```

BindX V7 couvre ~90% du scope fonctionnel d'Insilico Medicine.
Les 10% restants (validation experimentale, pipeline clinique)
necessitent un laboratoire physique et des centaines de millions de dollars.

---

Ce document complete la serie CDC V1-V7. Genere le 22 fevrier 2026.
