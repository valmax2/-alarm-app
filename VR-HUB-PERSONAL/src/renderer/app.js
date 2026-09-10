'use strict';

/**
 * Logica UI di VR HUB PERSONAL. JS semplice, nessun framework (spec §108:
 * "niente complessità inutile"). Parla col main process solo tramite
 * `window.vrhub` (esposta da preload.ts via contextBridge).
 */

const state = {
  games: [],
  filter: 'all',
  search: '',
  currentGameId: null
};

const els = {};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  els.steamGrid = document.getElementById('steam-grid');
  els.nonsteamGrid = document.getElementById('nonsteam-grid');
  els.steamEmpty = document.getElementById('steam-empty');
  els.nonsteamEmpty = document.getElementById('nonsteam-empty');
  els.searchInput = document.getElementById('search-input');
  els.catalogInfo = document.getElementById('catalog-info');
  els.detailOverlay = document.getElementById('detail-overlay');
  els.detailContent = document.getElementById('detail-content');
  els.settingsOverlay = document.getElementById('settings-overlay');
  els.settingsContent = document.getElementById('settings-content');
  els.toastContainer = document.getElementById('toast-container');

  document.getElementById('rescan-btn').addEventListener('click', onRescan);
  document.getElementById('add-nonsteam-btn').addEventListener('click', onAddNonSteam);
  document.getElementById('settings-btn').addEventListener('click', openSettings);
  els.searchInput.addEventListener('input', (e) => {
    state.search = e.target.value.trim().toLowerCase();
    renderLibrary();
  });

  document.querySelectorAll('.filter-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      state.filter = chip.dataset.filter;
      renderLibrary();
    });
  });

  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => closeOverlay(document.getElementById(btn.dataset.close)));
  });

  const info = await window.vrhub.catalogInfo();
  els.catalogInfo.textContent = `Catalogo v${info.databaseVersion} · ${info.entriesCount} profili conosciuti`;

  await refreshLibrary();
}

async function refreshLibrary() {
  state.games = await window.vrhub.listGames();
  renderLibrary();
}

function renderLibrary() {
  const filtered = state.games.filter(matchesFilterAndSearch);
  const steamGames = filtered.filter((g) => g.platform === 'steam');
  const manualGames = filtered.filter((g) => g.platform === 'manual');

  renderGrid(els.steamGrid, steamGames);
  renderGrid(els.nonsteamGrid, manualGames);
  els.steamEmpty.hidden = steamGames.length > 0;
  els.nonsteamEmpty.hidden = manualGames.length > 0;
}

function matchesFilterAndSearch(game) {
  if (state.search) {
    const haystack = `${game.title} ${game.engine?.engine ?? ''} ${game.vrReadiness}`.toLowerCase();
    if (!haystack.includes(state.search)) return false;
  }
  switch (state.filter) {
    case 'ready':
      return game.vrReadiness === 'ready';
    case 'configuration_required':
      return game.vrReadiness === 'configuration_required';
    case 'update_available':
      return game.vrReadiness === 'update_available';
    case 'not_compatible':
      return game.vrReadiness === 'not_compatible' || game.vrReadiness === 'not_found';
    case 'pcvr':
    case 'quest':
      return true; // il filtro fine per modalità VR richiede il profilo: raffinato in Fase 2
    default:
      return true;
  }
}

function renderGrid(container, games) {
  container.innerHTML = '';
  for (const game of games) {
    container.appendChild(renderCard(game));
  }
}

function renderCard(game) {
  const card = document.createElement('div');
  card.className = 'game-card';
  card.innerHTML = `
    <div class="cover">${game.coverPath ? '' : '🎮'}</div>
    <div class="card-body">
      <div class="title" title="${escapeHtml(game.title)}">${escapeHtml(game.title)}</div>
      <div class="badges">${badgesFor(game)}</div>
    </div>
  `;
  card.addEventListener('click', () => openDetail(game.id));
  return card;
}

function badgesFor(game) {
  const badges = [];
  switch (game.vrReadiness) {
    case 'ready':
      badges.push(badge('ready', 'READY VR'));
      break;
    case 'configuration_required':
      badges.push(badge('config', 'CONFIGURAZIONE RICHIESTA'));
      break;
    case 'update_available':
      badges.push(badge('update', 'UPDATE VR'));
      break;
    case 'not_found':
      badges.push(badge('error', 'GIOCO NON TROVATO'));
      break;
    default:
      badges.push(badge('unavailable', 'NON COMPATIBILE'));
  }
  if (game.engine && game.engine.confidence !== 'unknown') {
    badges.push(badge('unavailable', game.engine.engine));
  }
  return badges.join('');
}

function badge(kind, label) {
  return `<span class="badge badge-${kind}">${escapeHtml(label)}</span>`;
}

async function onRescan() {
  toast('Scansione Steam in corso…');
  try {
    await window.vrhub.scanSteam();
    await refreshLibrary();
    toast('Libreria aggiornata.', 'success');
  } catch (err) {
    toast(`Scansione falita: ${err}`, 'error');
  }
}

async function onAddNonSteam() {
  const folder = await window.vrhub.pickFolder();
  if (!folder) return;
  toast('Analisi della cartella in corso…');
  try {
    const game = await window.vrhub.addNonSteamGame(folder);
    await refreshLibrary();
    toast(`Aggiunto "${game.title}".`, 'success');
    openDetail(game.id);
  } catch (err) {
    toast(`Aggiunta non riuscita: ${err}`, 'error');
  }
}

async function openDetail(gameId) {
  state.currentGameId = gameId;
  const game = state.games.find((g) => g.id === gameId);
  if (!game) return;

  els.detailContent.innerHTML = '<p>Caricamento…</p>';
  showOverlay(els.detailOverlay);

  const profile = await window.vrhub.getProfile(gameId);
  renderDetail(game, profile);
}

function renderDetail(game, profile) {
  const controllers = profile?.controllers;
  const settings = profile?.recommendedSettings;

  els.detailContent.innerHTML = `
    <div class="detail-header">
      <div class="detail-cover">${game.coverPath ? '' : '🎮'}</div>
      <div class="detail-title-wrap">
        <h1>${escapeHtml(game.title)}</h1>
        <div class="detail-meta">${escapeHtml(game.platform === 'steam' ? 'Steam' : 'Non-Steam')} · ${escapeHtml(
    game.installPath
  )}</div>
        <div class="badges">${badgesFor(game)}</div>
      </div>
    </div>

    <div class="detail-section">
      <h3>INFORMAZIONI GENERALI</h3>
      <div class="kv-grid">
        <div class="k">Eseguibile</div><div>${escapeHtml(game.exePath ?? 'non impostato')}</div>
        <div class="k">Motore</div><div>${escapeHtml(game.engine.engine)} (${escapeHtml(game.engine.confidence)})</div>
        <div class="k">Profilo</div><div>${profile ? escapeHtml(profile.title) : 'nessuno — aggiungilo manualmente'}</div>
      </div>
    </div>

    ${
      profile
        ? `
    <div class="detail-section">
      <h3>VR</h3>
      <div class="kv-grid">
        <div class="k">Compatibilità</div><div>${escapeHtml(profile.compatibility)}</div>
        <div class="k">Provider</div><div>${escapeHtml(profile.provider ?? 'non impostato')}</div>
        <div class="k">Runtime</div><div>${escapeHtml(profile.runtime ?? 'non impostato')}</div>
        <div class="k">Modalità</div><div>${escapeHtml((profile.vrModes || []).join(', ') || 'non specificata')}</div>
      </div>
    </div>

    <div class="detail-section">
      <h3>CONTROLLER</h3>
      <div class="kv-grid">
        <div class="k">Gamepad</div><div>${escapeHtml(controllers.gamepad)}</div>
        <div class="k">Quest Touch</div><div>${escapeHtml(controllers.questTouch)}</div>
        <div class="k">Tastiera/Mouse</div><div>${escapeHtml(controllers.keyboardMouse)}</div>
        <div class="k">Motion controller</div><div>${escapeHtml(controllers.motionController)}</div>
      </div>
    </div>

    <div class="detail-section">
      <h3>IMPOSTAZIONI CONSIGLIATE</h3>
      <div class="kv-grid">
        <div class="k">Motion Blur</div><div>${escapeHtml(settings.motionBlur)}</div>
        <div class="k">DLSS Frame Generation</div><div>${escapeHtml(settings.dlssFrameGeneration)}</div>
        <div class="k">TAA</div><div>${escapeHtml(settings.taa)}</div>
      </div>
    </div>

    <div id="plan-box-slot"></div>

    <div class="cta-row">
      ${
        game.vrReadiness === 'ready'
          ? `<button class="btn-huge" id="launch-btn" style="flex:1">AVVIA IN VR</button>`
          : `<button class="btn btn-primary" id="simulate-btn">SIMULA INSTALLAZIONE</button>
             <button class="btn btn-primary" id="configure-btn">CONFIGURA VR</button>`
      }
      <button class="btn btn-secondary" id="diagnostics-btn">DIAGNOSTICA VR</button>
      <button class="btn btn-secondary" id="restore-btn">RIPRISTINA GIOCO</button>
      <button class="btn btn-danger" id="remove-btn">RIMUOVI DALLA LIBRERIA</button>
    </div>
    `
        : `<p class="empty-hint">Nessun profilo VR associato a questo gioco.</p>
           <div class="cta-row"><button class="btn btn-danger" id="remove-btn">RIMUOVI DALLA LIBRERIA</button></div>`
    }
  `;

  document.getElementById('remove-btn')?.addEventListener('click', () => onRemove(game.id));
  document.getElementById('restore-btn')?.addEventListener('click', () => onRestore(game.id));
  document.getElementById('diagnostics-btn')?.addEventListener('click', () => onDiagnostics(game.id));
  document.getElementById('configure-btn')?.addEventListener('click', () => onConfigureVr(game.id));
  document.getElementById('simulate-btn')?.addEventListener('click', () => onSimulate(game.id));
  document.getElementById('launch-btn')?.addEventListener('click', () => onLaunch(game.id));
}

async function onSimulate(gameId) {
  const plan = await window.vrhub.planInstall(gameId);
  const slot = document.getElementById('plan-box-slot');
  if (!plan) {
    slot.innerHTML = `<div class="plan-box">Nessun provider VR applicabile a questo gioco.</div>`;
    return;
  }
  slot.innerHTML = `
    <div class="plan-box">
      <strong>SIMULA INSTALLAZIONE — cosa farà "Configura VR" (nessuna modifica reale)</strong>
      <ul>${plan.steps.map((s) => `<li>${escapeHtml(s.description)}</li>`).join('')}</ul>
      ${
        plan.manualStepsRequired.length
          ? `<div class="manual-steps">Passaggi manuali richiesti:<ul>${plan.manualStepsRequired
              .map((m) => `<li>${escapeHtml(m)}</li>`)
              .join('')}</ul></div>`
          : ''
      }
    </div>
  `;
}

async function onConfigureVr(gameId) {
  toast('Configurazione VR in corso…');
  try {
    const result = await window.vrhub.configureVr(gameId);
    toast(result.message, result.ok ? 'success' : 'error');
    if (result.ok) {
      await refreshLibrary();
      openDetail(gameId);
    }
  } catch (err) {
    toast(`Errore: ${err}`, 'error');
  }
}

async function onLaunch(gameId) {
  toast('Avvio in VR…');
  try {
    const report = await window.vrhub.launch(gameId);
    toast(report.success ? 'Gioco avviato.' : `Avvio non riuscito: ${report.error}`, report.success ? 'success' : 'error');
  } catch (err) {
    toast(`Errore avvio: ${err}`, 'error');
  }
}

async function onRestore(gameId) {
  try {
    const result = await window.vrhub.restoreGame(gameId);
    toast(result.message, result.ok ? 'success' : 'error');
    if (result.ok) {
      await refreshLibrary();
      openDetail(gameId);
    }
  } catch (err) {
    toast(`Errore: ${err}`, 'error');
  }
}

async function onRemove(gameId) {
  await window.vrhub.removeGame(gameId);
  closeOverlay(els.detailOverlay);
  await refreshLibrary();
  toast('Rimosso dalla libreria (il gioco resta installato sul disco).', 'success');
}

async function onDiagnostics(gameId) {
  const data = await window.vrhub.readDiagnostics(gameId);
  const lines = (data.logs || []).slice(-30);
  const providerLines = data.providerLogs
    ? data.providerLogs.entries.map((e) => `${e.exists ? '✔' : '✘'} ${e.path}`)
    : [];
  const slot = document.getElementById('plan-box-slot');
  if (slot) {
    slot.innerHTML = `
      <div class="plan-box">
        <strong>DIAGNOSTICA VR</strong>
        <div style="margin-top:8px;color:var(--text-dim)">File attesi:</div>
        <ul>${providerLines.map((l) => `<li>${escapeHtml(l)}</li>`).join('') || '<li>nessuno</li>'}</ul>
        <div style="margin-top:8px;color:var(--text-dim)">Ultime righe di log:</div>
        <ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('') || '<li>nessun log</li>'}</ul>
      </div>
    `;
  }
}

async function openSettings() {
  const settings = await window.vrhub.getSettings();
  els.settingsContent.innerHTML = `
    <div class="form-row">
      <label>Percorso Steam</label>
      <input type="text" id="set-steamPath" value="${escapeHtml(settings.steamPath ?? '')}" placeholder="C:\\Program Files (x86)\\Steam" />
    </div>
    <div class="form-row">
      <label>Cartella cache</label>
      <input type="text" id="set-cacheDir" value="${escapeHtml(settings.cacheDir)}" />
    </div>
    <div class="form-row">
      <label>Cartella backup</label>
      <input type="text" id="set-backupDir" value="${escapeHtml(settings.backupDir)}" />
    </div>
    <div class="form-row">
      <label>Runtime preferito</label>
      <select id="set-preferredRuntime">
        <option value="openxr" ${settings.preferredRuntime === 'openxr' ? 'selected' : ''}>OpenXR</option>
        <option value="openvr" ${settings.preferredRuntime === 'openvr' ? 'selected' : ''}>OpenVR / SteamVR</option>
      </select>
    </div>
    <div class="form-row">
      <label>Metodo Quest preferito</label>
      <select id="set-questMethod">
        <option value="quest_link" ${settings.questMethod === 'quest_link' ? 'selected' : ''}>Quest Link</option>
        <option value="air_link" ${settings.questMethod === 'air_link' ? 'selected' : ''}>Air Link</option>
        <option value="virtual_desktop" ${settings.questMethod === 'virtual_desktop' ? 'selected' : ''}>Virtual Desktop</option>
      </select>
    </div>
    <label class="checkbox-row"><input type="checkbox" id="set-autoUpdateDatabase" ${
      settings.autoUpdateDatabase ? 'checked' : ''
    } /> Aggiorna automaticamente il database</label>
    <label class="checkbox-row"><input type="checkbox" id="set-autoUpdateMods" ${
      settings.autoUpdateMods ? 'checked' : ''
    } /> Aggiorna automaticamente le mod VR</label>
    <label class="checkbox-row"><input type="checkbox" id="set-debugMode" ${
      settings.debugMode ? 'checked' : ''
    } /> Modalità debug (log più dettagliati)</label>
    <button class="btn btn-primary" id="save-settings-btn">Salva</button>
  `;

  document.getElementById('save-settings-btn').addEventListener('click', async () => {
    const partial = {
      steamPath: valueOrNull('set-steamPath'),
      cacheDir: document.getElementById('set-cacheDir').value,
      backupDir: document.getElementById('set-backupDir').value,
      preferredRuntime: document.getElementById('set-preferredRuntime').value,
      questMethod: document.getElementById('set-questMethod').value,
      autoUpdateDatabase: document.getElementById('set-autoUpdateDatabase').checked,
      autoUpdateMods: document.getElementById('set-autoUpdateMods').checked,
      debugMode: document.getElementById('set-debugMode').checked
    };
    await window.vrhub.updateSettings(partial);
    toast('Impostazioni salvate.', 'success');
    closeOverlay(els.settingsOverlay);
  });

  showOverlay(els.settingsOverlay);
}

function valueOrNull(id) {
  const v = document.getElementById(id).value.trim();
  return v.length > 0 ? v : null;
}

function showOverlay(el) {
  el.hidden = false;
}
function closeOverlay(el) {
  el.hidden = true;
}

function toast(message, kind) {
  const el = document.createElement('div');
  el.className = `toast${kind ? ` ${kind}` : ''}`;
  el.textContent = message;
  els.toastContainer.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
