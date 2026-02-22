#!/bin/bash
# Fast rebuild for code-only changes (no dependency changes)
# Uses Docker layer cache — typically ~30s instead of ~7min
set -e

echo "=== BindX Fast Rebuild ==="
echo "Building backend + worker (cached layers)..."
docker compose build backend celery_worker

echo "Building frontend (cached layers)..."
docker compose build frontend

echo "Restarting services..."
docker compose up -d

echo ""
echo "=== Done! Services restarting... ==="
docker compose ps --format "table {{.Name}}\t{{.Status}}"
echo ""
echo "Frontend: http://localhost:3000"
echo "Backend:  http://localhost:8000/api/health"
