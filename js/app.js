// ── Comptabilité Maison — Application ───────────────────────────────────────
'use strict';

// ── État global ──────────────────────────────────────────────────────────────
const db          = new DataManager();
let currentMonth  = todayKey();
let currentPage   = 'dashboard';
let dashChart     = null;
let bilanChart    = null;
let _editId         = null;
let _editRecurrent  = false;
let _filterCat      = '';
let _filterRevCat   = '';
let _filterPmtCat   = '';
let bilanView       = 'mensuel';
let _pmtSort        = 'desc'; // chargé depuis db dans init
let currentCompteIdx = 0;

// ── Sélecteur de mois inline (custom, remplace input[type=month]) ────────────
const _mpiYears = {};

function monthPickerHtml(id, value, cb) {
  const year = value ? parseInt(value.split('-')[0]) : new Date().getFullYear();
  const label = value ? monthLabel(value) : '';
  return `<div class="mpi-wrap" id="mpi-wrap-${id}">
    <div class="mpi-input-row">
      <div class="mpi-display${label ? '' : ' empty'}" id="mpi-display-${id}" onclick="mpiToggle('${id}')">${label || '—'}</div>
      <button type="button" class="mpi-cal-btn" onclick="mpiToggle('${id}')">📅</button>
    </div>
    <div class="mpi-popup" id="mpi-popup-${id}">
      <div class="mpi-header">
        <button class="mpi-nav" type="button" onclick="mpiYear('${id}',-1)">&#8249;</button>
        <span class="mpi-year-label" id="mpi-year-${id}">${year}</span>
        <button class="mpi-nav" type="button" onclick="mpiYear('${id}',1)">&#8250;</button>
      </div>
      <div class="mpi-grid" id="mpi-grid-${id}" data-cb="${cb || ''}"></div>
    </div>
    <input type="hidden" id="${id}" value="${value || ''}">
  </div>`;
}

function mpiRenderGrid(id) {
  const grid = document.getElementById(`mpi-grid-${id}`);
  if (!grid) return;
  const year = _mpiYears[id] || new Date().getFullYear();
  const sel  = document.getElementById(id)?.value || '';
  const nowK = todayKey();
  const yl = document.getElementById(`mpi-year-${id}`);
  if (yl) yl.textContent = year;
  grid.innerHTML = MOIS_COURTS.map((m, i) => {
    const key = `${year}-${String(i + 1).padStart(2, '0')}`;
    const cls = key === sel ? 'mpi-btn active' : key === nowK ? 'mpi-btn today' : 'mpi-btn';
    return `<button type="button" class="${cls}" onclick="mpiSelect('${id}','${key}')">${m}</button>`;
  }).join('');
}

function mpiYear(id, dir) {
  _mpiYears[id] = (_mpiYears[id] || new Date().getFullYear()) + dir;
  mpiRenderGrid(id);
}

function mpiSelect(id, key) {
  const input = document.getElementById(id);
  if (input) input.value = key;
  const disp = document.getElementById(`mpi-display-${id}`);
  if (disp) { disp.textContent = monthLabel(key); disp.classList.remove('empty'); }
  _mpiYears[id] = parseInt(key.split('-')[0]);
  mpiRenderGrid(id);
  document.getElementById(`mpi-popup-${id}`)?.classList.remove('open');
  const cb = document.getElementById(`mpi-grid-${id}`)?.dataset.cb;
  if (cb && window[cb]) window[cb]();
}

function mpiToggle(id) {
  const popup = document.getElementById(`mpi-popup-${id}`);
  if (!popup) return;
  const opening = !popup.classList.contains('open');
  document.querySelectorAll('.mpi-popup.open').forEach(p => p.classList.remove('open'));
  if (opening) { mpiRenderGrid(id); popup.classList.add('open'); }
}

function mpiInit(id, value) {
  _mpiYears[id] = value ? parseInt(value.split('-')[0]) : new Date().getFullYear();
}

// Callbacks composés pour les pickers avec plusieurs actions
function _mpiFinPmt() { switchDurRadio('date'); updateDurInfo(); }

// ── Rafraîchissement à minuit ────────────────────────────────────────────────
function scheduleMidnightRefresh() {
  const now      = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
  const delay    = midnight - now;

  setTimeout(() => {
    currentMonth = todayKey();
    const comptes = db.comptes;
    if (comptes.length > 0) {
      // Met à jour le solde de chaque compte dans son propre contexte
      comptes.forEach(c => {
        if (!c.soldeDepartMois) return;
        const solde = getSoldeCompte(c, currentMonth);
        if (solde !== null) db.updateCompte(c.id, { solde, soldeDepartMois: currentMonth });
      });
    } else {
      const solde = getSoldeActuelPourMois(currentMonth);
      if (solde !== null) {
        db.setPref('soldeDeDepart', solde);
        db.setPref('soldeDepartMois', currentMonth);
      }
    }
    renderApp();
    scheduleMidnightRefresh();
  }, delay);
}

// ── Horloge temps réel ───────────────────────────────────────────────────────
function startClock() {
  function tick() {
    const now  = new Date();
    const time = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const date = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const tEl = el('clock-time'), dEl = el('clock-date');
    if (tEl) tEl.textContent = time;
    if (dEl) dEl.textContent = date;
  }
  tick();
  setInterval(tick, 1000);
}

// Masque la card parente si montant = 0
function toggleCard(id, amount) {
  const el   = document.getElementById(id);
  if (!el) return;
  const card = el.closest('.s-card, .bal-card, .bil-row');
  if (card) card.style.display = (amount === 0) ? 'none' : '';
}

// Retourne la date d'échéance formatée "JJ/MM/AAAA" pour un mois donné
function echeanceLabel(jourEcheance, monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, jourEcheance).toLocaleDateString('fr-FR');
}

// Retourne { cls, text } pour le badge d'échéance
function echeanceBadge(jourEcheance, monthKey, paye) {
  const text = echeanceLabel(jourEcheance, monthKey);
  if (paye) return { cls: 'badge-paid', text: '✓ Payé' };
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const nowKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  if (monthKey !== nowKey) return { cls: 'badge-due', text };
  const [y, m] = monthKey.split('-').map(Number);
  const due = new Date(y, m - 1, jourEcheance); due.setHours(0, 0, 0, 0);
  const diff = Math.round((due - now) / 86400000);
  if (diff < 0)  return { cls: 'badge-retard', text: `⚠ RETARD DE ${Math.abs(diff)}J` };
  if (diff === 0) return { cls: 'badge-retard', text: `Aujourd'hui` };
  if (diff <= 7)  return { cls: 'badge-urgent', text: `Reste ${diff} jour${diff > 1 ? 's' : ''}` };
  return { cls: 'badge-due', text };                                   // > 7 jours : date
}

function favError(img) {
  img.parentElement.innerHTML = `<span class="cat-icon-lg">${img.dataset.icon}</span>`;
}

// ── Menu contextuel (clic droit) ─────────────────────────────────────────────
let _ctxType = null, _ctxId = null;

function showContextMenu(e, type, id) {
  e.preventDefault();
  e.stopPropagation();
  _ctxType = type; _ctxId = id;
  const menu = el('context-menu');
  if (!menu) return;
  const x = Math.min(e.clientX, window.innerWidth  - 170);
  const y = Math.min(e.clientY, window.innerHeight - 50);
  menu.style.left = x + 'px';
  menu.style.top  = y + 'px';
  menu.classList.add('open');
}

function closeContextMenu() {
  el('context-menu')?.classList.remove('open');
}

function ctxEdit() {
  const type = _ctxType, id = _ctxId;
  closeContextMenu();
  if      (type === 'paiement') editPaiement(id);
  else if (type === 'depense')  editDepense(id);
  else if (type === 'credit')   editCredit(id);
}

// ── Initialisation ───────────────────────────────────────────────────────────
function init() {
  startClock();
  scheduleMidnightRefresh();

  // Navigation sidebar
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(el.dataset.page);
    });
  });

  // Ferme les popups si clic extérieur
  document.addEventListener('click', e => {
    const wrap   = document.getElementById('quick-add-wrap');
    const picker = document.getElementById('month-picker');
    const ctxMenu = document.getElementById('context-menu');
    if (wrap    && !wrap.contains(e.target))                                       closeQuickAdd();
    if (picker  && !picker.contains(e.target) && e.target.id !== 'currentMonth')  closeMonthPicker();
    if (ctxMenu && !ctxMenu.contains(e.target))                                    closeContextMenu();
    if (!e.target.closest('.mpi-wrap')) document.querySelectorAll('.mpi-popup.open').forEach(p => p.classList.remove('open'));
    const sortWrap = document.getElementById('pmt-sort-wrap');
    const sortMenu = document.getElementById('pmt-sort-menu');
    if (sortWrap && !sortWrap.contains(e.target) && sortMenu && !sortMenu.contains(e.target)) closePmtSortMenu();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeContextMenu(); });

  // Ferme la modale au clic sur l'overlay, SAUF si le mousedown a démarré dans la modale
  // (évite la fermeture lors d'un drag depuis l'intérieur vers l'extérieur)
  let _overlayDragFromInside = false;
  const overlay = el('modal-overlay');
  overlay.addEventListener('mousedown', e => {
    _overlayDragFromInside = !!e.target.closest('.modal');
  });
  overlay.addEventListener('click', e => {
    if (!_overlayDragFromInside && !e.target.closest('.modal')) closeModal();
    _overlayDragFromInside = false;
  });

  bilanView = db.getPref('bilanView', 'mensuel');
  _pmtSort  = db.getPref('pmtSort', 'desc');

  // Restaure le compte actif depuis les prefs (persist après F5)
  if (db.comptes.length > 0) {
    currentCompteIdx = db.getPref('activeCompteIdx', 0);
    if (currentCompteIdx >= db.comptes.length) currentCompteIdx = 0;
    db.setActiveCompte(db.comptes[currentCompteIdx].id);
  }

  // Restaure la page depuis le hash URL (persist après F5)
  const validPages = ['dashboard', 'revenus', 'paiements', 'credits', 'depenses', 'bilan', 'bilan-comptes', 'parametres'];
  const hashPage = location.hash.replace('#', '');
  if (validPages.includes(hashPage)) currentPage = hashPage;

  // Synchronise les classes active avec la page restaurée
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === currentPage);
  });
  document.querySelectorAll('.page').forEach(el => {
    el.classList.toggle('active', el.id === `page-${currentPage}`);
  });

  renderApp();
}

// ── Sélecteur de mois ────────────────────────────────────────────────────────
let _pickerYear = new Date().getFullYear();
const MOIS_COURTS = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];

function toggleMonthPicker(e) {
  e.stopPropagation();
  const picker = document.getElementById('month-picker');
  if (!picker) return;
  if (picker.classList.contains('open')) {
    picker.classList.remove('open');
  } else {
    const [y] = currentMonth.split('-').map(Number);
    _pickerYear = y;
    renderMonthPickerGrid();
    picker.classList.add('open');
  }
}

function closeMonthPicker() {
  document.getElementById('month-picker')?.classList.remove('open');
}

function renderMonthPickerGrid() {
  const [cy, cm] = currentMonth.split('-').map(Number);
  document.getElementById('mp-year').textContent = _pickerYear;
  document.getElementById('mp-grid').innerHTML = MOIS_COURTS.map((m, i) => {
    const key      = `${_pickerYear}-${String(i + 1).padStart(2, '0')}`;
    const isActive = _pickerYear === cy && (i + 1) === cm;
    const isToday  = _pickerYear === new Date().getFullYear() && (i + 1) === (new Date().getMonth() + 1);
    return `<button class="mp-month ${isActive ? 'active' : ''} ${isToday && !isActive ? 'today' : ''}"
                    onclick="selectPickerMonth(event,'${key}')">${m}</button>`;
  }).join('');
}

function pickerPrevYear(e) { e.stopPropagation(); _pickerYear--; renderMonthPickerGrid(); }
function pickerNextYear(e) { e.stopPropagation(); _pickerYear++; renderMonthPickerGrid(); }

function selectPickerMonth(e, key) {
  e.stopPropagation();
  currentMonth = key;
  console.log('[Picker] Mois →', currentMonth);
  closeMonthPicker();
  renderApp();
}

// ── Dropdown "Ajouter" (dashboard) ───────────────────────────────────────────
function toggleQuickAdd() {
  document.getElementById('quick-add-menu')?.classList.toggle('open');
}
function closeQuickAdd() {
  document.getElementById('quick-add-menu')?.classList.remove('open');
}
function quickAdd(type) {
  closeQuickAdd();
  switch (type) {
    case 'revenu':    showRevenuModal();    break;
    case 'paiement':  showPaiementModal();  break;
    case 'credit':    showCreditModal();    break;
    case 'depense':   showDepenseModal();   break;
  }
}

// ── Navigation ───────────────────────────────────────────────────────────────
function navigateTo(page) {
  currentPage = page;
  history.pushState(null, '', '#' + page);
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  document.querySelectorAll('.page').forEach(el => {
    el.classList.toggle('active', el.id === `page-${page}`);
  });
  // Ferme la sidebar sur mobile après navigation
  if (window.innerWidth <= 768) closeSidebar();
  renderPage();
}

function toggleSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebar-overlay');
  const isOpen   = sidebar?.classList.contains('open');
  sidebar?.classList.toggle('open', !isOpen);
  overlay?.classList.toggle('open', !isOpen);
}

function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('open');
}

function prevMonth() {
  const [y, m] = currentMonth.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  currentMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  console.log('[Nav] Mois →', currentMonth);
  renderApp();
}

function nextMonth() {
  const [y, m] = currentMonth.split('-').map(Number);
  const d = new Date(y, m, 1);
  currentMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  console.log('[Nav] Mois →', currentMonth);
  renderApp();
}

// ── Rendu global ─────────────────────────────────────────────────────────────
function renderApp() {
  renderHeader();
  try {
    renderPage();
  } catch (err) {
    console.error('[renderPage] Erreur pour le mois', currentMonth, err);
    flash('Erreur d\'affichage — ouvrez la console pour les détails.', 'error');
  }
}

function renderHeader() {
  document.getElementById('currentMonth').textContent = monthLabel(currentMonth) + ' ▾';
  const activeC = db.comptes[currentCompteIdx];
  const avantRef = activeC?.soldeDepartMois && currentMonth < activeC.soldeDepartMois;
  try {
    if (avantRef) {
      // Mois avant le mois de référence : masquer toutes les cards de totaux
      ['hRevenu','hDep','hReste'].forEach(id => toggleCard(id, 0));
      const soldeEl = document.getElementById('hSolde');
      if (soldeEl) { soldeEl.textContent = '—'; soldeEl.className = 'bal-amount'; }
    } else {
      const t = db.totals(currentMonth);
      const report = reportSoldeAnterieur();
      const resteAPayer = creditsRestantsPourMois(currentMonth) + t.paiementsRestants;
      const soldeRestant = t.disponible + report;
      document.getElementById('hRevenu').textContent = formatEur(t.revenus);
      document.getElementById('hDep').textContent    = formatEur(t.depenses);
      document.getElementById('hReste').textContent  = formatEur(resteAPayer);
      const soldeEl = document.getElementById('hSolde');
      soldeEl.textContent = formatEur(soldeRestant);
      soldeEl.className   = 'bal-amount ' + (soldeRestant >= 0 ? 'positive' : 'negative');
      toggleCard('hRevenu', t.revenus);
      toggleCard('hDep',    t.depenses);
      toggleCard('hReste',  resteAPayer);
    }
  } catch(e) {
    console.error('renderHeader totals error:', e);
  }
  renderCompteSwitcher();
}

function renderPage() {
  const c = db.comptes[currentCompteIdx];
  const avantRef = currentPage !== 'parametres' && c?.soldeDepartMois && currentMonth < c.soldeDepartMois;
  const targetId  = avantRef ? 'page-no-history' : `page-${currentPage}`;

  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === targetId));

  if (avantRef) {
    const msg = document.getElementById('before-ref-msg');
    if (msg) msg.textContent = `Aucun historique avant ${monthLabel(c.soldeDepartMois)}`;
    return;
  }

  switch (currentPage) {
    case 'dashboard': renderDashboard(); break;
    case 'revenus':   renderRevenus();   break;
    case 'paiements': renderPaiements(); break;
    case 'credits':   renderCredits();   break;
    case 'depenses':  renderDepenses();  break;
    case 'bilan':         renderBilan();         break;
    case 'bilan-comptes': renderBilanComptes();  break;
    case 'parametres':    renderParametres();    break;
  }
}

// ── Solde d'un compte pour un mois donné (dans son propre contexte) ──────────
function getSoldeCompte(compte, monthKey) {
  if (!compte) return null;
  if (!compte.soldeDepartMois || monthKey < compte.soldeDepartMois) return compte.solde || 0;
  let [y, m] = compte.soldeDepartMois.split('-').map(Number);
  const [ey, em] = monthKey.split('-').map(Number);
  let sum = compte.solde || 0;
  while (y < ey || (y === ey && m < em)) {
    const k = `${y}-${String(m).padStart(2, '0')}`;
    sum += db.totalsForCompte(compte.id, k).disponible;
    if (++m > 12) { m = 1; y++; }
  }
  return sum;
}

function switchCompte(dir) {
  const n = db.comptes.length;
  if (n <= 1) return;
  currentCompteIdx = (currentCompteIdx + dir + n) % n;
  db.setActiveCompte(db.comptes[currentCompteIdx].id);
  db.setPref('activeCompteIdx', currentCompteIdx);
  renderApp();
}

function setCurrentCompte(idx) {
  currentCompteIdx = idx;
  db.setActiveCompte(db.comptes[currentCompteIdx].id);
  db.setPref('activeCompteIdx', currentCompteIdx);
  renderApp();
}

function setCompteRole(id, role) {
  // Un seul principal et un seul secondaire à la fois
  if (role === 'principal' || role === 'secondaire') {
    db.comptes.forEach(c => { if (c.role === role) db.updateCompte(c.id, { role: null }); });
  }
  const c = db.comptes.find(x => x.id === id);
  db.updateCompte(id, { role: c?.role === role ? null : role });
  renderParametres();
  renderHeader();
}

function renderCompteSwitcher() {
  const comptes = db.comptes;
  const wrap    = document.getElementById('compte-switcher');
  if (!wrap) return;
  if (!comptes.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';
  if (currentCompteIdx >= comptes.length) currentCompteIdx = 0;

  // Nom/logo = compte actif (environnement affiché)
  const c   = comptes[currentCompteIdx];
  const fav = c.domain ? getFavicon(c.domain) : null;
  const logo = document.getElementById('cpt-logo');
  const iconEl = document.getElementById('cpt-icon');
  if (logo)   { logo.src = fav || ''; logo.style.display = fav ? '' : 'none'; }
  if (iconEl) { iconEl.textContent = c.type === 'liquide' ? '💵' : '🏦'; iconEl.style.display = fav ? 'none' : ''; }
  const nomEl = document.getElementById('cpt-nom');
  if (nomEl) nomEl.textContent = c.nom;

  // Solde = compte actif affiché
  const solde = getSoldeCompte(c, currentMonth);
  const soldeEl   = document.getElementById('cpt-solde');
  if (soldeEl) {
    soldeEl.textContent = formatEur(solde);
    soldeEl.className   = 'cpt-solde ' + (solde >= 0 ? 'positive' : 'negative');
  }

  const arrows = wrap.querySelectorAll('.cpt-arrow');
  arrows.forEach(a => { a.style.display = comptes.length > 1 ? '' : 'none'; });
}

function renderParametres() {

  const comptes  = db.comptes;
  const canAdd   = comptes.length < 5;
  const primary  = comptes.find(c => c.soldeDepartMois);

  const liste = comptes.length === 0
    ? `<p class="empty" style="padding:16px 0">Aucun compte configuré.</p>`
    : comptes.map((c, i) => {
        const fav      = c.domain ? getFavicon(c.domain) : null;
        const icon     = c.type === 'liquide' ? '💵' : '🏦';
        const soldeAff = getSoldeCompte(c, currentMonth);
        const pos      = soldeAff >= 0;
        const isActive = i === currentCompteIdx;
        const roleBadge = c.role === 'principal'
          ? `<span class="freq-badge" style="background:#dcfce7;color:#16a34a;font-size:10px">Principal</span>`
          : c.role === 'secondaire'
            ? `<span class="freq-badge" style="background:#dbeafe;color:#2563eb;font-size:10px">Secondaire</span>`
            : '';
        return `<div class="compte-card ${isActive ? 'compte-card-active' : ''}" onclick="setCurrentCompte(${i})" style="cursor:pointer">
          <div class="compte-logo">
            ${fav ? `<img src="${fav}" alt="" onerror="this.style.display='none'">` : `<span>${icon}</span>`}
          </div>
          <div class="compte-info">
            <div class="compte-nom">${esc(c.nom)} ${roleBadge}</div>
            <div class="compte-solde ${pos ? 'positive' : 'negative'}">${formatEur(soldeAff)}</div>
            ${c.soldeDepartMois ? `<div class="compte-ref">Depuis ${monthLabel(c.soldeDepartMois)}</div>` : ''}
          </div>
          <div class="compte-actions" onclick="event.stopPropagation()">
            <button class="btn btn-sm btn-secondary" onclick="openCompteModal('${c.id}')">✏️</button>
            <button class="btn btn-sm" style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5" onclick="deleteCompteConfirm('${c.id}')">🗑️</button>
          </div>
        </div>`;
      }).join('');

  const wrap = document.getElementById('param-comptes-list');
  if (wrap) wrap.innerHTML = liste;

  const btn = document.getElementById('param-add-compte-btn');
  if (btn) {
    btn.disabled    = !canAdd;
    btn.textContent = canAdd ? '+ Ajouter un compte' : 'Maximum 5 comptes atteint';
  }
}

let _compteEditId = null;
let _compteBanque = null;

function openCompteModal(editId = null) {
  _compteEditId = editId;
  _compteBanque = null;
  const existing = editId ? db.comptes.find(c => c.id === editId) : null;
  _compteRole = existing?.role ?? null;
  if (existing) {
    _compteBanque = { nom: existing.nom, domain: existing.domain, type: existing.type };
  }

  const banquesHtml = BANQUES.map(b =>
    `<button class="banque-btn" onclick="selectBanquePicker('${b.nom}','${b.domain}')">
      <img src="${getFavicon(b.domain)}" alt="" onerror="this.parentElement.querySelector('span').style.display='block';this.style.display='none'">
      <span style="display:none">🏦</span>
      <span class="banque-label">${esc(b.nom)}</span>
    </button>`
  ).join('');

  const formHtml = `
    <div id="compte-step1" ${existing ? 'style="display:none"' : ''}>
      <div class="banque-grid">${banquesHtml}</div>
      <button class="btn btn-secondary" style="width:100%;margin-top:12px" onclick="selectBanquePicker('Argent liquide',null,'liquide')">💵 Argent liquide</button>
    </div>
    <div id="compte-step2" ${existing ? '' : 'style="display:none"'}>
      <div id="compte-banque-selected" class="compte-banque-preview"></div>
      <div class="form-group" style="margin-top:14px">
        <label>Nom du compte</label>
        <input id="f-compte-nom" type="text" value="${esc(existing?.nom || '')}">
      </div>
      <div class="form-row">
        <div class="form-group" style="flex:1">
          <label>Solde actuel (€)</label>
          <input id="f-compte-solde" type="number" step="0.01" value="${existing?.solde ?? ''}">
        </div>
        <div class="form-group" style="flex:1">
          <label>Mois de référence</label>
          ${monthPickerHtml('f-compte-mois', existing?.soldeDepartMois || '')}
        </div>
      </div>
      <p style="font-size:12px;color:var(--text-muted);margin-bottom:16px">Le mois de référence active le suivi automatique du solde selon le budget.</p>
      <div class="form-group">
        <label>Rôle</label>
        <div style="display:flex;gap:8px">
          <button id="role-btn-principal" class="btn btn-sm ${existing?.role==='principal'?'btn-primary':'btn-secondary'}" style="flex:1" onclick="toggleRoleBtn('principal')">Principal</button>
          <button id="role-btn-secondaire" class="btn btn-sm ${existing?.role==='secondaire'?'btn-primary':'btn-secondary'}" style="flex:1" onclick="toggleRoleBtn('secondaire')">Secondaire</button>
          <button id="role-btn-none" class="btn btn-sm ${!existing?.role?'btn-primary':'btn-secondary'}" style="flex:1" onclick="toggleRoleBtn(null)">Aucun</button>
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:8px">
        ${!existing ? `<button class="btn btn-secondary" onclick="document.getElementById('compte-step1').style.display='';document.getElementById('compte-step2').style.display='none'">← Retour</button>` : ''}
        <button class="btn btn-primary" style="flex:1" onclick="saveCompte()">Enregistrer</button>
      </div>
    </div>`;

  openModal(existing ? 'Modifier le compte' : 'Ajouter un compte', formHtml);
  if (existing) updateComptePreview(existing);
  setTimeout(() => mpiInit('f-compte-mois', existing?.soldeDepartMois || ''), 30);
}

let _compteRole = null;

function toggleRoleBtn(role) {
  _compteRole = role;
  ['principal', 'secondaire', null].forEach(r => {
    const id  = r === null ? 'role-btn-none' : `role-btn-${r}`;
    const btn = document.getElementById(id);
    if (btn) btn.className = `btn btn-sm ${r === role ? 'btn-primary' : 'btn-secondary'}`;
  });
}

function selectBanquePicker(nom, domain, type = 'bank') {
  _compteBanque = { nom, domain, type };
  document.getElementById('compte-step1').style.display = 'none';
  document.getElementById('compte-step2').style.display = '';
  document.getElementById('f-compte-nom').value = nom;
  updateComptePreview({ nom, domain, type });
}

function updateComptePreview(c) {
  const wrap = document.getElementById('compte-banque-selected');
  if (!wrap) return;
  const fav  = c.domain ? getFavicon(c.domain) : null;
  const icon = c.type === 'liquide' ? '💵' : '🏦';
  wrap.innerHTML = `<div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg-secondary);border-radius:8px">
    ${fav ? `<img src="${fav}" style="width:24px;height:24px;border-radius:4px" alt="" onerror="this.style.display='none'">` : `<span>${icon}</span>`}
    <strong>${esc(c.nom)}</strong>
  </div>`;
}

function saveCompte() {
  const nom   = document.getElementById('f-compte-nom')?.value.trim();
  const solde = parseFloat(document.getElementById('f-compte-solde')?.value);
  const mois  = document.getElementById('f-compte-mois')?.value || null;
  if (!nom) { flash('Veuillez saisir un nom.'); return; }
  if (isNaN(solde)) { flash('Veuillez saisir un solde valide.'); return; }

  // Un seul principal et un seul secondaire à la fois
  if (_compteRole === 'principal' || _compteRole === 'secondaire') {
    db.comptes.forEach(c => {
      if (c.role === _compteRole && c.id !== _compteEditId) db.updateCompte(c.id, { role: null });
    });
  }

  const data = {
    nom,
    solde,
    soldeDepartMois: mois || null,
    domain: _compteBanque?.domain || null,
    type:   _compteBanque?.type   || 'bank',
    role:   _compteRole,
  };

  if (_compteEditId) {
    db.updateCompte(_compteEditId, data);
    flash('Compte mis à jour.', 'success');
  } else {
    if (!db.addCompte(data)) { flash('Maximum 5 comptes atteint.'); return; }
    flash('Compte ajouté.', 'success');
  }
  closeModal();
  renderParametres();
  renderHeader();
}

function deleteCompteConfirm(id) {
  const c = db.comptes.find(x => x.id === id);
  if (!c) return;
  if (!confirm(`Supprimer le compte "${c.nom}" ?`)) return;
  db.deleteCompte(id);
  renderParametres();
  renderHeader();
}

// ── DASHBOARD ────────────────────────────────────────────────────────────────
function renderDashboard() {
  const t  = db.totals(currentMonth);
  const md = db.monthData(currentMonth);
  const actifs = db.paiements.filter(p => isPaymentActiveForMonth(p, currentMonth));

  // Initialise le mois de référence si une valeur existe mais pas de mois
  if (db.getPref('soldeDeDepart', null) !== null && !db.getPref('soldeDepartMois', null)) {
    db.setPref('soldeDepartMois', '2026-08');
  }

  // Cartes résumé
  const credRestants  = creditsRestantsPourMois(currentMonth);
  const report        = reportSoldeAnterieur();
  const soldeRestant  = t.disponible + report;
  const soldeEstime   = t.solde + report;
  const resteTotal = credRestants + t.paiementsRestants;
  el('d-revenus').textContent   = formatEur(t.revenus);
  el('d-credits').textContent   = formatEur(credRestants);
  el('d-paiements').textContent = formatEur(t.paiementsRestants);
  el('d-depenses').textContent  = formatEur(t.depenses);
  el('d-reste-amount').textContent = formatEur(resteTotal);
  toggleCard('d-reste-amount', resteTotal);
  el('d-solde').textContent         = formatEur(soldeRestant);
  el('d-solde').className           = 'd-amount ' + (soldeRestant >= 0 ? 'positive' : 'negative');
  el('d-solde-estime').textContent  = formatEur(soldeEstime);
  el('d-solde-estime').className    = 'd-amount ' + (soldeEstime >= 0 ? 'positive' : 'negative');
  toggleCard('d-revenus',      t.revenus);
  toggleCard('d-credits',      credRestants);
  toggleCard('d-paiements',    t.paiementsRestants);
  toggleCard('d-depenses',     t.depenses);
  toggleCard('d-solde',        soldeRestant);
  toggleCard('d-solde-estime', soldeEstime);

  // Barre progression paiements
  const pct = t.paiements > 0 ? Math.round((t.paiementsPaids / t.paiements) * 100) : 0;
  el('d-prog-bar').style.width   = pct + '%';
  el('d-prog-text').innerHTML = `<strong>${t.countPaid} / ${t.countTotal}</strong> paiements &nbsp;·&nbsp; <strong>${formatEur(t.paiementsPaids)}</strong> <span style="color:var(--text-muted)">/ ${formatEur(t.paiements)}</span>`;

  // Liste paiements + crédits fusionnés, triés par montant décroissant
  const creditsActifs = db.credits.filter(c => isRevenuActiveForMonth(c, currentMonth));
  const pmtItems = actifs.map(p => {
    const st     = md.statuts[p.id];
    const montant = st?.montantReel ?? p.montant;
    return { type: 'pmt', p, st, montant };
  });
  const credItems = creditsActifs.map(c => ({ type: 'crd', c, montant: c.mensualite || 0 }));
  const getName = item => item.type === 'pmt' ? item.p.nom : item.c.nom;
  const allItems = [...pmtItems, ...credItems].sort((a, b) => {
    if (_pmtSort === 'asc')   return a.montant - b.montant;
    if (_pmtSort === 'alpha') return getName(a).localeCompare(getName(b), 'fr', { sensitivity: 'base' });
    return b.montant - a.montant; // desc (default)
  });

  // Met à jour le label et la sélection active du dropdown
  const labels = { desc: 'Décroissant', asc: 'Croissant', alpha: 'A→Z' };
  const sortLabel = document.getElementById('pmt-sort-label');
  if (sortLabel) sortLabel.textContent = labels[_pmtSort] || 'Trier';
  document.querySelectorAll('#pmt-sort-menu button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sort === _pmtSort);
  });

  el('d-pmt-list').innerHTML = allItems.map(item => {
    if (item.type === 'pmt') {
      const { p, st, montant } = item;
      const paye = !!st?.paye;
      const cat  = CATS_PAIEMENTS.find(c => c.id === p.categorie) || CATS_PAIEMENTS.at(-1);
      const fav  = getFavicon(p.siteWeb);
      const { cls: badgeClass, text: badgeText } = echeanceBadge(p.jourEcheance, currentMonth, paye);
      return `<div class="pmt-row ${paye ? 'paid' : 'unpaid'}" onclick="togglePmtDash('${p.id}')" oncontextmenu="showContextMenu(event,'paiement','${p.id}')">
        <span class="pmt-favicon">${fav ? `<img src="${fav}" alt="" onerror="this.style.display='none'">` : `<span class="cat-icon">${cat.icon}</span>`}</span>
        <span class="pmt-name">${esc(p.nom)}<span class="pmt-cat-pill" style="background:${cat.color}20;color:${cat.color}">${cat.icon} ${cat.nom}</span></span>
        <span class="pmt-amount">${formatEur(montant)}</span>
        <span class="pmt-badge ${badgeClass}">${badgeText}</span>
      </div>`;
    } else {
      const { c } = item;
      const fav = getFavicon(c.siteWeb);
      const label = (c.organisme ? `${c.organisme} — ` : '') + c.nom;
      const now = new Date();
      const nowKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
      const autoDate = c.jourEcheance && currentMonth === nowKey && now.getDate() >= c.jourEcheance;
      const manualPaid = !!md.statuts[`cred_${c.id}`]?.paye;
      const paye = c.prelevementAuto ? autoDate : manualPaid;
      const { cls: badgeClass, text: badgeText } = echeanceBadge(c.jourEcheance, currentMonth, paye);
      const clickHandler = !c.prelevementAuto ? `onclick="toggleCreditDash('${c.id}')"` : '';
      return `<div class="pmt-row ${paye ? 'paid' : 'unpaid'}" ${clickHandler} oncontextmenu="showContextMenu(event,'credit','${c.id}')">
        <span class="pmt-favicon">${fav ? `<img src="${fav}" alt="" onerror="this.style.display='none'">` : `<span class="cat-icon">💳</span>`}</span>
        <span class="pmt-name">${esc(label)}<span class="pmt-cat-pill" style="background:#ef444420;color:#ef4444">💳 Crédit</span></span>
        <span class="pmt-amount">${formatEur(c.mensualite)}</span>
        <span class="pmt-badge ${c.jourEcheance ? badgeClass : 'badge-info'}">${c.jourEcheance ? badgeText : 'Crédit'}</span>
      </div>`;
    }
  }).join('') || '<p class="empty">Aucun paiement récurrent configuré.</p>';

  // Dernières dépenses
  const deps = [...md.depenses].sort((a,b) => b.date?.localeCompare(a.date) || 0).slice(0, 6);
  el('d-dep-list').innerHTML = deps.map(d => {
    const cat = CATS_DEPENSES.find(c => c.id === d.categorie) || CATS_DEPENSES.at(-1);
    return `<div class="dep-row" oncontextmenu="showContextMenu(event,'depense','${d.id}')">
      <span class="dep-icon" style="background:${cat.color}20;color:${cat.color}">${cat.icon}</span>
      <span class="dep-info">
        <span class="dep-name">${esc(d.nom)}</span>
        <span class="dep-date">${formatDate(d.date)} · ${cat.nom}</span>
      </span>
      <span class="dep-amount">${formatEur(d.montant)}</span>
    </div>`;
  }).join('') || '<p class="empty">Aucune dépense enregistrée ce mois.</p>';

  // Graphique répartition dépenses
  renderDashChart();
}

function togglePmtDash(pid) {
  db.togglePaiement(currentMonth, pid);
  renderApp();
}

function togglePmtSortMenu(e) {
  e.stopPropagation();
  const menu = document.getElementById('pmt-sort-menu');
  const btn  = document.getElementById('pmt-sort-btn');
  if (!menu || !btn) return;
  if (menu.classList.contains('open')) { menu.classList.remove('open'); return; }
  const rect = btn.getBoundingClientRect();
  menu.style.top   = (rect.bottom + 6) + 'px';
  menu.style.right = (window.innerWidth - rect.right) + 'px';
  menu.classList.add('open');
}

function closePmtSortMenu() {
  document.getElementById('pmt-sort-menu')?.classList.remove('open');
}

function setPmtSort(val) {
  _pmtSort = val;
  db.setPref('pmtSort', val);
  closePmtSortMenu();
  renderDashboard();
}

function toggleCreditDash(cid) {
  const md  = db.monthData(currentMonth);
  const key = `cred_${cid}`;
  md.statuts[key] = { paye: !md.statuts[key]?.paye };
  db.save();
  renderApp();
}

function getSoldeActuelPourMois(monthKey) {
  const comptes = db.comptes;

  if (!comptes.length) {
    // Legacy : solde unique via prefs
    const base    = db.getPref('soldeDeDepart', null);
    const moisRef = db.getPref('soldeDepartMois', null);
    if (base === null || !moisRef || monthKey < moisRef) return null;
    let [y, m] = moisRef.split('-').map(Number);
    const [ey, em] = monthKey.split('-').map(Number);
    let sum = base;
    while (y < ey || (y === ey && m < em)) {
      const k = `${y}-${String(m).padStart(2, '0')}`;
      sum += db.totals(k).disponible;
      if (++m > 12) { m = 1; y++; }
    }
    return sum;
  }

  // Isolation par compte : retourne le solde du compte actif uniquement
  const c = comptes[currentCompteIdx] || comptes[0];
  if (!c) return null;
  if (!c.soldeDepartMois || monthKey < c.soldeDepartMois) return c.solde ?? null;

  let [y, m] = c.soldeDepartMois.split('-').map(Number);
  const [ey, em] = monthKey.split('-').map(Number);
  let sum = c.solde || 0;
  while (y < ey || (y === ey && m < em)) {
    const k = `${y}-${String(m).padStart(2, '0')}`;
    sum += db.totals(k).disponible; // _ctx() = compte actif, contexte correct
    if (++m > 12) { m = 1; y++; }
  }
  return sum;
}

function reportSoldeAnterieur() {
  const v = getSoldeActuelPourMois(currentMonth);
  return v !== null ? v : 0;
}

function saveSoldeDeDepart(val, mois) {
  const v = parseFloat(val);
  db.setPref('soldeDeDepart', isNaN(v) ? 0 : v);
  db.setPref('soldeDepartMois', mois || currentMonth);
  renderApp();
}


function creditsRestantsPourMois(monthKey) {
  const md  = db.monthData(monthKey);
  const now = new Date();
  const nowKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  return db.credits
    .filter(c => isRevenuActiveForMonth(c, monthKey))
    .reduce((sum, c) => {
      const autoDate   = c.jourEcheance && monthKey === nowKey && now.getDate() >= c.jourEcheance;
      const manualPaid = !!md.statuts[`cred_${c.id}`]?.paye;
      const paye       = c.prelevementAuto ? autoDate : manualPaid;
      return paye ? sum : sum + (c.mensualite || 0);
    }, 0);
}

function doughnutOptions() {
  return {
    responsive: true,
    plugins: {
      legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 12 }, padding: 12 } },
      tooltip: { callbacks: { label: ctx => ` ${ctx.label} : ${formatEur(ctx.parsed)}` } }
    },
    cutout: '62%'
  };
}

function doughnutOptionsBilan() {
  const base = doughnutOptions();
  return {
    ...base,
    plugins: {
      ...base.plugins,
      datalabels: {
        color: '#fff',
        font: { weight: 'bold', size: 13, family: 'Inter' },
        formatter: (value, ctx) => {
          const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
          if (!total) return '';
          const pct = Math.round(value / total * 100);
          return pct >= 5 ? pct + '%' : '';
        }
      }
    }
  };
}

function renderDashChart() {
  const map  = db.depensesParCategorie(currentMonth);
  const keys = Object.keys(map);
  if (!keys.length) {
    if (dashChart) { dashChart.destroy(); dashChart = null; }
    el('dash-chart-wrap').innerHTML = '<p class="empty chart-empty">Aucune dépense ce mois</p>';
    return;
  }
  const labels = keys.map(k => (CATS_DEPENSES.find(c => c.id === k) || {nom: k}).nom);
  const data   = keys.map(k => map[k]);
  const colors = keys.map(k => (CATS_DEPENSES.find(c => c.id === k) || {color: '#94a3b8'}).color);

  if (dashChart) { dashChart.destroy(); dashChart = null; }
  el('dash-chart-wrap').innerHTML = '<canvas id="dashChart"></canvas>';
  dashChart = new Chart(document.getElementById('dashChart'), {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
    options: doughnutOptions()
  });
}

// ── REVENUS ──────────────────────────────────────────────────────────────────
function renderRevenus() {
  const md         = db.monthData(currentMonth);
  const recurrents = db.revenusRecurrentsForMonth(currentMonth);
  const totalRec   = recurrents.reduce((s, r) => s + (r.montant || 0), 0);
  const totalOnce  = md.revenus.reduce((s, r) => s + (r.montant || 0), 0);
  const total      = totalRec + totalOnce;
  const count      = recurrents.length + md.revenus.length;

  el('rev-total').textContent = formatEur(total);
  el('rev-count').textContent = count + ' entrée(s)';

  // Filter bar — categories present in either list
  const allEntries = [...recurrents, ...md.revenus];
  const catsPresent = CATS_REVENUS.filter(c => allEntries.some(r => r.categorie === c.id));
  el('rev-filters').innerHTML = catsPresent.length > 1
    ? `<button class="filter-btn ${_filterRevCat === '' ? 'active' : ''}" onclick="setRevFilter('')">Tout</button>` +
      catsPresent.map(c => {
        const cnt = allEntries.filter(r => r.categorie === c.id).length;
        return `<button class="filter-btn ${_filterRevCat === c.id ? 'active' : ''}" onclick="setRevFilter('${c.id}')">${c.icon} ${c.nom} <span class="filter-cnt">${cnt}</span></button>`;
      }).join('')
    : '';

  // Filter
  const filtRec  = _filterRevCat ? recurrents.filter(r => r.categorie === _filterRevCat) : recurrents;
  const filtOnce = _filterRevCat ? md.revenus.filter(r => r.categorie === _filterRevCat) : md.revenus;

  function revCard(r, isRecurrent) {
    const cat    = CATS_REVENUS.find(c => c.id === r.categorie) || CATS_REVENUS.at(-1);
    const catFav = cat.catLogo || (cat.catFavicon ? getFavicon(cat.catFavicon) : null);
    const periode = isRecurrent
      ? (r.dateFin
          ? `${monthLabel(r.dateDebut)} → ${monthLabel(r.dateFin)}`
          : r.dateDebut ? `Depuis ${monthLabel(r.dateDebut)}` : 'Mensuel')
      : null;
    return `
    <div class="pmt-card">
      <div class="pmt-card-header">
        <div class="pmt-card-logo">
          ${catFav ? `<img src="${catFav}" alt="" class="favicon-lg" data-icon="${cat.icon}" onerror="favError(this)">` : `<span class="cat-icon-lg">${cat.icon}</span>`}
        </div>
        <div class="pmt-card-info">
          <h3>${esc(r.nom)}</h3>
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:3px">
            <span class="pmt-cat-badge" style="background:${cat.color}20;color:${cat.color}">${catFav ? '' : cat.icon + ' '}${cat.nom}</span>
            ${isRecurrent ? '<span class="freq-badge">🔄 Mensuel</span>' : ''}
            ${isRecurrent && r.jourVersement ? (() => { const { cls, text } = echeanceBadge(r.jourVersement, currentMonth, false); return `<span class="pmt-badge ${cls}">${text}</span>`; })() : ''}
          </div>
        </div>
        <div class="pmt-card-actions">
          <button class="btn-icon" onclick="${isRecurrent ? `editRevenuRecurrent('${r.id}')` : `editRevenu('${r.id}')`}" title="Modifier">✏️</button>
          <button class="btn-icon danger" onclick="${isRecurrent ? `delRevenuRecurrent('${r.id}')` : `delRevenu('${r.id}')`}" title="Supprimer">🗑️</button>
        </div>
      </div>
      <div class="pmt-card-body">
        <div class="pmt-detail"><span>Montant</span><strong class="amount positive">${formatEur(r.montant)}</strong></div>
        ${r.date ? `<div class="pmt-detail"><span>Date</span><strong>${formatDate(r.date)}</strong></div>` : ''}
        ${isRecurrent && r.jourVersement ? `<div class="pmt-detail"><span>Versement le</span><strong>le ${r.jourVersement} du mois</strong></div>` : ''}
        ${periode ? `<div class="pmt-detail"><span>Période</span><strong style="font-size:12px">${periode}</strong></div>` : ''}
        ${r.note ? `<div class="pmt-note">${esc(r.note)}</div>` : ''}
      </div>
    </div>`;
  }

  let html = '';
  if (filtRec.length) {
    html += `<div class="rev-section-title">🔄 Revenus récurrents</div><div class="pmt-grid">${filtRec.map(r => revCard(r, true)).join('')}</div>`;
  }
  if (filtOnce.length) {
    html += `<div class="rev-section-title" style="margin-top:${filtRec.length ? '24px' : '0'}">📅 Revenus ponctuels</div><div class="pmt-grid">${[...filtOnce].sort((a,b) => b.date?.localeCompare(a.date)||0).map(r => revCard(r, false)).join('')}</div>`;
  }
  el('rev-list').innerHTML = html || '<p class="empty">Aucun revenu enregistré ce mois.</p>';
}

function editRevenu(id) {
  const md = db.monthData(currentMonth);
  const r  = md.revenus.find(x => x.id === id);
  if (r) showRevenuModal(r);
}

function editRevenuRecurrent(id) {
  const r = db.revenusRecurrents.find(x => x.id === id);
  if (r) showRevenuModal({ ...r, _recurrent: true });
}

function delRevenu(id) {
  if (!confirm('Supprimer ce revenu ?')) return;
  db.deleteRevenu(currentMonth, id);
  renderApp();
}

function delRevenuRecurrent(id) {
  if (!confirm('Supprimer ce revenu récurrent ? Il disparaîtra de tous les mois.')) return;
  db.deleteRevenuRecurrent(id);
  renderApp();
}

function showRevenuModal(existing) {
  _editId        = existing?.id || null;
  _editRecurrent = !!existing?._recurrent;
  const isRec    = _editRecurrent;
  const opts     = CATS_REVENUS.map(c => `<option value="${c.id}" ${existing?.categorie === c.id ? 'selected' : ''}>${c.icon} ${c.nom}</option>`).join('');

  openModal(existing ? 'Modifier le revenu' : 'Ajouter un revenu', `
    <div class="form-row">
      <div class="form-group">
        <label>Libellé *</label>
        <input id="f-nom" type="text" placeholder="ex : Salaire, CAF, APL..." value="${esc(existing?.nom || '')}" required>
      </div>
      <div class="form-group">
        <label>Montant (€) *</label>
        <input id="f-montant" type="number" min="0" step="0.01" placeholder="0,00" value="${existing?.montant || ''}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group" id="f-date-wrap" style="${isRec ? 'display:none' : ''}">
        <label>Date de réception</label>
        <input id="f-date" type="date" value="${existing?.date || new Date().toISOString().split('T')[0]}">
      </div>
      <div class="form-group">
        <label>Catégorie</label>
        <select id="f-cat">${opts}</select>
      </div>
    </div>
    <div class="form-group">
      <label>Note</label>
      <input id="f-note" type="text" placeholder="Optionnel..." value="${esc(existing?.note || '')}">
    </div>

    <div class="form-divider"><span>Récurrence</span></div>

    <label class="toggle-label">
      <input type="checkbox" id="f-recurrent" ${isRec ? 'checked' : ''} onchange="onToggleRecRev()">
      <span class="toggle-track"><span class="toggle-thumb"></span></span>
      <span>Ce revenu se répète <strong>chaque mois automatiquement</strong></span>
    </label>

    <div id="f-rec-fields" style="${isRec ? '' : 'display:none'}">
      <div class="rec-info-box">
        🔄 Ce revenu sera affiché automatiquement dans tous les mois concernés, sans avoir à le saisir à nouveau.
      </div>
      <div class="form-row" style="margin-top:12px">
        <div class="form-group">
          <label>Débute en</label>
          ${monthPickerHtml('f-debut', existing?.dateDebut || currentMonth)}
        </div>
        <div class="form-group">
          <label>Se termine en <span style="font-weight:400;color:var(--text-muted)">(optionnel)</span></label>
          ${monthPickerHtml('f-fin', existing?.dateFin || '')}
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Jour de versement <span style="font-weight:400;color:var(--text-muted)">(optionnel)</span></label>
          <input id="f-jour" type="number" min="1" max="31" placeholder="ex : 5" value="${existing?.jourVersement || ''}">
        </div>
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="saveRevenu()">Enregistrer</button>
    </div>
  `);
  setTimeout(() => {
    attachAutocomplete('f-nom', 'nom');
    mpiInit('f-debut', existing?.dateDebut || currentMonth);
    mpiInit('f-fin', existing?.dateFin || '');
  }, 50);
}

function onToggleRecRev() {
  const checked   = document.getElementById('f-recurrent')?.checked;
  const recFields = document.getElementById('f-rec-fields');
  const dateWrap  = document.getElementById('f-date-wrap');
  if (recFields) recFields.style.display = checked ? '' : 'none';
  if (dateWrap)  dateWrap.style.display  = checked ? 'none' : '';
}

function saveRevenu() {
  const nom       = val('f-nom');
  const montant   = parseFloat(val('f-montant'));
  const cat       = val('f-cat');
  const note      = val('f-note');
  const recurrent = document.getElementById('f-recurrent')?.checked;

  if (!nom || isNaN(montant)) { flash('Veuillez remplir les champs obligatoires.'); return; }

  if (recurrent) {
    // ── Revenu récurrent (dans revenusRecurrents) ──
    const debut  = val('f-debut') || currentMonth;
    const dateFin = val('f-fin') || null;
    const jourVersement = parseInt(val('f-jour')) || null;
    const data   = { nom, montant, categorie: cat, note, dateDebut: debut, dateFin, jourVersement };
    if (_editRecurrent && _editId) db.updateRevenuRecurrent(_editId, data);
    else                           db.addRevenuRecurrent(data);
  } else {
    // ── Revenu ponctuel (dans monthData) ──
    const date = val('f-date') || new Date().toISOString().split('T')[0];
    if (!date) { flash('Veuillez indiquer une date.'); return; }
    const data = { nom, montant, date, categorie: cat, note };
    if (!_editRecurrent && _editId) db.updateRevenu(currentMonth, _editId, data);
    else                            db.addRevenu(currentMonth, data);
  }
  closeModal(); renderApp();
}

// ── PAIEMENTS RÉCURRENTS ─────────────────────────────────────────────────────
function renderPaiements() {
  const md     = db.monthData(currentMonth);
  const actifs = db.paiements.filter(p => p.actif);
  const t      = db.totals(currentMonth);

  el('pmt-total').textContent = formatEur(t.paiements);
  el('pmt-paid').textContent  = formatEur(t.paiementsPaids);
  el('pmt-reste').textContent = formatEur(t.paiementsRestants);

  // Boutons filtre catégorie
  const catsPresentes = CATS_PAIEMENTS.filter(c => db.paiements.some(p => p.categorie === c.id));
  el('pmt-filters').innerHTML = catsPresentes.length > 1
    ? `<button class="filter-btn ${_filterPmtCat === '' ? 'active' : ''}" onclick="setPmtFilter('')">Tout</button>` +
      catsPresentes.map(c => {
        const cnt = db.paiements.filter(p => p.categorie === c.id).length;
        return `<button class="filter-btn ${_filterPmtCat === c.id ? 'active' : ''}" onclick="setPmtFilter('${c.id}')">${c.icon} ${c.nom} <span class="filter-cnt">${cnt}</span></button>`;
      }).join('')
    : '';

  const pmtFiltered = db.paiements.filter(p => {
    if (!isPaymentActiveForMonth(p, currentMonth)) return false;
    if (_filterPmtCat && p.categorie !== _filterPmtCat) return false;
    return true;
  });

  el('pmt-grid').innerHTML = pmtFiltered.map(p => {
    const st          = md.statuts[p.id];
    const paye        = !!st?.paye;
    const activeMonth = isPaymentActiveForMonth(p, currentMonth);
    const cat         = CATS_PAIEMENTS.find(c => c.id === p.categorie) || CATS_PAIEMENTS.at(-1);
    const fav         = getFavicon(p.siteWeb);
    const freqInfo    = FREQUENCES.find(f => f.id === (p.frequence || 'mensuel')) || FREQUENCES[0];

    // Libellé durée
    let dureeLabel = '';
    const isUniquePmt = p.dateDebut && p.dateFin && p.dateDebut === p.dateFin;
    if (isUniquePmt) {
      dureeLabel = `Paiement unique — ${monthLabel(p.dateDebut)}`;
    } else if (p.dateDebut && p.dateFin) {
      dureeLabel = `Du ${monthLabel(p.dateDebut)} au ${monthLabel(p.dateFin)}`;
    } else if (p.dateDebut) {
      dureeLabel = `Depuis ${monthLabel(p.dateDebut)} · Illimité`;
    } else if (p.dateFin) {
      dureeLabel = `Jusqu'en ${monthLabel(p.dateFin)}`;
    }

    return `
    <div class="pmt-card ${paye ? 'paid' : ''} ${!activeMonth ? 'not-this-month' : ''}" oncontextmenu="showContextMenu(event,'paiement','${p.id}')">
      <div class="pmt-card-header">
        <div class="pmt-card-logo">
          ${fav
            ? `<img src="${fav}" alt="" class="favicon-lg" data-icon="${cat.icon}" onerror="favError(this)">`
            : `<span class="cat-icon-lg">${cat.icon}</span>`}
        </div>
        <div class="pmt-card-info">
          <h3>${esc(p.nom)}</h3>
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:3px">
            <span class="pmt-cat-badge" style="background:${cat.color}20;color:${cat.color}">${fav ? '' : cat.icon + ' '}${cat.nom}</span>
            <span class="freq-badge">${freqInfo.short}</span>
            ${!activeMonth ? `<span class="freq-badge inactive-badge">Inactif ce mois</span>` : ''}
          </div>
        </div>
        <div class="pmt-card-actions">
          <button class="btn-icon" onclick="editPaiement('${p.id}')" title="Modifier">✏️</button>
          <button class="btn-icon danger" onclick="delPaiement('${p.id}')" title="Supprimer">🗑️</button>
        </div>
      </div>
      <div class="pmt-card-body">
        <div class="pmt-detail"><span>Montant</span><strong class="amount">${formatEur(st?.montantReel ?? p.montant)}</strong></div>
        <div class="pmt-detail"><span>Date d'échéance</span><strong>${echeanceLabel(p.jourEcheance, currentMonth)}</strong></div>
        ${dureeLabel ? `<div class="pmt-detail"><span>Période</span><strong style="font-size:12px">${dureeLabel}</strong></div>` : ''}
        ${p.note ? `<div class="pmt-note">${esc(p.note)}</div>` : ''}
      </div>
      <div class="pmt-card-footer">
        ${activeMonth
          ? (paye
              ? `<span class="status-ok">✓ Payé le ${formatDate(st.datePaiement)}</span>`
              : `<span class="status-due">⏳ En attente</span>`)
          : `<span class="status-skip">⏭ Pas dû ce mois</span>`}
        ${activeMonth
          ? `<button class="btn btn-sm ${paye ? 'btn-secondary' : 'btn-success'}" onclick="togglePmt('${p.id}')">
               ${paye ? 'Marquer non payé' : '✓ Marquer payé'}
             </button>`
          : ''}
      </div>
    </div>`;
  }).join('') || '<p class="empty">Aucun paiement récurrent configuré.</p>';
}

function togglePmt(pid) {
  db.togglePaiement(currentMonth, pid);
  renderApp();
}

function editPaiement(id) {
  const p = db.paiements.find(x => x.id === id);
  if (p) showPaiementModal(p);
}

function delPaiement(id) {
  if (!confirm('Supprimer ce paiement récurrent ?')) return;
  db.deletePaiement(id);
  renderApp();
}

function showPaiementModal(existing) {
  _editId = existing?.id || null;
  const catOpts   = CATS_PAIEMENTS.map(c => `<option value="${c.id}" ${existing?.categorie === c.id ? 'selected' : ''}>${c.icon} ${c.nom}</option>`).join('');
  const freqOpts  = FREQUENCES.map(f => `<option value="${f.id}" ${(existing?.frequence || 'mensuel') === f.id ? 'selected' : ''}>${f.nom}</option>`).join('');
  const fav       = getFavicon(existing?.siteWeb || '');
  const debutVal  = existing?.dateDebut || currentMonth;
  const isUnique  = existing?.dateDebut && existing?.dateFin && existing.dateDebut === existing.dateFin;
  const hasFin    = !!existing?.dateFin && !isUnique;
  // Sélection radio par défaut : Unique pour un nouveau paiement
  const chkUnique = !existing || isUnique;
  const chkBimes  = !!(existing && !isUnique && !hasFin && existing.frequence === 'bimestriel');
  const chkIndef  = !!(existing && !isUnique && !hasFin && existing.frequence !== 'bimestriel');
  const chkDate   = !!(existing && hasFin);

  openModal(existing ? 'Modifier le paiement' : 'Ajouter un paiement', `
    <div class="form-row">
      <div class="form-group">
        <label>Libellé *</label>
        <input id="f-nom" type="text" placeholder="ex : EDF, Loyer, Netflix..." value="${esc(existing?.nom || '')}" required>
      </div>
      <div class="form-group">
        <label>Montant (€) *</label>
        <input id="f-montant" type="number" min="0" step="0.01" value="${existing?.montant || ''}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Date d'échéance <span class="label-opt">(jour du mois)</span></label>
        <input id="f-jour" type="number" min="1" max="30" placeholder="1–30" value="${existing?.jourEcheance || 1}">
      </div>
      <div class="form-group">
        <label>Catégorie</label>
        <select id="f-cat">${catOpts}</select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Site web (logo automatique)</label>
        <div class="favicon-input-wrap">
          <img id="f-fav-preview" src="${fav || ''}" alt="" class="fav-preview" style="${fav ? '' : 'display:none'}" onerror="this.style.display='none'">
          <input id="f-site" type="text" placeholder="ex : netflix.com, engie.fr..." value="${esc(existing?.siteWeb || '')}" oninput="previewFav(this.value)">
        </div>
      </div>
      <div class="form-group">
        <label>Note</label>
        <input id="f-note" type="text" placeholder="Optionnel..." value="${esc(existing?.note || '')}">
      </div>
    </div>

    <div class="form-divider"><span>Récurrence &amp; durée</span></div>

    <div class="form-group">
      <label>Durée</label>
      <div class="radio-group">
        <label class="radio-opt">
          <input type="radio" name="f-dur-type" value="unique" ${chkUnique ? 'checked' : ''} onchange="updateDurInfo()">
          <span>Unique <span style="color:var(--text-muted);font-weight:400">(un seul mois)</span></span>
        </label>
        <label class="radio-opt">
          <input type="radio" name="f-dur-type" value="bimestriel" ${chkBimes ? 'checked' : ''} onchange="updateDurInfo()">
          <span>Bimestriel <span style="color:var(--text-muted);font-weight:400">(tous les 2 mois)</span></span>
        </label>
        <label class="radio-opt">
          <input type="radio" name="f-dur-type" value="indefini" ${chkIndef ? 'checked' : ''} onchange="updateDurInfo()">
          <span>Illimité <span style="color:var(--text-muted);font-weight:400">(sans date de fin)</span></span>
        </label>
        <label class="radio-opt">
          <input type="radio" name="f-dur-type" value="mois" onchange="updateDurInfo()">
          <span>Durée fixe :</span>
          <input id="f-dur-mois" type="number" min="1" class="inline-num" placeholder="ex : 12"
            oninput="switchDurRadio('mois'); updateDurInfo()">
          <span>mois</span>
        </label>
        <label class="radio-opt">
          <input type="radio" name="f-dur-type" value="date" ${chkDate ? 'checked' : ''} onchange="updateDurInfo()">
          <span>Jusqu'au :</span>
        </label>
        ${monthPickerHtml('f-fin', existing?.dateFin || '', '_mpiFinPmt')}
      </div>
      <div class="dur-info" id="f-dur-info"></div>
    </div>

    <div id="f-recurrence-wrap">
      <div class="form-row">
        <div class="form-group">
          <label>Fréquence</label>
          <select id="f-freq" onchange="updateDurInfo()">${freqOpts}</select>
        </div>
        <div class="form-group">
          <label id="f-debut-label">Mois du paiement</label>
          ${monthPickerHtml('f-debut', debutVal, 'updateDurInfo')}
        </div>
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="savePaiement()">Enregistrer</button>
    </div>
  `);
  setTimeout(() => {
    updateDurInfo();
    attachAutocomplete('f-nom',  'nom');
    attachAutocomplete('f-site', 'siteWeb');
    mpiInit('f-fin',   existing?.dateFin   || '');
    mpiInit('f-debut', debutVal);
  }, 30);
}

function previewFav(siteWeb) {
  const url = getFavicon(siteWeb);
  const img = document.getElementById('f-fav-preview');
  if (!img) return;
  if (url) { img.src = url; img.style.display = ''; }
  else      { img.style.display = 'none'; }
}

function savePaiement() {
  const nom     = val('f-nom');
  const mnt     = parseFloat(val('f-montant'));
  const jour    = parseInt(val('f-jour'));
  const cat     = val('f-cat');
  const site    = val('f-site');
  const note    = val('f-note');
  let freq      = val('f-freq') || 'mensuel';
  const durType = document.querySelector('input[name="f-dur-type"]:checked')?.value || 'unique';

  let debut   = val('f-debut') || null;
  let dateFin = null;

  if (durType === 'unique') {
    const base = debut || currentMonth;
    debut   = base;
    dateFin = base;
  } else if (durType === 'bimestriel') {
    freq    = 'bimestriel';
    debut   = debut || currentMonth;
    dateFin = null;
  } else if (durType === 'indefini') {
    debut   = debut || currentMonth;
  } else if (durType === 'mois') {
    const mois = parseInt(document.getElementById('f-dur-mois')?.value);
    debut   = debut || currentMonth;
    dateFin = (debut && mois > 0) ? calcDateFin(debut, mois) : null;
  } else if (durType === 'date') {
    dateFin = document.getElementById('f-fin')?.value || null;
  }

  if (!nom || isNaN(mnt)) { flash('Veuillez remplir les champs obligatoires.'); return; }
  const data = { nom, montant: mnt, jourEcheance: jour || 1, categorie: cat, siteWeb: site, note, actif: true, frequence: freq, dateDebut: debut, dateFin };
  if (_editId) db.updatePaiement(_editId, data);
  else         db.addPaiement(data);
  closeModal(); renderApp();
}

// ── CRÉDITS ──────────────────────────────────────────────────────────────────
function renderCredits() {
  const total = db.credits.reduce((s, c) => s + (c.mensualite || 0), 0);
  el('cred-total').textContent = formatEur(total);
  el('cred-count').textContent = db.credits.length + ' crédit(s)';

  el('cred-list').innerHTML = db.credits.length
    ? db.credits.map(c => {
        const pct = c.montantInitial > 0 ? Math.round(((c.montantInitial - c.capitalRestant) / c.montantInitial) * 100) : 0;
        const fav = getFavicon(c.siteWeb);
        const fin = c.dateFin ? (() => {
          const d = new Date(c.dateFin + '-01');
          const now = new Date();
          const mois = (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth());
          return mois > 0 ? `${mois} mois restants (${d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'})})` : 'Terminé';
        })() : '';
        return `
        <div class="pmt-card">
          <div class="pmt-card-header">
            <div class="pmt-card-logo">
              ${fav ? `<img src="${fav}" alt="" class="favicon-lg" data-icon="💳" onerror="favError(this)">` : `<span class="cat-icon-lg">💳</span>`}
            </div>
            <div class="pmt-card-info">
              <h3>${esc(c.nom)}</h3>
              <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:3px">
                <span class="pmt-cat-badge" style="background:#ef444420;color:#ef4444">💳 Crédit</span>
                ${c.organisme ? `<span class="freq-badge">${esc(c.organisme)}</span>` : ''}
              </div>
            </div>
            <div class="pmt-card-actions">
              <button class="btn-icon" onclick="editCredit('${c.id}')" title="Modifier">✏️</button>
              <button class="btn-icon danger" onclick="delCredit('${c.id}')" title="Supprimer">🗑️</button>
            </div>
          </div>
          <div class="pmt-card-body">
            <div class="pmt-detail"><span>Mensualité</span><strong class="amount negative">${formatEur(c.mensualite)}</strong></div>
            <div class="pmt-detail"><span>Capital restant</span><strong>${formatEur(c.capitalRestant)}</strong></div>
            <div class="pmt-detail"><span>Remboursé</span><strong class="positive">${formatEur(c.montantInitial - c.capitalRestant)} / ${formatEur(c.montantInitial)}</strong></div>
            ${fin ? `<div class="pmt-detail"><span>Fin</span><strong style="font-size:12px">${fin}</strong></div>` : ''}
            <div style="margin-top:10px">
              <div class="budget-bar-bg"><div class="budget-bar-fill" style="width:${pct}%;background:#3b82f6"></div></div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${pct}% remboursé</div>
            </div>
            ${c.note ? `<div class="pmt-note">${esc(c.note)}</div>` : ''}
          </div>
        </div>`;
      }).join('')
    : '<p class="empty">Aucun crédit enregistré.</p>';
}

function editCredit(id) {
  const c = db.credits.find(x => x.id === id);
  if (c) showCreditModal(c);
}

function delCredit(id) {
  if (!confirm('Supprimer ce crédit ?')) return;
  db.deleteCredit(id);
  renderApp();
}

function showCreditModal(existing) {
  _editId = existing?.id || null;
  const fav      = getFavicon(existing?.siteWeb || '');
  const debutVal = existing?.dateDebut || currentMonth;

  openModal(existing ? 'Modifier le crédit' : 'Ajouter un crédit en cours', `
    <div class="form-row">
      <div class="form-group">
        <label>Libellé *</label>
        <input id="f-nom" type="text" placeholder="ex : Crédit auto, Prêt immo..." value="${esc(existing?.nom || '')}" required>
      </div>
      <div class="form-group">
        <label>Organisme</label>
        <input id="f-org" type="text" placeholder="ex : BNP, Cofidis..." value="${esc(existing?.organisme || '')}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Montant initial (€)</label>
        <input id="f-init" type="number" min="0" step="0.01" value="${existing?.montantInitial || ''}">
      </div>
      <div class="form-group">
        <label>Capital restant dû (€) *</label>
        <input id="f-restant" type="number" min="0" step="0.01" value="${existing?.capitalRestant || ''}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Mensualité (€) *</label>
        <input id="f-mens" type="number" min="0" step="0.01" value="${existing?.mensualite || ''}">
      </div>
      <div class="form-group">
        <label>Taux (%)</label>
        <input id="f-taux" type="number" min="0" step="0.01" placeholder="ex : 3.5" value="${existing?.taux || ''}">
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Site de l'organisme (logo)</label>
        <div class="favicon-input-wrap">
          <img id="f-fav-preview" src="${fav || ''}" alt="" class="fav-preview" style="${fav ? '' : 'display:none'}" onerror="this.style.display='none'">
          <input id="f-site" type="text" placeholder="ex : cofidis.fr" value="${esc(existing?.siteWeb || '')}" oninput="previewFav(this.value)">
        </div>
      </div>
      <div class="form-group">
        <label>Note</label>
        <input id="f-note" type="text" placeholder="Optionnel..." value="${esc(existing?.note || '')}">
      </div>
    </div>

    <div class="form-divider"><span>Calendrier du crédit</span></div>

    <div class="form-row">
      <div class="form-group">
        <label>Débute en (1ère mensualité)</label>
        ${monthPickerHtml('f-debut', debutVal, 'calcCreditFin')}
      </div>
      <div class="form-group">
        <label>Jour de prélèvement</label>
        <input id="f-jour" type="number" min="1" max="31" placeholder="ex : 5" value="${existing?.jourEcheance || ''}">
      </div>
    </div>
    <label class="toggle-label">
      <input type="checkbox" id="f-auto" ${existing?.prelevementAuto ? 'checked' : ''}>
      <span class="toggle-track"><span class="toggle-thumb"></span></span>
      <span>Prélèvement automatique <span style="color:var(--text-muted);font-weight:400">(passe en payé dès la date atteinte)</span></span>
    </label>
    <div class="form-row">
      <div class="form-group" style="flex:1">
        <label>Durée totale du crédit</label>
        <div class="dur-calc-row">
          <input id="f-cred-dur" type="number" min="1" class="inline-num" placeholder="ex : 60"
            oninput="calcCreditFin()">
          <select id="f-cred-unit" onchange="calcCreditFin()">
            <option value="mois">mois</option>
            <option value="ans">ans</option>
          </select>
        </div>
        <div class="dur-info" id="f-cred-info"></div>
      </div>
    </div>
    <div class="form-divider" style="margin:5px 0 16px;"><span>ou</span></div>
    <div class="form-group">
      <label>Date de fin précise</label>
      ${monthPickerHtml('f-fin', existing?.dateFin || '', 'clearCreditDur')}
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="saveCredit()">Enregistrer</button>
    </div>
  `);
  setTimeout(() => {
    attachAutocomplete('f-nom',  'nom');
    attachAutocomplete('f-site', 'siteWeb');
    mpiInit('f-debut', debutVal);
    mpiInit('f-fin',   existing?.dateFin || '');
  }, 50);
}

function saveCredit() {
  const nom     = val('f-nom');
  const restant = parseFloat(val('f-restant'));
  const mensual = parseFloat(val('f-mens'));
  if (!nom || isNaN(restant) || isNaN(mensual)) { flash('Veuillez remplir les champs obligatoires.'); return; }
  const data = {
    nom,
    organisme:      val('f-org'),
    montantInitial: parseFloat(val('f-init')) || restant,
    capitalRestant: restant,
    mensualite:     mensual,
    taux:           parseFloat(val('f-taux')) || null,
    jourEcheance:     parseInt(val('f-jour')) || null,
    prelevementAuto:  document.getElementById('f-auto')?.checked || false,
    dateDebut:        val('f-debut') || null,
    dateFin:        val('f-fin') || null,
    siteWeb:        val('f-site'),
    note:           val('f-note'),
  };
  if (_editId) db.updateCredit(_editId, data);
  else         db.addCredit(data);
  closeModal(); renderApp();
}

// ── DÉPENSES ─────────────────────────────────────────────────────────────────
function renderDepenses() {
  const md    = db.monthData(currentMonth);
  const total = md.depenses.reduce((s, d) => s + (d.montant || 0), 0);
  el('dep-total').textContent = formatEur(total);
  el('dep-count').textContent = md.depenses.length + ' dépense(s)';

  // Boutons filtre catégorie
  el('dep-filters').innerHTML =
    `<button class="filter-btn ${_filterCat === '' ? 'active' : ''}" onclick="setFilter('')">Tout</button>` +
    CATS_DEPENSES.map(c => {
      const cnt = md.depenses.filter(d => d.categorie === c.id).length;
      return cnt > 0
        ? `<button class="filter-btn ${_filterCat === c.id ? 'active' : ''}" onclick="setFilter('${c.id}')">${c.icon} ${c.nom} <span class="filter-cnt">${cnt}</span></button>`
        : '';
    }).join('');

  // Liste filtrée
  const filtered = _filterCat
    ? md.depenses.filter(d => d.categorie === _filterCat)
    : md.depenses;
  const sorted = [...filtered].sort((a, b) => b.date?.localeCompare(a.date) || 0);

  el('dep-list').innerHTML = sorted.length
    ? sorted.map(d => {
        const cat = CATS_DEPENSES.find(c => c.id === d.categorie) || CATS_DEPENSES.at(-1);
        const fav = getFavicon(d.siteWeb);
        return `
        <div class="pmt-card" oncontextmenu="showContextMenu(event,'depense','${d.id}')">
          <div class="pmt-card-header">
            <div class="pmt-card-logo">
              ${fav ? `<img src="${fav}" alt="" class="favicon-lg" data-icon="${cat.icon}" onerror="favError(this)">` : `<span class="cat-icon-lg">${cat.icon}</span>`}
            </div>
            <div class="pmt-card-info">
              <h3>${esc(d.nom)}</h3>
              <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:3px">
                <span class="pmt-cat-badge" style="background:${cat.color}20;color:${cat.color}">${fav ? '' : cat.icon + ' '}${cat.nom}</span>
                <span class="freq-badge">${formatDate(d.date)}</span>
              </div>
            </div>
            <div class="pmt-card-actions">
              <button class="btn-icon" onclick="editDepense('${d.id}')" title="Modifier">✏️</button>
              <button class="btn-icon danger" onclick="delDepense('${d.id}')" title="Supprimer">🗑️</button>
            </div>
          </div>
          <div class="pmt-card-body">
            <div class="pmt-detail"><span>Montant</span><strong class="amount negative">${formatEur(d.montant)}</strong></div>
            ${d.note ? `<div class="pmt-note">${esc(d.note)}</div>` : ''}
          </div>
        </div>`;
      }).join('')
    : '<p class="empty">Aucune dépense ce mois.</p>';
}

function setFilter(cat)    { _filterCat    = cat; renderDepenses(); }
function setPmtFilter(cat) { _filterPmtCat = cat; renderPaiements(); }

function setRevFilter(cat) {
  _filterRevCat = cat;
  renderRevenus();
}

function editDepense(id) {
  const d = db.monthData(currentMonth).depenses.find(x => x.id === id);
  if (d) showDepenseModal(d);
}

function delDepense(id) {
  if (!confirm('Supprimer cette dépense ?')) return;
  db.deleteDepense(currentMonth, id);
  renderApp();
}

function showDepenseModal(existing) {
  _editId = existing?.id || null;
  const catOpts = CATS_DEPENSES.map(c => `<option value="${c.id}" ${existing?.categorie === c.id ? 'selected' : ''}>${c.icon} ${c.nom}</option>`).join('');
  const fav     = getFavicon(existing?.siteWeb || '');
  openModal(existing ? 'Modifier la dépense' : 'Ajouter une dépense', `
    <div class="form-row">
      <div class="form-group">
        <label>Libellé *</label>
        <input id="f-nom" type="text" placeholder="ex : Courses Leclerc..." value="${esc(existing?.nom || '')}" required>
      </div>
      <div class="form-group">
        <label>Montant (€) *</label>
        <input id="f-montant" type="number" min="0" step="0.01" value="${existing?.montant || ''}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Date *</label>
        <input id="f-date" type="date" value="${existing?.date || new Date().toISOString().split('T')[0]}">
      </div>
      <div class="form-group">
        <label>Catégorie</label>
        <select id="f-cat">${catOpts}</select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Site / Enseigne (logo automatique)</label>
        <div class="favicon-input-wrap">
          <img id="f-fav-preview" src="${fav || ''}" alt="" class="fav-preview" style="${fav ? '' : 'display:none'}" onerror="this.style.display='none'">
          <input id="f-site" type="text" placeholder="ex : leclerc.fr, amazon.fr..." value="${esc(existing?.siteWeb || '')}" oninput="previewFav(this.value)">
        </div>
      </div>
      <div class="form-group">
        <label>Note</label>
        <input id="f-note" type="text" placeholder="Optionnel..." value="${esc(existing?.note || '')}">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="saveDepense()">Enregistrer</button>
    </div>
  `);
  setTimeout(() => {
    attachAutocomplete('f-nom',  'nom');
    attachAutocomplete('f-site', 'siteWeb');
  }, 50);
}

function saveDepense() {
  const nom     = val('f-nom');
  const montant = parseFloat(val('f-montant'));
  const date    = val('f-date');
  if (!nom || isNaN(montant) || !date) { flash('Veuillez remplir les champs obligatoires.'); return; }
  const data = { nom, montant, date, categorie: val('f-cat'), siteWeb: val('f-site'), note: val('f-note') };
  if (_editId) db.updateDepense(currentMonth, _editId, data);
  else         db.addDepense(currentMonth, data);
  closeModal(); renderApp();
}

// ── BILAN ────────────────────────────────────────────────────────────────────
function prevBilanView() {
  bilanView = bilanView === 'mensuel' ? 'annuel' : 'mensuel';
  db.setPref('bilanView', bilanView);
  renderBilan();
}
function nextBilanView() {
  bilanView = bilanView === 'mensuel' ? 'annuel' : 'mensuel';
  db.setPref('bilanView', bilanView);
  renderBilan();
}

// ── Bilan des comptes ─────────────────────────────────────────────────────────
let _bcBarChart = null;
let _bcDoughnutChart = null;

function renderBilanComptes() {
  const comptes = db.comptes;
  const body = document.getElementById('bilan-comptes-body');
  const title = document.getElementById('bilan-comptes-title');
  if (!body) return;
  if (title) title.textContent = `🏦 Bilan des comptes — ${monthLabel(currentMonth)}`;

  if (!comptes.length) {
    body.innerHTML = `<p class="empty" style="padding:40px 0;text-align:center">Aucun compte configuré.</p>`;
    return;
  }

  // Calcul des totaux par compte (chacun dans son propre contexte)
  const data = comptes.map(c => {
    const t    = db.totalsForCompte(c.id, currentMonth);
    const solde = getSoldeCompte(c, currentMonth);
    const fav  = c.domain ? getFavicon(c.domain) : null;
    const icon = c.type === 'liquide' ? '💵' : '🏦';
    const roleBadge = c.role === 'principal'
      ? `<span class="freq-badge" style="background:#dcfce7;color:#16a34a;font-size:10px">Principal</span>`
      : c.role === 'secondaire'
        ? `<span class="freq-badge" style="background:#dbeafe;color:#2563eb;font-size:10px">Secondaire</span>`
        : '';
    return { c, t, solde, fav, icon, roleBadge };
  });

  const totalSolde   = data.reduce((s, d) => s + d.solde, 0);
  const totalRev     = data.reduce((s, d) => s + d.t.revenus, 0);
  const totalDep     = data.reduce((s, d) => s + d.t.depenses + d.t.paiements + d.t.credits, 0);

  // Cards par compte
  const cardsHtml = data.map(({ c, t, solde, fav, icon, roleBadge }) => {
    const pos = solde >= 0;
    const sorties = t.depenses + t.paiements + t.credits;
    return `
      <div class="card" style="flex:1;min-width:220px">
        <div class="card-header" style="gap:8px">
          ${fav ? `<img src="${fav}" style="width:20px;height:20px;border-radius:4px" alt="" onerror="this.style.display='none'">` : `<span>${icon}</span>`}
          <span class="card-title">${esc(c.nom)} ${roleBadge}</span>
        </div>
        <div class="card-body" style="padding:16px;display:flex;flex-direction:column;gap:8px">
          <div style="display:flex;justify-content:space-between;font-size:13px">
            <span style="color:var(--text-muted)">Solde</span>
            <strong class="${pos ? 'positive' : 'negative'}">${formatEur(solde)}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:13px">
            <span style="color:var(--text-muted)">Revenus</span>
            <span class="positive">${formatEur(t.revenus)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:13px">
            <span style="color:var(--text-muted)">Sorties</span>
            <span class="negative">${formatEur(sorties)}</span>
          </div>
          ${t.credits ? `<div style="display:flex;justify-content:space-between;font-size:13px">
            <span style="color:var(--text-muted)">Crédits</span>
            <span>${formatEur(t.credits)}</span>
          </div>` : ''}
        </div>
      </div>`;
  }).join('');

  // Total global
  const totalHtml = `
    <div class="card" style="flex:1;min-width:220px;border:2px solid var(--primary)">
      <div class="card-header"><span class="card-title">📊 Total tous comptes</span></div>
      <div class="card-body" style="padding:16px;display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;justify-content:space-between;font-size:13px">
          <span style="color:var(--text-muted)">Solde cumulé</span>
          <strong class="${totalSolde >= 0 ? 'positive' : 'negative'}">${formatEur(totalSolde)}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13px">
          <span style="color:var(--text-muted)">Revenus totaux</span>
          <span class="positive">${formatEur(totalRev)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13px">
          <span style="color:var(--text-muted)">Sorties totales</span>
          <span class="negative">${formatEur(totalDep)}</span>
        </div>
      </div>
    </div>`;

  body.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:16px;margin-bottom:24px">
      ${cardsHtml}
      ${totalHtml}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div class="card">
        <div class="card-header"><span class="card-title">Revenus vs Sorties par compte</span></div>
        <div class="card-body" style="padding:16px"><canvas id="bc-bar-chart"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Répartition des soldes</span></div>
        <div class="card-body" style="padding:16px;display:flex;justify-content:center"><canvas id="bc-doughnut-chart" style="max-width:280px"></canvas></div>
      </div>
    </div>`;

  // Détruit les anciens charts
  if (_bcBarChart)     { _bcBarChart.destroy();     _bcBarChart = null; }
  if (_bcDoughnutChart){ _bcDoughnutChart.destroy(); _bcDoughnutChart = null; }

  const labels  = data.map(d => d.c.nom);
  const colors  = ['#3b82f6','#10b981','#f59e0b','#ec4899','#8b5cf6'];

  // Bar chart
  const barCtx = document.getElementById('bc-bar-chart')?.getContext('2d');
  if (barCtx) {
    _bcBarChart = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Revenus',  data: data.map(d => d.t.revenus),                              backgroundColor: '#10b981' },
          { label: 'Sorties',  data: data.map(d => d.t.depenses + d.t.paiements + d.t.credits), backgroundColor: '#ef4444' },
          { label: 'Solde',    data: data.map(d => d.solde),                                  backgroundColor: '#3b82f6' },
        ]
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { y: { ticks: { callback: v => formatEur(v) } } } }
    });
  }

  // Doughnut soldes (valeurs absolues pour le visuel)
  const doughCtx = document.getElementById('bc-doughnut-chart')?.getContext('2d');
  if (doughCtx) {
    const absSoldes = data.map(d => Math.abs(d.solde));
    _bcDoughnutChart = new Chart(doughCtx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data: absSoldes, backgroundColor: colors.slice(0, data.length), borderWidth: 2 }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: { callbacks: { label: ctx => `${ctx.label} : ${formatEur(data[ctx.dataIndex].solde)}` } }
        }
      }
    });
  }
}

function renderBilan() {
  if (bilanView === 'annuel') { renderBilanAnnuel(); return; }

  el('bilan-page-title').textContent = '📈 Bilan mensuel';
  el('bil-mensuel').style.display = '';
  el('bil-annuel').style.display  = 'none';

  const t   = db.totals(currentMonth);
  const md  = db.monthData(currentMonth);
  const map = db.depensesParCategorie(currentMonth);

  const soldeBase   = getSoldeActuelPourMois(currentMonth);
  const soldeEstime = (soldeBase !== null ? soldeBase : 0) + t.solde;
  const soldeActuelEl  = el('bil-solde-actuel');
  const soldeActuelRow = el('bil-row-solde-actuel');
  const isPos = (soldeBase ?? 0) >= 0;
  if (soldeActuelEl) {
    soldeActuelEl.textContent = soldeBase !== null ? formatEur(soldeBase) : '—';
    soldeActuelEl.className   = 'bil-val ' + (isPos ? 'positive' : 'negative');
  }
  if (soldeActuelRow) soldeActuelRow.className = 'bil-row ' + (isPos ? 'green' : 'orange');
  toggleCard('bil-solde-actuel', soldeBase !== null ? 1 : 0);
  el('bil-revenus').textContent  = formatEur(t.revenus);
  el('bil-credits').textContent  = formatEur(t.credits);
  el('bil-pmt').textContent      = formatEur(t.paiements);
  el('bil-dep').textContent      = formatEur(t.depenses);
  el('bil-solde').textContent    = formatEur(soldeEstime);
  el('bil-solde').className      = 'bil-val ' + (soldeEstime >= 0 ? 'positive' : 'negative');
  toggleCard('bil-credits', t.credits);
  toggleCard('bil-pmt',     t.paiements);
  toggleCard('bil-dep',     t.depenses);

  // Budget bar : (paiements + dépenses) vs revenus
  const total  = t.depenses + t.paiements;
  const pct    = t.revenus > 0 ? Math.min(Math.round((total / t.revenus) * 100), 100) : 0;
  const barEl  = el('bil-budget-bar');
  barEl.style.width     = pct + '%';
  barEl.style.background = pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : '#22c55e';
  el('bil-budget-pct').textContent = `${pct}% du budget utilisé`;

  // Tableau détaillé catégories dépenses
  const catRows = Object.entries(map).map(([k, v]) => {
    const cat = CATS_DEPENSES.find(c => c.id === k) || { nom: k, icon: '❓', color: '#94a3b8' };
    const p   = t.revenus > 0 ? Math.round((v / t.revenus) * 100) : 0;
    return `<tr>
      <td><span style="color:${cat.color}">${cat.icon}</span> ${cat.nom}</td>
      <td class="amount">${formatEur(v)}</td>
      <td><div class="mini-bar"><div class="mini-bar-fill" style="width:${p}%;background:${cat.color}"></div></div> ${p}%</td>
    </tr>`;
  }).join('');
  el('bil-cat-table').innerHTML = catRows || '<tr><td colspan="3"><em>Aucune dépense</em></td></tr>';

  // Sélecteur de graphique
  const BILAN_CHARTS = [
    { id: 'bar',       label: '📊 Vue d\'ensemble'          },
    { id: 'revenus',   label: '💰 Répartition revenus'      },
    { id: 'paiements', label: '📋 Paiements par catégorie'  },
    { id: 'depenses',  label: '🛒 Répartition dépenses'     },
  ];
  const chartType = db.getPref('bilanChart', 'bar');
  el('bil-chart-header').innerHTML = `
    <span class="card-title">Vue graphique</span>
    <select class="chart-type-select" onchange="selectBilanChart(this.value)">
      ${BILAN_CHARTS.map(c => `<option value="${c.id}" ${chartType === c.id ? 'selected' : ''}>${c.label}</option>`).join('')}
    </select>`;

  renderBilanChart(t, map, md, chartType);
}

function selectBilanChart(type) {
  db.setPref('bilanChart', type);
  renderBilan();
}

function renderBilanChart(t, map, md, chartType) {
  if (bilanChart) { bilanChart.destroy(); bilanChart = null; }
  el('bil-chart-body').innerHTML = '<canvas id="bilanChart"></canvas>';
  const ctx = document.getElementById('bilanChart');
  if (!ctx) return;

  if (chartType === 'bar') {
    bilanChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Revenus', 'Paiements récurrents', 'Dépenses variables'],
        datasets: [{ data: [t.revenus, t.paiements, t.depenses], backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b'], borderRadius: 8, borderWidth: 0 }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${formatEur(c.parsed.y)}` } } },
        scales: { y: { ticks: { callback: v => formatEur(v) }, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } }
      }
    });

  } else if (chartType === 'revenus') {
    const recurrents = db.revenusRecurrentsForMonth(currentMonth);
    const catMap = {};
    for (const r of [...recurrents, ...md.revenus]) {
      catMap[r.categorie] = (catMap[r.categorie] || 0) + (r.montant || 0);
    }
    const keys = Object.keys(catMap);
    if (!keys.length) { el('bil-chart-body').innerHTML = '<p class="empty chart-empty">Aucun revenu ce mois</p>'; return; }
    bilanChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: keys.map(k => (CATS_REVENUS.find(c => c.id === k) || {nom: k}).nom),
        datasets: [{ data: keys.map(k => catMap[k]), backgroundColor: keys.map(k => (CATS_REVENUS.find(c => c.id === k) || {color: '#94a3b8'}).color), borderWidth: 2, borderColor: '#fff' }]
      },
      options: doughnutOptionsBilan(),
      plugins: [ChartDataLabels]
    });

  } else if (chartType === 'paiements') {
    const actifs = db.paiements.filter(p => isPaymentActiveForMonth(p, currentMonth));
    const catMap = {};
    for (const p of actifs) {
      const st = md.statuts[p.id];
      catMap[p.categorie] = (catMap[p.categorie] || 0) + (st?.montantReel ?? p.montant);
    }
    const keys = Object.keys(catMap);
    if (!keys.length) { el('bil-chart-body').innerHTML = '<p class="empty chart-empty">Aucun paiement récurrent ce mois</p>'; return; }
    bilanChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: keys.map(k => (CATS_PAIEMENTS.find(c => c.id === k) || {nom: k}).nom),
        datasets: [{ data: keys.map(k => catMap[k]), backgroundColor: keys.map(k => (CATS_PAIEMENTS.find(c => c.id === k) || {color: '#94a3b8'}).color), borderWidth: 2, borderColor: '#fff' }]
      },
      options: doughnutOptionsBilan(),
      plugins: [ChartDataLabels]
    });

  } else if (chartType === 'depenses') {
    const keys = Object.keys(map);
    if (!keys.length) { el('bil-chart-body').innerHTML = '<p class="empty chart-empty">Aucune dépense ce mois</p>'; return; }
    bilanChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: keys.map(k => (CATS_DEPENSES.find(c => c.id === k) || {nom: k}).nom),
        datasets: [{ data: keys.map(k => map[k]), backgroundColor: keys.map(k => (CATS_DEPENSES.find(c => c.id === k) || {color: '#94a3b8'}).color), borderWidth: 2, borderColor: '#fff' }]
      },
      options: doughnutOptionsBilan(),
      plugins: [ChartDataLabels]
    });
  }
}

function selectBilanAnnuelChart(type) {
  db.setPref('bilanAnnuelChart', type);
  renderBilanAnnuel();
}

function renderBilanAnnuel() {
  const year = currentMonth.split('-')[0];
  el('bilan-page-title').textContent = `📈 Bilan annuel ${year}`;
  el('bil-mensuel').style.display = 'none';
  el('bil-annuel').style.display  = '';

  let totRev = 0, totCred = 0, totPmt = 0, totDep = 0;
  const months = [];
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, '0')}`;
    const t = db.totals(key);
    months.push({ key, t });
    totRev  += t.revenus;
    totCred += t.credits;
    totPmt  += t.paiements;
    totDep  += t.depenses;
  }
  const totSolde = totRev - totCred - totPmt - totDep;

  const showCred = totCred > 0;
  const activeMonths = months.filter(({ t }) => t.revenus || t.credits || t.paiements || t.depenses);

  const monthRows = activeMonths.map(({ key, t }) => `
    <tr>
      <td class="det-month">${monthLabel(key)}</td>
      <td class="amount positive">${t.revenus ? formatEur(t.revenus) : '—'}</td>
      ${showCred ? `<td class="amount col-blue">${t.credits ? formatEur(t.credits) : '—'}</td>` : ''}
      <td class="amount col-blue">${t.paiements ? formatEur(t.paiements) : '—'}</td>
      <td class="amount col-orange">${t.depenses ? formatEur(t.depenses) : '—'}</td>
      <td class="amount ${t.solde >= 0 ? 'positive' : 'negative'}">${formatEur(t.solde)}</td>
    </tr>`).join('');

  const totRow = `
    <tr class="det-total">
      <td>Total</td>
      <td class="amount positive">${formatEur(totRev)}</td>
      ${showCred ? `<td class="amount col-blue">${formatEur(totCred)}</td>` : ''}
      <td class="amount col-blue">${formatEur(totPmt)}</td>
      <td class="amount col-orange">${formatEur(totDep)}</td>
      <td class="amount ${totSolde >= 0 ? 'positive' : 'negative'}">${formatEur(totSolde)}</td>
    </tr>`;

  const BILAN_CHARTS = [
    { id: 'bar',       label: '📊 Vue d\'ensemble'         },
    { id: 'revenus',   label: '💰 Répartition revenus'     },
    { id: 'paiements', label: '📋 Paiements par catégorie' },
    { id: 'depenses',  label: '🛒 Répartition dépenses'    },
  ];
  const chartType = db.getPref('bilanAnnuelChart', 'bar');

  el('bil-annuel').innerHTML = `
    <div class="bil-grid">
      <div>
        <div class="card" style="margin-bottom:20px">
          <div class="card-header"><span class="card-title">Résumé ${year}</span></div>
          <div class="card-body">
            <div class="bil-rows">
              <div class="bil-row green">
                <div><div class="bil-row-label">💰 Revenus totaux</div></div>
                <div class="bil-val positive">${formatEur(totRev)}</div>
              </div>
              ${totCred > 0 ? `<div class="bil-row blue">
                <div class="bil-row-with-op"><span class="bil-op">−</span><div><div class="bil-row-label">💳 Crédits</div></div></div>
                <div class="bil-val col-blue">${formatEur(totCred)}</div>
              </div>` : ''}
              <div class="bil-row blue">
                <div class="bil-row-with-op"><span class="bil-op">−</span><div><div class="bil-row-label">📋 Paiements récurrents</div></div></div>
                <div class="bil-val col-blue">${formatEur(totPmt)}</div>
              </div>
              <div class="bil-row orange">
                <div class="bil-row-with-op"><span class="bil-op">−</span><div><div class="bil-row-label">🛒 Dépenses variables</div></div></div>
                <div class="bil-val col-orange">${formatEur(totDep)}</div>
              </div>
              <div class="bil-formula-sep"></div>
              <div class="bil-row green result">
                <div class="bil-row-with-op"><span class="bil-op">=</span><div><div class="bil-row-label">📊 Solde annuel</div></div></div>
                <div class="bil-val ${totSolde >= 0 ? 'positive' : 'negative'}">${formatEur(totSolde)}</div>
              </div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">Détail mensuel</span></div>
          <div class="card-body">
            <table class="det-table">
              <thead>
                <tr>
                  <th>Mois</th>
                  <th class="amount">💰 Revenus</th>
                  ${showCred ? '<th class="amount">💳 Crédits</th>' : ''}
                  <th class="amount">📋 Paiements</th>
                  <th class="amount">🛒 Dépenses</th>
                  <th class="amount">📊 Solde</th>
                </tr>
              </thead>
              <tbody>${monthRows}</tbody>
              <tfoot>${totRow}</tfoot>
            </table>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">Vue graphique</span>
          <select class="chart-type-select" onchange="selectBilanAnnuelChart(this.value)">
            ${BILAN_CHARTS.map(c => `<option value="${c.id}" ${chartType === c.id ? 'selected' : ''}>${c.label}</option>`).join('')}
          </select>
        </div>
        <div class="card-body" id="bil-annuel-chart-body"><canvas id="bilanAnnuelChart"></canvas></div>
      </div>
    </div>`;

  renderBilanAnnuelChart(year, months, chartType);
}

function renderBilanAnnuelChart(year, months, chartType) {
  if (bilanChart) { bilanChart.destroy(); bilanChart = null; }
  const ctx = document.getElementById('bilanAnnuelChart');
  if (!ctx) return;

  if (chartType === 'bar') {
    const labels = months.map(({ key }) => {
      const [, m] = key.split('-');
      return new Date(2000, +m - 1, 1).toLocaleDateString('fr-FR', { month: 'short' });
    });
    bilanChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Revenus',   data: months.map(({t}) => t.revenus),   backgroundColor: '#22c55e', borderRadius: 4, borderWidth: 0 },
          { label: 'Paiements', data: months.map(({t}) => t.paiements), backgroundColor: '#3b82f6', borderRadius: 4, borderWidth: 0 },
          { label: 'Dépenses',  data: months.map(({t}) => t.depenses),  backgroundColor: '#f59e0b', borderRadius: 4, borderWidth: 0 },
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 12 }, padding: 12 } },
          tooltip: { callbacks: { label: c => ` ${c.dataset.label} : ${formatEur(c.parsed.y)}` } }
        },
        scales: {
          y: { ticks: { callback: v => formatEur(v) }, grid: { color: '#f1f5f9' } },
          x: { grid: { display: false } }
        }
      }
    });

  } else if (chartType === 'revenus') {
    const catMap = {};
    for (const { key } of months) {
      const md = db.monthData(key);
      for (const r of [...db.revenusRecurrentsForMonth(key), ...md.revenus]) {
        catMap[r.categorie] = (catMap[r.categorie] || 0) + (r.montant || 0);
      }
    }
    const keys = Object.keys(catMap);
    if (!keys.length) { el('bil-annuel-chart-body').innerHTML = '<p class="empty chart-empty">Aucun revenu cette année</p>'; return; }
    bilanChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: keys.map(k => (CATS_REVENUS.find(c => c.id === k) || {nom: k}).nom),
        datasets: [{ data: keys.map(k => catMap[k]), backgroundColor: keys.map(k => (CATS_REVENUS.find(c => c.id === k) || {color: '#94a3b8'}).color), borderWidth: 2, borderColor: '#fff' }]
      },
      options: doughnutOptionsBilan(),
      plugins: [ChartDataLabels]
    });

  } else if (chartType === 'paiements') {
    const catMap = {};
    for (const { key } of months) {
      const md = db.monthData(key);
      for (const p of db.paiements.filter(p => isPaymentActiveForMonth(p, key))) {
        const st = md.statuts[p.id];
        catMap[p.categorie] = (catMap[p.categorie] || 0) + (st?.montantReel ?? p.montant);
      }
    }
    const keys = Object.keys(catMap);
    if (!keys.length) { el('bil-annuel-chart-body').innerHTML = '<p class="empty chart-empty">Aucun paiement cette année</p>'; return; }
    bilanChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: keys.map(k => (CATS_PAIEMENTS.find(c => c.id === k) || {nom: k}).nom),
        datasets: [{ data: keys.map(k => catMap[k]), backgroundColor: keys.map(k => (CATS_PAIEMENTS.find(c => c.id === k) || {color: '#94a3b8'}).color), borderWidth: 2, borderColor: '#fff' }]
      },
      options: doughnutOptionsBilan(),
      plugins: [ChartDataLabels]
    });

  } else if (chartType === 'depenses') {
    const catMap = {};
    for (const { key } of months) {
      for (const d of db.monthData(key).depenses) {
        catMap[d.categorie] = (catMap[d.categorie] || 0) + (d.montant || 0);
      }
    }
    const keys = Object.keys(catMap);
    if (!keys.length) { el('bil-annuel-chart-body').innerHTML = '<p class="empty chart-empty">Aucune dépense cette année</p>'; return; }
    bilanChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: keys.map(k => (CATS_DEPENSES.find(c => c.id === k) || {nom: k}).nom),
        datasets: [{ data: keys.map(k => catMap[k]), backgroundColor: keys.map(k => (CATS_DEPENSES.find(c => c.id === k) || {color: '#94a3b8'}).color), borderWidth: 2, borderColor: '#fff' }]
      },
      options: doughnutOptionsBilan(),
      plugins: [ChartDataLabels]
    });
  }
}

// ── HELPERS FORMULAIRES ───────────────────────────────────────────────────────

// Met à jour les infos de durée dans le formulaire paiement
function updateDurInfo() {
  const infoEl  = document.getElementById('f-dur-info');
  if (!infoEl) return;
  const durType   = document.querySelector('input[name="f-dur-type"]:checked')?.value || 'unique';
  const debut     = document.getElementById('f-debut')?.value || null;
  const freq      = document.getElementById('f-freq')?.value || 'mensuel';
  const freqObj   = FREQUENCES.find(f => f.id === freq) || FREQUENCES[0];
  const debutStr  = debut ? `${monthLabel(debut)}` : monthLabel(currentMonth);
  const debutLbl  = document.getElementById('f-debut-label');
  const recWrap   = document.getElementById('f-recurrence-wrap');

  if (durType === 'unique') {
    infoEl.textContent = `📅 Apparaît uniquement en ${debutStr}`;
    if (debutLbl)  debutLbl.textContent = 'Mois du paiement';
    if (recWrap)   recWrap.querySelector('#f-freq').closest('.form-row').querySelector('.form-group:first-child').style.display = 'none';
  } else if (durType === 'bimestriel') {
    if (recWrap)   recWrap.querySelector('#f-freq').closest('.form-row').querySelector('.form-group:first-child').style.display = 'none';
    if (debutLbl)  debutLbl.innerHTML = 'Débute en <span class="label-opt">(vide = depuis toujours)</span>';
    const debutStr2 = debut ? `À partir de ${monthLabel(debut)}` : 'Depuis toujours';
    infoEl.textContent = `${debutStr2} · Tous les 2 mois · sans fin`;
  } else {
    if (recWrap)   recWrap.querySelector('#f-freq').closest('.form-row').querySelector('.form-group:first-child').style.display = '';
    if (debutLbl)  debutLbl.innerHTML = 'Débute en <span class="label-opt">(vide = depuis toujours)</span>';
    const debutStr2 = debut ? `À partir de ${monthLabel(debut)}` : 'Depuis toujours';
    if (durType === 'indefini') {
      infoEl.textContent = `${debutStr2} · ${freqObj.nom} · sans fin`;
    } else if (durType === 'mois') {
      const mois = parseInt(document.getElementById('f-dur-mois')?.value);
      if (mois > 0) {
        const base = debut || todayKey();
        const fin  = calcDateFin(base, mois);
        infoEl.textContent = `${debutStr2} → ${mois} mois → fin en ${monthLabel(fin)}`;
      } else {
        infoEl.textContent = '';
      }
    } else if (durType === 'date') {
      const fin = document.getElementById('f-fin')?.value;
      infoEl.textContent = fin ? `${debutStr2} → fin en ${monthLabel(fin)}` : '';
    }
  }
}

// Coche le bon radio dans le formulaire paiement
function switchDurRadio(v) {
  document.querySelectorAll('input[name="f-dur-type"]').forEach(r => { r.checked = r.value === v; });
}

// Calcule la date de fin du crédit depuis la durée entrée
function calcCreditFin() {
  const dur   = parseInt(document.getElementById('f-cred-dur')?.value);
  const unit  = document.getElementById('f-cred-unit')?.value || 'mois';
  const debut = document.getElementById('f-debut')?.value || currentMonth;
  const info  = document.getElementById('f-cred-info');
  if (!info) return;

  if (!dur || isNaN(dur)) { info.textContent = ''; return; }

  const mois   = unit === 'ans' ? dur * 12 : dur;
  const finKey = calcDateFin(debut, mois);
  if (!finKey) return;

  info.textContent = `→ ${mois} mensualités · Fin en ${monthLabel(finKey)}`;
  const finInput = document.getElementById('f-fin');
  if (finInput) {
    finInput.value = finKey;
    const disp = document.getElementById('mpi-display-f-fin');
    if (disp) { disp.textContent = monthLabel(finKey); disp.classList.remove('empty'); }
    _mpiYears['f-fin'] = parseInt(finKey.split('-')[0]);
    mpiRenderGrid('f-fin');
  }
}

// Vide le calculateur durée quand on entre la date de fin manuellement
function clearCreditDur() {
  const durEl  = document.getElementById('f-cred-dur');
  const infoEl = document.getElementById('f-cred-info');
  if (durEl)  durEl.value = '';
  if (infoEl) infoEl.textContent = '';
}

// ── AUTOCOMPLETE ─────────────────────────────────────────────────────────────
function collectSuggestions(field) {
  const seen = new Set();
  const add  = v => { if (typeof v === 'string' && v.trim()) seen.add(v.trim()); };
  db.paiements.forEach(p => add(p[field]));
  db.credits.forEach(c => add(c[field]));
  db.revenusRecurrents.forEach(r => add(r[field]));
  Object.values(db._d.mois).forEach(md => {
    (md.revenus  || []).forEach(r => add(r[field]));
    (md.depenses || []).forEach(d => add(d[field]));
  });
  return [...seen].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
}

function attachAutocomplete(inputId, field) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const wrap = input.closest('.form-group') || input.parentNode;
  if (wrap) wrap.style.position = 'relative';

  const dd = document.createElement('div');
  dd.className = 'ac-dropdown';
  dd.id = 'ac-' + inputId;
  (wrap || input.parentNode).appendChild(dd);

  function refresh() {
    const q = input.value.trim().toLowerCase();
    if (!q) { dd.classList.remove('open'); return; }
    const matches = collectSuggestions(field)
      .filter(s => s.toLowerCase().includes(q) && s !== input.value)
      .slice(0, 8);
    if (!matches.length) { dd.classList.remove('open'); return; }
    dd.innerHTML = matches.map(s => {
      const img = field === 'siteWeb'
        ? `<img src="${getFavicon(s)}" onerror="this.style.display='none'">`
        : '';
      return `<div class="ac-item" data-ac-input="${inputId}" data-ac-val="${esc(s)}">${img}<span>${esc(s)}</span></div>`;
    }).join('');
    // Attacher les clics via addEventListener pour éviter les conflits de guillemets
    dd.querySelectorAll('.ac-item').forEach(item => {
      item.addEventListener('mousedown', e => e.preventDefault());
      item.addEventListener('click', () => fillAC(item.dataset.acInput, item.dataset.acVal));
    });
    dd.classList.add('open');
  }

  input.addEventListener('input', refresh);
  input.addEventListener('focus', refresh);
  dd.addEventListener('mousedown', e => e.preventDefault());
  input.addEventListener('blur',  () => setTimeout(() => dd.classList.remove('open'), 200));
  input.addEventListener('keydown', e => { if (e.key === 'Escape') dd.classList.remove('open'); });
}

function fillAC(inputId, value) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  const dd = document.getElementById('ac-' + inputId);
  if (dd) dd.classList.remove('open');
}

// ── MODAL ────────────────────────────────────────────────────────────────────
function openModal(title, html) {
  el('modal-title').textContent = title;
  el('modal-body').innerHTML    = html;
  el('modal-overlay').classList.add('open');
  setTimeout(() => {
    const first = el('modal-body').querySelector('input, select');
    if (first) first.focus();
  }, 60);
}

function closeModal() {
  el('modal-overlay').classList.remove('open');
  _editId = null;
}

// ── EXPORT / IMPORT / RESET ──────────────────────────────────────────────────
function importData() {
  document.getElementById('import-file-input')?.click();
}

function handleImportFile(input) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (typeof parsed !== 'object' || parsed === null) throw new Error();
      openModal('📂 Importer des données', `
        <p style="margin-bottom:8px">Fichier : <strong>${esc(file.name)}</strong></p>
        <p style="margin-bottom:20px;color:var(--text-muted)">
          Cette action <strong>remplacera toutes vos données actuelles</strong> par celles du fichier. Cette opération est irréversible.
        </p>
        <div style="display:flex;gap:10px">
          <button class="btn btn-secondary" style="flex:1" onclick="closeModal()">Annuler</button>
          <button class="btn btn-primary" style="flex:1;background:#dc2626;border-color:#dc2626" onclick="confirmImport()">Remplacer mes données</button>
        </div>
      `);
      window._pendingImport = parsed;
    } catch {
      flash('Fichier JSON invalide.', 'error');
    }
    input.value = '';
  };
  reader.readAsText(file);
}

function confirmImport() {
  if (!window._pendingImport) return;
  try {
    db.importJSON(JSON.stringify(window._pendingImport));
    window._pendingImport = null;
    closeModal();
    currentCompteIdx = 0;
    if (db.comptes.length > 0) db.setActiveCompte(db.comptes[0].id);
    flash('Données importées avec succès.', 'success');
    renderApp();
  } catch {
    flash('Erreur lors de l\'import.', 'error');
  }
}

function exportData() {
  const blob = new Blob([db.exportJSON()], { type: 'application/json' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `compta-maison-${currentMonth}.json`;
  a.click();
}

function resetData() {
  openModal('🗑️ Réinitialiser', `
    <p style="margin-bottom:20px;color:var(--text-muted)">Que souhaitez-vous réinitialiser ?</p>
    <div style="display:flex;flex-direction:column;gap:10px">
      <button class="btn btn-secondary reset-choice-btn" onclick="resetMonth()">
        🗓️ Réinitialiser le mois en cours
        <small>Supprime les revenus, dépenses et statuts de paiement de ce mois uniquement</small>
      </button>
      <button class="btn reset-choice-btn" style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5" onclick="confirmFormat()">
        💣 Formatage complet
        <small>Supprime <strong>TOUTES</strong> les données du logiciel — irréversible</small>
      </button>
    </div>
    <div class="modal-footer" style="margin-top:20px">
      <button class="btn btn-secondary" onclick="closeModal()">Annuler</button>
    </div>
  `);
}

function resetMonth() {
  const md = db.monthData(currentMonth);
  md.revenus  = [];
  md.depenses = [];
  md.statuts  = {};
  db.save();
  closeModal();
  flash(`Mois de ${monthLabel(currentMonth)} réinitialisé.`, 'success');
  renderApp();
}

function confirmFormat() {
  closeModal();
  openModal('⚠️ Confirmation formatage', `
    <div style="text-align:center;padding:12px 0 20px">
      <div style="font-size:52px;margin-bottom:12px">⚠️</div>
      <p style="font-size:15px;font-weight:700;color:#dc2626;margin-bottom:10px">Cette action est irréversible</p>
      <p style="color:var(--text-muted);line-height:1.6">Toutes vos données seront définitivement supprimées :<br>
        revenus, dépenses, paiements, crédits, historique…</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Non, annuler</button>
      <button class="btn" style="background:#ef4444;color:#fff" onclick="doFormat()">Oui, tout supprimer</button>
    </div>
  `);
}

function doFormat() {
  db.reset();
  closeModal();
  flash('Toutes les données ont été supprimées.', 'success');
  renderApp();
}

// ── UTILITAIRES DOM ──────────────────────────────────────────────────────────
function el(id)  { return document.getElementById(id); }
function val(id) { return (document.getElementById(id)?.value || '').trim(); }
function esc(s)  {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function flash(msg, type = 'error') {
  const toastEl = el('toast');
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.className   = `toast toast-${type} visible`;
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.remove('visible'), 3500);
}

// ── Démarrage ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
