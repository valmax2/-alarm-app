# CHANGELOG

## 0.1.0 — 2026-09-10 (Fase 1: base funzionante)

Prima versione utilizzabile di VR HUB PERSONAL.

### Aggiunto

- Parser VDF/ACF e scanner Steam (`libraryfolders.vdf`, `appmanifest_*.acf`),
  con deduplica tra librerie multiple e controllo "fully installed".
- Scanner Non-Steam con scoring degli EXE candidati (penalità per crash
  reporter/uninstaller/prerequisiti, bonus per posizione e somiglianza al nome
  della cartella) ed euristica di rilevamento motore grafico (Unreal 4/5,
  Unity, Source/Source 2, id Tech, RE Engine, CryEngine) con livello di
  confidenza esplicito.
- Modello dati `GameProfile`/`LibraryGame` e database locale JSON versionato,
  con separazione tra profilo di catalogo e override utente (un update del
  catalogo non cancella mai le scelte dell'utente).
- Catalogo Flat-to-VR seed con 5 titoli (BioShock 2, Quake, Quake II, DOOM,
  Hogwarts Legacy) e matching per Steam App ID / titolo+alias / nome EXE.
- Sistema di provider VR (`VRProvider`) e primo provider reale: `UevrProvider`
  (piano di installazione dry-run, installazione con backup automatico,
  manifest di installazione, validazione, rollback, log diagnostici).
- Launch planner e launcher (prelaunch → avvio gioco → attesa+iniezione →
  postlaunch), con process runner sostituibile per i test.
- Backup manager, manifest di installazione e rollback ("RIPRISTINA GIOCO").
- Modulo di sicurezza: protezione path traversal/"zip slip", hash SHA-256.
- Logger rotante e settings store persistente.
- App Electron completa: main process, preload con `contextBridge`, canali
  IPC, e UI renderer in stile libreria (sezioni STEAM/NON-STEAM, card, badge
  di stato, scheda dettaglio, pannello impostazioni), tema scuro viola/ciano.
- Pipeline GitHub Actions che builda l'installer Windows su `windows-latest`
  ed esegue l'intera suite di test.
- Documentazione: `AUDIT_ORIGINALE.md`, `ARCHITETTURA_VR_HUB_PERSONAL.md`,
  `README.md`, `KNOWN_ISSUES.md`, `TEST_REPORT.md`.

### Limiti noti

Vedi `KNOWN_ISSUES.md`.
