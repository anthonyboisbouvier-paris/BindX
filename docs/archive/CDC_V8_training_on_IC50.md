# DockIt — Cahier des Charges (CDC) V8

## 1. Objectif général

DockIt est une plateforme de **virtual screening in silico** permettant :
- le **hit-finding** par docking structure-based,
- l’option **d’enrichissement par modèle SAR ligand-only** entraîné par l’utilisateur,
- une orchestration simple, reproductible et automatisable, sans promesse abusive.

La V8 introduit une **nouvelle feature majeure** :
> 🔬 *User-trained SAR model based on experimental IC50 data, utilisé en complément du docking.*

---

## 2. Positionnement scientifique (important)

DockIt distingue clairement :
- **le moteur** (DockIt)  
- **la responsabilité scientifique** (utilisateur)

> *L’utilisateur fournit des données expérimentales supposées propres.  
> DockIt entraîne un modèle ML et fournit des prédictions et métriques, sans garantir la validité biologique.*

---

## 3. Niveaux fonctionnels supportés

### V1 — Docking-only
- Docking (Vina / GNINA)
- Re-ranking
- Filtres ADMET / PAINS
- Output : hits plausibles

### V2 — Docking + SAR ligand-only (nouveau)
- Modèle ML entraîné sur IC50 fournies par l’utilisateur
- Re-ranking combiné Docking + ML
- Output : ranking enrichi + score ML

(V3 structure-aware hors périmètre CDC V8)

---

## 4. Nouvelle feature V8 — Entraînement de modèle SAR utilisateur

### 4.1 Principe

L’utilisateur peut :
1. Uploader un **dataset IC50 déjà clean**
2. Cliquer sur **“Train SAR Model”**
3. Utiliser automatiquement ce modèle dans les futurs runs in silico

Aucun cleaning avancé n’est effectué par la plateforme.

---

## 5. Spécification des données d’entrée

### 5.1 Format accepté

- CSV ou Parquet

Colonnes obligatoires :
- `smiles` : SMILES valide
- `pIC50` : valeur numérique (float)

Colonnes optionnelles :
- `assay_id`
- `weight`
- `source`

Exemple :

```
smiles,pIC50
CCOc1ccc...,7.2
CCN(CC)C...,6.8
```

---

## 6. Validation minimale côté plateforme

À l’upload :
- SMILES valides
- pIC50 numériques
- dataset ≥ 100 molécules

Règles :
- < 100 → refus
- 100–300 → warning
- > 500 → recommandé

---

## 7. Pipeline ML SAR (ligand-only)

### 7.1 Modèle

- Modèle pré-entraîné ligand-only (ex : Chemprop D-MPNN)
- Fine-tuning supervisé (régression pIC50)
- Pas d’entraînement from scratch

### 7.2 Entraînement

- Split : random (par défaut)
- Option scaffold split (recommandé)
- Early stopping
- Sauvegarde du modèle entraîné

---

## 8. Artefacts générés

Pour chaque entraînement :
- `model_id`
- `user_id`
- `target_id`
- métriques :
  - RMSE
  - R²
  - Spearman
- date / version dataset

---

## 9. Intégration au pipeline de screening

Lors d’un run in silico :

```
score_final = α * docking_score + β * ML_score
```

- α / β configurables via UI
- ML score optionnel (toggle)

---

## 10. UX / UI attendue

### 10.1 Page “Train SAR Model”

- Upload dataset
- Choix :
  - régression / classification
  - split strategy
- Bouton : 🧠 Train model
- Statuts :
  - en cours
  - terminé
  - échoué (message explicite)

---

### 10.2 Page “Model results”

- Tableau des métriques
- Learning curve simple
- Feature importance (si dispo)

---

### 10.3 Page “Screening config”

- Toggle :
  - ☐ Use SAR model for re-ranking
- Slider :
  - Docking ↔ ML (α / β)

---

## 11. Contraintes et limites explicites

- DockIt **ne nettoie pas** les données IC50
- DockIt **ne garantit pas** la validité biologique
- Prédictions = probabilistes
- Affichage recommandé :
  - ranking
  - percentile
  - incertitude

---

## 12. Sécurité & traçabilité

- Modèles isolés par utilisateur
- Versioning des datasets
- Reproductibilité (seed)

---

## 13. Hors périmètre V8

- Structure-aware ML
- Active learning automatique
- Validation expérimentale intégrée
- Génération de composés

---

## 14. Objectif produit V8

Passer de :
> “outil de docking”

à :
> “plateforme de virtual screening enrichie par SAR ML utilisateur, biotech-grade, honnête et scalable”

---

## 15. Roadmap suggérée post-V8

- V9 : uncertainty quantification
- V10 : pose-aware re-ranking
- V11 : boucle CRO / active learning
