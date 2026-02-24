# DockIt — "Le Canva du docking moléculaire"

## MISSION
Tu es un développeur autonome. Ton objectif : livrer un MVP fonctionnel de DockIt de A à Z, sans intervention humaine. Tu lis le cahier des charges, tu codes, tu testes, tu fixes, tu itères jusqu'à ce que TOUS les critères de succès soient validés.

## RÈGLES D'AUTONOMIE

### Décisions
- **Ne jamais demander confirmation** sauf suppression de données ou push en prod
- Quand tu as un doute technique, fais un choix, implémente-le, teste-le. Change si ça marche pas.
- Si une API externe est down, implémente un mock et continue. Reviens dessus plus tard.
- Si une lib ne s'installe pas, cherche une alternative et adapte.

### Boucle de travail
1. Planifier → écrire le plan dans PROGRESS.md
2. Coder → un module à la fois
3. Tester unitairement
4. Intégrer → docker-compose up --build
5. Vérifier via l'UI → Playwright screenshot
6. Logger le résultat dans PROGRESS.md
7. Passer au module suivant OU fixer les bugs
8. Répéter jusqu'à ce que TOUS les critères de succès passent

### Quand tu bloques
- Si bloqué plus de 3 tentatives sur le même bug : screenshot UI + simplifier (mock/stub/fallback) + noter TODO
- Ne jamais boucler plus de 5 fois sur le même problème. Simplifie et avance.

### Vérification UI obligatoire
Après chaque milestone majeur, vérifier l'application comme un utilisateur :
- Playwright ou navigateur headless sur http://localhost:3000
- Screenshots pour vérifier visuellement
- Tester le flow complet : input → run → progression → résultats → téléchargement

### Debug visuel via API
Quand bloqué sur un bug d'intégration :
- curl chaque endpoint isolément
- Logger les réponses JSON complètes
- Comparer avec le format attendu dans le cahier des charges section 6

## PLAN D'EXÉCUTION

### Phase 1 — Backend Pipeline
1.1 Scaffold FastAPI + structure fichiers
1.2 models.py — Pydantic schemas
1.3 pipeline/structure.py — AlphaFold DB + ESMFold fallback
1.4 pipeline/pockets.py — fpocket wrapper
1.5 pipeline/prepare.py — Open Babel + Meeko conversions
1.6 pipeline/ligands.py — ChEMBL API + ZINC loader
1.7 pipeline/docking.py — AutoDock Vina wrapper
1.8 pipeline/scoring.py — RDKit properties + composite score
1.9 pipeline/report.py — PDF generation
1.10 tasks.py — Celery task enchaîne tout le pipeline
1.11 main.py — Endpoints API complets
1.12 Dockerfile backend + requirements.txt
1.13 TEST: pipeline end-to-end P00533 → Erlotinib top 5

### Phase 2 — Frontend React
2.1 Scaffold Vite + React + Tailwind
2.2 InputForm.jsx
2.3 api.js
2.4 ProgressBar.jsx — polling 2s
2.5 Viewer3D.jsx — 3Dmol.js + dropdown
2.6 ResultsTable.jsx — top 10 + SVG 2D
2.7 MoleculeCard.jsx
2.8 Boutons téléchargement PDF + ZIP
2.9 Dockerfile frontend (nginx)
2.10 TEST UI: screenshot Playwright

### Phase 3 — Intégration Docker
3.1 docker-compose.yml
3.2 Volumes /data + ZINC
3.3 Healthcheck
3.4 README.md
3.5 TEST: docker-compose up --build < 5 min
3.6 TEST: screening complet via UI

### Phase 4 — Validation finale
4.1 Passer TOUS les critères section 9 du cahier des charges
4.2 Screenshot final UI avec résultats EGFR
4.3 Vérifier PDF et ZIP
4.4 Tester fallback ESMFold
4.5 PROGRESS.md à jour

## PROGRESS TRACKING
Maintiens PROGRESS.md à la racine avec statut de chaque étape.

## CONTEXTE TECHNIQUE
Stack: React+Vite+Tailwind+3Dmol.js | FastAPI Python 3.11 | Celery+Redis | SQLite | Docker Compose | Aucun GPU

### Commandes
docker-compose up --build
cd backend && uvicorn main:app --reload --port 8000
cd backend && celery -A tasks worker --loglevel=info
cd frontend && npm run dev
curl http://localhost:8000/api/health

### APIs externes
- AlphaFold DB: https://alphafold.ebi.ac.uk/api/
- ESMFold: HuggingFace facebook/esmfold_v1
- ChEMBL: https://www.ebi.ac.uk/chembl/api/data/
- ZINC20: subset SDF local

### Conventions
- Python: type hints, docstrings, try/except + logging
- React: composants fonctionnels, hooks
- UI: bleu foncé (#1e3a5f) + blanc + verts (#22c55e)
- Test: EGFR (P00533) → Erlotinib (CHEMBL553) top 5

### MCP disponibles
- n8n: monitoring, alertes
- Linear: issues, sprints
- Hugging Face: ESMFold, modèles ML
- Playwright: screenshots UI


## CONTEXT MANAGEMENT (CRITICAL)

### Screenshots
- **NEVER accumulate screenshots in context.** After taking a Playwright screenshot, analyze it, report findings, then move on. Do NOT keep multiple screenshots in conversation history.
- **Image dimension limit: 2000px max.** Always resize or crop screenshots:
  ```js
  await page.screenshot({ path: 'screenshot.png', clip: { x: 0, y: 0, width: 1280, height: 800 } })
  ```
- **Max 2 screenshots per task.** If you need more, run `/compact` between batches.
- **For "Take screenshots of all screens" tasks:** process ONE screen at a time, save to disk, run `/compact`, then do the next screen. Never capture all screens in a single context window.

### Context overflow prevention
- **Run `/compact` proactively** when you feel context is getting heavy (many tool outputs, long code blocks, multiple images). Do NOT wait for the error.
- **If you see "dimension limit for many-image requests (2000px)":** STOP immediately. Run `/compact`. Do NOT retry before compacting. After compacting, reduce image dimensions before retrying.
- **Never loop on the same error more than twice.** If `/compact` doesn't fix it, start a new session.

### Large task strategy
- Break screenshot-heavy tasks into sub-batches of 2-3 screens max
- Save screenshots to `./screenshots/` directory, reference by filename in PROGRESS.md
- Prefer describing UI state in text over keeping images in context


## SELF-RECOVERY RULES

### Before ANY task
- Check docker containers are running: `docker compose ps`
- Check backend health: `curl -s http://localhost:8000/api/health`
- Check frontend serves: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000`
- If any service is down, fix it BEFORE starting the task

### When stuck
- **3 strikes rule**: if the same fix fails 3 times, STOP. Simplify the approach or skip with a TODO.
- **Never run `docker compose up --build` more than 2 times in a row** without investigating logs first: `docker compose logs --tail=50 backend`
- **Before retrying a failed command**, read the error message fully and change your approach. Do not blindly retry.

### Git safety
- `git stash` before any risky refactor
- Commit working state after each completed task with a descriptive message
- Never rewrite more than 3 files without testing in between

### Worker/Celery health
- After any backend change, verify the Celery worker restarted: `docker compose logs --tail=20 worker`
- If a job stays "queued" for more than 30 seconds, check worker logs immediately
- Common fix: `docker compose restart worker`

### Resource management
- Monitor disk space: `df -h /` (Docker images eat disk fast)
- Monitor memory: `free -h` (Celery + Redis + FastAPI + Node can exceed 4GB)
- If builds are slow, prune: `docker system prune -f`

### Testing discipline
- After modifying backend code: test the API endpoint with curl BEFORE touching frontend
- After modifying frontend: check browser console for errors BEFORE taking screenshots
- Never assume a change works. Verify.
