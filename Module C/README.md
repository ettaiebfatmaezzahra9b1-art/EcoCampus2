# EcoCampus — Module C

Programme console de gestion des mesures de consommation du campus (électricité, eau, chauffage, gaz).
Il charge un fichier CSV, contrôle chaque ligne, détecte les alertes et génère `data.json` pour le module Web.

## Compilation et exécution

    gcc -std=c99 -Wall -Wextra gestion.c main.c -o ecocampus
    ./ecocampus                      (lit measures_in.csv)
    ./ecocampus mon_fichier.csv      (autre fichier)

Sous Windows : `gcc -std=c99 -Wall -Wextra gestion.c main.c -o ecocampus.exe` puis `ecocampus.exe`.
Aucun exécutable n'est fourni : compiler avec la commande ci-dessus.

## Fichiers

| Fichier | Rôle |
|---|---|
| gestion.h | Structures (Mesure, Stat) et liste des fonctions |
| gestion.c | Toutes les fonctions : outils, ajout/validation, chargement CSV, recherche, suppression, tri, statistiques, alertes, analyses, export |
| main.c | Saisies protégées + menu |
| measures_in.csv | Jeu de données : 85 mesures, 7 bâtiments, 4 ressources, 8 alertes |
| measures_test_erreurs.csv | Fichier volontairement faux pour tester la gestion des erreurs (13 lignes rejetées, 3 chargées) |
| data.json | Fichier généré pour le module Web (option 12) |
| measures_out.csv | Sauvegarde des mesures au format CSV (option 13) |

## Choix de conception

- Tableau fixe `mesures[MAX_MESURES]` + compteur `nb_mesures` : limite de 500 mesures (message « tableau plein » au-delà).
- Tri à bulles avec un `switch`.
- 3 fichiers sources : `gestion.h`, `gestion.c`, `main.c`.

## Ce qui est protégé

- Chargement CSV : fichier absent, mauvais nombre de champs, valeur manquante ou non numérique, id en double,
  ressource inconnue, valeur négative, seuil ≤ 0, date ou heure invalide, doublon (même bâtiment, ressource, date
  et heure), valeur ou seuil > 10 000 000 → la ligne est rejetée avec son numéro et son motif, le reste du
  fichier est chargé.
- Toutes les saisies du menu sont contrôlées (aucun plantage si on tape n'importe quoi, ni si l'entrée se termine).
- Suppression avec confirmation et annulation possible.

## Lien avec le module Web

- Option 12 : écrit `data.json`, puis en copie `data.json` et `data.js` dans `../Module_Web` s'il existe.
  Les pages se mettent à jour seules. Si le dossier n'existe pas, la copie est simplement ignorée.
- Les règles de validation du C sont les mêmes que celles de la page web.

## Alerte et formats

Alerte = valeur > seuil. Format d'entrée : `id,batiment,ressource,valeur,date,heure,seuil`.
Format de `data.json` : `meta` (genere_le, nb_mesures, nb_alertes) + `mesures` (avec `unite`, `heure`, `alerte`)
+ `statistiques` (une entrée par couple bâtiment/ressource, avec `nb_alertes`).

## Menu

1 Afficher - 2 Ajouter - 3 Rechercher - 4 Supprimer - 5 Annuler la suppression - 6 Trier -
7 Statistiques - 8 Alertes et pics - 9 Comparer deux bâtiments - 10 Classement des bâtiments -
11 Score éco et conseils - 12 Exporter data.json - 13 Sauvegarder en CSV - 0 Quitter
