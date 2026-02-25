#!/bin/bash
set -e
cd /home/antho/dockit

echo '=== BindX V9 Branch Setup ==='

# 1. Stage all changes (restructure)
git add -A
git commit -m "refactor: restructure repo for V9 (docs/, tests/, clean root)"

# 2. Tag current state as v8-final
git tag -a v8-final -m "Final V8 state before V9 refonte"
echo 'Tagged v8-final'

# 3. Create v9 branch
git checkout -b v9
echo 'Created and switched to branch v9'

# 4. Push everything
git push origin dev --tags
git push origin v9
echo ''
echo '=== Done ==='
echo 'Branches: main (stable), dev (v8-final tagged), v9 (active dev)'
echo 'You are now on branch v9. Happy coding!'