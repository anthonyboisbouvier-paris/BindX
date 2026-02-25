#!/bin/bash
exec > /home/antho/dockit/.git_output.log 2>&1
cd /home/antho/dockit

# Add the log file to gitignore first
echo '.git_output.log' >> .gitignore

# Stash log file, switch to dev
git stash
git checkout dev

# The old commit on dev still has the secret
# We need to amend it too
echo '=== Current dev HEAD ==='
git log --oneline -1

# The GNINA file on dev still has the real key - fix it
sed -i 's/rpa_[A-Za-z0-9]\{20,\}/rpa_YOUR_RUNPOD_API_KEY/g' docs/GNINA_GPU_RunPod.md 2>/dev/null || true

# Also add gitignore fix
git add -A
git commit --amend --no-edit

echo '=== Amended dev ==='
git log --oneline -1

# Recreate tag on this commit
git tag -d v8-final 2>/dev/null || true
git tag -a v8-final -m 'Final V8 state before V9 refonte'

# Force push dev + tags
git push origin dev --tags --force 2>&1

echo '=== Switch back to v9 ==='
git checkout v9
git stash pop 2>/dev/null || true

echo '=== FINAL STATE ==='
git branch -a
git log --oneline -3
echo 'Tags:'
git tag -l