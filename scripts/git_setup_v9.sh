#!/bin/bash
exec > /home/antho/dockit/.git_output.log 2>&1
cd /home/antho/dockit

echo '=== Step 1: Stage all ==='
git add -A
echo 'Staged'

echo '=== Step 2: Commit restructure ==='
git commit -m 'refactor: restructure repo for V9 (docs/, tests/, clean root, new CLAUDE.md)'

echo '=== Step 3: Tag v8-final ==='
git tag -a v8-final -m 'Final V8 state before V9 refonte'
echo 'Tagged'

echo '=== Step 4: Create v9 branch ==='
git checkout -b v9
echo 'On v9'

echo '=== Step 5: Push dev + tags ==='
git push origin dev --tags 2>&1

echo '=== Step 6: Push v9 ==='
git push origin v9 2>&1

echo '=== DONE ==='
git branch -a
git log --oneline -3