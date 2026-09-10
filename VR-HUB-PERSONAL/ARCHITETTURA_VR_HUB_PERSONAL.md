# ARCHITETTURA_VR_HUB_PERSONAL.md

## 1. Stack

- **Electron** (main + renderer) — app desktop Windows, packaged con `electron-builder` (target `nsis`, x64).
- **TypeScript** per tutta la logica core (process Node "main"), nessuna dipendenza nativa compilata (per build CI semplice e riproducibile su `windows-latest`).
- **Storage**: JSON strutturato versionato su disco (niente SQLite nativo → evita problemi di build cross-platform dei moduli nativi in CI). Vedi §16 della specifica: opzione "JSON strutturati versionati" scelta esplicitamente per questo motivo.
- **Renderer**: HTML/CSS/TS vanilla (no framework pesante), tema scuro "libreria Steam" con palette propria (viola/ciano) diversa da Steam ma stile simile: griglia di card, sidebar filtri, barra ricerca.
- **Test**: Vitest sui moduli core (`src/main/core/**`), eseguibili in sandbox Linux senza Electron.

## 2. Struttura cartelle

```
VR-HUB-PERSONAL/
  package.json
  tsconfig.json
  electron-builder.yml
  vitest.config.ts
  src/
    main/
      index.ts                 entry Electron (crea finestra, avvia IPC)
      ipc.ts                   handler IPC main<->renderer
      core/
        model/
          gameProfile.ts        schema TS del profilo gioco/VR (spec §15)
          types.ts
        steam/
          vdf.ts                 parser VDF (libraryfolders.vdf, appmanifest_*.acf)
          steamScanner.ts        orchestratore scansione librerie Steam
        nonsteam/
          exeScanner.ts          scansione cartella + scoring EXE candidati
          engineDetector.ts      heuristics motore grafico (UE4/5, Unity, Source, ...)
        database/
          localDatabase.ts       CRUD giochi/profili, JSON versionato, merge override utente
          catalogLoader.ts       carica catalogo Flat-to-VR (database/catalog.json)
        providers/
          provider.ts            interfaccia VRProvider comune (spec §92)
          uevrProvider.ts        implementazione UEVR (plan/install/launch/validate)
          providerRegistry.ts
        launch/
          launchPlanner.ts        costruisce il "launch plan" (spec §93)
          launcher.ts              esegue il piano (spawn processi) — Windows-only in runtime
        backup/
          backupManager.ts        backup file prima di modifica, restore
        manifest/
          installManifest.ts      manifest di installazione per rollback/uninstall
        security/
          pathSafety.ts            protezione path traversal (zip slip), validazione percorsi
          hash.ts                  sha256 file/stringa
        diagnostics/
          logger.ts                logger rotante INFO/WARN/ERROR/DEBUG
        settings/
          settingsStore.ts         impostazioni app (percorsi, auto-update, lingua)
    preload/
      preload.ts                 contextBridge, API sicura esposta al renderer
    renderer/
      index.html
      styles.css
      app.ts                     stato UI, routing semplice (Home/Dettaglio/Impostazioni)
      views/
        home.ts
        gameDetail.ts
        settings.ts
        addNonSteam.ts
  tests/
    vdf.test.ts
    exeScanner.test.ts
    engineDetector.test.ts
    localDatabase.test.ts
    installManifest.test.ts
    backupManager.test.ts
    pathSafety.test.ts
    launchPlanner.test.ts
    hash.test.ts
    fixtures/
      libraryfolders.vdf
      steamapps/appmanifest_620.acf
  database/
    catalog.json                 catalogo Flat-to-VR seed (Fase 1: BioShock 2, Quake, Quake II, Doom)
  profiles/
    examples/*.json
  .github/workflows/
    build_vrhubpersonal_windows.yml
  README.md
  CHANGELOG.md
  KNOWN_ISSUES.md
  TEST_REPORT.md
```

## 3. Flusso dati principale

1. All'avvio: `localDatabase` carica `userdata/games.json` + `userdata/profiles/*.json` (se assenti, li crea) e il catalogo (`database/catalog.json`). UI mostrata subito (spec §17: non bloccare).
2. In background (non implementato in Fase 1 il fetch remoto reale — stub con interfaccia pronta): confronto versione manifest remoto vs locale.
3. `steamScanner` legge `libraryfolders.vdf` + `appmanifest_*.acf` → lista giochi Steam con AppID, titolo, path.
4. Utente aggiunge gioco Non-Steam → `exeScanner` analizza la cartella, assegna punteggio agli EXE candidati, `engineDetector` cerca segnali di motore.
5. Matching con `catalogLoader` (per titolo/alias/AppID) → stato "Confermato/Probabile/Sconosciuto" (spec §51).
6. Ogni gioco ha un `GameProfile` (persistito in `localDatabase`) con sezione VR (provider, runtime, controller, stato).
7. "Configura VR" → `providerRegistry` seleziona il provider (Fase 1: solo `UEVRProvider`) → `plan_install()` produce un piano human-readable (spec §56/§70 dry-run) → utente confirma → `install()` (backup via `backupManager`, scrittura `installManifest`).
8. "Avvia in VR" → `launchPlanner.build()` produce un `LaunchPlan` (spec §93) → `launcher.run()` lo esegue (prelaunch, avvio EXE, attesa processo, injection, postlaunch), loggando tutto via `logger`.
9. "Ripristina gioco" → legge `installManifest`, richiama `backupManager.restore()`.

## 4. Perché è modulare (spec §11/§42)

Nessuna logica hardcoded in un solo file: ogni provider implementa `VRProvider` (§92); aggiungere REFramework/SourceVR/QuestPort in futuro significa solo aggiungere un file in `providers/` e registrarlo, senza toccare UI o database.

## 5. Cosa NON è incluso in questa Fase 1 (onestà sui limiti)

- Download reale di mod/patch da fonti remote (rete non disponibile/verificabile in sandbox) → l'interfaccia `download()` esiste ma è uno stub che va collegato a fonti reali (GitHub release ufficiali) in Fase 2.
- ADB/Quest (Fase 3 della specifica) → non incluso in questa iterazione.
- SteamGridDB/cover remote (Fase 2).
- Iniezione UEVR realmente testata (richiede Windows + gioco installato + UEVR installato): il piano di lancio è generato e loggato correttamente, l'esecuzione va validata dall'utente sulla propria macchina.
