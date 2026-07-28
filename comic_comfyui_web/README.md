# Comic Studio — ComfyUI Comic Book Creator

Applicazione web statica (HTML/CSS/JS vanilla, nessuna build richiesta) per creare
fumetti generando le immagini tramite una istanza locale di [ComfyUI](https://github.com/comfyanonymous/ComfyUI).

Vive in questa cartella come modulo indipendente rispetto all'app Flutter della
sveglia contenuta nel resto del repository.

## Moduli

- **Modalità di generazione** — selettore in alto: **ComfyUI locale** o **IA
  Esterna**. Pensato per usare l'app anche da telefono, fuori casa: costruisci
  scena, personaggio, camera e luci e genera con un'IA cloud, poi rifinisci in
  locale su ComfyUI quando torni a casa.
- **Connessione ComfyUI** — configura protocollo/IP/porta/credenziali della tua
  istanza ComfyUI locale, con test di connessione (`/system_stats`). I dati
  restano solo in `localStorage` del browser.
- **IA Esterne** — chiavi API per Google Gemini, OpenAI (ChatGPT/DALL·E) e
  Leonardo.ai, con selezione del provider attivo. Le chiamate partono
  direttamente dal browser verso l'API ufficiale del provider scelto; le
  chiavi restano solo in `localStorage`. Gemini e OpenAI supportano
  l'immagine di riferimento del personaggio, Leonardo.ai per ora solo
  testo → immagine. Meta AI non è incluso: non ha un'API pubblica per
  generazione immagini richiamabile da terze parti.
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
chiamate esplicite verso l'istanza ComfyUI configurata, verso il provider IA
esterno scelto (se in modalità "IA Esterna") e (per la traduzione) verso
l'API pubblica MyMemory.

### Uso da telefono / fuori casa (GitHub Pages)

Il repository include `.github/workflows/deploy_comic_studio_pages.yml`, che
pubblica automaticamente questa cartella su GitHub Pages a ogni push. Per
attivarlo (una tantum, da fare manualmente su github.com, richiede permessi
di amministrazione sul repository):

1. Rendi pubblico il repository (Settings → General → Danger Zone → Change
   visibility), oppure usa GitHub Pages su un piano che supporta repo privati.
2. Settings → Pages → "Build and deployment" → Source = **GitHub Actions**.
3. Al successivo push il workflow pubblica il sito su
   `https://<utente>.github.io/<repo>/`.

In modalità "IA Esterna" da remoto funziona tutto (le chiamate vanno dirette
al provider cloud); la modalità "ComfyUI locale" richiede invece che il
telefono/browser possa raggiungere l'IP del PC con ComfyUI in esecuzione
(stessa rete locale, oppure VPN/tunnel).

## Note tecniche

- Nessuna dipendenza esterna: solo ES modules nativi del browser.
- Persistenza locale: IndexedDB per workflow/personaggi/immagini,
  `localStorage` per le impostazioni di connessione e le chiavi dei provider
  IA esterni.
- La comunicazione con ComfyUI usa le API REST standard: `/system_stats`,
  `/upload/image`, `/prompt`, `/history/{id}`, `/view`.
- Provider esterni: Gemini (`generativelanguage.googleapis.com`), OpenAI
  (`api.openai.com/v1/images/...`), Leonardo.ai
  (`cloud.leonardo.ai/api/rest/v1/generations`).
