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
- **Crea Scena** — il flusso principale, tutto su una sola schermata in
  passaggi numerati, senza dover saltare tra schede:
  1. **Personaggio** — scegli il personaggio di riferimento (preselezionato
     automaticamente l'ultimo caricato).
  2. **Scena** — scrivi la descrizione in italiano (anche a voce, con il
     pulsante microfono 🎤), stile e negativi extra.
  3. **Regia (camera)** — tre diagrammi trascinabili (non usa la fotocamera
     del telefono): vista dall'alto (davanti/lato/dietro + zoom, trascinando
     la 📷 anche più vicina/lontana dal personaggio), vista laterale (altezza
     camera), e zoom/inquadratura con anteprima live (una linea trascinabile
     su una sagoma mostra esattamente cosa resta dentro/fuori, dal viso alla
     figura intera) — sincronizzata con lo zoom del primo diagramma. Un
     riquadro "Anteprima scena" riepiloga sempre in italiano cosa hai
     impostato. "Applica alla scena" la aggiunge al prompt.
  4. **Traduci** — traduce e ottimizza in inglese (tag comma-separated +
     booster di qualità); include sempre un prompt negativo anatomico di
     base. Copia rapida degli output con un pulsante dedicato.
  5. **Genera** — invia a ComfyUI o all'IA esterna scelta (in alto), con
     link diretto all'Archivio a fine generazione.

  Tutto (testo, stile, personaggio, impostazioni di regia) resta salvato
  anche cambiando scheda o chiudendo il browser, e il prompt si aggiorna da
  solo se modifichi la regia dopo aver tradotto. Se preferisci generare a
  mano su ChatGPT/Gemini (es. con un abbonamento Plus) c'è un pulsante che
  copia il prompt e apre direttamente il sito dell'IA scelta; l'immagine del
  personaggio si copia a parte dalla scheda Personaggi.
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
