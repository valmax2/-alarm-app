# TEST_REPORT.md

Ultima esecuzione: 2026-09-10, ambiente Linux (sandbox di sviluppo), Node.js 22.

```
Test Files  14 passed (14)
     Tests  73 passed (73)
```

## Copertura per area (spec §69: test minimi richiesti)

| Area | File di test | Cosa verifica |
|---|---|---|
| Parser Steam VDF/ACF | `tests/vdf.test.ts` | parsing di `libraryfolders.vdf`/`appmanifest_*.acf`, escape, nodi vuoti, commenti |
| Scanner Steam | `tests/steamScanner.test.ts` | librerie multiple, deduplica appId, manifest corrotti, `isFullyInstalled` |
| Scanner Non-Steam | `tests/exeScanner.test.ts` | esclusione cartelle redist, penalità EXE non validi, scelta motivata dell'EXE principale (mai "il primo trovato") |
| Rilevamento motore | `tests/engineDetector.test.ts` | UE5 (.uproject), Unity (UnityPlayer.dll + Assembly-CSharp), id Tech (.pk3), RE Engine (re_chunk), livelli di confidenza |
| Database locale | `tests/localDatabase.test.ts` | CRUD libreria, persistenza tra riavvii, file corrotto non blocca l'app, merge profilo/override |
| Catalogo | `tests/catalogLoader.test.ts` | caricamento catalogo reale spedito con l'app, matching per AppID/titolo/alias |
| Sicurezza | `tests/pathSafety.test.ts`, `tests/hash.test.ts` | path traversal/"zip slip", sha256 di stringhe e file |
| Backup + manifest | `tests/backupManagerAndManifest.test.ts` | ciclo completo backup → modifica → ripristino, errore esplicito se il backup manca |
| Provider UEVR | `tests/uevrProvider.test.ts` | detect/compatibilità, dry-run senza scrittura, install/validate/update/uninstall reali su filesystem temporaneo |
| Provider registry | incluso in `uevrProvider.test.ts` | selezione del provider giusto in base al motore |
| Launch planner | `tests/launchPlanner.test.ts` | costruzione piano da profilo, errori se manca l'eseguibile, iniezione con delay/target |
| Launcher | `tests/launcher.test.ts` | esecuzione ordinata prelaunch → gioco → iniezione → postlaunch con un process runner finto; errori gestiti senza crash |
| Logger | `tests/loggerAndSettings.test.ts` | filtro per livello, rotazione file, lettura ultime righe |
| Settings | `tests/loggerAndSettings.test.ts` | default, update parziale, recupero da file corrotto |
| Integrazione libreria | `tests/libraryService.test.ts` | flusso completo aggiungi Non-Steam → risolvi profilo → simula → configura → valida → costruisci piano di lancio → ripristina; rimozione dalla libreria senza toccare il disco; matching automatico con catalogo (DOOM) |

## Cosa NON è (e non può essere) verificato in questa sandbox

- **Compilazione/esecuzione reale dell'app Electron** (nessun ambiente
  desktop/Windows qui): verificata dalla pipeline GitHub Actions
  `build_vrhubpersonal_windows.yml` su `windows-latest`, che ricompila e
  rilancia l'intera suite di test anche lì.
- **Iniezione UEVR reale** su un gioco vero, **rilevamento Quest via ADB**,
  **download reali**: richiedono rispettivamente Windows + gioco installato +
  UEVR, un dispositivo Quest via USB, e accesso a fonti remote reali. Non
  implementati/testabili in questa fase (vedi `KNOWN_ISSUES.md`).

## Come rieseguire

```bash
cd VR-HUB-PERSONAL
npm install
npm test
npx tsc -p tsconfig.json --noEmit
```
