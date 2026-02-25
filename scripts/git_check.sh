#!/bin/bash
exec > /home/antho/dockit/.git_output.log 2>&1
cd /home/antho/dockit
echo '=== STATUS ==='
git status --short
echo '=== BRANCH ==='
git branch
echo '=== DONE ==='