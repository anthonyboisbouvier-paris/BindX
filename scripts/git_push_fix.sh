#!/bin/bash
exec > /home/antho/dockit/.git_output.log 2>&1
cd /home/antho/dockit

echo '=== Amend commit with cleaned secret ==='
git add -A
git commit --amend -m 'refactor: restructure repo for V9 (docs/, tests/, clean root, new CLAUDE.md)' --no-edit

echo '=== Delete old tag and recreate ==='
git tag -d v8-final
git tag -a v8-final -m 'Final V8 state before V9 refonte'

echo '=== Push dev + tags ==='
git checkout dev
git push origin dev --tags --force 2>&1

echo '=== Push v9 ==='
git checkout v9
git push origin v9 --force 2>&1

echo '=== RESULT ==='
git branch -a
git log --oneline -3
git tag -l