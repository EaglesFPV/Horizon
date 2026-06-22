# Horizon

Application de bureau (Windows) pour suivre ton budget et savoir, à tout moment, dans combien de temps tu pourras t'offrir tes prochains achats.

## Fonctionnalités

- Suivi du solde, des revenus et des dépenses, avec catégories
- Import CSV des relevés bancaires (détection automatique des colonnes, gère les formats à montant signé ou à colonnes Débit/Crédit séparées)
- Liste d'objectifs d'achat classés par priorité, avec estimation du temps restant avant de pouvoir se les offrir
- Le calcul se met à jour automatiquement dès qu'une transaction est ajoutée : un revenu supplémentaire raccourcit immédiatement le délai de tous tes objectifs
- Statistiques : revenus/dépenses par mois, dépenses par catégorie
- Sauvegarde / restauration manuelle (export-import JSON)
- Toutes les données restent en local, sur ta machine — rien n'est envoyé ailleurs

## Comment ça calcule le temps avant un achat

Horizon calcule ton rythme d'épargne moyen sur tes 3 derniers mois complets (ou tu peux le fixer toi-même dans Paramètres). Tes objectifs sont financés dans l'ordre de priorité que tu définis : l'argent disponible (solde + épargne à venir) finance d'abord le premier objectif de la liste, puis ce qui reste finance le suivant, etc. Si tu reçois un revenu imprévu, ton solde augmente immédiatement et tous les délais se recalculent en conséquence — sans rien à faire de ta part.

## Lancer l'app en local

Prérequis : [Node.js](https://nodejs.org) (version 20 recommandée).

```bash
npm install
npm start
```

## Construire l'exécutable Windows

```bash
npm run build
```

L'installeur sera généré dans `dist/Horizon-Setup-<version>.exe`.

## Construction automatique via GitHub Actions

Le dossier `.github/workflows/` contient deux workflows, sur le même modèle que tes projets précédents :

- **build.yml** : se déclenche à chaque push sur `main`, construit l'app et dépose l'exécutable en artefact de build (téléchargeable depuis l'onglet Actions du repo).
- **release.yml** : à déclencher manuellement (`workflow_dispatch`) avec un numéro de version. Construit l'app et publie une Release GitHub avec l'installeur `.exe` et `latest.yml` (utilisé pour les mises à jour automatiques si tu ajoutes `electron-updater` plus tard).

Il suffit de pousser ce projet sur un repo GitHub pour que ça fonctionne, comme pour tes anciens projets.

## Où sont stockées tes données

Dans un fichier `horizon-data.json`, dans le dossier de données utilisateur d'Electron (sur Windows : `%APPDATA%/horizon/`). Utilise le bouton **Exporter une sauvegarde** dans Paramètres pour en garder une copie ailleurs (clé USB, cloud...).

## Pourquoi pas de connexion bancaire automatique pour l'instant

L'option gratuite la plus simple pour ça (GoCardless Bank Account Data) a fermé les inscriptions aux nouveaux comptes mi-2025. L'alternative actuelle la plus viable (Enable Banking) nécessite un petit serveur backend pour gérer l'authentification de façon sécurisée, et la réglementation européenne impose de toute façon une reconnexion à ta banque tous les 90 jours — donc même "automatique" veut dire "presque automatique".

Le code est organisé pour que ça reste possible d'ajouter ça plus tard sans tout réécrire : toute la logique de calcul (`src/calc.js`) ne connaît que la liste des transactions, peu importe d'où elles viennent. Un futur module de synchronisation bancaire n'aurait qu'à ajouter des transactions au même tableau — exactement comme le fait l'import CSV aujourd'hui.

## Structure du projet

```
src/
  main.js       Processus principal Electron (fenêtre, fichiers, IPC)
  preload.js    Pont sécurisé entre l'interface et le processus principal
  calc.js       Logique pure : solde, rythme d'épargne, projections d'objectifs
  csv.js        Lecture des fichiers CSV
  app.js        Logique de l'interface (rendu, formulaires, événements)
  index.html    Structure de la page
  style.css     Styles
```
