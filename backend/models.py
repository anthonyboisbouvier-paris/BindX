"""
DockIt — Pydantic models and SQLAlchemy ORM models.

Defines request/response schemas for the API and the Job persistence model.
V2: added mode, generation/ADMET/retrosynthesis fields.
V3: optional sequence input, mode rapid/standard/deep, auto ligand strategy,
    score_100, affinity_stars, toxicity, synthesis feasibility, pipeline_summary,
    notification_email, docking_engine, pedagogical tips.
"""

from __future__ import annotations

import datetime
import re
from typing import Optional

from pydantic import BaseModel, Field, model_validator
from sqlalchemy import Column, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase


# ---------------------------------------------------------------------------
# SQLAlchemy Base
# ---------------------------------------------------------------------------

class Base(DeclarativeBase):
    """SQLAlchemy declarative base for all ORM models."""
    pass


# ---------------------------------------------------------------------------
# SQLAlchemy ORM — Job table
# ---------------------------------------------------------------------------

class JobORM(Base):
    """Persistent representation of a docking job stored in SQLite."""

    __tablename__ = "jobs"

    id: str = Column(String(36), primary_key=True)  # UUID4
    uniprot_id: str = Column(String(20), nullable=True)  # V3: nullable (sequence-only jobs)
    status: str = Column(String(20), nullable=False, default="queued")  # queued | running | completed | failed
    progress: int = Column(Integer, nullable=False, default=0)  # 0-100
    current_step: str = Column(String(200), nullable=False, default="Queued")
    error_message: str = Column(Text, nullable=True)
    protein_name: str = Column(String(200), nullable=True)

    # Job parameters (stored as JSON-ish strings or simple fields)
    use_chembl: bool = Column(Integer, nullable=False, default=1)  # SQLite has no bool
    use_zinc: bool = Column(Integer, nullable=False, default=0)
    max_ligands: int = Column(Integer, nullable=False, default=50)
    smiles_list: str = Column(Text, nullable=True)  # JSON-encoded list or None

    # V2 parameters (kept for backward compatibility)
    mode: str = Column(String(20), nullable=False, default="rapid")  # V3: rapid | standard | deep
    enable_generation: bool = Column(Integer, nullable=False, default=0)
    enable_diffdock: bool = Column(Integer, nullable=False, default=0)
    enable_retrosynthesis: bool = Column(Integer, nullable=False, default=0)
    n_generated_molecules: int = Column(Integer, nullable=False, default=100)

    # V3 parameters
    sequence: str = Column(Text, nullable=True)  # Raw amino acid sequence (alternative to uniprot_id)
    notification_email: str = Column(String(200), nullable=True)  # Email for deep screening completion
    structure_source: str = Column(String(50), nullable=True)  # alphafold | esmfold | pdb_experimental | mock
    strategy_message: str = Column(Text, nullable=True)  # Auto ligand strategy explanation
    pipeline_summary_json: str = Column(Text, nullable=True)  # JSON-encoded pipeline summary dict
    docking_engine: str = Column(String(20), nullable=False, default="auto")  # gnina | vina | auto

    # Result metadata
    results_json: str = Column(Text, nullable=True)  # JSON-encoded list[DockingResult]
    generated_json: str = Column(Text, nullable=True)  # JSON-encoded V2 generated molecules
    pdb_path: str = Column(String(500), nullable=True)
    report_path: str = Column(String(500), nullable=True)
    zip_path: str = Column(String(500), nullable=True)

    created_at: datetime.datetime = Column(
        DateTime, nullable=False, default=datetime.datetime.utcnow
    )
    completed_at: datetime.datetime = Column(DateTime, nullable=True)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

VALID_AA_CHARS = set("ACDEFGHIKLMNPQRSTVWY")
MIN_SEQUENCE_LENGTH = 50


# ---------------------------------------------------------------------------
# Pydantic — Request schemas
# ---------------------------------------------------------------------------

class JobCreate(BaseModel):
    """Payload for POST /api/jobs.

    V3: either ``uniprot_id`` or ``sequence`` must be provided (or both).
    Mode is now ``rapid | standard | deep`` instead of ``basic | advanced``.
    Ligand sources are auto-determined by the backend.
    """

    uniprot_id: Optional[str] = Field(
        default=None, min_length=2, max_length=20,
        description="UniProt accession, e.g. P00533. Optional if sequence provided.",
    )
    sequence: Optional[str] = Field(
        default=None,
        description="Raw amino acid sequence (must start with M, only valid AA chars, min 50 residues).",
    )
    smiles_list: Optional[list[str]] = Field(default=None, description="Optional custom SMILES to dock")

    # V2 fields kept for backward compat but now optional with defaults
    use_chembl: Optional[bool] = Field(default=None, description="(V2 compat) Fetch known ligands from ChEMBL")
    use_zinc: Optional[bool] = Field(default=None, description="(V2 compat) Include ZINC drug-like molecules")
    max_ligands: Optional[int] = Field(default=None, ge=1, le=5000, description="(V2 compat) Max ligands to screen")

    # V3 fields
    mode: str = Field(
        default="rapid",
        description="Pipeline mode: rapid (quick V1), standard (advanced), deep (massive 4h screening)",
    )
    docking_engine: str = Field(
        default="auto",
        description="Docking engine: gnina (CNN-scored), vina (classic), or auto (GNINA -> Vina -> mock fallback)",
    )
    notification_email: Optional[str] = Field(
        default=None, description="Email address for completion notification (deep mode)",
    )

    # V2 fields kept for backward compat but no longer required
    enable_generation: Optional[bool] = Field(default=None, description="(V2 compat) Enable AI molecule generation")
    enable_diffdock: Optional[bool] = Field(default=None, description="(V2 compat) Enable DiffDock")
    enable_retrosynthesis: Optional[bool] = Field(default=None, description="(V2 compat) Enable retrosynthesis")
    n_generated_molecules: Optional[int] = Field(default=None, ge=10, le=500, description="(V2 compat) Num molecules to generate")

    @model_validator(mode="after")
    def validate_input_source(self) -> "JobCreate":
        """Ensure either uniprot_id or sequence is provided, and validate sequence format."""
        if not self.uniprot_id and not self.sequence:
            raise ValueError("Either uniprot_id or sequence must be provided.")

        if self.sequence is not None:
            seq = self.sequence.strip()
            # Remove FASTA header if present
            if seq.startswith(">"):
                lines = seq.split("\n")
                seq = "".join(line.strip() for line in lines[1:] if not line.startswith(">"))
                self.sequence = seq

            if not seq.startswith("M"):
                raise ValueError(
                    "Sequence must start with methionine (M). "
                    f"Got: '{seq[:5]}...'"
                )
            invalid_chars = set(seq.upper()) - VALID_AA_CHARS
            if invalid_chars:
                raise ValueError(
                    f"Sequence contains invalid amino acid characters: {sorted(invalid_chars)}. "
                    f"Only {sorted(VALID_AA_CHARS)} are allowed."
                )
            if len(seq) < MIN_SEQUENCE_LENGTH:
                raise ValueError(
                    f"Sequence too short ({len(seq)} residues). "
                    f"Minimum is {MIN_SEQUENCE_LENGTH} residues."
                )

        if self.mode not in ("rapid", "standard", "deep", "basic", "advanced"):
            raise ValueError(
                f"Invalid mode '{self.mode}'. Must be one of: rapid, standard, deep."
            )

        return self


# ---------------------------------------------------------------------------
# Pydantic — Response schemas
# ---------------------------------------------------------------------------

class JobStatus(BaseModel):
    """Returned by GET /api/jobs/{job_id}."""

    job_id: str
    status: str
    progress: int = 0
    current_step: str = "Queued"
    error_message: Optional[str] = None
    created_at: Optional[str] = None
    completed_at: Optional[str] = None
    mode: str = "rapid"

    # V3 fields
    step_details: Optional[str] = None
    strategy_message: Optional[str] = None
    pedagogical_tip: Optional[str] = None
    structure_source: Optional[str] = None
    pipeline_summary: Optional[dict] = None
    results_summary: Optional[dict] = None


# ---------------------------------------------------------------------------
# V2 ADMET sub-schema
# ---------------------------------------------------------------------------

class ADMETResult(BaseModel):
    """ADMET prediction for one molecule."""

    oral_bioavailability: Optional[float] = None
    intestinal_permeability: Optional[float] = None
    solubility: Optional[float] = None
    plasma_protein_binding: Optional[float] = None
    bbb_permeability: Optional[float] = None
    cyp1a2_inhibitor: Optional[float] = None
    cyp2c9_inhibitor: Optional[float] = None
    cyp2c19_inhibitor: Optional[float] = None
    cyp2d6_inhibitor: Optional[float] = None
    cyp3a4_inhibitor: Optional[float] = None
    clearance: Optional[float] = None
    half_life: Optional[float] = None
    herg_inhibition: Optional[float] = None
    ames_mutagenicity: Optional[float] = None
    hepatotoxicity: Optional[float] = None
    skin_sensitization: Optional[float] = None
    carcinogenicity: Optional[float] = None
    composite_score: float = 0.5
    flags: list[str] = []
    color_code: str = "yellow"


# ---------------------------------------------------------------------------
# V2 Synthesis route sub-schema
# ---------------------------------------------------------------------------

class SynthesisStep(BaseModel):
    """One step in a retrosynthetic route."""

    reaction: str
    reactants: list[str] = []
    reactant_names: list[str] = []
    conditions: str = ""
    confidence: float = 0.0


class SynthesisRoute(BaseModel):
    """Full retrosynthesis route for one molecule."""

    n_steps: int = 0
    confidence: float = 0.0
    steps: list[SynthesisStep] = []
    all_reagents_available: bool = False
    estimated_cost: str = "unknown"
    tree: Optional[dict] = None

    # V6.3 fields
    cost_estimate: Optional[dict] = None  # {total_cost_usd, reagent_cost, labor_cost, currency}
    reagent_availability: Optional[list] = None  # Per-reagent availability info


# ---------------------------------------------------------------------------
# Docking result (V1 + V2 + V3 fields)
# ---------------------------------------------------------------------------

class DockingResult(BaseModel):
    """One docked ligand with computed properties."""

    name: str
    smiles: str
    affinity: float
    logp: Optional[float] = None
    mw: Optional[float] = None
    tpsa: Optional[float] = None
    qed: Optional[float] = None
    hbd: Optional[int] = None
    hba: Optional[int] = None
    rotatable_bonds: Optional[int] = None
    composite_score: float = 0.0
    svg: Optional[str] = None
    pose_pdbqt: Optional[str] = None
    source: Optional[str] = None

    # V2 fields
    admet: Optional[ADMETResult] = None
    synthesis_route: Optional[SynthesisRoute] = None
    docking_method: Optional[str] = None  # "vina" or "diffdock"
    novelty_score: Optional[float] = None

    # V3 fields
    score_100: int = 0  # Composite score mapped to 0-100
    affinity_stars: int = 1  # 1-5 stars based on affinity
    toxicity_level: str = "unknown"  # low | medium | high | unknown
    toxicity_color: str = "#9ca3af"  # Hex color for toxicity badge
    synthesis_steps: Optional[int] = None  # Number of synthesis steps
    synthesis_feasibility: Optional[str] = None  # easy | moderate | hard | unknown
    synthesis_color: Optional[str] = None  # Hex color for synthesis badge

    # V5 fields
    off_target: Optional[dict] = None  # Off-target screening results
    confidence: Optional[dict] = None  # Confidence breakdown

    # V5bis fields
    vina_score: Optional[float] = None  # Vina affinity (kcal/mol)
    cnn_score: Optional[float] = None  # GNINA CNN pose confidence (0-1)
    cnn_affinity: Optional[float] = None  # GNINA CNN affinity (pK)
    consensus_rank: Optional[float] = None  # Mean of 3 score ranks
    consensus_robust: Optional[bool] = None  # In top 50 of 2/3 methods
    interactions: Optional[dict] = None  # ProLIF interaction analysis
    interaction_quality: Optional[float] = None  # Functional contacts score (0-1)
    cluster_id: Optional[int] = None  # Butina cluster assignment
    cluster_size: Optional[int] = None  # Number of molecules in cluster
    is_representative: Optional[bool] = None  # Best in cluster
    eliminated: Optional[bool] = None  # Hard cutoff elimination flag
    elimination_reason: Optional[str] = None  # Reason for elimination
    admet_domain: Optional[dict] = None  # Applicability domain check
    pains_alert: Optional[bool] = None  # PAINS substructure alert
    sa_score: Optional[float] = None  # Synthetic accessibility (1-10)

    # V6.1 fields
    consensus_detail: Optional[dict] = None  # Z-scores, agreement, per-method ranks

    # V6.2 fields
    pareto_rank: Optional[int] = None
    pareto_front: Optional[bool] = None
    pareto_objectives: Optional[dict] = None

    # V6.3 fields
    combined_off_target: Optional[dict] = None  # SEA + docking combined screening
    herg_specialized: Optional[dict] = None  # Specialized hERG IC50 prediction


class JobResults(BaseModel):
    """Returned by GET /api/jobs/{job_id}/results."""

    job_id: str
    protein_name: Optional[str] = None
    uniprot_id: Optional[str] = None  # V3: nullable for sequence-only jobs
    results: list[DockingResult] = []
    generated_molecules: list[DockingResult] = []  # V2: AI-generated molecules
    pdb_file_url: Optional[str] = None
    report_pdf_url: Optional[str] = None
    zip_url: Optional[str] = None
    mode: str = "rapid"

    # V3 fields
    pipeline_summary: Optional[dict] = None


# ---------------------------------------------------------------------------
# V5: Off-target screening result
# ---------------------------------------------------------------------------

class OffTargetEntry(BaseModel):
    """Off-target screening result for a single anti-target."""

    score: float
    threshold: float
    status: str = "safe"  # "safe" | "risk"
    risk_description: str = ""


class OffTargetResult(BaseModel):
    """Off-target screening results for one molecule."""

    results: dict[str, OffTargetEntry] = {}
    selectivity_score: float = 0.0
    n_safe: int = 0
    n_total: int = 10
    warnings: list[str] = []


# ---------------------------------------------------------------------------
# V5: Optimization request / status
# ---------------------------------------------------------------------------

class OptimizationRequest(BaseModel):
    """Payload for POST /api/jobs/{job_id}/optimize."""

    smiles: str = Field(
        ..., min_length=1, description="SMILES of the molecule to optimize",
    )
    molecule_name: str = Field(
        default="molecule", description="Name of the starting molecule",
    )
    weights: Optional[dict[str, float]] = Field(
        default=None,
        description=(
            "Objective weights: affinity, toxicity, bioavailability, synthesis. "
            "Must sum to ~1.0. Defaults: affinity=0.35, toxicity=0.25, "
            "bioavailability=0.20, synthesis=0.20"
        ),
    )
    n_iterations: int = Field(
        default=10, ge=1, le=50,
        description="Number of optimization iterations",
    )
    variants_per_iter: int = Field(
        default=50, ge=10, le=200,
        description="Number of variants to generate per iteration",
    )


class OptimizationStatus(BaseModel):
    """Returned by GET /api/jobs/{job_id}/optimization/{opt_id}."""

    optimization_id: str
    job_id: str
    status: str = "running"  # queued | running | completed | failed
    progress: int = 0  # 0-100
    current_iteration: int = 0
    total_iterations: int = 10
    best_score: Optional[float] = None
    result: Optional[dict] = None
    error_message: Optional[str] = None
