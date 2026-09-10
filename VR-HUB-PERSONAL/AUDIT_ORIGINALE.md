# AUDIT_ORIGINALE.md — VR HUB PERSONAL

Data audit: 2026-09-10

## 1. Cosa è stato verificato online

Il documento di specifica cita **"MRSURVIV0RS VR HUB"** come riferimento tecnico di partenza. Ricerca web effettuata:

- **MrSurviv0r VR HUB** (autore: MrSurviv0r, distribuito via `mrsurvivor-installers.com` e annunci su X/Twitter) è un launcher che raggruppa più mod Flat-to-VR (es. Atomic Heart, Silent Hill 2 Remake) con setup guidato, rilevamento gioco e disinstallazione mod completa.
  - **Non è open source**: nessun repository pubblico trovato. È distribuito come installer binario chiuso.
  - **Conseguenza**: nessun codice di MrSurviv0r VR HUB è stato o può essere riutilizzato in questo progetto (non disponibile, quindi non "legalmente riutilizzabile" per assenza di licenza pubblica). Viene usato **solo come riferimento concettuale di UX** (un hub unico, per-game, con injection automatica), non come base tecnica.
- **praydog/UEVR** (https://github.com/praydog/UEVR): il vero motore di iniezione VR per giochi Unreal Engine 4/5, open source (licenza permissiva), è il target reale di integrazione come "provider" per la maggior parte dei titoli UE. Espone un frontend/injector, profili condivisibili (zip di config), `config.json` per-processo.
- **oduis/UEVRDeluxe** (https://github.com/oduis/UEVRDeluxe): frontend alternativo a UEVR, open source, con auto-scan di librerie Steam/Epic/GOG e sostituzione del launcher — concettualmente il progetto più simile a VR HUB PERSONAL trovato online. Usato come riferimento di design (non copiato: licenza e codice non importati), in particolare per l'idea di "provider auto-scan + profilo condiviso".
- **Mr-Nlce/PCVR-Mods-Installer-Hub**: installer batch-based per mod PCVR con Steam detection — riferimento minore, stesso discorso (nessun import di codice).

**Conclusione audit**: non esiste codice originale riutilizzabile lecitamente nel repository corrente né online per la parte "hub/launcher". Il progetto viene quindi costruito da zero, usando **UEVR** come runtime esterno da orchestrare (non da includere/redistribuire) e **UEVRDeluxe** solo come riferimento di flusso UX.

## 2. Stato del repository `valmax2/-alarm-app` prima di questa modifica

Il repository non contiene alcun progetto Windows/VR preesistente. Contiene tre app Android native (Kotlin + Gradle: FaceGuard, FortKnoxVault, VoiceCloneStudio) più un progetto Flutter root (`alarm_app`) con CI Android via GitHub Actions (build APK → `docs/downloads/`).

- **Framework/tecnologia disponibile in sandbox**: Node.js 22 + npm, Python 3, Java + Gradle. **Nessun Flutter/Dart SDK, nessun .NET SDK** installati in questo ambiente di sviluppo remoto.
- **Nessun modulo riutilizzabile** dalle altre app (sono tutte app mobile Android, senza logica di scansione filesystem Windows, parsing Steam, o gestione processi desktop).

## 3. Decisione tecnica

Perché serve un'app **desktop Windows** con build automatica via GitHub Actions e che sia anche verificabile/testabile qui in sandbox Linux (senza Windows/Flutter disponibili):

| Opzione | Pro | Contro | Scelta |
|---|---|---|---|
| Flutter Desktop (Windows) | UI dichiarativa pulita | SDK Flutter non disponibile in sandbox → zero verifica locale, solo "a scatola chiusa" | ❌ |
| .NET/WPF/WinUI | Nativo Windows, buona integrazione Steam/ADB | .NET SDK non disponibile in sandbox, nessun modo di eseguire test qui | ❌ |
| **Electron + TypeScript** | Node/npm già presenti → logica di business (parsing Steam, scanner, DB, backup, manifest) **scrivibile e testabile realmente qui** con Vitest; build reale `.exe` delegata a GitHub Actions `windows-latest` con `electron-builder` | Peso runtime maggiore di un'app nativa | ✅ **Scelta** |

Questa scelta rispetta la regola §2 della specifica ("non riscrivere senza analisi, non dichiarare funzionante senza testare"): la logica core viene scritta come moduli TypeScript puri, senza dipendenze da Electron, **testati con test automatici reali eseguiti in questa sessione**. Solo l'involucro (finestra, IPC, dialog di selezione cartella, spawn di processi) usa le API Electron/Node e viene validato tramite compilazione TypeScript + il primo run reale della pipeline CI su `windows-latest`.

## 4. Rischi identificati

- Impossibilità di testare qui l'iniezione UEVR reale, il rilevamento ADB/Quest reale, o l'avvio di un vero gioco Steam: questi moduli sono scritti con interfacce chiare (provider pattern) e **piani di lancio (dry-run)** verificabili, ma l'esecuzione reale richiede Windows + hardware reali (Quest, gioco installato) — da validare dall'utente sulla sua macchina.
- `electron-builder` genera l'installer solo su CI Windows: il primo run reale della pipeline è la prova che il progetto compila per Windows.

## 5. Piano di lavoro (Fase 1 di questa sessione)

Implementare la "FASE 1 — BASE FUNZIONANTE" della specifica (§74):
Steam scanner, Non-Steam scanner con folder picker e scoring EXE, card libreria, database locale JSON versionato, profilo VR, provider UEVR (plan/install/launch), backup manager con manifest e rollback, log, UI Steam-like.
