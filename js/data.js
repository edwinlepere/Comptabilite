// ── Comptabilité Maison — Couche données ────────────────────────────────────
'use strict';

const STORAGE_KEY = 'comptaMaison_v3';

// ── Référentiels ─────────────────────────────────────────────────────────────
const CATS_PAIEMENTS = [
  { id: 'logement',    nom: 'Loyer',        icon: '🏠', color: '#3b82f6' },
  { id: 'energie',     nom: 'Énergie',       icon: '⚡', color: '#f59e0b' },
  { id: 'abonnement',  nom: 'Abonnement',    icon: '📱', color: '#8b5cf6' },
  { id: 'assurance',   nom: 'Assurance',     icon: '🛡️', color: '#0ea5e9' },
  { id: 'impots',      nom: 'Impôts/Taxes',  icon: '📄', color: '#64748b' },
  { id: 'autre',       nom: 'Autre',         icon: '❓', color: '#94a3b8' },
];

const CATS_DEPENSES = [
  { id: 'alimentation', nom: 'Alimentation',    icon: '🛒', color: '#22c55e' },
  { id: 'transport',    nom: 'Transport',        icon: '🚗', color: '#f59e0b' },
  { id: 'sante',        nom: 'Santé',            icon: '💊', color: '#ec4899' },
  { id: 'loisirs',      nom: 'Loisirs',          icon: '🎮', color: '#8b5cf6' },
  { id: 'vetements',    nom: 'Vêtements',        icon: '👕', color: '#06b6d4' },
  { id: 'maison',       nom: 'Maison/Travaux',   icon: '🔧', color: '#f97316' },
  { id: 'tech',         nom: 'Tech/Électronique',icon: '💻', color: '#475569' },
  { id: 'restaurant',   nom: 'Restaurant',       icon: '🍽️', color: '#f43f5e' },
  { id: 'animaux',      nom: 'Animaux',          icon: '🐾', color: '#a78bfa' },
  { id: 'epargne',      nom: 'Épargne',          icon: '🏦', color: '#10b981' },
  { id: 'autre',        nom: 'Autre',            icon: '❓', color: '#94a3b8' },
];

const CATS_REVENUS = [
  { id: 'salaire',        nom: 'Salaire',         icon: '💼', color: '#16a34a' },
  { id: 'allocation',     nom: 'Allocations CAF', icon: '🤝', color: '#22c55e', catLogo: 'https://upload.wikimedia.org/wikipedia/fr/thumb/c/cb/Caisse_d_allocations_familiales_france_logo.svg/3840px-Caisse_d_allocations_familiales_france_logo.svg.png' },
  { id: 'francetravail',  nom: 'France Travail',  icon: '🏢', color: '#4f46e5', catFavicon: 'francetravail.fr' },
  { id: 'aide',           nom: 'Aide sociale',    icon: '🏛️', color: '#4ade80' },
  { id: 'retraite',       nom: 'Retraite',        icon: '👴', color: '#0ea5e9' },
  { id: 'remboursement',  nom: 'Remboursement',   icon: '↩️', color: '#8b5cf6' },
  { id: 'complement',     nom: 'Complément',      icon: '➕', color: '#f59e0b' },
  { id: 'autre',          nom: 'Autre',           icon: '💸', color: '#94a3b8' },
];

const FREQUENCES = [
  { id: 'mensuel',     nom: 'Mensuel',                  short: '/mois',    interval: 1  },
  { id: 'bimestriel',  nom: 'Bimestriel (tous les 2 mois)', short: '/2 mois',  interval: 2  },
  { id: 'trimestriel', nom: 'Trimestriel (tous les 3 mois)', short: '/trim.',  interval: 3  },
  { id: 'semestriel',  nom: 'Semestriel (tous les 6 mois)', short: '/sem.',   interval: 6  },
  { id: 'annuel',      nom: 'Annuel (1 fois par an)',    short: '/an',      interval: 12 },
];

const BANQUES = [
  { nom: 'BNP Paribas',        domain: 'bnpparibas.fr' },
  { nom: 'Crédit Agricole',    domain: 'credit-agricole.fr' },
  { nom: 'Société Générale',   domain: 'societegenerale.fr' },
  { nom: 'LCL',                domain: 'lcl.fr' },
  { nom: 'Crédit Mutuel',      domain: 'creditmutuel.fr' },
  { nom: 'CIC',                domain: 'cic.fr' },
  { nom: 'La Banque Postale',  domain: 'labanquepostale.fr' },
  { nom: "Caisse d'Épargne",   domain: 'caisse-epargne.fr' },
  { nom: 'Banque Populaire',   domain: 'banquepopulaire.fr' },
  { nom: 'Boursorama',         domain: 'boursorama.fr' },
  { nom: 'Hello Bank',         domain: 'hellobank.fr' },
  { nom: 'Fortuneo',           domain: 'fortuneo.fr' },
  { nom: 'N26',                domain: 'n26.com' },
  { nom: 'Revolut',            domain: 'revolut.com' },
  { nom: 'Nickel',             domain: 'nickel.eu' },
  { nom: 'Orange Bank',        domain: 'orangebank.fr' },
  { nom: 'Monabanq',           domain: 'monabanq.com' },
  { nom: 'Ma French Bank',     domain: 'mafrenchbank.fr' },
  { nom: 'Shine',              domain: 'shine.fr' },
  { nom: 'Qonto',              domain: 'qonto.com' },
  { nom: 'Lydia',              domain: 'lydia-app.com' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

function formatEur(v) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v || 0);
}

function formatDate(s) {
  if (!s) return '';
  return new Date(s).toLocaleDateString('fr-FR');
}

function monthLabel(key) {
  const [y, m] = key.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function getFavicon(siteWeb) {
  if (!siteWeb || !siteWeb.trim()) return null;
  const domain = siteWeb.trim().replace(/^https?:\/\//, '').split('/')[0];
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Retourne true si le paiement p doit apparaître dans le mois monthKey
function isPaymentActiveForMonth(p, monthKey) {
  if (!p.actif) return false;
  const [py, pm] = monthKey.split('-').map(Number);

  // Vérifier dateDebut
  if (p.dateDebut) {
    const [sy, sm] = p.dateDebut.split('-').map(Number);
    if (py < sy || (py === sy && pm < sm)) return false;
  }

  // Vérifier dateFin
  if (p.dateFin) {
    const [ey, em] = p.dateFin.split('-').map(Number);
    if (py > ey || (py === ey && pm > em)) return false;
  }

  // Vérifier fréquence (seulement si dateDebut est défini)
  if (p.frequence && p.frequence !== 'mensuel' && p.dateDebut) {
    const [sy, sm] = p.dateDebut.split('-').map(Number);
    const diff = (py - sy) * 12 + (pm - sm);
    const freq = (FREQUENCES.find(f => f.id === p.frequence) || FREQUENCES[0]).interval;
    if (diff % freq !== 0) return false;
  }

  return true;
}

// Calcule la dateFin à partir d'un dateDebut + durée en mois
function calcDateFin(dateDebut, dureeMois) {
  if (!dateDebut || !dureeMois) return null;
  const [y, m] = dateDebut.split('-').map(Number);
  const fin = new Date(y, m - 1 + dureeMois, 1);
  return `${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, '0')}`;
}

// Vérifie si un revenu récurrent est actif pour un mois donné
function isRevenuActiveForMonth(r, monthKey) {
  const [py, pm] = monthKey.split('-').map(Number);
  if (r.dateDebut) {
    const [sy, sm] = r.dateDebut.split('-').map(Number);
    if (py < sy || (py === sy && pm < sm)) return false;
  }
  if (r.dateFin) {
    const [ey, em] = r.dateFin.split('-').map(Number);
    if (py > ey || (py === ey && pm > em)) return false;
  }
  return true;
}

// ── Couche de stockage (swappable) ───────────────────────────────────────────
class LocalStorageBackend {
  load()        { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; } }
  save(data)    { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
}

// App portable Electron : stockage dans un fichier .json via IPC
class ElectronBackend {
  load()        { try { return JSON.parse(window.electronAPI.loadData()); } catch { return null; } }
  save(data)    { window.electronAPI.saveData(JSON.stringify(data)); }
}

// Détection automatique : Electron injecte window.electronAPI via preload.js
const storageBackend = (typeof window !== 'undefined' && window.electronAPI)
  ? new ElectronBackend()
  : new LocalStorageBackend();

// ── DataManager ──────────────────────────────────────────────────────────────
class DataManager {
  constructor() {
    this._d = null;
    this._activeId = null;
    this._load();
  }

  _load() {
    try {
      const raw = storageBackend.load();
      this._d = raw || this._defaults();
    } catch {
      this._d = this._defaults();
    }
    // Migration guard
    if (!this._d.mois)                  this._d.mois = {};
    if (!this._d.credits)               this._d.credits = [];
    if (!this._d.paiementsRecurrents)   this._d.paiementsRecurrents = [];
    if (!this._d.revenusRecurrents)     this._d.revenusRecurrents = [];
    if (!this._d.prefs)                 this._d.prefs = {};
    if (!this._d.comptes)               this._d.comptes = [];
    if (!this._d.comptes_data)          this._d.comptes_data = {};
    // Migration : crée le compte LCL principal depuis l'ancien solde unique
    if (this._d.comptes.length === 0 && this._d.prefs.soldeDeDepart !== undefined) {
      this._d.comptes = [{
        id: genId(),
        nom: 'LCL',
        domain: 'lcl.fr',
        type: 'bank',
        role: 'principal',
        solde: this._d.prefs.soldeDeDepart,
        soldeDepartMois: this._d.prefs.soldeDepartMois || null,
      }];
    }
    // Migration : déplace les données top-level vers le premier compte
    if (this._d.comptes.length > 0) {
      const firstId = this._d.comptes[0].id;
      if (!this._d.comptes_data[firstId]) {
        this._d.comptes_data[firstId] = {
          paiementsRecurrents: this._d.paiementsRecurrents || [],
          revenusRecurrents:   this._d.revenusRecurrents   || [],
          credits:             this._d.credits             || [],
          mois:                this._d.mois                || {}
        };
      }
      this._activeId = firstId;
    }
  }

  _defaults() {
    return {
      version: 3,
      paiementsRecurrents: [],
      revenusRecurrents:   [],
      credits: [],
      mois:    {},
      prefs:   {},
      comptes: [],
      comptes_data: {}
    };
  }

  save() {
    storageBackend.save(this._d);
  }

  // ── Contexte du compte actif ──────────────────────────────────────────────
  _emptyCtx() {
    return { paiementsRecurrents: [], revenusRecurrents: [], credits: [], mois: {} };
  }

  _ctx() {
    const id = this._activeId || (this._d.comptes.length > 0 ? this._d.comptes[0].id : '__root__');
    if (!this._d.comptes_data[id]) this._d.comptes_data[id] = this._emptyCtx();
    return this._d.comptes_data[id];
  }

  setActiveCompte(id) {
    this._activeId = id;
    if (!this._d.comptes_data[id]) this._d.comptes_data[id] = this._emptyCtx();
  }

  // ── Accès aux collections ─────────────────────────────────────────────────
  get paiements()         { return this._ctx().paiementsRecurrents; }
  get revenusRecurrents() { return this._ctx().revenusRecurrents; }
  get credits()           { return this._ctx().credits; }

  monthData(key) {
    const ctx = this._ctx();
    if (!ctx.mois[key]) {
      ctx.mois[key] = { revenus: [], depenses: [], statuts: {} };
    }
    return ctx.mois[key];
  }

  // Calcule les totaux dans le contexte d'un compte spécifique (sans changer _activeId globalement)
  totalsForCompte(compteId, monthKey) {
    const saved = this._activeId;
    this._activeId = compteId;
    const result = this.totals(monthKey);
    this._activeId = saved;
    return result;
  }

  // ── Calculs du mois ───────────────────────────────────────────────────────
  totals(monthKey) {
    const md = this.monthData(monthKey);
    const revRecurrents = this.revenusRecurrents
      .filter(r => isRevenuActiveForMonth(r, monthKey))
      .reduce((s, r) => s + (r.montant || 0), 0);
    const revenus   = md.revenus.reduce((s, r) => s + (r.montant || 0), 0) + revRecurrents;
    const depenses  = md.depenses.reduce((s, d) => s + (d.montant || 0), 0);
    const credits   = this.credits
      .filter(c => isRevenuActiveForMonth(c, monthKey))
      .reduce((s, c) => s + (c.mensualite || 0), 0);
    const actifs    = this.paiements.filter(p => isPaymentActiveForMonth(p, monthKey));

    let totalPmts = 0, paidPmts = 0, countPaid = 0, countTotal = actifs.length;
    for (const p of actifs) {
      const st      = md.statuts[p.id];
      const montant = st?.montantReel ?? p.montant;
      totalPmts    += montant;
      if (st?.paye) { paidPmts += montant; countPaid++; }
    }

    return {
      revenus,
      depenses,
      credits,
      paiements:         totalPmts,
      paiementsPaids:    paidPmts,
      paiementsRestants: totalPmts - paidPmts,
      countPaid,
      countTotal,
      solde:      revenus - credits - depenses - totalPmts,
      disponible: revenus - credits - depenses - paidPmts,
    };
  }

  // Répartition dépenses par catégorie
  depensesParCategorie(monthKey) {
    const md = this.monthData(monthKey);
    const map = {};
    for (const d of md.depenses) {
      map[d.categorie] = (map[d.categorie] || 0) + (d.montant || 0);
    }
    return map;
  }

  // ── CRUD Paiements récurrents ─────────────────────────────────────────────
  addPaiement(p)    { this.paiements.push({ ...p, id: genId() }); this.save(); }
  updatePaiement(id, u) {
    const i = this.paiements.findIndex(p => p.id === id);
    if (i >= 0) { this._ctx().paiementsRecurrents[i] = { ...this.paiements[i], ...u }; this.save(); }
  }
  deletePaiement(id) { this._ctx().paiementsRecurrents = this.paiements.filter(p => p.id !== id); this.save(); }

  togglePaiement(monthKey, pid) {
    const md = this.monthData(monthKey);
    const p  = this.paiements.find(x => x.id === pid);
    if (!p) return;
    const st = md.statuts[pid];
    if (st?.paye) {
      md.statuts[pid] = { paye: false, datePaiement: null, montantReel: p.montant };
    } else {
      md.statuts[pid] = {
        paye:          true,
        datePaiement:  new Date().toISOString().split('T')[0],
        montantReel:   st?.montantReel ?? p.montant,
      };
    }
    this.save();
  }

  // ── CRUD Crédits ──────────────────────────────────────────────────────────
  addCredit(c)      { this.credits.push({ ...c, id: genId() }); this.save(); }
  updateCredit(id, u) {
    const i = this.credits.findIndex(c => c.id === id);
    if (i >= 0) { this._ctx().credits[i] = { ...this.credits[i], ...u }; this.save(); }
  }
  deleteCredit(id)  { this._ctx().credits = this.credits.filter(c => c.id !== id); this.save(); }

  // ── CRUD Revenus ──────────────────────────────────────────────────────────
  addRevenu(mk, r)  { this.monthData(mk).revenus.push({ ...r, id: genId() }); this.save(); }
  updateRevenu(mk, id, u) {
    const md = this.monthData(mk), i = md.revenus.findIndex(r => r.id === id);
    if (i >= 0) { md.revenus[i] = { ...md.revenus[i], ...u }; this.save(); }
  }
  deleteRevenu(mk, id) { const md = this.monthData(mk); md.revenus = md.revenus.filter(r => r.id !== id); this.save(); }

  // ── CRUD Dépenses ─────────────────────────────────────────────────────────
  addDepense(mk, d)  { this.monthData(mk).depenses.push({ ...d, id: genId() }); this.save(); }
  updateDepense(mk, id, u) {
    const md = this.monthData(mk), i = md.depenses.findIndex(d => d.id === id);
    if (i >= 0) { md.depenses[i] = { ...md.depenses[i], ...u }; this.save(); }
  }
  deleteDepense(mk, id) { const md = this.monthData(mk); md.depenses = md.depenses.filter(d => d.id !== id); this.save(); }

  // ── CRUD Revenus récurrents ───────────────────────────────────────────────
  addRevenuRecurrent(r)      { this.revenusRecurrents.push({ ...r, id: genId() }); this.save(); }
  updateRevenuRecurrent(id, u) {
    const i = this.revenusRecurrents.findIndex(r => r.id === id);
    if (i >= 0) { this._ctx().revenusRecurrents[i] = { ...this.revenusRecurrents[i], ...u }; this.save(); }
  }
  deleteRevenuRecurrent(id)  { this._ctx().revenusRecurrents = this.revenusRecurrents.filter(r => r.id !== id); this.save(); }

  // Liste des revenus récurrents actifs pour un mois
  revenusRecurrentsForMonth(monthKey) {
    return this.revenusRecurrents.filter(r => isRevenuActiveForMonth(r, monthKey));
  }

  // ── CRUD Comptes ─────────────────────────────────────────────────────────────
  get comptes() { return this._d.comptes; }

  addCompte(c) {
    if (this._d.comptes.length >= 5) return false;
    this._d.comptes.push({ ...c, id: genId() });
    this.save();
    return true;
  }
  updateCompte(id, u) {
    const i = this._d.comptes.findIndex(c => c.id === id);
    if (i >= 0) { this._d.comptes[i] = { ...this._d.comptes[i], ...u }; this.save(); }
  }
  deleteCompte(id) {
    this._d.comptes = this._d.comptes.filter(c => c.id !== id);
    delete this._d.comptes_data[id];
    if (this._activeId === id) {
      this._activeId = this._d.comptes.length > 0 ? this._d.comptes[0].id : null;
    }
    this.save();
  }

  // ── Préférences UI ───────────────────────────────────────────────────────
  getPref(key, def = null) { return key in this._d.prefs ? this._d.prefs[key] : def; }
  setPref(key, val)        { this._d.prefs[key] = val; this.save(); }

  // ── Import / Export ───────────────────────────────────────────────────────
  exportJSON()     { return JSON.stringify(this._d, null, 2); }
  importJSON(json) { this._d = JSON.parse(json); this._activeId = null; this.save(); }
  reset()          { this._d = this._defaults(); this._activeId = null; this.save(); }
}
