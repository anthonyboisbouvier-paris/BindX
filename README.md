# BindX

Open-source drug discovery platform for in silico screening, hit-to-lead optimization, and lead optimization.

## What is BindX?

BindX is a web-based platform that lets computational chemists run virtual screening campaigns end-to-end:
molecular docking (Vina, GNINA, GNINA GPU), ADMET prediction, composite scoring, de novo generation,
scaffold analysis, and multi-objective optimization (Pareto).

## Architecture

- **Backend**: FastAPI + Celery + Redis + Supabase (PostgreSQL)
- **Frontend**: React + Vite + Tailwind
- **Docking GPU**: GNINA via RunPod serverless
- **Auth/Storage**: Supabase

## Quick Start

```bash
cp .env.example .env  # configure your keys
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/docs

## Project Structure

- `docs/` - Product specs, methodology, GPU integration docs
- `backend/` - FastAPI server, pipeline modules, Celery tasks
- `frontend/` - React application
- `tests/` - Unit and E2E tests

## Documentation

- [Product Spec (CDC V9)](docs/CDC_V9.md)
- [Scientific Methods](docs/METHODS.md)
- [GNINA GPU RunPod Integration](docs/GNINA_GPU_RunPod.md)

## License

MIT