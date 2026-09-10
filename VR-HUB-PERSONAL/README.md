# VR HUB PERSONAL

Libreria personale **Flat-to-VR**: rileva i tuoi giochi Steam e Non-Steam, ne
riconosce il motore grafico, ti propone (e opzionalmente installa) la
soluzione VR compatibile, e li avvia con un solo pulsante — **AVVIA IN VR**.

Nome provvisorio (spec §117), in attesa di un nome definitivo.

> Vedi `AUDIT_ORIGINALE.md` per l'analisi che ha preceduto questa implementazione
> e `ARCHITETTURA_VR_HUB_PERSONAL.md` per i dettagli tecnici. Questa è la
> **Fase 1 ("BASE FUNZIONANTE")** della roadmap descritta nella specifica
> completa fornita dall'utente: le fasi successive (auto-update reale da
> fonti remote, catalogo estso, Quest/ADB) sono descritte in `KNOWN_ISSUES.md`.

## Cosa fa oggi (Fase 1)

- **Steam**: legge `libraryfolders.vdf` e gli `appmanifest_*.acf` per rilevare
  automaticamente i giochi Steam installati (nessuna aggiunta manuale richiesta).
- **Non-Steam**: l'utente sceglie una cartella, l'app scansiona gli `.exe`
  presenti e propone quello più probabile come eseguibile principale (con un
  punteggio motivato, non "il primo trovato").
- **Motore grafico**: rilevamento euristico (Unreal 4/5, Unity, Source/Source 2,
  id Tech, RE Engine, CryEngine), sempre etichettato come Confermato/Probabile/Sconosciuto.
- **Catalogo Flat-to-VR**: un piccolo database locale (`database/catalog.json`)
  con alcuni titoli noti (BioShock 2, Quake, Quake II, DOOM, Hogwarts Legacy)
  usato per il matching automatico gioco → profilo VR.
- **Profilo VR per gioco**: motore, provider, runtime, controller, impostazioni
  consigliate (Motion Blur OFF, Frame Generation OFF, TAA configurabile),
  con override utente che sopravvive a un aggiornamento del catalogo.
- **Provider UEVR**: per giochi Unreal Engine, prepara il `config.json` UEVR
  (percorso `Engine/Binaries/Win64/uevr/config.json`), con backup automatico
  del file precedente e manifest per il rollback.
- **"SIMULA INSTALLAZIONE"**: mostra cosa farebbe "Configura VR" senza scrivere nulla.
- **"CONFIGURA VR" / "AVVIA IN VR"**: installazione reale (con backup) e piano
  di lancio (prelaunch → avvio gioco → iniezione se prevista → postlaunch).
- **"RIPRISTINA GIOCO" / "RIMUOVI DALLA LIBRERIA"**: rollback tramite manifest
  di installazione; la rimozione dalla libreria non tocca il gioco su disco.
- **Impostazioni**: percorso Steam, cartelle cache/backup, runtime preferito,
  metodo Quest preferito, auto-update database/mod, modalità debug.

## Cosa NON fa ancora (onestà sui limiti, vedi `KNOWN_ISSUES.md`)

Download reale di mod da fonti remote, cover da SteamGridDB, ADB/Quest
standalone: sono Fase 2/3 della specifica originale e non sono incluse qui.

## Requisiti

- Windows 10/11 a 64 bit (target di produzione).
- Node.js 20+ per sviluppare/compilare.

## Sviluppo

```bash
cd VR-HUB-PERSONAL
npm install
npm test          # esegue tutti i test della logica core (Vitest)
npm run build      # compila TypeScript (main/preload) + copia il renderer
npm start           # compila e avvia l'app Electron (richiede un ambiente desktop)
npm run dist:win   # compila l'installer Windows (electron-builder) — va eseguito su/per Windows
```

La build reale dell'installer Windows viene verificata automaticamente su
GitHub Actions (`.github/workflows/build_vrhubpersonal_windows.yml`, runner
`windows-latest`), perché l'ambiente di sviluppo usato per scrivere questo
codice è Linux e non può compilare né eseguire l'app Electron per Windows.

## Struttura

Vedi `ARCHITETTURA_VR_HUB_PERSONAL.md` per la struttura completa delle cartelle
e il flusso dati. In breve: `src/main/core/` contiene tutta la logica testabile
(scanner, database, provider, backup, manifest, sicurezza), senza dipendenze da
Electron; `src/main/index.ts` + `src/main/ipc.ts` + `src/preload/` cablano
questa logica a una finestra Electron; `src/renderer/` è la UI (HTML/CSS/JS
semplice, senza framework).

## Provider VR supportati oggi

- **UEVR** (Unreal Engine 4/5): unico provider implementato in Fase 1.
- **native**: placeholder per mod native (es. BioShock 2, Quake/Quake II, DOOM
  nel catalogo seed) — il profilo lo segnala, ma l'installazione automatica
  per questo provider non è ancora implementata (richiede integrazione con le
  singole mod, ognuna diversa): l'app mostrerà i passaggi manuali necessari.

Aggiungere un nuovo provider (REFramework, SourceVR, port Quest) significa
implementare l'interfaccia `VRProvider` (`src/main/core/providers/provider.ts`)
in un nuovo file e registrarlo in `src/main/core/appServices.ts`, senza
toccare UI o database.
