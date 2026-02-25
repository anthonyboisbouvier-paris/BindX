# DockIt — Cahier des Charges (CDC) V8.1
## Extension : Family-Level SAR + Target Similarity Agent

---

# 1. Objectif V8.1

Permettre l’entraînement d’un modèle SAR ligand-only même en absence de données IC50 sur la cible exacte,
en utilisant des données issues de **cibles proches scientifiquement validées**.

Ajout d’un module optionnel :
> 🤖 Target Similarity Agent (sélection automatique des cibles proches pertinentes)

---

# 2. Nouveaux Modes d’Entraînement

## Mode A — Target-Specific
- Données IC50 sur la cible exacte
- Modèle SAR spécifique
- Usage possible : prédiction + ranking

## Mode B — Family-Level (nouveau)
- Données IC50 issues de cibles proches
- Usage : prior SAR pour re-ranking
- Pas de prédiction IC50 absolue affichée

---

# 3. Target Similarity Agent (nouvelle feature)

## 3.1 Objectif

Automatiser la sélection de cibles similaires qui :
- sont biologiquement proches
- possèdent des données IC50 publiques exploitables

---

## 3.2 Pipeline Agent

### Étape 1 — Recherche de similarité séquence
- Input : UniProt ID
- BLAST automatique
- Filtre identité séquence ≥ 40–50 %

### Étape 2 — Vérification famille fonctionnelle
- Pfam / InterPro
- ChEMBL target hierarchy

### Étape 3 — Vérification disponibilité données
- Query automatique ChEMBL / BindingDB
- Minimum IC50 ≥ N (configurable, ex: 200 points)

### Étape 4 — Score composite

Score_final_target = 
    α * sequence_identity +
    β * pocket_similarity +
    γ * data_volume

Targets retenues = top K

---

# 4. Conservation de la poche : Comment s'assurer ?

## 4.1 Méthodes recommandées

### Méthode A — Alignement structurel
- Alignement PDB ou AlphaFold
- RMSD des résidus de la poche

### Méthode B — Conservation des résidus clés
- Identification résidus actifs connus (UniProt annotations)
- Comparaison identité locale (pas globale)

### Méthode C — Fingerprint de poche
- Comparaison géométrique simple
- Volume + polarité

---

## 4.2 Règle simple produit (pragmatique)

Si :
- Identité globale ≥ 50 %
- Résidus de poche conservés ≥ 70 %
→ cible acceptable pour mode Family-Level

Sinon :
→ warning utilisateur

---

# 5. Entraînement Family-Level SAR

- Modèle ligand-only pré-entraîné
- Dataset multi-cibles
- Option pondération par similarité

Split recommandé :
- Scaffold split

---

# 6. Usage en Screening

Score_final = α * docking_score + β * ML_family_score

Affichage :
- Ranking
- Percentile
- Confidence band

Jamais :
- IC50 absolue affichée

---

# 7. Gestion du Risque Scientifique

⚠️ Important :

Family-Level SAR :
- Diminue la spécificité cible
- Introduit un biais "famille"
- Peut être inadapté en médecine de précision

Recommandation produit :
- Mode Family-Level affiché comme "Prior Model"
- Mode Target-Specific prioritaire si data dispo

---

# 8. Médecine de précision : Position officielle DockIt

DockIt ne remplace pas :
- validation expérimentale
- caractérisation spécifique mutation / isoforme

Pour médecine de précision :
- privilégier données exactes mutation-spécifique
- sinon utiliser Family-Level comme filtre exploratoire uniquement

---

# 9. UX / Transparence

Dans l’interface :

Mode sélectionné :
☑ Target-Specific SAR
☑ Family-Level SAR (Prior)

Tooltip obligatoire :
"This model is trained on related targets. Predictions are intended for ranking only."

---

# 10. Objectif stratégique V8.1

- Scientifiquement défendable
- Transparent
- Modulaire
- Compatible biotech-grade
- Sans promesse abusive

---

# 11. Roadmap ultérieure

V9 :
- Pocket-aware filtering automatique

V10 :
- Mutation-aware SAR

V11 :
- Active learning avec boucle CRO
