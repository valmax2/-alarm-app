# Prompt Studio — V1.0

App web (PC / tablet / telefono) per creare personaggi e prompt per immagini
con un percorso guidato, gestire ComfyUI separatamente (workflow, modelli,
LoRA, nodi, immagini) tramite un Bridge locale, e preparare lo stesso
progetto per IA esterne (ChatGPT, Gemini, Meta AI).

Vedi il master prompt originale in `docs/BACKUP_V1.0.md` per la specifica
completa e le decisioni di progetto.

## Come si avvia

Nessuna build necessaria: è HTML/CSS/JS puro (ES modules).

1. Apri `PromptStudio/index.html` con un piccolo server statico (i moduli ES
   richiedono `http://`, non `file://`). Ad esempio, da questa cartella:

   ```
   npx serve .
   # oppure
   python3 -m http.server 8080
   ```

   e apri `http://localhost:8080` (o la porta indicata) nel browser.

2. Per usare ComfyUI Studio, avvia anche il Bridge locale sul PC dove gira
   ComfyUI: vedi `bridge/LEGGIMI.txt`.

## Struttura

```
PromptStudio/
  index.html            shell dell'app + router
  css/style.css          tema (viola scuro + oro caldo)
  js/
    main.js               router hash-based (#/home, #/builder/N, #/comfy, #/ai, #/gallery)
    state.js               stato del progetto in corso + motore di assemblaggio prompt
    storage.js              localStorage (dati leggeri) + IndexedDB (immagini)
    data/                   librerie di caratteristiche (corpo, volto, capelli, azione/posa, scena, camera/luce, negativo)
    components/             pezzi riusabili (stepper, prompt bar, dettatura, image viewer, import universale, dialog)
    modules/
      home.js                 Home — 3 grandi pulsanti
      promptBuilder.js         Modulo 1 — Crea personaggio / prompt (8 step)
      comfyStudio.js           Modulo 2 — ComfyUI Studio
      comfyBridge.js           client HTTP verso il Bridge locale
      compat.js                 rilevamento famiglia modello + badge compatibilità
      workflowParams.js         estrazione parametri da un workflow (formato API)
      aiExternal.js             Modulo 3 — Genera con IA esterne
      gallery.js                 Archivio: personaggi, reference pack, progetti, immagini
  bridge/
    bridge_server.py        server locale (solo libreria standard Python)
    AVVIA_BRIDGE.bat         avvio su Windows
    LEGGIMI.txt               istruzioni
    requirements.txt         (nessuna dipendenza esterna)
  docs/
    BACKUP_V1.0.md          backup dettagliato per ricostruire il progetto
    TEST_LOGICO_V1.0.txt      test logico simulato
```

## Principio guida

Prima **CREO** (Modulo 1, senza concetti tecnici ComfyUI) → poi **VEDO IL
PROMPT FINALE** → poi **SCELGO DOVE INVIARLO** → solo se scelgo ComfyUI
**CONFIGURO IL WORKFLOW** (Modulo 2) → infine **GENERO**.
