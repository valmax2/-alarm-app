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

## Come funziona la pipeline

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

Tutti e 5 i nodi fanno parte di questo pacchetto (`comfyui_vr_passthrough`)
e non dipendono da altre estensioni ComfyUI di terze parti: niente rischio
di incompatibilità quando altre estensioni aggiornano i loro nodi.

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

## Parametri principali (tuning)

| Nodo | Parametro | Effetto |
|---|---|---|
| Stima Profondità | `model_size` | Small = più veloce, Large = mappe di profondità più precise ma più lento/pesante |
| Coppia Stereo L/R | `max_shift_percent` | Intensità dell'effetto 3D (disparità massima, in % della larghezza del frame). **Tieni bassi valori (1–2%)**: valori alti creano un effetto 3D esagerato e possono causare fastidio/nausea, specialmente in passthrough dove il cervello confronta il video con l'ambiente reale attorno |
| Coppia Stereo L/R | `invert_depth` | Se l'effetto 3D ti sembra "al contrario" (gli oggetti vicini sembrano sprofondare invece di uscire verso di te), attiva questa opzione |
| Combina Side-by-Side | `eye_width` | Risoluzione per singolo occhio (l'output finale sarà larga il doppio). 1920 è un buon compromesso qualità/peso file per Quest 3 |
| Salva Video SBS | `crf` | Qualità di compressione H.264: più basso = qualità migliore ma file più grande (18 è visivamente quasi lossless, 23 è lo standard "buona qualità") |

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

## Struttura dei file in questo progetto

```
ComfyUI-VR-Quest3-Passthrough/
├── README.md                                   ← questo file
├── custom_nodes/comfyui_vr_passthrough/         ← i nodi ComfyUI da installare
│   ├── __init__.py
│   ├── nodes.py
│   └── requirements.txt
└── workflows/
    └── 2d_to_sbs_quest3_passthrough.json        ← il workflow da caricare in ComfyUI
```
