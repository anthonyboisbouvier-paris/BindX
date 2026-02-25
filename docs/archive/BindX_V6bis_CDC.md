Cahier des charges — BindX Refactor UX V6 refacto (production-safe, sans casser l’existant)
Contexte

Nous avons une application BindX de screening/docking existante. L’objectif est un refactor UX : rendre l’expérience plus claire, plus proche de la réalité d’un biochimiste/medicinal chemist, sans changer profondément le backend/pipelines ni introduire de features lourdes qui risquent de casser la prod.

Ce document donne une structure d’interface cible + des directives UX. Il n’est pas exhaustif : tu dois rester calé sur toutes les fonctionnalités déjà présentes et les intégrer proprement dans la nouvelle organisation. Si certains points demandent un refactor trop risqué, ne pas l’implémenter en V1, mais le noter pour une V2.

1) Principes UX directeurs
1.1. Persona / mental model

Tu dois te mettre à la place d’un chercheur screening/docking expérimenté (Schrödinger / MOE / AutoDock, etc.) :

Il veut une expérience simple, mais pas infantilisante.

Il veut voir l’essentiel au bon moment.

Il veut garder la main sur les décisions critiques.

Il se méfie des scores bruts et veut pouvoir inspecter / décider.

1.2. Règles

Un écran = une fonction claire.

Navigation persistante via menu à gauche (sidebar) entre les écrans.

Les choix critiques doivent être explicites (pas cachés dans le pipeline).

Éviter de rajouter de nouvelles features “profondes”.

Garder une cohérence avec l’existant : si une feature existe déjà, elle doit rester accessible, même si elle est déplacée / renommée.

2) Navigation obligatoire (menu gauche)

Il doit y avoir un menu vertical à gauche accessible en permanence, permettant d’aller sur chaque écran principal.

Entrées minimales du menu (V1)

Project

Target setup

Runs

Results

Optimization

Reports

Remarque : “Optimization” existe déjà (avec options/configs actuelles). On la garde dans la navigation, même si on simplifie l’accès et qu’on corrige surtout l’UX.

3) Structure fonctionnelle écran par écran
Écran 1 — Project (overview)
Objectif

Vue d’état du projet + point d’entrée vers le workflow.

Contenu requis (minimal, utile)

Nom du projet / target (UniProt + nom)

Résumé “selected defaults” :

Structure par défaut

Pocket par défaut

Source par défaut (si existant)

Récap Runs :

dernier run + statut

quelques KPIs synthétiques (ceux qui existent déjà)

Actions

“Go to Target setup”

“Create screening run”

“Open last results”

“Go to Optimization” (si hits déjà sélectionnés)

Contrôle du chercheur

Aucune décision scientifique critique ici (overview uniquement)

Il décide où aller ensuite.

Écran 2 — Target setup (structure + pocket)
Objectif

Configurer la cible et définir les choix par défaut.

Section A — Structure

Liste des structures disponibles (selon l’existant)

Une sélection “default structure” modifiable

Afficher l’essentiel (source/type/confiance), sans surcharge

Section B — Pocket

Liste des pockets trouvées

Une sélection “default pocket” modifiable

Afficher : pocket id + druggability + volume + (résidus clés si dispo)

Contrôle du chercheur

✅ Il a la main sur :

Structure par défaut

Pocket par défaut

Contraintes V1

Ne pas changer la logique de calcul structure/pocket.

Ne pas introduire de scoring pocket/structure nouveau si cela nécessite backend.

Écran 3 — Runs (liste + création)
Objectif

Centraliser tout ce qui concerne les runs : HTS (screening de librairies existantes) + runs d’optimisation (IA).

IMPORTANT : Il y a deux types de “campagnes” dans la vraie vie :

HTS / screening : on teste des molécules existantes → on trouve des hits

Hit-to-lead / optimisation : on génère/synthétise des analogues (IA) en itérations

V1 safe : comment organiser sans refactor profond

✅ Proposition V1 (safe) :

Garder le concept Run existant.

Ajouter (si possible sans casser) un champ simple “Run type” :

Screening (HTS)

Optimization (AI)
Si c’est trop risqué côté modèle : faire au minimum une étiquette UI calculée à partir du flux existant (ex : si run généré depuis “optimization”, label “Optimization”).

A) Runs list

Afficher une table/list claire :

Run ID / date

Run type (HTS vs Optimization)

Structure / pocket / source

Statut

KPIs principaux (ceux déjà calculés)

Bouton “Open results”

B) Create screening run (HTS)

Formulaire simple :

Structure (prérempli, modifiable)

Pocket (prérempli, modifiable)

Source ligands (choix unique)

Strategy (Fast/Balanced/Precise)

Scoring custom basique (V1) :

L’utilisateur peut ajuster un “score composite” simple basé sur des métriques déjà disponibles.

Exemple : sliders/weights pour 3–5 métriques max (celles existantes aujourd’hui).

Si l’existant ne supporte pas un vrai recalcul : faire au minimum un re-ranking côté UI (tri) + sauvegarde des weights dans la config du run (même si non utilisé backend dans un premier temps).

Ne pas implémenter un nouveau scoring backend complexe.

✅ Contrôle du chercheur (HTS)
Il a la main sur :

Structure / pocket

Source (unique)

Strategy

Poids scoring (simple)

Écran 4 — Results (analyse d’un run)
Objectif

Analyser les résultats d’un run de manière claire, orientée décision.

Contenu requis

Sélecteur de run (ou navigation depuis runs)

3D viewer + panneau d’info (docking/admet/interactions/notes) comme aujourd’hui

Tableau résultats : afficher tous les résultats calculés jusqu’ici

Pas “Top 10” seulement

Colonnes = toutes celles déjà calculées (dans une limite raisonnable de lisibilité ; sinon permettre scroll horizontal / colonnes repliables)

Actions critiques : HIT SELECTION

⚠️ Il manque un point clé dans la spec précédente : la sélection des hits.
La page Results doit permettre :

Sélectionner un ou plusieurs ligands en tant que Hits / Shortlist

Ajouter une note (optionnel)

Tagger (hit / discard / investigate), si possible sans refactor lourd

Un bouton “Send to Optimization” (si la feature existe déjà)

✅ Contrôle du chercheur

Choix des hits (décision scientifique centrale)

Notes / tags de sélection (si déjà existant ou simple à ajouter)

Tri / filtres / scoring weights (selon ce qui existe)

Contraintes V1

Ne pas refaire tout le tableau si ça casse le front : adapter au composant existant.

Respecter les résultats déjà calculés (pas de nouvelle computation lourde).

Écran 5 — Optimization (existant, à intégrer)
Objectif

Lancer l’optimisation IA à partir des hits sélectionnés (2ème passe).

Clarification workflow

✅ Oui : on est d’accord qu’au premier run (HTS) on cherche des hits.
Puis en deuxième passe, on lance l’optimisation / synthèse IA à partir du (des) meilleurs hits/scaffolds.

V1 : réorganisation sans feature profonde

Cet écran doit reprendre les options/configs déjà disponibles aujourd’hui (ne pas inventer de nouvelles options).

Entrée : liste des hits sélectionnés (depuis Results)

Bouton : “Start optimization”

Affichage : itérations / générations si déjà existant

Question “campagnes / itérations / consolidation”

On veut pouvoir suivre l’évolution des itérations d’optimisation (amélioration relative).
Sans refactor profond, V1 peut faire :

Chaque optimisation = un run de type Optimization, lié à un run HTS parent.

Afficher un “Optimization chain” :

Parent HTS run

Iteration 1 / 2 / 3 (si le système le fait déjà)

Consolidation :

Une vue simple “Best candidates so far” (liste des meilleurs across chain) si possible sans calcul nouveau

Sinon, afficher les meilleurs de chaque itération

✅ Contrôle du chercheur

Choisir les hits à optimiser

Choisir les options d’optimisation existantes

Comparer itérations (au moins visuellement)

Sélectionner “best candidates” pour la suite (shortlist)

Contraintes V1

Ne pas changer le moteur d’optimisation.

Ne pas refactorer la DB si risqué.

Si “link parent-child runs” est compliqué, faire un lien minimal (metadata/label UI) et documenter V2.

Écran 6 — Reports
Objectif

Exporter un report cohérent, reflétant ce qui existe.

Contenu requis

Projet / target

Structure/pocket

Config run

Résultats : inclure toutes les infos déjà calculées

Hits sélectionnés + notes

Si optimisation : chain / itérations + best candidates

Contraintes V1

Ne pas refaire tout le générateur de PDF si risqué : enrichir progressivement.

Priorité : inclure les infos déjà disponibles plutôt que calculer de nouvelles métriques.

4) Points explicitement hors scope V1 (trop risqué)

Si cela implique un refactor backend / modèle de données / pipeline lourd, ne pas implémenter en V1 :

Multi-source simultané

Nouveaux algos de pocket/structure scoring

Nouveau scoring backend complexe

Analytics avancés multi-run

Refonte complète du système de data persistence

Tu dois documenter ces points pour V2.

5) Critères de succès (acceptance)

Un utilisateur expert doit pouvoir :

Comprendre la target + defaults en 10 secondes (Project)

Choisir structure & pocket sans confusion (Target setup)

Créer un run HTS facilement + scoring custom simple (Runs)

Voir tous les résultats calculés + sélectionner des hits (Results)

Lancer optimisation IA à partir des hits + suivre les itérations (Optimization)

Exporter un report cohérent (Reports)

6) Instruction finale

Ce cahier des charges est une directive. Il manque forcément des détails spécifiques au code actuel. Tu dois :

rester compatible avec l’existant

adapter sans casser

livrer une V1 stable, lisible, cohérente

noter clairement tout ce que tu repousses à V2