<div align="center">

# Horizon

**Gestionnaire de budget et d'objectifs d'achat pour Windows**

![Version](https://img.shields.io/badge/version-1.0.0-blue?style=flat-square)
![Platform](https://img.shields.io/badge/platform-Windows-lightgrey?style=flat-square)
![Electron](https://img.shields.io/badge/Electron-31-47848F?style=flat-square&logo=electron)
![License](https://img.shields.io/badge/licence-MIT-green?style=flat-square)

</div>

---

## <img src="https://cdn.jsdelivr.net/npm/feather-icons@4.28.0/dist/icons/download.svg" width="18"/> Téléchargement

Rendez-vous dans l'onglet [**Releases**](../../releases/latest) et téléchargez `Horizon-Setup-x.x.x.exe`.

---

## <img src="https://cdn.jsdelivr.net/npm/feather-icons@4.28.0/dist/icons/star.svg" width="18"/> Fonctionnalités

### <img src="https://cdn.jsdelivr.net/npm/feather-icons@4.28.0/dist/icons/trending-up.svg" width="14"/> Tableau de bord
- Solde actuel et rythme d'épargne mensuel calculé automatiquement
- Trajectoire visuelle vers tes objectifs (runway) avec dates précises si jour de paie configuré
- Alertes de dépassement de budget par catégorie

### <img src="https://cdn.jsdelivr.net/npm/feather-icons@4.28.0/dist/icons/dollar-sign.svg" width="14"/> Transactions
- Saisie manuelle de revenus et dépenses avec catégories
- Import CSV des relevés bancaires — détection automatique des colonnes, gère les formats Débit/Crédit séparés et les montants signés
- Recherche et filtres par type, mois ou mot-clé
- Édition et suppression de chaque transaction

### <img src="https://cdn.jsdelivr.net/npm/feather-icons@4.28.0/dist/icons/refresh-cw.svg" width="14"/> Récurrents
- Loyer, salaire, abonnements — configurés une fois, générés automatiquement chaque mois
- Génération rétroactive si l'app n'a pas été ouverte depuis plusieurs mois

### <img src="https://cdn.jsdelivr.net/npm/feather-icons@4.28.0/dist/icons/target.svg" width="14"/> Objectifs
- Liste d'objectifs d'achat priorisés avec prix
- Calcul du délai avant de pouvoir se les offrir (waterfall : le premier objectif est financé avant le suivant)
- Date exacte d'achat estimée si le jour de paie est configuré
- Marquage comme « acheté » avec enregistrement automatique de la dépense

### <img src="https://cdn.jsdelivr.net/npm/feather-icons@4.28.0/dist/icons/bar-chart-2.svg" width="14"/> Statistiques
- Courbe d'évolution du solde sur 12 mois
- Graphe revenus vs dépenses par mois
- Répartition des dépenses par catégorie avec indicateur de dépassement

### <img src="https://cdn.jsdelivr.net/npm/feather-icons@4.28.0/dist/icons/settings.svg" width="14"/> Paramètres
- Devise configurable (€, $, £, CHF)
- Jour de paie pour des projections à la date exacte
- Rythme d'épargne manuel ou calculé automatiquement
- Budgets mensuels par catégorie de dépense
- Démarrage automatique avec Windows
- Thème clair et thème sombre
- Export et import de sauvegarde JSON

---

## <img src="https://cdn.jsdelivr.net/npm/feather-icons@4.28.0/dist/icons/command.svg" width="18"/> Raccourcis clavier

| Raccourci | Action |
|---|---|
| `Ctrl + 1` | Tableau de bord |
| `Ctrl + 2` | Transactions |
| `Ctrl + 3` | Récurrents |
| `Ctrl + 4` | Objectifs |
| `Ctrl + 5` | Statistiques |
| `Ctrl + 6` | Paramètres |
| `Échap` | Fermer un modal |

---

## <img src="https://cdn.jsdelivr.net/npm/feather-icons@4.28.0/dist/icons/database.svg" width="18"/> Données & confidentialité

Toutes les données restent **en local** sur ta machine, dans le dossier de données utilisateur d'Electron (`%APPDATA%\horizon\`). Rien n'est envoyé sur un serveur. Utilise **Paramètres → Exporter une sauvegarde** pour garder une copie ailleurs.

---

## <img src="https://cdn.jsdelivr.net/npm/feather-icons@4.28.0/dist/icons/git-branch.svg" width="18"/> Build

Les releases sont générées automatiquement par GitHub Actions.

**Build de test** (push sur `main`) — produit un `.exe` en artefact de build :
```bash
git push origin main
```

**Release officielle** (workflow manuel) :
```bash
# Depuis l'onglet Actions → Release Horizon → Run workflow → entrer la version
# ex : 1.0.0
```

Ou depuis la ligne de commande :
```bash
npm install
npm run build
# → dist/Horizon-Setup-x.x.x.exe
```

---

## <img src="https://cdn.jsdelivr.net/npm/feather-icons@4.28.0/dist/icons/tool.svg" width="18"/> Dépannage

<details>
<summary><strong>L'application ne démarre pas</strong></summary>

Vérifie que tu as bien installé la dernière version depuis l'onglet Releases. Si le problème persiste, supprime le dossier `%APPDATA%\horizon\` et relance.
</details>

<details>
<summary><strong>L'import CSV ne détecte pas mes colonnes</strong></summary>

Horizon supporte les délimiteurs `,` et `;` ainsi que les formats de date `YYYY-MM-DD` et `DD/MM/YYYY`. Ouvre la fenêtre d'import et ajuste manuellement les colonnes si la détection automatique est incorrecte.
</details>

<details>
<summary><strong>Les transactions récurrentes ne se génèrent pas</strong></summary>

Elles sont générées au démarrage de l'application, uniquement si le jour du mois configuré est passé. Si tu viens de configurer un récurrent pour le 1er du mois et que nous sommes le 15, la prochaine génération aura lieu le mois prochain au démarrage.
</details>

<details>
<summary><strong>La mise à jour automatique ne fonctionne pas</strong></summary>

La mise à jour automatique nécessite que l'application soit installée via le `.exe` de la page Releases. Elle ne fonctionne pas en mode développement (`npm start`).
</details>
