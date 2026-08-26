# PROMPT STUDIO — BACKUP V1.0

Documento di backup dettagliato. Obiettivo: permettere a una nuova sessione
(umana o IA) di ricostruire il progetto e capire tutte le decisioni prese,
senza dover rileggere l'intero codice riga per riga.

## 1. Cos'è

App web (funziona da PC, tablet, telefono Android — browser) chiamata
"Prompt Studio". Tre moduli separati:

1. **Crea personaggio / prompt** — percorso guidato a 8 step, puramente
   creativo, zero concetti tecnici ComfyUI.
2. **ComfyUI Studio** — gestione tecnica separata: Bridge locale, inventario
   modelli/nodi, libreria workflow, editor workflow, generazione.
3. **Genera con IA esterne** — prepara lo stesso progetto (testo + foto di
   riferimento) per ChatGPT, Gemini, Meta AI. Nessuna integrazione API
   inventata: solo copia testo + link alla piattaforma ufficiale.

Principio guida: CREO → VEDO IL PROMPT FINALE → SCELGO DOVE INVIARLO →
(solo se ComfyUI) CONFIGURO IL WORKFLOW → GENERO.

## 2. Stack tecnico e perché

- **HTML/CSS/JS vanilla con ES modules**, nessun build step. Scelto per:
  zero dipendenze da installare, funziona aprendo con un server statico
  qualsiasi, facile da ispezionare/modificare, portabile su PC/tablet/
  telefono via browser.
- **Routing**: hash-based (`#/home`, `#/builder/<step 1-8>`, `#/comfy[/<sub>]`,
  `#/ai`, `#/gallery[/<sub>]`). Dà back-button gratis, utile su mobile.
- **Persistenza**:
  - `localStorage` (prefisso `promptstudio:`) per dati leggeri: progetto in
    corso, personaggi, progetti salvati, config del Bridge, inventario
    manuale, workflow attivo.
  - `IndexedDB` (database `prompt-studio`, store `images`) per i BLOB delle
    immagini (foto di riferimento, reference pack, immagini generate) — il
    limite ~5MB di `localStorage` non basterebbe per le foto.
- **Bridge locale**: `bridge/bridge_server.py`, Python 3 **solo libreria
  standard** (nessun pip install richiesto) — scelto per abbassare al
  minimo l'attrito di setup su Windows (AVVIA_BRIDGE.bat cerca `python`/`py`
  nel PATH e basta). Espone una REST API minimale su
  `http://127.0.0.1:8765`.

## 3. Modello dati (state.js)

Un solo "progetto in corso" alla volta (`js/state.js`), con pub-sub per
aggiornare la UI reattivamente. Struttura (`blankProject()`):

```
{
  id, name, createdAt, updatedAt,
  persona: 'donna' | 'uomo' | null,
  selections: { body:{}, face:{}, hair:{}, action:{}, pose:{}, scene:{}, camera:{}, light:{} },
    // ogni bucket[categoryId] = [optionId, ...] (multi-select libero, toggle)
  faceMode: 'create' | 'reference' | null,
  referenceImageId: <id IndexedDB> | null,
  identityLock: true/false,
  hairMode: 'keep' | 'change' | null,
  customHair, customAction, customScene: stringhe libere (dettabili),
  negativeText: stringa (parte da defaultNegativePrompt(), editabile),
  positiveManualText: null finché l'utente non modifica a mano il box,
  destination: 'comfyui' | 'chatgpt' | 'gemini' | 'metaai' | null,
  referencePack: [] (riservato — il reference pack "vero" vive sul record
    Personaggio in gallery.js, non sul progetto in corso)
}
```

Il **prompt positivo** è generato da `buildAutoPositivePrompt()`:
`1woman`/`1man` (in base a persona) → frammenti corpo → identity-lock
(se reference+identityLock attivo, altrimenti "inspired by reference
image") oppure frammenti volto (se faceMode create) → capelli
(reference "keep" oppure libreria capelli) + testo libero → azione + testo
libero → posa → scena + testo libero → camera → luce. Ogni categoria
contribuisce le sue `frag` (stringhe inglesi, stile tag SD) nell'ordine.
Se l'utente modifica il box a mano, `positiveManualText` prende il
sopravvento finché non preme "Rigenera dagli step".

Il **prompt negativo** parte da `defaultNegativePrompt()`
(`data/negative.js`) ed è sempre liberamente editabile; i chip della
libreria negativa fanno toggle di frammenti dentro la stringa (case
insensitive, separata da virgole).

## 4. Librerie dati (js/data/*.js)

Ogni file esporta categorie `{id, name, options:[{id,label,frag}]}`:
- `body.js` — corporatura, altezza, torso, vita, fianchi, gambe, braccia,
  pelle, + seno/sedere (donna) o petto/addominali (uomo). Funzione
  `getBodyCategories(persona)` compone l'ordine giusto.
- `face.js` — 11 categorie per "crea il volto" + `buildIdentityLockFragments()`
  per il percorso "foto di riferimento" (Identity Lock).
- `hair.js` — acconciatura, texture, colore, volume, frangia/riga +
  `buildKeepReferenceHairFragment()`.
- `actionsPoses.js` — azione e posa, tenute volutamente separate.
- `scenes.js` — ambiente, interno/esterno, giorno/notte, meteo, stagione,
  atmosfera.
- `cameraLight.js` — inquadratura, punto di vista, zoom/distanza/angolo,
  illuminazione.
- `negative.js` — libreria negativa comune + `defaultNegativePrompt()`.

`label` = italiano mostrato all'utente. `frag` = inglese, va nel prompt
(convenzione standard per prompt Stable-Diffusion-style).

## 5. Modulo 1 — promptBuilder.js

8 step fissi (`STEPS` array), un solo file controller
`js/modules/promptBuilder.js` con una funzione `render*()` per step.
Riusa `components/stepper.js` (accordion di categorie + chip + campo
testo con dettatura) e `components/promptBar.js` (pannello "PROMPT IN
COSTRUZIONE" sempre visibile, sottoscritto allo stato via `subscribe()`).

Decisioni UX:
- Step 1 (persona): selezionare DONNA/UOMO avanza automaticamente allo
  step successivo (unica eccezione all'avanzamento manuale, perché è una
  scelta binaria e decisiva).
- Step 3 (volto): due percorsi. "Foto di riferimento" attiva Identity
  Lock di default (checkbox per disattivarlo) e usa
  `pickImportSource()` + `saveImageBlob()` per caricare la foto.
- Step 4 (capelli): la domanda "mantieni/cambia" appare SOLO se esiste
  una foto di riferimento; altrimenti si va dritti alla libreria.
- Step 8: box positivo/negativo `contenteditable`, pulsanti Copia
  positivo/negativo/tutto, "Rigenera dagli step", libreria negativa come
  chip dentro la card negativa, salvataggio personaggio in archivio, e
  infine la scelta destinazione (ComfyUI / ChatGPT / Gemini / Meta AI).
  Selezionare una destinazione salva uno snapshot del progetto
  (`gallery.saveProjectSnapshot()`) e naviga al modulo giusto — lo stato
  è condiviso (stesso `state.js`), quindi "il trasferimento" a ComfyUI
  Studio è semplicemente che quel modulo legge lo stesso progetto.

## 6. Modulo 2 — ComfyUI Studio

File: `comfyStudio.js` (UI), `comfyBridge.js` (client HTTP verso il
Bridge), `compat.js` (euristica famiglia modello + badge),
`workflowParams.js` (estrazione parametri da workflow in formato API).

Sotto-viste (`#/comfy/<sub>`): `config`, `inventory`, `workflows`,
`editor`, `generate` (default = hub).

### Bridge (bridge/bridge_server.py)

Server HTTP puro standard-library (no Flask) su porta **8765**. Endpoint:

- `GET /health`
- `GET /config`, `POST /config` (comfy_root, personal_root, comfy_api_url)
- `GET /browse?root=comfy|personal&path=` — elenco cartella, mai fuori
  dalla root (vedi `safe_join()`)
- `GET /file?root=&path=` — bytes grezzi di un file (per import universale)
- `GET /inventory`, `POST /inventory/rescan` — scansiona
  `models/{checkpoints,loras,vae,text_encoders,clip,controlnet,
  upscale_models,unet,diffusion_models}` e `custom_nodes` dentro
  `comfy_root`. Per i `.safetensors` legge l'header JSON (8 byte
  little-endian length + JSON, niente librerie esterne) cercando
  `modelspec.architecture` / `ss_base_model_version` / `ss_sd_model_name`
  / `model_type` come indizio di famiglia — solo se presente, mai
  inventato.
- `GET /workflows` — unisce la libreria locale (`bridge/workflow_library/`,
  path `library/...`) con i workflow trovati in
  `user/default/workflows`, `workflows` dentro/accanto a ComfyUI (path
  `comfy/...`, sola lettura).
- `GET /workflow?path=`, `POST /workflow/import`, `DELETE /workflow?path=`
  — la cancellazione è permessa SOLO per `library/...` (mai per file
  dentro l'installazione ComfyUI dell'utente).
- `POST /comfyui/generate` — proxy verso `{comfy_api_url}/prompt`
  (default `http://127.0.0.1:8188`).
- `GET /comfyui/status?prompt_id=` — legge `/history/<id>` di ComfyUI,
  interpreta `completed`/`running`/`queued`/`error`, estrae le immagini.
- `GET /comfyui/image?filename=&subfolder=&type=` — proxy di `/view`.
- `POST /comfyui/input?filename=` — scrive i byte grezzi del body dentro
  `comfy_root/input/<basename sanitizzato>` (usato per "assegna immagine"
  ai nodi Load Image: l'immagine finisce davvero nella cartella input di
  ComfyUI, non solo il nome file).

Sicurezza: `safe_join()` impedisce di uscire dalle root configurate;
nessuna password cloud richiesta; il Bridge non tocca altro sul PC.

### Compatibilità (compat.js)

`detectFamily({name, path, metadata})` riconosce FLUX / SDXL / SD 1.5 /
WAN / Qwen via regex su nome file + metadata `base_model` (se letto dal
Bridge). Se nessun indizio → `{family:'unknown', confidence:'low'}`, MAI
dichiarato compatibile per supposizione. `compareCompatibility(a,b)`
restituisce `green` (stessa famiglia, evidenza alta), `red` (famiglie
diverse rilevate), `yellow` (non determinabile) — badge coerenti nella UI
(`badge-green/red/yellow` in `style.css`).

### Editor workflow (workflowParams.js)

Legge SOLO workflow "formato API" di ComfyUI (mappa piatta
`{nodeId:{class_type, inputs, _meta}}` — quello che ComfyUI produce con
"Save (API Format)" ed è anche quello che `/prompt` accetta). Un workflow
in formato "UI" (`{nodes:[...], links:[...]}`) viene rilevato
(`isApiFormat()`) e segnalato: l'editor visuale si disattiva e resta
disponibile solo l'editor JSON avanzato, con invito a ri-esportare in
formato API. Riconosce: CheckpointLoader*, LoraLoader*, VAELoader*,
CLIPTextEncode (ruolo positivo/negativo dedotto da `_meta.title` o, se
esattamente 2 nodi senza titolo, per ordine), KSampler* (seed/steps/cfg/
denoise/sampler/scheduler), EmptyLatentImage (width/height), LoadImage*.
Editor JSON avanzato sempre presente in coda: vedi/valida/applica/salva.

## 7. Modulo 3 — aiExternal.js

Nessuna integrazione API reale con ChatGPT/Gemini/Meta AI (non esiste/non
autorizzata) — per esplicita indicazione del master prompt. Converte il
prompt a tag in un breve testo naturale italiano
(`toNaturalLanguage()`), offre copia testo / copia anche il prompt
tecnico, mostra ed eventualmente fa scaricare la foto di riferimento con
promemoria di allegarla sulla piattaforma, e apre il sito ufficiale in
una nuova scheda. Pronto per una futura integrazione API (punto di
estensione: sostituire `window.open()` con una chiamata reale quando/se
disponibile).

## 8. Archivio (gallery.js)

- **Personaggi**: `{id, name, persona, mainImageId, mainImageHidden,
  identityFragments, referencePack:[{id,label,imageId,hidden}],
  sourceProjectId}`. Reference Pack con gli 11 slot da spec (volto
  frontale, 3/4 sx/dx, profilo sx/dx, vista posteriore, dall'alto, dal
  basso, close-up volto, mezzo busto, full body) — upload per slot,
  occhio di privacy per slot e per la foto principale, zoom via
  `imageViewer.js`. "Usa in Prompt Builder" ricarica la reference nel
  progetto in corso e salta allo step 8.
- **Progetti salvati**: snapshot completo dello stato (`saveProjectSnapshot()`,
  chiamato automaticamente quando si sceglie una destinazione allo step 8).
  "Apri" ricarica lo snapshot come progetto in corso.
- **Immagini**: vista di tutte le immagini in IndexedDB (reference,
  reference pack, generate...), con eliminazione.
- **Workflow**: rimanda alla libreria di ComfyUI Studio (evita duplicare
  la stessa UI in due posti).

## 9. Componenti condivisi

- `imageViewer.js` — overlay fullscreen con pan (pointer events), pinch-
  to-zoom (2 puntatori), wheel zoom, doppio tap/click per zoomare,
  pulsante "adatta". Usato ovunque si mostri un'immagine ingrandibile.
- `importSource.js` — **import universale**: 3 sorgenti sempre uguali
  (Gestore file/Cloud via `<input type=file>` nativo — su Android questo
  espone Drive/OneDrive/Dropbox ecc. automaticamente, senza mai chiedere
  password; PC — cartella ComfyUI; PC — i miei file, entrambe via Bridge
  con un mini file-browser modale). Usato per foto reference, workflow
  JSON, inventario TXT/JSON.
- `voice.js` — dettatura via Web Speech API (`it-IT`), MAI un assistente
  vocale: solo un pulsante 🎙 che inserisce testo riconosciuto nel campo,
  più 🗑 per svuotare. Disabilitato con messaggio se il browser non
  supporta l'API.
- `promptDialog.js` — sostituti a tema di `window.prompt`/`confirm`.
- `toast.js` — notifiche non bloccanti.

## 10. Design

Tema definito in `css/style.css`: `--bg-elev-1:#241B2F` (viola scuro),
`--gold:#C9A063` (oro caldo), variabili CSS per tutto, dark theme fisso
(l'app è pensata per essere sempre scura, coerente col tema richiesto).
Bottoni grandi (`.big-choice`), categorie richiudibili (`.category`),
step progress a puntini, grid responsive (`auto-fit`/`auto-fill`).

## 11. Limiti noti / prossimi passi (onestamente dichiarati)

- Il Bridge non ha ancora un installer/packaging (richiede Python 3 nel
  PATH sul PC dell'utente — gestito con un messaggio chiaro in
  `AVVIA_BRIDGE.bat` se manca).
- Il rilevamento famiglia modello è euristico (nome file + alcune chiavi
  metadata note): dichiarato esplicitamente come "non determinabile"
  (giallo) quando l'evidenza è insufficiente, mai inventato.
  L'estrazione parametri workflow copre i node type più comuni ma non
  l'intero universo di custom node possibile — l'editor JSON avanzato è
  il fallback universale.
- Le IA esterne non hanno integrazione API reale (nessuna esiste/è
  autorizzata) — per design, non è un bug.
- Le immagini vivono in IndexedDB del browser: non sincronizzate fra
  dispositivi diversi (nessun backend cloud in V1.0). Un futuro
  "esporta/importa tutto l'archivio" sarebbe il prossimo passo naturale
  per portabilità multi-dispositivo.
- Nessun test automatizzato (app senza build step); la verifica è stata
  fatta con controllo di sintassi (`node --check` su ogni file JS) e
  revisione manuale del flusso — vedi `TEST_LOGICO_V1.0.txt`.

## 12. Versioning

Prima release: **V1.0**. Per le prossime, seguire la convenzione
V1.1, V1.2... (o V2.0 per cambi maggiori), mai sovrascrivere una release
stabile. Ad ogni modifica importante: aggiornare questo backup, il test
logico, e — se richiesto — creare uno zip completo del programma.
