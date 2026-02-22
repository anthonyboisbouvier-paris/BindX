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
