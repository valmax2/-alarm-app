# Comic Studio — ComfyUI Comic Book Creator

Applicazione web statica (HTML/CSS/JS vanilla, nessuna build richiesta) per creare
fumetti generando le immagini tramite una istanza locale di [ComfyUI](https://github.com/comfyanonymous/ComfyUI).

Vive in questa cartella come modulo indipendente rispetto all'app Flutter della
sveglia contenuta nel resto del repository.

## Moduli

- **Connessione** — configura protocollo/IP/porta/credenziali della tua istanza
  ComfyUI locale, con test di connessione (`/system_stats`). I dati restano solo
  in `localStorage` del browser.
- **Workflow** — carica uno o più workflow ComfyUI esportati in *formato API*
  (Menu ComfyUI → "Save (API Format)"), selezionane uno come attivo e mappa
  quali nodi ricevono prompt positivo, prompt negativo, immagine di riferimento
  e seed.
- **Personaggi** — carica, rinomina ed elimina immagini di riferimento dei
  personaggi, riutilizzabili come reference image nella generazione.
- **Prompt** — scrivi la scena in italiano, traducila e ottimizzala in inglese
  (tag comma-separated + booster di qualità) con un click; copia rapida degli
  output con un pulsante dedicato. La traduzione usa l'API pubblica MyMemory
  con fallback automatico a un dizionario locale se non c'è accesso a
  Internet.
- **Director's Mode** — usa la webcam per provare angolazioni di camera,
  illuminazione, inquadratura e composizione (con griglia dei terzi), cattura
  scatti da salvare come riferimento personaggio, e applica le direttive
  scelte al prompt generato.
- **Archivio** — galleria delle immagini generate, con toggle indipendenti per
  privacy e attivazione nel progetto, download e cancellazione.

## Uso

Serve semplicemente da servire come sito statico, es.:

```bash
cd comic_comfyui_web
python3 -m http.server 8000
```

poi apri `http://localhost:8000`. Le immagini/workflow/personaggi vengono
salvati in IndexedDB nel browser; nulla viene inviato altrove tranne le
chiamate esplicite verso l'istanza ComfyUI configurata e (per la traduzione)
verso l'API pubblica MyMemory.

## Note tecniche

- Nessuna dipendenza esterna: solo ES modules nativi del browser.
- Persistenza locale: IndexedDB per workflow/personaggi/immagini,
  `localStorage` per le impostazioni di connessione.
- La comunicazione con ComfyUI usa le API REST standard: `/system_stats`,
  `/upload/image`, `/prompt`, `/history/{id}`, `/view`.
