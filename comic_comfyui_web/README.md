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
- **Personaggi** — il tuo archivio personaggi: carica immagini dalla galleria
  o scattale direttamente con la fotocamera del telefono, rinominale ed
  eliminale. Sono riutilizzabili come immagine di riferimento nella
  generazione per mantenere lo stesso aspetto del personaggio. Ogni miniatura
  ha un'icona 👁️ per nasconderla/sfocarla (privacy sullo schermo).
- **Prompt** — scrivi la scena in italiano (anche a voce, con il pulsante
  microfono 🎤 di dettatura), traducila e ottimizzala in inglese (tag
  comma-separated + booster di qualità) con un click; copia rapida degli
  output con un pulsante dedicato. Seleziona un personaggio di riferimento
  (viene preselezionato automaticamente l'ultimo caricato) per mantenerne la
  coerenza nell'immagine generata. Testo, stile e personaggio scelto restano
  salvati anche cambiando scheda o chiudendo il browser. La traduzione usa
  l'API pubblica MyMemory con fallback automatico a un dizionario locale se
  non c'è accesso a Internet.
- **Director's Mode** — tre diagrammi trascinabili (non usa la fotocamera del
  telefono): uno visto dall'alto per scegliere se inquadrare il personaggio
  da davanti/di lato/da dietro (la freccia verde indica dove guarda), uno
  laterale per l'altezza della camera (dall'alto/a livello occhi/dal basso), e
  uno di zoom/inquadratura con anteprima live (una linea trascinabile su una
  sagoma del personaggio mostra esattamente cosa resta dentro/fuori
  inquadratura, dal viso alla figura intera). Insieme a illuminazione e
  composizione, il tutto si applica al prompt con un click. Tutte le
  impostazioni restano salvate anche cambiando scheda o chiudendo il browser.
- **Archivio** — galleria delle immagini generate, con icona 👁️ per
  nascondere/sfocare una miniatura (privacy) e toggle "Attiva" per includerla
  nel progetto corrente; download e cancellazione.

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
