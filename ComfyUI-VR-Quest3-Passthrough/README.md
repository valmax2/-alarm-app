# ComfyUI → Video 3D Side-by-Side per Meta Quest 3 (Passthrough)

Flusso ComfyUI che prende un **video 2D piatto** (mono, girato con telefono,
action cam, webcam, ecc.) e lo converte in un **video stereoscopico
Side-by-Side (SBS)**, pronto da guardare su **Meta Quest 3** in modalità
passthrough/mixed reality tramite un player VR di terze parti (es. **SKYBOX
VR**, **DeoVR**, **Pigasus**), che mostrano il video "fluttuante" nel tuo
ambiente reale ripreso dalle telecamere del visore.

> ⚠️ **Nota importante sul termine "passthrough"**: il Quest 3 non ha una
> funzione nativa che converte *automaticamente* qualsiasi video in 3D
> passthrough. Quello che questo flusso fa è generare un video **stereo 3D
> SBS**, che poi guardi con un player VR che sa mostrare i pannelli video
> mentre resti in passthrough (vedi la tua stanza reale attorno allo
> schermo). La conversione 2D→3D è **sintetica** (stimata da un modello di
> profondità), non una vera ripresa stereo: la qualità dipende da quanto
> bene il modello stima la profondità della scena.

## Due flussi disponibili

### 1) Video 3D Side-by-Side (schermo con profondità)

```
VRP_LoadVideo
     │  (frame RGB)
     ▼
VRP_EstimateDepth  (Depth Anything V2 - stima di profondità monoculare)
     │  (mappa di profondità, normalizzata su tutta la clip)
     ▼
VRP_DepthToStereoPair  (genera occhio sinistro e destro sintetici)
     │
     ▼
VRP_SideBySideCombine  (affianca L e R in un unico frame)
     │
     ▼
VRP_SaveVideoSBS  (scrive l'mp4 finale, rimuxa l'audio originale)
```
Workflow: `workflows/2d_to_sbs_quest3_passthrough.json`

### 2) Persona ritagliata senza sfondo ("effetto ologramma nella stanza")

```
VRP_LoadVideo
     │
     ▼
VRP_RemoveBackground  (Robust Video Matting - rimuove lo sfondo, lo
     │                  sostituisce con un verde chroma-key puro)
     ▼
VRP_SaveVideoSBS  (scrive l'mp4 finale, rimuxa l'audio originale)
```
Workflow: `workflows/video_cutout_chromakey_quest3.json`

Il video risultante ha la persona ritagliata su sfondo verde puro. Va
guardato con un player che sa **rimuovere il verde a runtime in
passthrough** (vedi sezione dedicata più sotto): a quel punto la persona
sembra fluttuare nella tua stanza reale, senza il rettangolo nero dietro.
È un **ritaglio piatto** ("cartone"/cardboard cutout): ottimo
frontalmente, ma non ha volume reale se ti sposti molto di lato — vedi
il flusso 3 per aggiungere un po' di profondità reale al ritaglio.

### 3) Persona ritagliata **+ profondità 3D** (cutout meno "piatto")

```
VRP_LoadVideo
     │
     ▼
VRP_RemoveBackground   (ritaglio su sfondo verde chroma-key)
     │
     ▼
VRP_EstimateDepth      (profondità stimata sulla persona ritagliata)
     │
     ▼
VRP_DepthToStereoPair  (genera L/R con un po' di "pop" 3D)
     │
     ▼
VRP_SideBySideCombine
     │
     ▼
VRP_SaveVideoSBS
```
Workflow: `workflows/cutout_stereo_3d_quest3.json`

Combina i due effetti: la persona è ritagliata (niente rettangolo/sfondo)
**e** ha una minima profondità reale (es. la chitarra leggermente più
avanti del busto), invece di essere un piano completamente piatto.
Funziona bene perché lo sfondo, dopo il ritaglio, è un **verde uniforme**:
anche se il warp stereo lo deforma leggermente, resta verde e non produce
artefatti visibili — la deformazione "si vede" solo sulla persona, dove
ha senso. Per guardarlo ti serve un player che supporti **contemporaneamente**
SBS 3D e chroma-key passthrough (HereSphere lo fa: proiezione SBS +
sfondo passthrough con chroma key, entrambi nelle impostazioni video del
file). In questo workflow `max_shift_percent` parte più basso (1.0 invece
di 1.5) per restare prudenti sui bordi del ritaglio; puoi alzarlo se il
risultato ti sembra troppo piatto.

Tutti i nodi fanno parte di questo pacchetto (`comfyui_vr_passthrough`) e
non dipendono da altre estensioni ComfyUI di terze parti: niente rischio
di incompatibilità quando altre estensioni aggiornano i loro nodi (fa
eccezione `VRP_RemoveBackground`, che al primo utilizzo scarica in
automatico codice e pesi del modello Robust Video Matting da GitHub
tramite `torch.hub` — serve una connessione a internet solo la prima
volta).

## Installazione

1. Copia la cartella `custom_nodes/comfyui_vr_passthrough` dentro la
   cartella `custom_nodes/` della tua installazione di ComfyUI:

   ```bash
   cp -r ComfyUI-VR-Quest3-Passthrough/custom_nodes/comfyui_vr_passthrough \
         /percorso/della/tua/ComfyUI/custom_nodes/
   ```

2. Installa le dipendenze Python nello stesso ambiente/venv che usa
   ComfyUI:

   ```bash
   cd /percorso/della/tua/ComfyUI
   ./venv/bin/pip install -r custom_nodes/comfyui_vr_passthrough/requirements.txt
   ```

   (`torch`/`numpy` sono quasi certamente già presenti: l'installer li
   salterà se già soddisfatti.)

3. Riavvia ComfyUI. Nel menu "Add Node" dovresti vedere una nuova
   categoria **"VR Passthrough"** con 5 nodi.

4. La prima volta che esegui `VRP_EstimateDepth`, `transformers` scaricherà
   automaticamente il modello **Depth Anything V2** da Hugging Face
   (richiede connessione a internet la prima volta; poi resta in cache
   locale).

## Uso

1. Apri ComfyUI e carica il workflow:
   `workflows/2d_to_sbs_quest3_passthrough.json` (menu **Load**, oppure
   trascina il file nella finestra di ComfyUI).
2. Nel nodo **"Carica Video"** imposta `video_path` con il percorso
   completo del tuo file video sorgente.
3. Nel nodo **"Salva Video SBS"**:
   - imposta `fps` allo stesso frame rate del video sorgente (lo vedi
     nelle proprietà del file, o collega manualmente l'uscita `fps` del
     nodo "Carica Video" trascinandola sul campo `fps": ComfyUI la
     convertirà automaticamente in un ingresso collegato);
   - `filename_prefix` è il nome base del file di output.
4. Premi **Queue Prompt**. Il file finale verrà salvato nella cartella
   `output/` di ComfyUI con un nome tipo
   `quest3_passthrough_00001_LR.mp4`.

Il suffisso **`_LR`** non è decorativo: è la convenzione di nome file che
molti player VR (SKYBOX VR, DeoVR, Pigasus) riconoscono automaticamente
come "video stereo Side-by-Side completo" senza doverlo impostare a mano.

## Guardarlo sul Quest 3

1. Copia l'mp4 risultante sul visore (via cavo/ADB, Meta Quest app,
   Google Drive, o un server locale) oppure tienilo su un PC e usa lo
   streaming da un'app come SKYBOX/DeoVR.
2. Apri **SKYBOX VR**, **DeoVR** o **Pigasus** sul Quest 3.
3. Seleziona il file: se il player non lo riconosce da solo come SBS
   (grazie al suffisso `_LR`), seleziona manualmente il formato
   **"Side-by-Side" / "3D SBS"** nel menu del player.
4. Usa la modalità **passthrough / cinema in mixed reality** dell'app (il
   nome esatto dell'opzione varia da app ad app, es. "MR Cinema",
   "Passthrough mode") per vedere lo schermo del video fluttuare nella tua
   stanza reale, mantenendo la profondità 3D generata.

## Guardare il video "ritagliato" (chroma-key) sul Quest 3

A differenza del video 3D SBS, questo file va aperto con un player che
supporti la rimozione del verde **in modalità passthrough**:

- **HereSphere** — nelle impostazioni video avanzate imposta lo sfondo su
  "Passthrough" e attiva/regola il "chroma key" con l'icona a ingranaggio
  vicino all'opzione mask.
- **PLAY'A VR Video Player** — stessa idea, opzione dedicata alla rimozione
  del verde per i video in passthrough.
- **DeoVR** — supporta il passthrough AR con più modalità (tra cui "alpha
  packing"); per il chroma-key semplice generato da questo workflow usa la
  modalità passthrough classica del player.

Passaggi tipici:
1. Copia l'mp4 generato (con suffisso di default `quest3_cutout_...mp4`) sul
   visore, o mettilo in streaming da PC.
2. Apri l'app scelta, carica il file.
3. Attiva la modalità passthrough e il chroma-key/green-screen removal
   nelle impostazioni video di quel file.
4. Posiziona/scala il pannello dove vuoi che "stia" la persona nella tua
   stanza.

## Parametri principali (tuning)

| Nodo | Parametro | Effetto |
|---|---|---|
| Stima Profondità | `model_size` | Small = più veloce, Large = mappe di profondità più precise ma più lento/pesante |
| Coppia Stereo L/R | `max_shift_percent` | Intensità dell'effetto 3D (disparità massima, in % della larghezza del frame). **Tieni bassi valori (1–2%)**: valori alti creano un effetto 3D esagerato e possono causare fastidio/nausea, specialmente in passthrough dove il cervello confronta il video con l'ambiente reale attorno |
| Coppia Stereo L/R | `invert_depth` | Se l'effetto 3D ti sembra "al contrario" (gli oggetti vicini sembrano sprofondare invece di uscire verso di te), attiva questa opzione |
| Combina Side-by-Side | `eye_width` | Risoluzione per singolo occhio (l'output finale sarà larga il doppio). 1920 è un buon compromesso qualità/peso file per Quest 3 |
| Salva Video SBS | `crf` | Qualità di compressione H.264: più basso = qualità migliore ma file più grande (18 è visivamente quasi lossless, 23 è lo standard "buona qualità") |
| Rimuovi Sfondo (Cutout) | `model_variant` | `mobilenetv3` = veloce, buono per la maggior parte dei casi; `resnet50` = più lento ma ritaglia meglio bordi difficili (capelli, dita) |
| Rimuovi Sfondo (Cutout) | `chroma_color` | Verde di default (standard chroma-key); passa a blu solo se il soggetto indossa qualcosa di verde acceso (altrimenti il player rimuoverebbe anche quello) |
| Rimuovi Sfondo (Cutout) | `downsample_ratio` | Risoluzione interna usata dal modello per calcolare la maschera: più bassa = più veloce ma bordi meno precisi. 0.25 è il default consigliato dagli autori per video HD |

## Limiti e cose da sapere

- La profondità è **stimata da un solo modello monoculare**, non misurata:
  su scene complesse (vetri, riflessi, capelli, oggetti molto vicini alla
  camera) può sbagliare e creare artefatti da "warping" (leggere
  distorsioni sui bordi degli oggetti).
- Il warp usato è una **DIBR semplificata** (senza vero inpainting dei
  buchi di disocclusione): ai bordi delle zone con forti differenze di
  profondità può comparire un leggero "stiramento" invece di un vero
  riempimento — accettabile per una visione comoda con `max_shift_percent`
  basso, più visibile se lo alzi troppo.
- Video molto lunghi possono richiedere parecchia VRAM/tempo per la stima
  di profondità: usa `max_frames` e `skip_first_frames` nel nodo "Carica
  Video" per processare la clip a spezzoni, poi unisci i pezzi con
  ffmpeg (`concat`).
- Questo flusso non genera video **360°** o **VR180** nativi: è pensato
  per contenuto "quasi piatto" (inquadratura fissa/action cam), non per
  filmati già ripresi con camere 360.
- Il flusso "ritaglio/cutout" produce un **piano piatto**, non un vero
  ologramma volumetrico: da davanti fermo l'illusione è convincente, ma
  spostandoti molto di lato noti che non ha profondità reale (non puoi
  girargli intorno). Un vero effetto "walk-around" richiederebbe una
  ripresa multi-camera o un rig di volumetric capture professionale
  (es. Depthkit/Metastage), non ottenibile da un singolo video normale.
- `VRP_RemoveBackground` funziona meglio su una **persona ben illuminata,
  con sfondo relativamente statico**; capelli mossi, motion blur forte o
  più persone sovrapposte possono creare bordi imprecisi.

## Struttura dei file in questo progetto

```
ComfyUI-VR-Quest3-Passthrough/
├── README.md                                   ← questo file
├── custom_nodes/comfyui_vr_passthrough/         ← i nodi ComfyUI da installare
│   ├── __init__.py
│   ├── nodes.py
│   └── requirements.txt
└── workflows/
    ├── 2d_to_sbs_quest3_passthrough.json        ← flusso 1: video 3D SBS
    ├── video_cutout_chromakey_quest3.json       ← flusso 2: persona ritagliata (cutout piatto)
    └── cutout_stereo_3d_quest3.json             ← flusso 3: cutout + profondità 3D
```
