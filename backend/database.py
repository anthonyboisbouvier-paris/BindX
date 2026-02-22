"""
DockIt — Database setup (SQLite via SQLAlchemy).

Provides engine, session factory, and helper functions for job persistence.
V3: supports sequence, notification_email, docking_engine fields.
"""

from __future__ import annotations

import json
import logging
import os
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Generator, Optional

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from models import Base, JobORM

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Engine / Session
# ---------------------------------------------------------------------------

DATA_DIR = Path(os.environ.get("DOCKIT_DATA_DIR", "/data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = f"sqlite:///{DATA_DIR / 'dockit.db'}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db() -> None:
    """Create all tables if they do not exist."""
    Base.metadata.create_all(bind=engine)
    logger.info("Database initialised at %s", DATABASE_URL)


@contextmanager
def get_db() -> Generator[Session, None, None]:
    """Context manager that yields a SQLAlchemy session and handles cleanup."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Convenience helpers
# ---------------------------------------------------------------------------

def create_job(
    job_id: str,
    uniprot_id: Optional[str] = None,
    use_chembl: bool = True,
    use_zinc: bool = False,
    max_ligands: int = 50,
    smiles_list: Optional[list[str]] = None,
    mode: str = "rapid",
    enable_generation: bool = False,
    enable_diffdock: bool = False,
    enable_retrosynthesis: bool = False,
    n_generated_molecules: int = 100,
    # V3 fields
    sequence: Optional[str] = None,
    notification_email: Optional[str] = None,
    docking_engine: str = "vina",
) -> JobORM:
    """Insert a new job row and return it.

    Parameters
    ----------
    job_id : str
        UUID4 identifier for the job.
    uniprot_id : str, optional
        UniProt accession. Can be None if sequence is provided.
    use_chembl : bool
        Whether to query ChEMBL for known ligands.
    use_zinc : bool
        Whether to include ZINC drug-like molecules.
    max_ligands : int
        Maximum number of ligands to screen.
    smiles_list : list[str], optional
        User-supplied SMILES strings.
    mode : str
        Pipeline mode: rapid, standard, or deep.
    enable_generation : bool
        Enable AI molecule generation (V2 compat).
    enable_diffdock : bool
        Enable DiffDock (V2 compat).
    enable_retrosynthesis : bool
        Enable retrosynthesis planning (V2 compat).
    n_generated_molecules : int
        Number of molecules to generate (V2 compat).
    sequence : str, optional
        Raw amino acid sequence (V3).
    notification_email : str, optional
        Email for completion notification (V3).
    docking_engine : str
        Docking engine to use, default "vina" (V3).

    Returns
    -------
    JobORM
        The created job record.
    """
    with get_db() as db:
        job = JobORM(
            id=job_id,
            uniprot_id=uniprot_id or "",
            status="queued",
            progress=0,
            current_step="Queued",
            use_chembl=int(use_chembl),
            use_zinc=int(use_zinc),
            max_ligands=max_ligands,
            smiles_list=json.dumps(smiles_list) if smiles_list else None,
            mode=mode,
            enable_generation=int(enable_generation),
            enable_diffdock=int(enable_diffdock),
            enable_retrosynthesis=int(enable_retrosynthesis),
            n_generated_molecules=n_generated_molecules,
            # V3 fields
            sequence=sequence,
            notification_email=notification_email,
            docking_engine=docking_engine,
            created_at=datetime.utcnow(),
        )
        db.add(job)
        db.flush()
        display_id = uniprot_id or f"seq[{len(sequence or '')}aa]"
        logger.info("Job %s created for %s (mode=%s, engine=%s)", job_id, display_id, mode, docking_engine)
    return job


def get_job(job_id: str) -> Optional[JobORM]:
    """Fetch a job by ID, or return None."""
    with get_db() as db:
        job = db.get(JobORM, job_id)
        if job is not None:
            # Detach from session so caller can use fields freely
            db.expunge(job)
        return job


def update_job(job_id: str, **kwargs) -> None:
    """Update arbitrary columns on a job row."""
    with get_db() as db:
        job = db.get(JobORM, job_id)
        if job is None:
            logger.warning("update_job: job %s not found", job_id)
            return
        for key, value in kwargs.items():
            setattr(job, key, value)
        db.flush()
