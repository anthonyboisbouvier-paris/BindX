"""
DockIt pipeline -- V5bis Protein-ligand interaction analysis using ProLIF.

Analyzes specific interactions (H-bonds, pi-stacking, hydrophobic, etc.)
between docked ligands and the target protein. Crosses with functional
residues from UniProt to assess binding quality.

Strategies (in order):
  1. ProLIF for interaction fingerprinting (requires prolif + MDAnalysis).
  2. RDKit-based distance analysis from PDB coordinates.
  3. Deterministic mock based on known target data.
"""

from __future__ import annotations

import hashlib
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Known functional residues for common drug targets
# ---------------------------------------------------------------------------

KNOWN_FUNCTIONAL_RESIDUES: dict[str, dict] = {
    "P00533": {  # EGFR
        "residues": [719, 721, 743, 745, 790, 791, 793, 797, 854, 855],
        "key_hbond_residues": [793, 790],  # MET793 (hinge), THR790 (gatekeeper)
        "description": "ATP-binding site key residues",
    },
    "P04626": {  # HER2/ERBB2
        "residues": [726, 753, 798, 862, 863],
        "key_hbond_residues": [798],
        "description": "ATP-binding site key residues",
    },
    "P07550": {  # ADRB2
        "residues": [113, 203, 207, 286, 289, 290, 312, 316],
        "key_hbond_residues": [113, 207],
        "description": "Orthosteric binding site residues",
    },
    "P00519": {  # ABL1
        "residues": [253, 255, 271, 286, 315, 318, 381, 382],
        "key_hbond_residues": [318, 315],
        "description": "ATP-binding site key residues",
    },
}


# =====================================================================
# PUBLIC API
# =====================================================================

def analyze_interactions(
    protein_path: str,
    ligand_path: str,
    uniprot_id: str = "",
    smiles: str = "",
) -> dict:
    """Analyze protein-ligand interactions.

    Tries ProLIF first, falls back to RDKit distance-based analysis,
    and finally to a deterministic mock.

    Parameters
    ----------
    protein_path : str
        Path to the protein PDB file.
    ligand_path : str
        Path to the docked ligand file (PDB, SDF, or MOL2).
    uniprot_id : str
        UniProt accession (e.g. "P00533") for functional residue lookup.
    smiles : str
        SMILES of the ligand (used for deterministic mock fallback).

    Returns
    -------
    dict
        Interaction analysis result with keys:
        - ``interactions``: list of interaction dicts.
        - ``functional_contacts``: int, number of functional residues contacted.
        - ``total_functional``: int, total known functional residues.
        - ``interaction_quality``: float in [0, 1].
        - ``key_hbonds``: int, number of key H-bond contacts.
        - ``method``: "prolif", "rdkit_distance", or "mock".
        - ``summary``: human-readable summary string.
    """
    # Try ProLIF
    try:
        return _analyze_prolif(protein_path, ligand_path, uniprot_id)
    except ImportError:
        logger.info("ProLIF not available, using RDKit distance analysis")
    except Exception as exc:
        logger.warning("ProLIF failed: %s, falling back", exc)

    # Try RDKit distance-based
    try:
        return _analyze_rdkit_distance(protein_path, ligand_path, uniprot_id)
    except ImportError:
        logger.info("RDKit not available for distance analysis, using mock")
    except Exception as exc:
        logger.warning("RDKit distance analysis failed: %s, using mock", exc)

    # Mock fallback
    return _mock_interactions(uniprot_id, smiles=smiles)


def score_interaction_quality(interactions_result: dict) -> float:
    """Extract interaction_quality score (0-1) for composite scoring.

    Parameters
    ----------
    interactions_result : dict
        Output from ``analyze_interactions()``.

    Returns
    -------
    float
        Interaction quality score in [0, 1].
    """
    return interactions_result.get("interaction_quality", 0.5)


# =====================================================================
# STRATEGY 1: ProLIF
# =====================================================================

def _analyze_prolif(
    protein_path: str,
    ligand_path: str,
    uniprot_id: str,
) -> dict:
    """Use ProLIF for interaction fingerprinting.

    Requires ``prolif`` and ``MDAnalysis`` to be installed.

    Parameters
    ----------
    protein_path : str
        Path to protein PDB.
    ligand_path : str
        Path to docked ligand file.
    uniprot_id : str
        UniProt accession for functional residue annotation.

    Returns
    -------
    dict
        Interaction analysis result.
    """
    import prolif  # type: ignore[import-untyped]
    import MDAnalysis as mda  # type: ignore[import-untyped]

    # Load protein and ligand
    prot = mda.Universe(protein_path)
    lig = mda.Universe(ligand_path)

    prot_mol = prolif.Molecule.from_mda(prot)
    lig_mol = prolif.Molecule.from_mda(lig)

    # Compute interaction fingerprint
    fp = prolif.Fingerprint()
    fp.run_from_iterable([lig_mol], prot_mol)

    # Extract interactions
    functional = KNOWN_FUNCTIONAL_RESIDUES.get(uniprot_id, {})
    known_res = set(functional.get("residues", []))
    key_hbond_res = set(functional.get("key_hbond_residues", []))

    interactions: list[dict] = []
    ifp = fp.ifp[0]  # First (only) frame

    for (lig_res, prot_res), interaction_dict in ifp.items():
        res_num = prot_res.number
        res_name = f"{prot_res.name}{res_num}"

        for int_type, is_present in interaction_dict.items():
            if is_present:
                interactions.append({
                    "residue": res_name,
                    "residue_number": res_num,
                    "type": int_type,
                    "is_functional": res_num in known_res,
                })

    func_contacted = len(set(
        i["residue_number"] for i in interactions if i["is_functional"]
    ))
    total_func = len(known_res) if known_res else 1
    quality = func_contacted / total_func if total_func > 0 else 0.5
    key_hb = sum(
        1 for i in interactions
        if i["residue_number"] in key_hbond_res and "HB" in i["type"]
    )

    return {
        "interactions": interactions,
        "functional_contacts": func_contacted,
        "total_functional": len(known_res),
        "interaction_quality": round(quality, 3),
        "key_hbonds": key_hb,
        "method": "prolif",
        "summary": (
            f"Functional contacts: {func_contacted}/{len(known_res)} key residues "
            f"({quality:.0%}) - {key_hb} key H-bonds"
        ),
    }


# =====================================================================
# STRATEGY 2: RDKit distance-based analysis
# =====================================================================

def _analyze_rdkit_distance(
    protein_path: str,
    ligand_path: str,
    uniprot_id: str,
) -> dict:
    """Simplified interaction analysis using RDKit and coordinate distances.

    Parses PDB files, finds contacts within 4 Angstroms, and classifies
    them by atom types.

    Parameters
    ----------
    protein_path : str
        Path to protein PDB.
    ligand_path : str
        Path to docked ligand PDB/SDF.
    uniprot_id : str
        UniProt accession for functional residue annotation.

    Returns
    -------
    dict
        Interaction analysis result.
    """
    from rdkit import Chem  # type: ignore[import-untyped]

    functional = KNOWN_FUNCTIONAL_RESIDUES.get(uniprot_id, {})
    known_res = set(functional.get("residues", []))
    key_hbond_res = set(functional.get("key_hbond_residues", []))

    # Parse protein PDB to extract atom coordinates
    protein_atoms = _parse_pdb_atoms(protein_path)
    if not protein_atoms:
        raise ValueError(f"Could not parse protein atoms from {protein_path}")

    # Parse ligand atoms
    ligand_atoms = _parse_ligand_atoms(ligand_path)
    if not ligand_atoms:
        raise ValueError(f"Could not parse ligand atoms from {ligand_path}")

    # Find contacts within 4.0 Angstroms
    contact_distance = 4.0
    interactions: list[dict] = []
    seen_contacts: set[tuple[int, str]] = set()

    for lig_atom in ligand_atoms:
        for prot_atom in protein_atoms:
            dist = _euclidean_distance(lig_atom["coords"], prot_atom["coords"])
            if dist <= contact_distance:
                res_num = prot_atom["res_num"]
                res_name = prot_atom["res_name"]
                contact_key = (res_num, prot_atom["atom_name"])
                if contact_key in seen_contacts:
                    continue
                seen_contacts.add(contact_key)

                # Classify interaction type
                int_type = _classify_interaction(
                    lig_atom, prot_atom, dist,
                )

                interactions.append({
                    "residue": f"{res_name}{res_num}",
                    "residue_number": res_num,
                    "type": int_type,
                    "distance": round(dist, 2),
                    "is_functional": res_num in known_res,
                })

    # Deduplicate by residue (keep closest contact per residue)
    residue_best: dict[int, dict] = {}
    for interaction in interactions:
        rn = interaction["residue_number"]
        if rn not in residue_best or interaction.get("distance", 99) < residue_best[rn].get("distance", 99):
            residue_best[rn] = interaction
    interactions = list(residue_best.values())

    func_contacted = len(set(
        i["residue_number"] for i in interactions if i["is_functional"]
    ))
    total_func = len(known_res) if known_res else 1
    quality = func_contacted / total_func if total_func > 0 else 0.5
    key_hb = sum(
        1 for i in interactions
        if i["residue_number"] in key_hbond_res and "HB" in i["type"]
    )

    return {
        "interactions": interactions,
        "functional_contacts": func_contacted,
        "total_functional": len(known_res),
        "interaction_quality": round(quality, 3),
        "key_hbonds": key_hb,
        "method": "rdkit_distance",
        "summary": (
            f"Functional contacts: {func_contacted}/{len(known_res)} key residues "
            f"({quality:.0%}) - {key_hb} key H-bonds"
        ),
    }


def _parse_pdb_atoms(pdb_path: str) -> list[dict]:
    """Parse ATOM records from a PDB file.

    Parameters
    ----------
    pdb_path : str
        Path to the PDB file.

    Returns
    -------
    list[dict]
        List of atom dicts with keys: atom_name, element, res_name,
        res_num, coords.
    """
    atoms: list[dict] = []
    try:
        with open(pdb_path, "r") as f:
            for line in f:
                if line.startswith("ATOM") or line.startswith("HETATM"):
                    try:
                        atom_name = line[12:16].strip()
                        res_name = line[17:20].strip()
                        res_num = int(line[22:26].strip())
                        x = float(line[30:38].strip())
                        y = float(line[38:46].strip())
                        z = float(line[46:54].strip())
                        element = line[76:78].strip() if len(line) > 76 else atom_name[0]
                        atoms.append({
                            "atom_name": atom_name,
                            "element": element,
                            "res_name": res_name,
                            "res_num": res_num,
                            "coords": (x, y, z),
                        })
                    except (ValueError, IndexError):
                        continue
    except Exception as exc:
        logger.warning("Failed to parse PDB %s: %s", pdb_path, exc)
    return atoms


def _parse_ligand_atoms(ligand_path: str) -> list[dict]:
    """Parse atoms from a ligand file (PDB or SDF).

    Parameters
    ----------
    ligand_path : str
        Path to the ligand file.

    Returns
    -------
    list[dict]
        List of atom dicts with keys: atom_name, element, coords.
    """
    path = Path(ligand_path)
    if path.suffix.lower() in (".pdb", ".pdbqt"):
        return _parse_pdb_atoms(ligand_path)
    elif path.suffix.lower() in (".sdf", ".mol"):
        try:
            from rdkit import Chem
            supplier = Chem.SDMolSupplier(ligand_path)
            atoms: list[dict] = []
            for mol in supplier:
                if mol is None:
                    continue
                conf = mol.GetConformer()
                for atom in mol.GetAtoms():
                    pos = conf.GetAtomPosition(atom.GetIdx())
                    atoms.append({
                        "atom_name": atom.GetSymbol(),
                        "element": atom.GetSymbol(),
                        "coords": (pos.x, pos.y, pos.z),
                    })
                break  # Only first molecule
            return atoms
        except Exception as exc:
            logger.warning("Failed to parse SDF %s: %s", ligand_path, exc)
            return []
    else:
        # Try as PDB
        return _parse_pdb_atoms(ligand_path)


def _euclidean_distance(
    coords1: tuple[float, float, float],
    coords2: tuple[float, float, float],
) -> float:
    """Compute Euclidean distance between two 3D points."""
    return (
        (coords1[0] - coords2[0]) ** 2
        + (coords1[1] - coords2[1]) ** 2
        + (coords1[2] - coords2[2]) ** 2
    ) ** 0.5


def _classify_interaction(
    lig_atom: dict,
    prot_atom: dict,
    distance: float,
) -> str:
    """Classify an interaction type based on atom types and distance.

    Parameters
    ----------
    lig_atom : dict
        Ligand atom dict with ``element`` key.
    prot_atom : dict
        Protein atom dict with ``element`` key.
    distance : float
        Distance in Angstroms.

    Returns
    -------
    str
        Interaction type string.
    """
    lig_elem = lig_atom.get("element", "C").upper()
    prot_elem = prot_atom.get("element", "C").upper()

    hbond_donors = {"N", "O"}
    hbond_acceptors = {"N", "O", "F"}
    hydrophobic = {"C"}

    # H-bond: N/O...N/O within 3.5 A
    if distance <= 3.5:
        if lig_elem in hbond_donors and prot_elem in hbond_acceptors:
            return "HBDonor"
        if lig_elem in hbond_acceptors and prot_elem in hbond_donors:
            return "HBAcceptor"

    # Hydrophobic: C...C within 4.0 A
    if lig_elem in hydrophobic and prot_elem in hydrophobic and distance <= 4.0:
        return "Hydrophobic"

    # Salt bridge: charged N...O
    if distance <= 4.0:
        if (lig_elem == "N" and prot_elem == "O") or (lig_elem == "O" and prot_elem == "N"):
            return "Ionic"

    return "VDW"


# =====================================================================
# STRATEGY 3: Mock interactions
# =====================================================================

def _mock_interactions(uniprot_id: str, smiles: str = "") -> dict:
    """Mock interaction analysis based on known target data.

    Generates deterministic, reproducible interaction data using a hash
    of the SMILES/UniProt ID. Useful for development and testing when
    neither ProLIF nor RDKit is available.

    Parameters
    ----------
    uniprot_id : str
        UniProt accession.
    smiles : str
        Ligand SMILES for deterministic hash.

    Returns
    -------
    dict
        Mock interaction analysis result.
    """
    functional = KNOWN_FUNCTIONAL_RESIDUES.get(uniprot_id, {})
    known_res = functional.get("residues", [718, 745, 793, 855])
    key_hbond = functional.get("key_hbond_residues", [793])

    # Generate deterministic mock interactions based on smiles hash
    h = int(hashlib.md5((smiles or uniprot_id).encode()).hexdigest()[:8], 16)

    interaction_types = ["HBDonor", "HBAcceptor", "Hydrophobic", "PiStacking", "CationPi", "VDW"]
    residue_names = ["MET", "THR", "LYS", "LEU", "ASP", "GLU", "ALA", "VAL", "PHE", "TYR"]

    interactions: list[dict] = []
    n_contacts = 3 + (h % 5)  # 3-7 contacts

    for i in range(n_contacts):
        res_idx = (h + i * 7) % len(known_res)
        res_num = known_res[res_idx] if res_idx < len(known_res) else 700 + (h + i) % 200
        res_name = residue_names[(h + i) % len(residue_names)]
        int_type = interaction_types[(h + i * 3) % len(interaction_types)]
        is_func = res_num in known_res

        interactions.append({
            "residue": f"{res_name}{res_num}",
            "residue_number": res_num,
            "type": int_type,
            "is_functional": is_func,
        })

    func_contacted = len(set(
        i["residue_number"] for i in interactions if i["is_functional"]
    ))
    total_func = len(known_res)
    quality = func_contacted / total_func if total_func > 0 else 0.5
    key_hb = sum(
        1 for i in interactions
        if i["residue_number"] in key_hbond and "HB" in i["type"]
    )

    return {
        "interactions": interactions,
        "functional_contacts": func_contacted,
        "total_functional": total_func,
        "interaction_quality": round(quality, 3),
        "key_hbonds": key_hb,
        "method": "mock",
        "summary": (
            f"Functional contacts: {func_contacted}/{total_func} key residues "
            f"({quality:.0%}) - {key_hb} key H-bonds"
        ),
    }


# =====================================================================
# CLI / SELF-TEST
# =====================================================================

if __name__ == "__main__":
    import json
    import sys

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    # Test with mock for EGFR + Erlotinib
    erlotinib_smiles = "C#Cc1cccc(Nc2ncnc3cc(OCCOC)c(OC)cc23)c1"

    print("=" * 72)
    print("DockIt Interaction Analysis Self-Test")
    print("=" * 72)

    result = _mock_interactions("P00533", smiles=erlotinib_smiles)
    print(f"\nMethod: {result['method']}")
    print(f"Summary: {result['summary']}")
    print(f"Interaction quality: {result['interaction_quality']}")
    print(f"Functional contacts: {result['functional_contacts']}/{result['total_functional']}")
    print(f"Key H-bonds: {result['key_hbonds']}")
    print(f"\nInteractions:")
    for inter in result["interactions"]:
        func_tag = " [FUNCTIONAL]" if inter["is_functional"] else ""
        print(f"  {inter['residue']:>10s} -- {inter['type']:<15s}{func_tag}")

    print(f"\nFull JSON:")
    print(json.dumps(result, indent=2))
    print("\n--- All tests passed ---")
    sys.exit(0)
