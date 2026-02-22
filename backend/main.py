"""
DockIt — FastAPI application.

Provides the REST API for creating docking jobs, polling status,
and downloading results.
V2: advanced mode with generation, ADMET, retrosynthesis.
V3: rapid/standard/deep modes, sequence input, auto strategy, score_100,
    affinity_stars, toxicity, pedagogical tips, pipeline_summary.
"""

from __future__ import annotations

import json
import logging
import os
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator, Optional
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from database import create_job, get_job, init_db
from models import (
    ADMETResult, DockingResult, JobCreate, JobResults, JobStatus,
    OffTargetResult, OptimizationRequest, OptimizationStatus,
    SynthesisRoute, SynthesisStep,
)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("dockit.api")

DATA_DIR = Path(os.environ.get("DOCKIT_DATA_DIR", "/data")) / "jobs"

# Thread pool for non-blocking Celery dispatch
_dispatch_pool = ThreadPoolExecutor(max_workers=2)


# ---------------------------------------------------------------------------
# V3 helpers
# ---------------------------------------------------------------------------

def _compute_score_100(composite_score: float) -> int:
    """Map a composite score (0.0-1.0 range) to an integer 0-100.

    Parameters
    ----------
    composite_score : float
        Raw composite score, typically between 0 and 1.

    Returns
    -------
    int
        Score mapped to 0-100, clamped.
    """
    return max(0, min(100, int(round(composite_score * 100))))


def _compute_affinity_stars(affinity: float) -> int:
    """Map a binding affinity (kcal/mol, negative is better) to 1-5 stars.

    Parameters
    ----------
    affinity : float
        Binding affinity in kcal/mol (more negative = stronger binding).

    Returns
    -------
    int
        Star rating from 1 (weak) to 5 (very strong).
    """
    if affinity < -10.0:
        return 5
    elif affinity < -8.0:
        return 4
    elif affinity < -6.0:
        return 3
    elif affinity < -4.0:
        return 2
    else:
        return 1


def _get_toxicity_info(admet_data: Optional[dict]) -> tuple[str, str]:
    """Derive toxicity level and color from ADMET data.

    Parameters
    ----------
    admet_data : dict or None
        ADMET result dictionary.

    Returns
    -------
    tuple[str, str]
        (toxicity_level, toxicity_color) where level is low/medium/high/unknown
        and color is a hex color code.
    """
    if not admet_data or not isinstance(admet_data, dict):
        return "unknown", "#9ca3af"

    # Check the color_code or composite_score from ADMET
    color_code = admet_data.get("color_code", "yellow")
    composite = admet_data.get("composite_score", 0.5)
    flags = admet_data.get("flags", [])

    # Derive from flags count and composite
    if color_code == "green" or (composite >= 0.7 and len(flags) == 0):
        return "low", "#22c55e"
    elif color_code == "red" or composite < 0.3 or len(flags) >= 3:
        return "high", "#ef4444"
    else:
        return "medium", "#f59e0b"


def _get_synthesis_info(synthesis_route: Optional[dict]) -> tuple[Optional[int], Optional[str], Optional[str]]:
    """Extract synthesis feasibility from a synthesis route dict.

    Parameters
    ----------
    synthesis_route : dict or None
        Synthesis route dictionary.

    Returns
    -------
    tuple[Optional[int], Optional[str], Optional[str]]
        (n_steps, feasibility, color) where feasibility is easy/moderate/hard/unknown.
    """
    if not synthesis_route or not isinstance(synthesis_route, dict):
        return None, None, None

    n_steps = synthesis_route.get("n_steps", 0)
    confidence = synthesis_route.get("confidence", 0.0)
    available = synthesis_route.get("all_reagents_available", False)

    if n_steps <= 3 and confidence >= 0.7 and available:
        return n_steps, "easy", "#22c55e"
    elif n_steps <= 6 and confidence >= 0.4:
        return n_steps, "moderate", "#f59e0b"
    elif n_steps > 0:
        return n_steps, "hard", "#ef4444"
    else:
        return None, None, None


def _get_pedagogical_tip(step: str) -> str:
    """Return an educational text explaining what is happening at each pipeline step.

    Parameters
    ----------
    step : str
        Current pipeline step name or keyword.

    Returns
    -------
    str
        A short pedagogical explanation in English.
    """
    tips = {
        "structure": (
            "The 3D structure of the protein is essential for molecular docking. "
            "It reveals the exact shape of the active site where candidate molecules "
            "will bind. We use AlphaFold (AI prediction) or experimental structures (X-ray, cryo-EM)."
        ),
        "pockets": (
            "Binding pockets are cavities on the protein surface where small molecules "
            "can bind. The fpocket algorithm analyzes the protein geometry to identify "
            "these cavities. The best pocket is selected for docking."
        ),
        "prepare": (
            "Receptor preparation converts the PDB structure to PDBQT format, "
            "which is required by AutoDock Vina. This step adds partial charges "
            "and atom types used in the affinity calculation."
        ),
        "ligands": (
            "Ligands are the candidate small molecules that will be tested against the protein. "
            "They come from databases such as ChEMBL (known molecules) or ZINC (drug-like molecules). "
            "The more studied a target is, the more reference compounds are available."
        ),
        "docking": (
            "Molecular docking simulates the interaction between each ligand and the protein. "
            "AutoDock Vina explores thousands of conformations to find the optimal position "
            "of the ligand in the pocket. The affinity (in kcal/mol) indicates the binding strength -- the more negative, the better."
        ),
        "scoring": (
            "Scoring combines binding affinity with physicochemical properties "
            "(Lipinski, QED, logP) to produce a composite score. A good drug candidate "
            "must have strong affinity AND good drug-like properties."
        ),
        "admet": (
            "ADMET stands for Absorption, Distribution, Metabolism, Excretion, and Toxicity. "
            "These predictions evaluate whether a molecule will be well absorbed by the body, "
            "whether it will reach its target, and whether it poses toxicity risks."
        ),
        "generation": (
            "Molecule generation uses artificial intelligence (REINVENT4) "
            "to create new molecules optimized for the target. "
            "This is useful when few known molecules exist for a protein."
        ),
        "retrosynthesis": (
            "Retrosynthesis plans how to synthesize a molecule in the laboratory, "
            "starting from the final product and working backwards to commercially available reagents. "
            "Fewer steps and more available reagents make the synthesis more feasible."
        ),
        "report": (
            "The final report compiles all results: top molecules, scores, "
            "properties, and visualizations. It can be downloaded as a PDF to be "
            "shared with collaborators or used to guide laboratory testing."
        ),
    }

    # Match the step to a tip key
    step_lower = step.lower()
    for key, tip in tips.items():
        if key in step_lower:
            return tip

    return (
        "The molecular docking pipeline systematically analyzes the interaction "
        "between a target protein and candidate molecules to identify "
        "potential drug compounds."
    )


# ---------------------------------------------------------------------------
# V3: mode to pipeline params mapping
# ---------------------------------------------------------------------------

def _map_mode_to_params(mode: str, body: JobCreate) -> dict:
    """Map V3 mode (rapid/standard/deep) to pipeline parameters.

    Parameters
    ----------
    mode : str
        One of "rapid", "standard", "deep", or V2 compat "basic"/"advanced".
    body : JobCreate
        The original request body.

    Returns
    -------
    dict
        Pipeline parameters dict ready for the Celery task.
    """
    base_params: dict = {
        "uniprot_id": body.uniprot_id or "",
        "sequence": body.sequence,
        "smiles_list": body.smiles_list,
        "mode": mode,
        "docking_engine": body.docking_engine,
        "notification_email": body.notification_email,
    }

    if mode == "rapid" or mode == "basic":
        # Quick V1-style pipeline: small ligand set, no generation, no ADMET
        base_params.update({
            "max_ligands": body.max_ligands or 50,
            "use_chembl": body.use_chembl if body.use_chembl is not None else True,
            "use_zinc": body.use_zinc if body.use_zinc is not None else False,
            "enable_generation": False,
            "enable_diffdock": False,
            "enable_retrosynthesis": False,
            "n_generated_molecules": 0,
            "auto_strategy": False,
        })

    elif mode == "standard" or mode == "advanced":
        # Advanced pipeline: GNINA is ~15s/molecule, so default to 50 (not 500)
        base_params.update({
            "max_ligands": body.max_ligands or 50,
            "use_chembl": True,
            "use_zinc": True,
            "enable_generation": True,
            "enable_diffdock": body.enable_diffdock if body.enable_diffdock is not None else False,
            "enable_retrosynthesis": True,
            "n_generated_molecules": body.n_generated_molecules or 20,
            "auto_strategy": True,
        })

    elif mode == "deep":
        # Massive screening, up to 4h, email notification
        base_params.update({
            "max_ligands": body.max_ligands or 5000,
            "use_chembl": True,
            "use_zinc": True,
            "enable_generation": True,
            "enable_diffdock": False,
            "enable_retrosynthesis": True,
            "n_generated_molecules": body.n_generated_molecules or 200,
            "auto_strategy": True,
        })

    else:
        # Fallback to rapid
        base_params.update({
            "max_ligands": body.max_ligands or 50,
            "use_chembl": True,
            "use_zinc": False,
            "enable_generation": False,
            "enable_diffdock": False,
            "enable_retrosynthesis": False,
            "n_generated_molecules": 0,
            "auto_strategy": False,
        })

    return base_params


# ---------------------------------------------------------------------------
# Lifespan (startup / shutdown)
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan: initialise DB on startup."""
    logger.info("DockIt API starting up (V3)")
    init_db()
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    yield
    logger.info("DockIt API shutting down")
    _dispatch_pool.shutdown(wait=False)


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="DockIt API",
    description="Virtual screening / molecular docking pipeline — V5bis (Scientific Rigor Upgrade)",
    version="5.1.0",
    lifespan=lifespan,
)

# CORS — allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Helper: dispatch Celery task with timeout
# ---------------------------------------------------------------------------

def _dispatch_celery_task(job_id: str, task_params: dict, task_name: str = "run_pipeline") -> None:
    """Send the pipeline task to Celery, with a short timeout to avoid blocking.

    Parameters
    ----------
    job_id : str
        Job UUID.
    task_params : dict
        Parameters to pass to the Celery task.
    task_name : str
        Either "run_pipeline" or "run_deep_screening".
    """
    if task_name == "run_deep_screening":
        from tasks import run_deep_screening
        run_deep_screening.apply_async(
            args=[job_id, task_params],
            retry=False,
            retry_policy={"max_retries": 0},
        )
    else:
        from tasks import run_pipeline
        run_pipeline.apply_async(
            args=[job_id, task_params],
            retry=False,
            retry_policy={"max_retries": 0},
        )


# ---------------------------------------------------------------------------
# Helper: parse results JSON into DockingResult models (V3 enriched)
# ---------------------------------------------------------------------------

def _extract_admet_domain(admet_data: Optional[dict]) -> Optional[dict]:
    """Extract the applicability domain from ADMET data if present."""
    if not admet_data or not isinstance(admet_data, dict):
        return None
    ad = admet_data.get("applicability_domain")
    if isinstance(ad, dict):
        return ad
    return None


def _parse_results(raw_list: list[dict]) -> list[DockingResult]:
    """Convert raw JSON dicts into DockingResult pydantic models with V3 fields."""
    results: list[DockingResult] = []
    for r in raw_list:
        # Parse ADMET sub-object
        admet_data = r.get("admet")
        admet_obj = None
        if admet_data and isinstance(admet_data, dict):
            admet_obj = ADMETResult(
                oral_bioavailability=admet_data.get("absorption", {}).get("oral_bioavailability") if isinstance(admet_data.get("absorption"), dict) else admet_data.get("oral_bioavailability"),
                herg_inhibition=admet_data.get("toxicity", {}).get("herg_inhibition") if isinstance(admet_data.get("toxicity"), dict) else admet_data.get("herg_inhibition"),
                hepatotoxicity=admet_data.get("toxicity", {}).get("hepatotoxicity") if isinstance(admet_data.get("toxicity"), dict) else admet_data.get("hepatotoxicity"),
                ames_mutagenicity=admet_data.get("toxicity", {}).get("ames_mutagenicity") if isinstance(admet_data.get("toxicity"), dict) else admet_data.get("ames_mutagenicity"),
                bbb_permeability=admet_data.get("distribution", {}).get("bbb_permeability") if isinstance(admet_data.get("distribution"), dict) else admet_data.get("bbb_permeability"),
                plasma_protein_binding=admet_data.get("distribution", {}).get("plasma_protein_binding") if isinstance(admet_data.get("distribution"), dict) else admet_data.get("plasma_protein_binding"),
                composite_score=admet_data.get("composite_score", 0.5),
                flags=admet_data.get("flags", []),
                color_code=admet_data.get("color_code", "yellow"),
            )

        # Parse synthesis route
        synth_data = r.get("synthesis_route")
        synth_obj = None
        if synth_data and isinstance(synth_data, dict):
            steps = []
            for s in synth_data.get("steps", []):
                steps.append(SynthesisStep(
                    reaction=s.get("reaction", ""),
                    reactants=s.get("reactants", []),
                    reactant_names=s.get("reactant_names", []),
                    conditions=s.get("conditions", ""),
                    confidence=s.get("confidence", 0.0),
                ))
            synth_obj = SynthesisRoute(
                n_steps=synth_data.get("n_steps", 0),
                confidence=synth_data.get("confidence", 0.0),
                steps=steps,
                all_reagents_available=synth_data.get("all_reagents_available", False),
                estimated_cost=synth_data.get("estimated_cost", "unknown"),
                tree=synth_data.get("tree"),
                # V6.3 cost fields
                cost_estimate=synth_data.get("cost_estimate"),
                reagent_availability=synth_data.get("reagent_availability"),
            )

        # V3: compute derived fields
        affinity = r.get("affinity", 0.0)
        composite = r.get("composite_score", 0.0)
        score_100 = r.get("score_100", _compute_score_100(composite))
        affinity_stars = r.get("affinity_stars", _compute_affinity_stars(affinity))
        toxicity_level, toxicity_color = _get_toxicity_info(admet_data)
        synth_steps, synth_feasibility, synth_color = _get_synthesis_info(synth_data)

        results.append(DockingResult(
            name=r.get("name", "Unknown"),
            smiles=r.get("smiles", ""),
            affinity=affinity,
            logp=r.get("logP") or r.get("logp"),
            mw=r.get("MW") or r.get("mw"),
            tpsa=r.get("tpsa"),
            qed=r.get("qed"),
            hbd=r.get("hbd"),
            hba=r.get("hba"),
            rotatable_bonds=r.get("rotatable_bonds"),
            composite_score=composite,
            svg=r.get("svg_2d") or r.get("svg"),
            pose_pdbqt=r.get("pose_pdbqt_path"),
            source=r.get("source"),
            admet=admet_obj,
            synthesis_route=synth_obj,
            docking_method=r.get("docking_method"),
            novelty_score=r.get("novelty_score"),
            # V3 fields
            score_100=score_100,
            affinity_stars=affinity_stars,
            toxicity_level=r.get("toxicity_level", toxicity_level),
            toxicity_color=r.get("toxicity_color", toxicity_color),
            synthesis_steps=r.get("synthesis_steps", synth_steps),
            synthesis_feasibility=r.get("synthesis_feasibility", synth_feasibility),
            synthesis_color=r.get("synthesis_color", synth_color),
            # V5 fields
            off_target=r.get("off_target_results"),
            confidence=r.get("confidence"),
            # V5bis fields
            vina_score=r.get("vina_score"),
            cnn_score=r.get("cnn_score"),
            cnn_affinity=r.get("cnn_affinity"),
            consensus_rank=r.get("consensus_rank"),
            consensus_robust=r.get("consensus_robust"),
            interactions=r.get("interactions"),
            interaction_quality=r.get("interaction_quality"),
            cluster_id=r.get("cluster_id"),
            cluster_size=r.get("cluster_size"),
            is_representative=r.get("is_representative"),
            eliminated=r.get("eliminated"),
            elimination_reason=r.get("elimination_reason"),
            admet_domain=_extract_admet_domain(admet_data),
            pains_alert=r.get("pains_alert"),
            sa_score=r.get("sa_score"),
            # V6.1 fields
            consensus_detail=r.get("consensus_detail"),
            # V6.2 fields
            pareto_rank=r.get("pareto_rank"),
            pareto_front=r.get("pareto_front"),
            pareto_objectives=r.get("pareto_objectives"),
            # V6.3 fields
            combined_off_target=r.get("combined_off_target"),
            herg_specialized=r.get("herg_specialized"),
        ))
    return results


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def health_check() -> dict:
    """Health-check endpoint."""
    return {"status": "ok", "service": "dockit-api", "version": "5.1.0"}


@app.post("/api/jobs")
async def create_docking_job(body: JobCreate) -> dict:
    """Create a new docking job and dispatch it to the Celery worker.

    V3: accepts sequence input, mode rapid/standard/deep, auto-determines
    ligand strategy. Deep mode dispatches run_deep_screening task.
    """
    job_id = str(uuid4())

    # Normalize mode: map V2 names to V3
    mode = body.mode
    if mode == "basic":
        mode = "rapid"
    elif mode == "advanced":
        mode = "standard"

    # Build pipeline parameters based on mode
    task_params = _map_mode_to_params(mode, body)

    # Determine effective boolean flags for DB storage
    use_chembl = task_params.get("use_chembl", True)
    use_zinc = task_params.get("use_zinc", False)
    max_ligands = task_params.get("max_ligands", 50)
    enable_gen = task_params.get("enable_generation", False)
    enable_dd = task_params.get("enable_diffdock", False)
    enable_retro = task_params.get("enable_retrosynthesis", False)
    n_gen = task_params.get("n_generated_molecules", 100)

    # Persist in DB
    create_job(
        job_id=job_id,
        uniprot_id=body.uniprot_id,
        use_chembl=use_chembl,
        use_zinc=use_zinc,
        max_ligands=max_ligands,
        smiles_list=body.smiles_list,
        mode=mode,
        enable_generation=enable_gen,
        enable_diffdock=enable_dd,
        enable_retrosynthesis=enable_retro,
        n_generated_molecules=n_gen,
        # V3 fields
        sequence=body.sequence,
        notification_email=body.notification_email,
        docking_engine=body.docking_engine,
    )

    # Choose task type based on mode
    task_name = "run_deep_screening" if mode == "deep" else "run_pipeline"

    try:
        future = _dispatch_pool.submit(_dispatch_celery_task, job_id, task_params, task_name)
        future.result(timeout=5)  # Wait at most 5 seconds for Redis
        display_id = body.uniprot_id or f"seq[{len(body.sequence or '')}aa]"
        logger.info("Job %s dispatched for %s (mode=%s, task=%s)", job_id, display_id, mode, task_name)
    except FuturesTimeoutError:
        logger.warning("Celery dispatch timed out for job %s (Redis may be offline)", job_id)
    except Exception as exc:
        logger.warning("Celery dispatch failed for job %s: %s", job_id, exc)

    return {"job_id": job_id, "mode": mode}


@app.get("/api/jobs/{job_id}")
async def get_job_status(job_id: str) -> JobStatus:
    """Return the current status and progress of a job (V3 enriched)."""
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    # V3: parse pipeline summary from JSON if stored
    pipeline_summary = None
    pipeline_summary_json = getattr(job, "pipeline_summary_json", None)
    if pipeline_summary_json:
        try:
            pipeline_summary = json.loads(pipeline_summary_json)
        except (json.JSONDecodeError, TypeError):
            pass

    # V3: build results summary from stored results
    results_summary = None
    if job.status == "completed" and job.results_json:
        try:
            raw_results = json.loads(job.results_json)
            results_summary = {
                "total_results": len(raw_results),
                "best_affinity": min((r.get("affinity", 0.0) for r in raw_results), default=0.0),
                "best_score": max((r.get("composite_score", 0.0) for r in raw_results), default=0.0),
            }
        except (json.JSONDecodeError, TypeError):
            pass

    # V3: pedagogical tip based on current step
    current_step = job.current_step or "Queued"
    pedagogical_tip = _get_pedagogical_tip(current_step)

    job_mode = getattr(job, "mode", "rapid") or "rapid"
    # Normalize V2 mode names
    if job_mode == "basic":
        job_mode = "rapid"
    elif job_mode == "advanced":
        job_mode = "standard"

    return JobStatus(
        job_id=job.id,
        status=job.status,
        progress=job.progress,
        current_step=current_step,
        error_message=job.error_message,
        created_at=job.created_at.isoformat() if job.created_at else None,
        completed_at=job.completed_at.isoformat() if job.completed_at else None,
        mode=job_mode,
        # V3 fields
        step_details=getattr(job, "current_step", None),
        strategy_message=getattr(job, "strategy_message", None),
        pedagogical_tip=pedagogical_tip,
        structure_source=getattr(job, "structure_source", None),
        pipeline_summary=pipeline_summary,
        results_summary=results_summary,
    )


@app.get("/api/jobs/{job_id}/results")
async def get_job_results(job_id: str) -> JobResults:
    """Return the scored docking results for a completed job (V3 enriched)."""
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    if job.status != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Job is {job.status}; results are only available for completed jobs",
        )

    # Parse known results from JSON
    results: list[DockingResult] = []
    if job.results_json:
        try:
            raw = json.loads(job.results_json)
            results = _parse_results(raw)
        except (json.JSONDecodeError, TypeError, KeyError) as exc:
            logger.error("Failed to deserialise results for job %s: %s", job_id, exc)

    # Parse generated molecules (V2)
    generated: list[DockingResult] = []
    generated_json = getattr(job, "generated_json", None)
    if generated_json:
        try:
            raw_gen = json.loads(generated_json)
            generated = _parse_results(raw_gen)
        except (json.JSONDecodeError, TypeError, KeyError) as exc:
            logger.error("Failed to deserialise generated results for job %s: %s", job_id, exc)

    job_mode = getattr(job, "mode", "rapid") or "rapid"
    if job_mode == "basic":
        job_mode = "rapid"
    elif job_mode == "advanced":
        job_mode = "standard"

    # V3: parse pipeline summary
    pipeline_summary = None
    pipeline_summary_json = getattr(job, "pipeline_summary_json", None)
    if pipeline_summary_json:
        try:
            pipeline_summary = json.loads(pipeline_summary_json)
        except (json.JSONDecodeError, TypeError):
            pass

    return JobResults(
        job_id=job_id,
        protein_name=job.protein_name or job.uniprot_id or "Unknown",
        uniprot_id=job.uniprot_id or None,
        results=results,
        generated_molecules=generated,
        pdb_file_url=f"/api/jobs/{job_id}/protein" if job.pdb_path else None,
        report_pdf_url=f"/api/jobs/{job_id}/report" if job.report_path else None,
        zip_url=f"/api/jobs/{job_id}/download" if job.zip_path else None,
        mode=job_mode,
        pipeline_summary=pipeline_summary,
    )


@app.get("/api/jobs/{job_id}/synthesis/{mol_index}")
async def get_synthesis_route(job_id: str, mol_index: int) -> dict:
    """Return detailed synthesis route for a specific molecule."""
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    # Combine known + generated results
    all_results = []
    if job.results_json:
        try:
            all_results.extend(json.loads(job.results_json))
        except json.JSONDecodeError:
            pass
    generated_json = getattr(job, "generated_json", None)
    if generated_json:
        try:
            all_results.extend(json.loads(generated_json))
        except json.JSONDecodeError:
            pass

    if mol_index < 0 or mol_index >= len(all_results):
        raise HTTPException(
            status_code=404,
            detail=f"Molecule index {mol_index} out of range (0-{len(all_results)-1})",
        )

    mol = all_results[mol_index]
    route = mol.get("synthesis_route")
    if not route:
        raise HTTPException(status_code=404, detail="No synthesis route available for this molecule")

    return {
        "molecule_name": mol.get("name", "Unknown"),
        "smiles": mol.get("smiles", ""),
        "synthesis_route": route,
    }


@app.get("/api/jobs/{job_id}/report")
async def download_report(job_id: str) -> FileResponse:
    """Download the PDF (or text) report for a completed job."""
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    if not job.report_path:
        raise HTTPException(status_code=404, detail="Report not available")

    report_path = Path(job.report_path)
    if not report_path.exists():
        # Try .txt fallback
        txt_path = report_path.with_suffix(".txt")
        if txt_path.exists():
            report_path = txt_path
        else:
            raise HTTPException(status_code=404, detail="Report file not found on disk")

    media_type = "application/pdf" if report_path.suffix == ".pdf" else "text/plain"
    return FileResponse(
        path=str(report_path),
        media_type=media_type,
        filename=f"dockit_report_{job_id[:8]}{report_path.suffix}",
    )


@app.get("/api/jobs/{job_id}/download")
async def download_zip(job_id: str) -> FileResponse:
    """Download the ZIP archive of all results."""
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    if not job.zip_path:
        raise HTTPException(status_code=404, detail="ZIP archive not available")

    zip_path = Path(job.zip_path)
    if not zip_path.exists():
        raise HTTPException(status_code=404, detail="ZIP file not found on disk")

    return FileResponse(
        path=str(zip_path),
        media_type="application/zip",
        filename=f"dockit_results_{job_id[:8]}.zip",
    )


@app.get("/api/jobs/{job_id}/protein")
async def download_protein(job_id: str) -> FileResponse:
    """Download the PDB file of the target protein."""
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    if not job.pdb_path:
        raise HTTPException(status_code=404, detail="PDB file not available")

    pdb_path = Path(job.pdb_path)
    if not pdb_path.exists():
        raise HTTPException(status_code=404, detail="PDB file not found on disk")

    return FileResponse(
        path=str(pdb_path),
        media_type="chemical/x-pdb",
        filename=f"{job.uniprot_id or 'protein'}.pdb",
    )


@app.get("/api/jobs/{job_id}/pose/{ligand_index}")
async def download_pose(job_id: str, ligand_index: int) -> FileResponse:
    """Download the docked PDBQT pose for a specific ligand (by index)."""
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    if not job.results_json:
        raise HTTPException(status_code=404, detail="No results available")

    try:
        results = json.loads(job.results_json)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Corrupt results data")

    if ligand_index < 0 or ligand_index >= len(results):
        raise HTTPException(
            status_code=404,
            detail=f"Ligand index {ligand_index} out of range (0-{len(results)-1})",
        )

    pose_path_str = results[ligand_index].get("pose_pdbqt_path")
    if not pose_path_str:
        raise HTTPException(status_code=404, detail="Pose file not available for this ligand")

    pose_path = Path(pose_path_str)
    if not pose_path.exists():
        raise HTTPException(status_code=404, detail="Pose file not found on disk")

    ligand_name = results[ligand_index].get("name", f"ligand_{ligand_index}")
    return FileResponse(
        path=str(pose_path),
        media_type="chemical/x-pdbqt",
        filename=f"{ligand_name}_pose.pdbqt",
    )


# ---------------------------------------------------------------------------
# V5 Endpoints: Audit log, Lead optimization
# ---------------------------------------------------------------------------

# In-memory store for optimization results (keyed by optimization_id)
_optimization_results: dict[str, dict] = {}


@app.get("/api/jobs/{job_id}/audit_log")
async def get_audit_log(job_id: str) -> dict:
    """Return the audit log JSON for a completed (or running) job.

    The audit log is stored as ``audit_log.json`` in the job's
    working directory.
    """
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    audit_path = DATA_DIR / job_id / "audit_log.json"
    if not audit_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Audit log not available for this job",
        )

    try:
        with open(audit_path, "r", encoding="utf-8") as f:
            audit_data = json.load(f)
        return audit_data
    except (json.JSONDecodeError, IOError) as exc:
        logger.error("Failed to read audit log for job %s: %s", job_id, exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to read audit log file",
        )


@app.post("/api/jobs/{job_id}/optimize")
async def start_optimization(job_id: str, body: OptimizationRequest) -> dict:
    """Start a lead optimization task for a molecule from a completed job.

    Dispatches the optimization to a Celery task and returns an
    optimization_id for polling.

    Parameters
    ----------
    job_id : str
        UUID of the parent docking job (must be completed).
    body : OptimizationRequest
        Optimization parameters: smiles, molecule_name, weights,
        n_iterations, variants_per_iter.

    Returns
    -------
    dict
        ``{"optimization_id": str, "status": "queued"}``
    """
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    if job.status != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Job is {job.status}; optimization requires a completed job",
        )

    opt_id = str(uuid4())

    # Build optimization parameters
    opt_params: dict = {
        "job_id": job_id,
        "optimization_id": opt_id,
        "smiles": body.smiles,
        "molecule_name": body.molecule_name,
        "weights": body.weights,
        "n_iterations": body.n_iterations,
        "variants_per_iter": body.variants_per_iter,
    }

    # Store initial status
    _optimization_results[opt_id] = {
        "optimization_id": opt_id,
        "job_id": job_id,
        "status": "queued",
        "progress": 0,
        "current_iteration": 0,
        "total_iterations": body.n_iterations,
        "best_score": None,
        "result": None,
        "error_message": None,
    }

    # Try to dispatch via Celery; fall back to synchronous execution
    try:
        future = _dispatch_pool.submit(
            _dispatch_optimization_task, opt_id, opt_params,
        )
        future.result(timeout=5)
        logger.info(
            "Optimization %s dispatched for job %s, molecule %s",
            opt_id, job_id, body.molecule_name,
        )
    except FuturesTimeoutError:
        logger.warning(
            "Optimization dispatch timed out for %s (will try sync)", opt_id,
        )
        # Run synchronously as fallback
        _run_optimization_sync(opt_id, opt_params)
    except Exception as exc:
        logger.warning(
            "Optimization dispatch failed for %s: %s (will try sync)",
            opt_id, exc,
        )
        _run_optimization_sync(opt_id, opt_params)

    return {"optimization_id": opt_id, "status": "queued"}


@app.get("/api/jobs/{job_id}/optimization/{opt_id}")
async def get_optimization_status(job_id: str, opt_id: str) -> OptimizationStatus:
    """Return the status and results of a lead optimization task.

    Parameters
    ----------
    job_id : str
        UUID of the parent docking job.
    opt_id : str
        UUID of the optimization task.

    Returns
    -------
    OptimizationStatus
        Current status, progress, and results (if completed).
    """
    opt_data = _optimization_results.get(opt_id)
    if opt_data is None:
        raise HTTPException(
            status_code=404,
            detail=f"Optimization {opt_id} not found",
        )

    if opt_data.get("job_id") != job_id:
        raise HTTPException(
            status_code=404,
            detail=f"Optimization {opt_id} does not belong to job {job_id}",
        )

    # If still queued/running, check if Celery worker wrote result.json
    if opt_data.get("status") in ("queued", "running"):
        result_path = DATA_DIR / job_id / "optimization" / opt_id / "result.json"
        if result_path.exists():
            try:
                with open(result_path, "r", encoding="utf-8") as f:
                    result = json.load(f)
                opt_data.update({
                    "status": "completed",
                    "progress": 100,
                    "result": result,
                    "best_score": result.get("final_lead", {}).get("score"),
                    "current_iteration": opt_data.get("total_iterations", 10),
                })
            except (json.JSONDecodeError, IOError):
                pass

    return OptimizationStatus(
        optimization_id=opt_data["optimization_id"],
        job_id=opt_data["job_id"],
        status=opt_data.get("status", "unknown"),
        progress=opt_data.get("progress", 0),
        current_iteration=opt_data.get("current_iteration", 0),
        total_iterations=opt_data.get("total_iterations", 10),
        best_score=opt_data.get("best_score"),
        result=opt_data.get("result"),
        error_message=opt_data.get("error_message"),
    )


# ---------------------------------------------------------------------------
# Optimization dispatch helpers
# ---------------------------------------------------------------------------

def _dispatch_optimization_task(opt_id: str, params: dict) -> None:
    """Send the optimization task to Celery.

    Parameters
    ----------
    opt_id : str
        Optimization UUID.
    params : dict
        Optimization parameters.
    """
    try:
        from tasks import run_lead_optimization
        run_lead_optimization.apply_async(
            args=[opt_id, params],
            retry=False,
            retry_policy={"max_retries": 0},
        )
    except Exception as exc:
        logger.warning(
            "Celery dispatch for optimization %s failed: %s (falling back to sync)",
            opt_id, exc,
        )
        _run_optimization_sync(opt_id, params)


def _run_optimization_sync(opt_id: str, params: dict) -> None:
    """Run optimization synchronously (fallback when Celery is unavailable).

    Parameters
    ----------
    opt_id : str
        Optimization UUID.
    params : dict
        Optimization parameters.
    """
    import traceback

    try:
        _optimization_results[opt_id]["status"] = "running"

        from pipeline.lead_optimization import run_optimization

        job_id = params["job_id"]
        work_dir = DATA_DIR / job_id

        # Get pocket center from the job's pipeline summary
        job = get_job(job_id)
        pocket_center = [22.0, 0.5, 18.0]  # fallback default
        if job and job.pipeline_summary_json:
            try:
                summary = json.loads(job.pipeline_summary_json)
                pocket_center = summary.get("best_pocket_center", pocket_center)
            except (json.JSONDecodeError, TypeError):
                pass

        target_pdbqt = str(work_dir / "receptor.pdbqt")

        def progress_cb(iteration: int, score: float, message: str) -> None:
            n_iters = params.get("n_iterations", 10)
            progress = int(iteration / n_iters * 100)
            _optimization_results[opt_id].update({
                "progress": progress,
                "current_iteration": iteration,
                "best_score": round(score, 4),
            })

        result = run_optimization(
            starting_smiles=params["smiles"],
            starting_name=params.get("molecule_name", "molecule"),
            target_pdbqt=target_pdbqt,
            pocket_center=pocket_center,
            weights=params.get("weights"),
            n_iterations=params.get("n_iterations", 10),
            variants_per_iter=params.get("variants_per_iter", 50),
            work_dir=work_dir / "optimization" / opt_id,
            progress_callback=progress_cb,
        )

        _optimization_results[opt_id].update({
            "status": "completed",
            "progress": 100,
            "result": result,
            "best_score": result["final_lead"]["score"],
        })

        logger.info(
            "Optimization %s completed: score %.3f -> %.3f",
            opt_id,
            result["starting_molecule"]["score"],
            result["final_lead"]["score"],
        )

    except Exception as exc:
        error_msg = f"{type(exc).__name__}: {exc}"
        logger.error(
            "Optimization %s failed: %s\n%s",
            opt_id, error_msg, traceback.format_exc(),
        )
        _optimization_results[opt_id].update({
            "status": "failed",
            "error_message": error_msg,
        })
