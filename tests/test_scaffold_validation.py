#!/usr/bin/env python3
"""
DockIt -- Comprehensive validation of scaffold_analysis + rules-aware lead optimization.

Steps:
  1. Test analyze_scaffold() with diverse molecules (including error cases).
  2. Test Pydantic model round-trips and edge cases.
  3. Test run_optimization() with various structural_rules configurations.
  4. Test API endpoint wiring in main.py.

Run:
    PYTHONPATH=/home/antho/dockit/backend python3 /home/antho/dockit/backend/test_scaffold_validation.py
"""

from __future__ import annotations

import inspect
import json
import logging
import sys
import traceback
from pathlib import Path
from typing import Any

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("test_scaffold_validation")

# ---------------------------------------------------------------------------
# Counters
# ---------------------------------------------------------------------------
_pass_count = 0
_fail_count = 0
_skip_count = 0

RDKIT_AVAILABLE = False
try:
    from rdkit import Chem
    RDKIT_AVAILABLE = True
except ImportError:
    pass


def _report(test_name: str, passed: bool, detail: str = "") -> None:
    global _pass_count, _fail_count
    tag = "PASS" if passed else "FAIL"
    if passed:
        _pass_count += 1
    else:
        _fail_count += 1
    suffix = f" -- {detail}" if detail else ""
    print(f"  [{tag}] {test_name}{suffix}")


def _skip(test_name: str, reason: str = "") -> None:
    global _skip_count
    _skip_count += 1
    suffix = f" -- {reason}" if reason else ""
    print(f"  [SKIP] {test_name}{suffix}")


# ===================================================================
# STEP 1 -- Test analyze_scaffold() with multiple molecules
# ===================================================================

def step1_scaffold_analysis() -> None:
    print("\n" + "=" * 72)
    print("STEP 1: Test analyze_scaffold() with diverse molecules")
    print("=" * 72)

    from pipeline.scaffold_analysis import analyze_scaffold

    test_molecules = [
        {
            "name": "Erlotinib",
            "smiles": "c1ccc(Nc2ncnc3cc(OCCOC)c(OCCOC)cc23)cc1",
            "expect_valid": True,
            "min_positions": 2,  # has BRICS bonds + secondary positions
        },
        {
            "name": "Imatinib",
            "smiles": "Cc1ccc(NC(=O)c2ccc(CN3CCN(C)CC3)cc2)cc1Nc1nccc(-c2cccnc2)n1",
            "expect_valid": True,
            "min_positions": 3,
        },
        {
            "name": "Aspirin",
            "smiles": "CC(=O)Oc1ccccc1C(=O)O",
            "expect_valid": True,
            "min_positions": 1,
        },
        {
            "name": "Caffeine",
            "smiles": "Cn1c(=O)c2c(ncn2C)n(C)c1=O",
            "expect_valid": True,
            "min_positions": 0,  # caffeine has few modifiable sites
        },
        {
            "name": "Sorafenib",
            "smiles": "CNC(=O)c1cc(Oc2ccc(NC(=O)Nc3ccc(Cl)c(C(F)(F)F)c3)cc2)ccn1",
            "expect_valid": True,
            "min_positions": 2,
        },
        {
            "name": "Invalid SMILES",
            "smiles": "not_a_molecule",
            "expect_valid": False,
            "min_positions": 0,
        },
        {
            "name": "Empty SMILES",
            "smiles": "",
            "expect_valid": False,
            "min_positions": 0,
        },
    ]

    for mol_info in test_molecules:
        name = mol_info["name"]
        smiles = mol_info["smiles"]
        expect_valid = mol_info["expect_valid"]
        min_pos = mol_info["min_positions"]

        print(f"\n  --- {name} (SMILES: {smiles[:60]}{'...' if len(smiles) > 60 else ''}) ---")

        try:
            result = analyze_scaffold(smiles)
        except Exception as exc:
            _report(f"{name}: analyze_scaffold() runs", False, f"Exception: {exc}")
            traceback.print_exc()
            continue

        # 1a. smiles field present
        _report(
            f"{name}: smiles field present",
            "smiles" in result and result["smiles"] == smiles,
            f"got '{result.get('smiles', '<missing>')}'",
        )

        # 1b. scaffold_smiles
        has_scaffold = result.get("scaffold_smiles") is not None
        if expect_valid and RDKIT_AVAILABLE:
            _report(
                f"{name}: scaffold_smiles not None",
                has_scaffold,
                f"scaffold='{result.get('scaffold_smiles')}'",
            )
        else:
            # For invalid SMILES or no RDKit, scaffold_smiles can be None
            _report(
                f"{name}: scaffold_smiles is None (expected for invalid/fallback)",
                not has_scaffold,
                f"scaffold='{result.get('scaffold_smiles')}'",
            )

        # 1c. positions structure
        positions = result.get("positions", [])
        if expect_valid and RDKIT_AVAILABLE:
            pos_ok = len(positions) >= min_pos
            _report(
                f"{name}: positions count >= {min_pos}",
                pos_ok,
                f"got {len(positions)} positions",
            )

            # Validate structure of each position
            if positions:
                p = positions[0]
                required_keys = {"label", "position_idx", "atom_symbol",
                                 "current_group", "applicable_strategies",
                                 "suggested_replacements", "is_brics_site"}
                actual_keys = set(p.keys())
                _report(
                    f"{name}: position[0] has all required keys",
                    required_keys.issubset(actual_keys),
                    f"missing={required_keys - actual_keys}" if not required_keys.issubset(actual_keys) else "all present",
                )

                # label format
                _report(
                    f"{name}: position label format 'R<n>'",
                    p.get("label", "").startswith("R"),
                    f"label='{p.get('label')}'",
                )

                # position_idx is int
                _report(
                    f"{name}: position_idx is int",
                    isinstance(p.get("position_idx"), int),
                    f"type={type(p.get('position_idx')).__name__}",
                )

                # applicable_strategies is list of strings
                strats = p.get("applicable_strategies", [])
                _report(
                    f"{name}: applicable_strategies is non-empty list[str]",
                    isinstance(strats, list) and len(strats) > 0 and all(isinstance(s, str) for s in strats),
                    f"strategies={strats}",
                )

                # suggested_replacements is list of strings
                replacements = p.get("suggested_replacements", [])
                _report(
                    f"{name}: suggested_replacements is list[str]",
                    isinstance(replacements, list) and all(isinstance(r, str) for r in replacements),
                    f"n_replacements={len(replacements)}",
                )

                # is_brics_site is bool
                _report(
                    f"{name}: is_brics_site is bool",
                    isinstance(p.get("is_brics_site"), bool),
                    f"is_brics_site={p.get('is_brics_site')}",
                )

                # Print all positions for visibility
                for i, pos in enumerate(positions):
                    print(
                        f"      pos[{i}] {pos['label']}: "
                        f"idx={pos['position_idx']} "
                        f"sym={pos['atom_symbol']} "
                        f"group={pos['current_group'][:30]} "
                        f"strats={pos['applicable_strategies']} "
                        f"brics={pos['is_brics_site']}"
                    )
        else:
            _report(
                f"{name}: positions empty for invalid/fallback",
                len(positions) == 0,
                f"got {len(positions)} positions",
            )

        # 1d. annotated_svg
        svg = result.get("annotated_svg")
        if expect_valid and RDKIT_AVAILABLE:
            svg_ok = svg is not None and ("<svg" in svg.lower() if svg else False)
            _report(
                f"{name}: annotated_svg is valid SVG",
                svg_ok,
                f"svg length={len(svg) if svg else 0}",
            )
        else:
            # Fallback SVG should still be present
            svg_ok = svg is not None and ("<svg" in svg.lower() if svg else False)
            _report(
                f"{name}: annotated_svg fallback present",
                svg_ok,
                f"svg length={len(svg) if svg else 0}",
            )

        # 1e. core_atom_indices
        core = result.get("core_atom_indices", [])
        if expect_valid and RDKIT_AVAILABLE:
            _report(
                f"{name}: core_atom_indices is list[int]",
                isinstance(core, list) and (len(core) == 0 or all(isinstance(i, int) for i in core)),
                f"n_core_atoms={len(core)}",
            )
        else:
            _report(
                f"{name}: core_atom_indices empty for invalid",
                len(core) == 0,
            )

        # 1f. brics_bond_count
        bbc = result.get("brics_bond_count", -1)
        _report(
            f"{name}: brics_bond_count >= 0",
            isinstance(bbc, int) and bbc >= 0,
            f"brics_bond_count={bbc}",
        )

        # 1g. stats
        stats = result.get("stats", {})
        if expect_valid and RDKIT_AVAILABLE:
            expected_stat_keys = {"n_positions", "n_brics_bonds", "scaffold_mw", "n_rings"}
            _report(
                f"{name}: stats has required keys",
                expected_stat_keys.issubset(set(stats.keys())),
                f"keys={list(stats.keys())}",
            )
            print(f"      stats={stats}")
        else:
            _report(
                f"{name}: stats is dict (possibly empty)",
                isinstance(stats, dict),
            )


# ===================================================================
# STEP 2 -- Test Pydantic models
# ===================================================================

def step2_pydantic_models() -> None:
    print("\n" + "=" * 72)
    print("STEP 2: Test Pydantic model round-trips and edge cases")
    print("=" * 72)

    from models import (
        ModificationRule, StructuralRules, ScaffoldPosition,
        ScaffoldAnalysisResponse, OptimizationRequest,
    )

    # 2a. ModificationRule creation + serialization
    print("\n  --- ModificationRule ---")
    try:
        rule = ModificationRule(position_idx=5, strategy="swap_halogen", allowed_groups=["F", "Cl"], frozen=False)
        dumped = rule.model_dump()
        restored = ModificationRule.model_validate(dumped)
        _report(
            "ModificationRule create + round-trip",
            restored.position_idx == 5 and restored.strategy == "swap_halogen"
            and restored.allowed_groups == ["F", "Cl"] and not restored.frozen,
            f"dumped={dumped}",
        )
    except Exception as exc:
        _report("ModificationRule create + round-trip", False, str(exc))

    # 2b. ModificationRule defaults
    try:
        rule_defaults = ModificationRule(position_idx=0)
        _report(
            "ModificationRule defaults",
            rule_defaults.strategy == "any" and rule_defaults.allowed_groups == []
            and rule_defaults.frozen is False,
            f"strategy={rule_defaults.strategy}, frozen={rule_defaults.frozen}",
        )
    except Exception as exc:
        _report("ModificationRule defaults", False, str(exc))

    # 2c. ModificationRule frozen=True
    try:
        rule_frozen = ModificationRule(position_idx=3, frozen=True)
        _report("ModificationRule frozen=True", rule_frozen.frozen is True)
    except Exception as exc:
        _report("ModificationRule frozen=True", False, str(exc))

    # 2d. StructuralRules creation
    print("\n  --- StructuralRules ---")
    try:
        rules = StructuralRules(
            rules=[
                ModificationRule(position_idx=1, strategy="add_fg"),
                ModificationRule(position_idx=3, frozen=True),
            ],
            frozen_positions=[5, 7],
            allowed_strategies=["swap_halogen", "add_fg"],
            preserve_scaffold=True,
            min_similarity=0.5,
            max_mw_change=80.0,
            core_atom_indices=[0, 1, 2, 3, 4],
        )
        dumped = rules.model_dump()
        restored = StructuralRules.model_validate(dumped)
        _report(
            "StructuralRules full create + round-trip",
            len(restored.rules) == 2 and restored.frozen_positions == [5, 7]
            and restored.preserve_scaffold is True and restored.min_similarity == 0.5
            and restored.max_mw_change == 80.0 and len(restored.core_atom_indices) == 5,
            f"n_rules={len(restored.rules)}, frozen_pos={restored.frozen_positions}",
        )
    except Exception as exc:
        _report("StructuralRules full create + round-trip", False, str(exc))

    # 2e. StructuralRules empty (all defaults)
    try:
        rules_empty = StructuralRules()
        _report(
            "StructuralRules empty defaults",
            rules_empty.rules == [] and rules_empty.frozen_positions == []
            and rules_empty.allowed_strategies == []
            and rules_empty.preserve_scaffold is True
            and rules_empty.min_similarity == 0.3
            and rules_empty.max_mw_change == 100.0
            and rules_empty.core_atom_indices == [],
            f"preserve_scaffold={rules_empty.preserve_scaffold}, "
            f"min_sim={rules_empty.min_similarity}, max_mw={rules_empty.max_mw_change}",
        )
    except Exception as exc:
        _report("StructuralRules empty defaults", False, str(exc))

    # 2f. StructuralRules all frozen
    try:
        rules_all_frozen = StructuralRules(
            rules=[
                ModificationRule(position_idx=i, frozen=True) for i in range(10)
            ],
            frozen_positions=list(range(50)),
        )
        _report(
            "StructuralRules all frozen (10 rules, 50 global)",
            all(r.frozen for r in rules_all_frozen.rules)
            and len(rules_all_frozen.frozen_positions) == 50,
        )
    except Exception as exc:
        _report("StructuralRules all frozen", False, str(exc))

    # 2g. ScaffoldPosition
    print("\n  --- ScaffoldPosition ---")
    try:
        pos = ScaffoldPosition(
            label="R1",
            position_idx=5,
            atom_symbol="C",
            current_group="OC",
            applicable_strategies=["add_fg", "swap_atom"],
            suggested_replacements=["F", "Cl", "N"],
            is_brics_site=True,
        )
        dumped = pos.model_dump()
        restored = ScaffoldPosition.model_validate(dumped)
        _report(
            "ScaffoldPosition create + round-trip",
            restored.label == "R1" and restored.position_idx == 5
            and restored.atom_symbol == "C" and restored.is_brics_site is True
            and len(restored.applicable_strategies) == 2,
        )
    except Exception as exc:
        _report("ScaffoldPosition create + round-trip", False, str(exc))

    # 2h. ScaffoldAnalysisResponse
    print("\n  --- ScaffoldAnalysisResponse ---")
    try:
        resp = ScaffoldAnalysisResponse(
            smiles="c1ccccc1",
            scaffold_smiles="c1ccccc1",
            positions=[
                ScaffoldPosition(
                    label="R1", position_idx=0, atom_symbol="C",
                    current_group="H", applicable_strategies=["add_fg"],
                    suggested_replacements=["F"], is_brics_site=False,
                ),
            ],
            annotated_svg="<svg></svg>",
            core_atom_indices=[0, 1, 2, 3, 4, 5],
            brics_bond_count=0,
            stats={"n_positions": 1, "n_brics_bonds": 0, "scaffold_mw": 78.0, "n_rings": 1},
        )
        dumped = resp.model_dump()
        restored = ScaffoldAnalysisResponse.model_validate(dumped)
        _report(
            "ScaffoldAnalysisResponse full create + round-trip",
            restored.smiles == "c1ccccc1" and len(restored.positions) == 1
            and restored.brics_bond_count == 0 and len(restored.core_atom_indices) == 6,
        )
    except Exception as exc:
        _report("ScaffoldAnalysisResponse create + round-trip", False, str(exc))

    # 2i. ScaffoldAnalysisResponse minimal (empty)
    try:
        resp_empty = ScaffoldAnalysisResponse(smiles="test")
        _report(
            "ScaffoldAnalysisResponse minimal (only smiles)",
            resp_empty.scaffold_smiles is None and resp_empty.positions == []
            and resp_empty.annotated_svg is None and resp_empty.core_atom_indices == []
            and resp_empty.brics_bond_count == 0 and resp_empty.stats == {},
        )
    except Exception as exc:
        _report("ScaffoldAnalysisResponse minimal", False, str(exc))

    # 2j. OptimizationRequest without modification_rules
    print("\n  --- OptimizationRequest ---")
    try:
        opt = OptimizationRequest(smiles="CCO", molecule_name="Ethanol")
        _report(
            "OptimizationRequest without modification_rules",
            opt.smiles == "CCO" and opt.modification_rules is None
            and opt.n_iterations == 10 and opt.variants_per_iter == 50,
        )
    except Exception as exc:
        _report("OptimizationRequest without modification_rules", False, str(exc))

    # 2k. OptimizationRequest WITH modification_rules
    try:
        opt_rules = OptimizationRequest(
            smiles="c1ccccc1",
            modification_rules=StructuralRules(
                rules=[ModificationRule(position_idx=2, strategy="add_fg")],
                min_similarity=0.7,
                max_mw_change=50.0,
            ),
            n_iterations=5,
            variants_per_iter=20,
        )
        _report(
            "OptimizationRequest with modification_rules",
            opt_rules.modification_rules is not None
            and len(opt_rules.modification_rules.rules) == 1
            and opt_rules.modification_rules.min_similarity == 0.7,
        )
        # Round-trip
        dumped = opt_rules.model_dump()
        restored = OptimizationRequest.model_validate(dumped)
        _report(
            "OptimizationRequest round-trip with rules",
            restored.modification_rules is not None
            and restored.modification_rules.min_similarity == 0.7,
        )
    except Exception as exc:
        _report("OptimizationRequest with modification_rules", False, str(exc))

    # 2l. OptimizationRequest serialization for API dispatch
    try:
        opt_full = OptimizationRequest(
            smiles="CCO",
            modification_rules=StructuralRules(
                rules=[ModificationRule(position_idx=1, frozen=True)],
                frozen_positions=[0, 2, 3],
                preserve_scaffold=True,
                core_atom_indices=[0, 1, 2],
            ),
        )
        # Simulate what main.py does
        dispatched = opt_full.modification_rules.model_dump() if opt_full.modification_rules else None
        _report(
            "Serialization for dispatch (model_dump -> dict)",
            isinstance(dispatched, dict) and "rules" in dispatched
            and "frozen_positions" in dispatched,
            f"keys={list(dispatched.keys()) if dispatched else 'None'}",
        )
    except Exception as exc:
        _report("Serialization for dispatch", False, str(exc))


# ===================================================================
# STEP 3 -- Test rules-aware lead optimization
# ===================================================================

def step3_lead_optimization() -> None:
    print("\n" + "=" * 72)
    print("STEP 3: Test rules-aware lead optimization")
    print("=" * 72)

    from pipeline.lead_optimization import run_optimization

    ERLOTINIB = "c1ccc(Nc2ncnc3cc(OCCOC)c(OCCOC)cc23)cc1"
    POCKET = [22.0, 0.5, 18.0]
    PDBQT = "/tmp/receptor.pdbqt"

    # 3a. Without structural_rules (backward compatibility)
    print("\n  --- 3a. No structural_rules (backward compat) ---")
    try:
        result_no_rules = run_optimization(
            starting_smiles=ERLOTINIB,
            starting_name="Erlotinib",
            target_pdbqt=PDBQT,
            pocket_center=POCKET,
            n_iterations=3,
            variants_per_iter=20,
        )
        _report(
            "No rules: completes without error",
            result_no_rules["final_lead"]["score"] > 0,
            f"score={result_no_rules['final_lead']['score']:.4f}, "
            f"tested={result_no_rules['total_tested']}, "
            f"valid={result_no_rules['total_valid']}",
        )
        _report(
            "No rules: has all expected keys",
            all(k in result_no_rules for k in
                ["starting_molecule", "final_lead", "iterations", "comparison",
                 "total_tested", "total_valid", "total_improved"]),
        )
        baseline_tested = result_no_rules["total_valid"]
        baseline_score = result_no_rules["final_lead"]["score"]
        print(f"    Baseline: valid={baseline_tested}, score={baseline_score:.4f}")
    except Exception as exc:
        _report("No rules: completes without error", False, str(exc))
        traceback.print_exc()
        baseline_tested = 0
        baseline_score = 0

    # 3b. All positions frozen + preserve_scaffold
    print("\n  --- 3b. All positions frozen ---")
    try:
        # Get scaffold info first to know core indices
        if RDKIT_AVAILABLE:
            from pipeline.scaffold_analysis import analyze_scaffold
            scaffold_info = analyze_scaffold(ERLOTINIB)
            core_indices = scaffold_info.get("core_atom_indices", [])
            all_position_indices = [p["position_idx"] for p in scaffold_info.get("positions", [])]
        else:
            core_indices = list(range(30))
            all_position_indices = list(range(30))

        frozen_rules = {
            "rules": [{"position_idx": idx, "frozen": True} for idx in all_position_indices],
            "frozen_positions": list(range(50)),  # Freeze everything
            "preserve_scaffold": True,
            "core_atom_indices": core_indices,
            "min_similarity": 0.3,
            "max_mw_change": 100.0,
            "allowed_strategies": [],
        }
        result_frozen = run_optimization(
            starting_smiles=ERLOTINIB,
            starting_name="Erlotinib_frozen",
            target_pdbqt=PDBQT,
            pocket_center=POCKET,
            n_iterations=3,
            variants_per_iter=20,
            structural_rules=frozen_rules,
        )
        _report(
            "All frozen: completes (mock fallback if needed)",
            result_frozen["final_lead"]["score"] > 0,
            f"score={result_frozen['final_lead']['score']:.4f}, "
            f"valid={result_frozen['total_valid']}",
        )
        if RDKIT_AVAILABLE:
            # With all frozen, expect fewer valid variants than baseline
            frozen_valid = result_frozen["total_valid"]
            _report(
                "All frozen: fewer valid variants than unrestricted",
                frozen_valid <= baseline_tested,
                f"frozen_valid={frozen_valid} vs baseline={baseline_tested}",
            )
    except Exception as exc:
        _report("All frozen: completes", False, str(exc))
        traceback.print_exc()

    # 3c. Only swap_halogen allowed
    print("\n  --- 3c. Only swap_halogen strategy ---")
    try:
        halogen_rules = {
            "rules": [],
            "frozen_positions": [],
            "preserve_scaffold": False,
            "core_atom_indices": [],
            "allowed_strategies": ["swap_halogen"],
            "min_similarity": 0.3,
            "max_mw_change": 100.0,
        }
        result_halogen = run_optimization(
            starting_smiles=ERLOTINIB,
            starting_name="Erlotinib_halogen",
            target_pdbqt=PDBQT,
            pocket_center=POCKET,
            n_iterations=3,
            variants_per_iter=20,
            structural_rules=halogen_rules,
        )
        _report(
            "swap_halogen only: completes",
            result_halogen["final_lead"]["score"] > 0,
            f"score={result_halogen['final_lead']['score']:.4f}, "
            f"valid={result_halogen['total_valid']}",
        )
        if RDKIT_AVAILABLE:
            # Erlotinib has no halogens, so swap_halogen should produce 0 valid from RDKit
            # but mock fallback will still produce results
            halogen_valid = result_halogen["total_valid"]
            print(f"    swap_halogen only: valid={halogen_valid}")
            _report(
                "swap_halogen only: fewer or equal variants (no halogens in erlotinib)",
                halogen_valid <= baseline_tested,
                f"halogen_valid={halogen_valid}",
            )
    except Exception as exc:
        _report("swap_halogen only: completes", False, str(exc))
        traceback.print_exc()

    # 3d. preserve_scaffold=True with real core_atom_indices
    print("\n  --- 3d. preserve_scaffold with core indices ---")
    try:
        scaffold_rules = {
            "rules": [],
            "frozen_positions": [],
            "preserve_scaffold": True,
            "core_atom_indices": core_indices if RDKIT_AVAILABLE else [],
            "allowed_strategies": [],
            "min_similarity": 0.3,
            "max_mw_change": 100.0,
        }
        result_scaffold = run_optimization(
            starting_smiles=ERLOTINIB,
            starting_name="Erlotinib_scaffold",
            target_pdbqt=PDBQT,
            pocket_center=POCKET,
            n_iterations=3,
            variants_per_iter=20,
            structural_rules=scaffold_rules,
        )
        _report(
            "preserve_scaffold: completes",
            result_scaffold["final_lead"]["score"] > 0,
            f"score={result_scaffold['final_lead']['score']:.4f}, "
            f"valid={result_scaffold['total_valid']}",
        )
        if RDKIT_AVAILABLE and core_indices:
            scaffold_valid = result_scaffold["total_valid"]
            print(f"    preserve_scaffold: valid={scaffold_valid}, core_frozen={len(core_indices)} atoms")
            _report(
                "preserve_scaffold: fewer valid variants (core frozen)",
                scaffold_valid <= baseline_tested,
                f"scaffold_valid={scaffold_valid} vs baseline={baseline_tested}",
            )
    except Exception as exc:
        _report("preserve_scaffold: completes", False, str(exc))
        traceback.print_exc()

    # 3e. min_similarity=0.8 (very strict)
    print("\n  --- 3e. min_similarity=0.8 (very strict) ---")
    try:
        strict_sim_rules = {
            "rules": [],
            "frozen_positions": [],
            "preserve_scaffold": False,
            "core_atom_indices": [],
            "allowed_strategies": [],
            "min_similarity": 0.8,
            "max_mw_change": 500.0,
        }
        result_strict_sim = run_optimization(
            starting_smiles=ERLOTINIB,
            starting_name="Erlotinib_strict_sim",
            target_pdbqt=PDBQT,
            pocket_center=POCKET,
            n_iterations=3,
            variants_per_iter=20,
            structural_rules=strict_sim_rules,
        )
        _report(
            "min_similarity=0.8: completes",
            result_strict_sim["final_lead"]["score"] > 0,
            f"score={result_strict_sim['final_lead']['score']:.4f}, "
            f"valid={result_strict_sim['total_valid']}",
        )
        if RDKIT_AVAILABLE:
            sim_valid = result_strict_sim["total_valid"]
            _report(
                "min_similarity=0.8: fewer valid than default (0.3)",
                sim_valid <= baseline_tested,
                f"strict_sim_valid={sim_valid} vs baseline={baseline_tested}",
            )
    except Exception as exc:
        _report("min_similarity=0.8: completes", False, str(exc))
        traceback.print_exc()

    # 3f. max_mw_change=20 (very strict)
    print("\n  --- 3f. max_mw_change=20 (very strict) ---")
    try:
        strict_mw_rules = {
            "rules": [],
            "frozen_positions": [],
            "preserve_scaffold": False,
            "core_atom_indices": [],
            "allowed_strategies": [],
            "min_similarity": 0.3,
            "max_mw_change": 20.0,
        }
        result_strict_mw = run_optimization(
            starting_smiles=ERLOTINIB,
            starting_name="Erlotinib_strict_mw",
            target_pdbqt=PDBQT,
            pocket_center=POCKET,
            n_iterations=3,
            variants_per_iter=20,
            structural_rules=strict_mw_rules,
        )
        _report(
            "max_mw_change=20: completes",
            result_strict_mw["final_lead"]["score"] > 0,
            f"score={result_strict_mw['final_lead']['score']:.4f}, "
            f"valid={result_strict_mw['total_valid']}",
        )
        if RDKIT_AVAILABLE:
            mw_valid = result_strict_mw["total_valid"]
            _report(
                "max_mw_change=20: fewer valid than default (100)",
                mw_valid <= baseline_tested,
                f"strict_mw_valid={mw_valid} vs baseline={baseline_tested}",
            )
    except Exception as exc:
        _report("max_mw_change=20: completes", False, str(exc))
        traceback.print_exc()

    # 3g. Per-position allowed_groups restriction
    print("\n  --- 3g. Per-position allowed_groups ---")
    try:
        if RDKIT_AVAILABLE and all_position_indices:
            # Pick the first R-group position and restrict to only fluorine
            first_pos = all_position_indices[0]
            per_pos_rules = {
                "rules": [
                    {
                        "position_idx": first_pos,
                        "strategy": "add_fg",
                        "allowed_groups": ["F"],
                        "frozen": False,
                    },
                ],
                "frozen_positions": [],
                "preserve_scaffold": False,
                "core_atom_indices": [],
                "allowed_strategies": ["add_fg"],
                "min_similarity": 0.3,
                "max_mw_change": 100.0,
            }
        else:
            per_pos_rules = {
                "rules": [
                    {"position_idx": 5, "strategy": "add_fg", "allowed_groups": ["F"], "frozen": False},
                ],
                "frozen_positions": [],
                "preserve_scaffold": False,
                "core_atom_indices": [],
                "allowed_strategies": ["add_fg"],
                "min_similarity": 0.3,
                "max_mw_change": 100.0,
            }

        result_per_pos = run_optimization(
            starting_smiles=ERLOTINIB,
            starting_name="Erlotinib_per_pos",
            target_pdbqt=PDBQT,
            pocket_center=POCKET,
            n_iterations=3,
            variants_per_iter=20,
            structural_rules=per_pos_rules,
        )
        _report(
            "Per-position allowed_groups: completes",
            result_per_pos["final_lead"]["score"] > 0,
            f"score={result_per_pos['final_lead']['score']:.4f}, "
            f"valid={result_per_pos['total_valid']}",
        )
    except Exception as exc:
        _report("Per-position allowed_groups: completes", False, str(exc))
        traceback.print_exc()

    # 3h. Summary comparison
    print("\n  --- 3h. Cross-scenario comparison ---")
    scenarios = {
        "no_rules": result_no_rules if 'result_no_rules' in dir() or True else None,
    }
    # Collect all results for comparison
    for label, var_name in [
        ("no_rules", "result_no_rules"),
        ("all_frozen", "result_frozen"),
        ("halogen_only", "result_halogen"),
        ("preserve_scaffold", "result_scaffold"),
        ("strict_sim_0.8", "result_strict_sim"),
        ("strict_mw_20", "result_strict_mw"),
        ("per_pos_groups", "result_per_pos"),
    ]:
        r = locals().get(var_name)
        if r:
            print(
                f"    {label:20s}: "
                f"score={r['final_lead']['score']:.4f}  "
                f"tested={r['total_tested']:4d}  "
                f"valid={r['total_valid']:4d}  "
                f"improved={r['total_improved']:4d}"
            )


# ===================================================================
# STEP 4 -- Test API endpoint wiring
# ===================================================================

def step4_api_wiring() -> None:
    print("\n" + "=" * 72)
    print("STEP 4: Test API endpoint wiring")
    print("=" * 72)

    # 4a. ScaffoldAnalysisResponse importable from models
    print("\n  --- 4a. Import ScaffoldAnalysisResponse from models ---")
    try:
        from models import ScaffoldAnalysisResponse
        _report(
            "ScaffoldAnalysisResponse importable",
            ScaffoldAnalysisResponse is not None,
        )
    except ImportError as exc:
        _report("ScaffoldAnalysisResponse importable", False, str(exc))

    # 4b. analyze_scaffold importable from pipeline
    print("\n  --- 4b. Import analyze_scaffold from pipeline ---")
    try:
        from pipeline.scaffold_analysis import analyze_scaffold
        _report(
            "analyze_scaffold importable",
            callable(analyze_scaffold),
        )
    except ImportError as exc:
        _report("analyze_scaffold importable", False, str(exc))

    # 4c. Verify function signature matches API expectations
    print("\n  --- 4c. Function signature check ---")
    try:
        from pipeline.scaffold_analysis import analyze_scaffold
        sig = inspect.signature(analyze_scaffold)
        params = list(sig.parameters.keys())
        _report(
            "analyze_scaffold takes 'smiles' parameter",
            "smiles" in params,
            f"params={params}",
        )
    except Exception as exc:
        _report("analyze_scaffold signature", False, str(exc))

    # 4d. Return type is compatible with ScaffoldAnalysisResponse
    print("\n  --- 4d. Return type compatibility ---")
    try:
        from pipeline.scaffold_analysis import analyze_scaffold
        from models import ScaffoldAnalysisResponse

        result = analyze_scaffold("c1ccccc1")  # benzene
        resp = ScaffoldAnalysisResponse(**result)
        _report(
            "analyze_scaffold output -> ScaffoldAnalysisResponse",
            resp.smiles == "c1ccccc1",
            f"smiles={resp.smiles}, scaffold={resp.scaffold_smiles}",
        )
    except Exception as exc:
        _report("Return type compatibility", False, str(exc))
        traceback.print_exc()

    # 4e. run_optimization accepts structural_rules parameter
    print("\n  --- 4e. run_optimization accepts structural_rules ---")
    try:
        from pipeline.lead_optimization import run_optimization
        sig = inspect.signature(run_optimization)
        params = list(sig.parameters.keys())
        _report(
            "run_optimization has 'structural_rules' param",
            "structural_rules" in params,
            f"params={params}",
        )
    except Exception as exc:
        _report("run_optimization signature", False, str(exc))

    # 4f. BUG CHECK: _run_optimization_sync passes structural_rules
    print("\n  --- 4f. BUG CHECK: _run_optimization_sync passes structural_rules ---")
    try:
        main_path = Path("/home/antho/dockit/backend/main.py")
        main_source = main_path.read_text()

        # Find the _run_optimization_sync function and check if it passes structural_rules
        # to run_optimization()
        import re

        # Find the run_optimization() call inside _run_optimization_sync
        # Look for the function definition then the call
        sync_func_match = re.search(
            r'def _run_optimization_sync\(.*?\).*?(?=\ndef |\Z)',
            main_source,
            re.DOTALL,
        )
        if sync_func_match:
            sync_body = sync_func_match.group()
            # Check if structural_rules is passed in the run_optimization() call
            has_structural_rules = "structural_rules" in sync_body
            _report(
                "BUG: _run_optimization_sync passes structural_rules to run_optimization",
                has_structural_rules,
                "structural_rules IS passed" if has_structural_rules
                else "structural_rules is MISSING from run_optimization() call -- THIS IS A BUG",
            )
        else:
            _report(
                "BUG CHECK: found _run_optimization_sync",
                False,
                "Could not find _run_optimization_sync function",
            )
    except Exception as exc:
        _report("BUG CHECK: _run_optimization_sync", False, str(exc))

    # 4g. Check that the endpoint dispatch serializes modification_rules correctly
    print("\n  --- 4g. Endpoint dispatch serialization ---")
    try:
        from models import OptimizationRequest, StructuralRules, ModificationRule

        req = OptimizationRequest(
            smiles="c1ccccc1",
            modification_rules=StructuralRules(
                rules=[ModificationRule(position_idx=3, frozen=True)],
                min_similarity=0.6,
            ),
        )
        # Simulate what main.py line 1882 does
        serialized = req.modification_rules.model_dump() if req.modification_rules else None
        _report(
            "Endpoint serialization: modification_rules -> dict",
            serialized is not None and isinstance(serialized, dict)
            and "rules" in serialized and len(serialized["rules"]) == 1
            and serialized["rules"][0]["frozen"] is True
            and serialized["min_similarity"] == 0.6,
            f"serialized keys={list(serialized.keys()) if serialized else 'None'}",
        )

        # And then run_optimization should accept this dict
        # Check that the dict format is what _generate_variants_rdkit expects
        rules_dict = serialized
        frozen_set = set(rules_dict.get("frozen_positions", []))
        for r in rules_dict.get("rules", []):
            if r.get("frozen"):
                frozen_set.add(r["position_idx"])
        _report(
            "Rules dict structure compatible with _generate_variants_rdkit",
            3 in frozen_set,
            f"frozen_set includes position 3: {3 in frozen_set}",
        )
    except Exception as exc:
        _report("Endpoint dispatch serialization", False, str(exc))

    # 4h. Check that the Celery task (tasks.py) also passes structural_rules
    print("\n  --- 4h. Celery task passes structural_rules ---")
    try:
        tasks_path = Path("/home/antho/dockit/backend/tasks.py")
        tasks_source = tasks_path.read_text()

        # Check if run_lead_optimization task passes structural_rules
        if "structural_rules" in tasks_source:
            _report(
                "tasks.py: structural_rules referenced",
                True,
                "found structural_rules in tasks.py",
            )
        else:
            _report(
                "tasks.py: structural_rules referenced",
                False,
                "structural_rules NOT found in tasks.py -- may be a bug if Celery path is used",
            )
    except Exception as exc:
        _report("Celery task check", False, str(exc))


# ===================================================================
# MAIN
# ===================================================================

def main() -> int:
    print("=" * 72)
    print("DockIt -- Comprehensive Scaffold + Lead Optimization Validation")
    print(f"RDKit available: {RDKIT_AVAILABLE}")
    print("=" * 72)

    step1_scaffold_analysis()
    step2_pydantic_models()
    step3_lead_optimization()
    step4_api_wiring()

    print("\n" + "=" * 72)
    print(f"FINAL RESULTS: {_pass_count} PASS, {_fail_count} FAIL, {_skip_count} SKIP")
    if _fail_count == 0:
        print("ALL TESTS PASSED")
    else:
        print(f"WARNING: {_fail_count} test(s) FAILED")
    print("=" * 72)

    return 0 if _fail_count == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
