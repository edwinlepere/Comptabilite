<div align="center">
  <img src="logo.png" alt="Comptabilité Maison" width="110">

  # Comptabilité Maison

  **Application de budget personnel — sans cloud, sans abonnement, sans tracking**

  [![Licence MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)
  [![Electron](https://img.shields.io/badge/Electron-31-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
  [![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux-lightgrey?logo=windows)](https://github.com/edwinlepere/Comptabilite/releases/latest)
  [![No Framework](https://img.shields.io/badge/frontend-HTML%2FCSS%2FJS%20pur-orange)]()
  [![Offline](https://img.shields.io/badge/offline-100%25-brightgreen)]()

  [**Télécharger le portable .exe**](https://github.com/edwinlepere/Comptabilite/releases/latest) · [Guide d'utilisation](#guide-dutilisation) · [Fonctionnalités](#fonctionnalités) · [Installation](#installation) · [Contribuer](#contribuer)
</div>

---

## Pourquoi Comptabilité Maison ?

La plupart des applications de budget exigent un compte, vos identifiants bancaires, ou un abonnement mensuel. Certaines revendent vos habitudes de consommation à des tiers.

**Comptabilité Maison** tourne entièrement en local : vos données restent sur votre machine dans un fichier JSON, aucun serveur n'est contacté, et l'application fonctionne sans connexion internet. Pas de publicité, pas de compte, pas de limite.

---

## Captures d'écran

> *Contributions de screenshots bienvenues — ouvrez une PR avec vos captures !*

---

## Fonctionnalités

| | |
|---|---|
| **Multi-comptes** | Jusqu'à 5 comptes indépendants (banque principale, livret, liquide…) avec solde et historique séparés |
| **Tableau de bord** | Solde actuel calculé, flux entrants/sortants du mois, horloge temps réel, paiements à venir avec badges d'échéance colorés |
| **Paiements récurrents** | Loyer, énergie, abonnements, assurances, impôts — fréquences mensuelle, bimestrielle, trimestrielle, semestrielle, annuelle |
| **Crédits** | Suivi des mensualités, taux, capital restant dû et durée restante pour chaque prêt |
| **Dépenses** | Saisie par catégorie (alimentation, transport, santé, loisirs…) avec graphique camembert interactif |
| **Revenus** | Revenus fixes récurrents (salaire, allocations, retraite…) et revenus ponctuels |
| **Bilan mensuel / annuel** | Vue d'ensemble avec graphiques Chart.js, comparaison mois par mois |
| **Bilan des comptes** | Vue consolidée de tous les comptes sur la période choisie |
| **Navigation mensuelle** | Historique complet accessible mois par mois, sans limite |
| **Favicon automatique** | Logo de chaque organisme/banque récupéré automatiquement (BNP, Crédit Agricole, Boursorama…) |
| **Export / Import JSON** | Sauvegarde et restauration manuelle — vos données restent sous votre contrôle |
| **100 % hors ligne** | Aucune connexion requise après le premier lancement |
| **Mode navigateur** | Fonctionne aussi directement dans Chrome/Firefox sans installation |

---

## Guide d'utilisation

### Premier lancement — mise en place en 5 minutes

#### 1. Créer votre premier compte

Allez dans **Paramètres** (icône engrenage en bas de la barre latérale) :
- Cliquez sur **Ajouter un compte**
- Donnez-lui un nom (ex : "BNP Courant"), choisissez votre banque dans la liste déroulante — le logo se charge automatiquement
- Saisissez le solde de départ actuel de votre compte bancaire

Répétez l'opération pour chaque compte (livret, compte joint, liquidités…). Naviguez entre eux via les flèches dans la barre latérale.

#### 2. Enregistrer vos paiements récurrents

Cliquez sur **Paiements récurrents** dans le menu :
- Ajoutez chaque charge fixe : loyer, EDF, abonnements (Netflix, téléphone…), assurances
- Indiquez le montant, la fréquence (mensuel, trimestriel…) et le jour d'échéance du mois
- Le tableau de bord affiche ensuite automatiquement les paiements à venir avec un badge coloré : rouge si la date est dépassée, orange si elle approche, vert si elle est à plus d'une semaine

#### 3. Déclarer vos revenus

Cliquez sur **Revenus** :
- Ajoutez vos revenus fixes (salaire, allocations CAF, France Travail, retraite…) — ils seront automatiquement pris en compte chaque mois
- Ajoutez un revenu ponctuel pour tout versement exceptionnel (remboursement, prime…)

#### 4. Saisir vos dépenses

Cliquez sur **Dépenses** :
- Chaque dépense est classée par catégorie (alimentation, transport, santé, restaurant…)
- Le graphique camembert se met à jour en temps réel pour visualiser où part votre argent ce mois

#### 5. Suivre vos crédits

Cliquez sur **Crédits en cours** :
- Ajoutez chaque prêt (immobilier, auto, personnel) avec son taux et sa mensualité
- L'application calcule le capital restant dû et la durée restante

#### 6. Consulter le bilan

Cliquez sur **Bilan** :
- Passez en vue **mensuelle** pour analyser un mois précis : revenus vs dépenses vs charges fixes
- Passez en vue **annuelle** pour comparer l'évolution sur 12 mois via le graphique Chart.js
- Utilisez **Bilan des comptes** pour une vue consolidée de tous vos comptes

#### Sauvegarde et restauration

Dans **Paramètres**, utilisez **Exporter** pour télécharger un fichier `compta.json` (sauvegardez-le régulièrement sur un disque externe ou dans le cloud de votre choix). Pour restaurer, utilisez **Importer** et sélectionnez votre fichier de sauvegarde.

---

## Installation

### Exécutable portable Windows (recommandé)

Téléchargez le `.exe` depuis les [**Releases**](../../releases/latest) et lancez-le directement — aucune installation requise, aucun droits administrateur nécessaire.

### Depuis les sources

**Prérequis :** [Node.js](https://nodejs.org/) ≥ 18 · npm ≥ 9

```bash
git clone https://github.com/edwinlepere/Comptabilite.git
cd Comptabilite
npm install
```

| Commande | Action |
|---|---|
| `npm start` | Lance en mode développement |
| `npm run dist` | Compile le portable Windows (`.exe`) |
| `npm run build:linux` | Compile l'AppImage Linux |
| `npm run build:all` | Compile Windows + Linux |

Le fichier généré se trouve dans `dist/`.

### Version navigateur

Ouvrez `index.html` dans n'importe quel navigateur moderne — aucune dépendance requise. Les données sont alors stockées dans le `localStorage` du navigateur.

---

## Stockage des données

| Plateforme | Emplacement |
|---|---|
| Windows | `%APPDATA%\comptabilite-maison\compta.json` |
| Linux | `~/.config/comptabilite-maison/compta.json` |
| macOS | `~/Library/Application Support/comptabilite-maison/compta.json` |
| Navigateur | `localStorage` du navigateur |

Le fichier JSON est lisible et modifiable directement — aucun format propriétaire.

---

## Stack technique

- **Frontend** : HTML / CSS / JavaScript pur — zéro framework, zéro dépendance runtime
- **Desktop** : [Electron](https://www.electronjs.org/) 31 avec `contextIsolation` et bridge IPC sécurisé
- **Graphiques** : [Chart.js](https://www.chartjs.org/) 4 + plugin datalabels
- **Packaging** : [electron-builder](https://www.electron.build/) — portable `.exe`, AppImage Linux, DMG macOS
- **Stockage** : Abstraction backend découplée (`LocalStorageBackend` / `ElectronBackend`)

La couche de stockage est entièrement abstraite : implémenter `load()` et `save(data)` dans une nouvelle classe suffit pour brancher un backend SQLite, IndexedDB, ou un serveur auto-hébergé.

---

## Structure du projet

```
comptabilite-maison/
├── index.html       # Interface principale (SPA complète)
├── main.js          # Processus principal Electron
├── preload.js       # Bridge IPC sécurisé (contextIsolation)
├── package.json     # Config npm + electron-builder
├── logo.png         # Icône de l'application
├── css/
│   └── style.css    # Styles (variables CSS, thème sombre)
└── js/
    ├── data.js      # DataManager — CRUD, backends de stockage, catégories
    └── app.js       # UI, rendu, navigation, modales, graphiques
```

L'application est une **SPA** (Single Page Application) sans routeur externe : la navigation est gérée par JavaScript pur, chaque section (dashboard, revenus, paiements…) est rendue dynamiquement dans le DOM.

---

## Potentiel et évolutions

L'architecture permet d'étendre l'application sans réécriture :

- **Backend alternatif** : remplacer `LocalStorageBackend` par une classe `SyncBackend` pour synchroniser via un serveur auto-hébergé (Nextcloud, VPS personnel)
- **Import bancaire** : parser des exports OFX/CSV des banques françaises pour alimenter les dépenses automatiquement
- **Notifications desktop** : alertes Electron pour les échéances de paiement J-3 / J-1
- **Export PDF** : générer un bilan mensuel imprimable via Puppeteer ou jsPDF
- **Multi-utilisateurs** : séparer les données par profil utilisateur sur une machine partagée
- **Thème clair** : les variables CSS sont déjà en place, il suffit d'ajouter un jeu de valeurs

---

## Roadmap

- [ ] Import relevés bancaires (OFX / CSV)
- [ ] Notifications d'échéance native (paiements à venir J-3, J-1)
- [ ] Thème clair
- [ ] Export PDF du bilan mensuel
- [ ] Synchronisation optionnelle auto-hébergée
- [ ] Prévisionnel : projection du solde sur N mois

---

## Contribuer

Les contributions sont les bienvenues — bug fix, nouvelle fonctionnalité, traduction, screenshot pour le README.

1. Forkez le dépôt
2. Créez une branche : `git checkout -b feature/ma-fonctionnalite`
3. Commitez : `git commit -m "feat: description courte"`
4. Poussez : `git push origin feature/ma-fonctionnalite`
5. Ouvrez une Pull Request

---

## Licence

[MIT](LICENSE) © [edwinlepere](https://github.com/edwinlepere)
