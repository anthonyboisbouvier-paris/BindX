#!/bin/bash
# Deploy current dev work to main (stable)
# Usage: ./scripts/deploy.sh "description of changes"
set -e

MSG="${1:-Deploy latest changes}"

echo "=== BindX Deploy: dev → main ==="

# 1. Make sure we're on dev
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "dev" ]; then
    echo "ERROR: Must be on 'dev' branch (currently on '$BRANCH')"
    exit 1
fi

# 2. Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo "Uncommitted changes detected. Committing first..."
    git add -A
    git commit -m "$MSG"
fi

# 3. Merge dev into main
echo "Merging dev → main..."
git checkout main
git merge dev --no-edit

# 4. Push to GitHub
echo "Pushing to GitHub..."
git push origin main

# 5. Switch back to dev
git checkout dev

echo ""
echo "=== Deployed! ==="
echo "GitHub: https://github.com/anthonyboisbouvier-paris/BindX"
echo "Local:  http://localhost:3000"
