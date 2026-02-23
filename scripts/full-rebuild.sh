#!/bin/bash
# Full rebuild — use only when dependencies change (requirements.txt, package.json)
set -e

echo "=== BindX Full Rebuild (no cache) ==="
echo "This will take ~7 minutes..."
echo ""

docker compose build --no-cache
docker compose down -v
docker compose up -d

echo ""
echo "=== Full rebuild complete ==="
docker compose ps --format "table {{.Name}}\t{{.Status}}"
