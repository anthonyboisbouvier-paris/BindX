# DockIt - Le Canva du docking moleculaire

Application web de screening moleculaire par docking. Entrez un identifiant UniProt, DockIt recupere automatiquement la structure 3D, detecte les poches de liaison, et effectue un screening de ligands via AutoDock Vina.

## Demarrage rapide

```bash
docker compose up --build
```

L'application sera disponible sur http://localhost:3000

## Architecture

- **Frontend**: React + Vite + Tailwind CSS + 3Dmol.js (port 3000)
- **Backend**: FastAPI + Python 3.11 (port 8000)
- **Worker**: Celery pour l'execution asynchrone du pipeline
- **Redis**: Broker de messages et cache
- **SQLite**: Persistence des jobs

## Pipeline de docking

1. Recuperation de la structure 3D (AlphaFold DB / ESMFold)
2. Detection des poches de liaison (fpocket)
3. Preparation du recepteur (Open Babel -> PDBQT)
4. Recuperation des ligands (ChEMBL API / ZINC)
5. Docking moleculaire (AutoDock Vina)
6. Scoring composite (affinite + QED + LogP)
7. Generation du rapport PDF

## Test rapide

Utilisez l'identifiant UniProt **P00533** (EGFR) pour tester le pipeline complet.
Le ligand de reference est l'Erlotinib (CHEMBL553).

## API Endpoints

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | /api/health | Health check |
| POST | /api/jobs | Lancer un screening |
| GET | /api/jobs/{id} | Statut du job |
| GET | /api/jobs/{id}/results | Resultats |
| GET | /api/jobs/{id}/report | Rapport PDF |
| GET | /api/jobs/{id}/download | Archive ZIP |
| GET | /api/jobs/{id}/protein | Fichier PDB |

## Developpement local

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Worker Celery (necessite Redis)
celery -A celery_app worker --loglevel=info

# Frontend
cd frontend
npm install
npm run dev
```

## Stack technique

- Python 3.11, FastAPI, Celery, SQLAlchemy, RDKit, ReportLab
- React 18, Vite 5, Tailwind CSS 3, 3Dmol.js
- Docker Compose, Redis, Nginx
