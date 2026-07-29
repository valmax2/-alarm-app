# Specifica tecnica completa — "Prompt Director" (Comic Studio)

Istruzioni per chi implementa: costruisci un'app web **statica** (nessun framework, nessun build tool) in **HTML + CSS + JavaScript vanilla con ES modules**, pensata per essere aperta direttamente in un browser (anche da `file://` o da un semplice server statico tipo GitHub Pages). Un solo `index.html`, una cartella `css/` con un file di stile, una cartella `js/` con un modulo per funzionalità. Nessuna chiamata a un backend proprio: l'app parla direttamente, dal browser, con un'istanza locale di ComfyUI e/o con le API pubbliche di provider di IA esterni.

---

## 1. Obiettivo generale

Un'app per creare scene/fumetti con l'IA: l'utente descrive un personaggio e una scena in italiano, imposta camera/luce/composizione con controlli visuali, l'app traduce e ottimizza tutto in un prompt inglese, e lo invia a **ComfyUI locale** (via REST/WebSocket) oppure a un **provider IA esterno** (Google Gemini, OpenAI, Leonardo.ai) per generare l'immagine (o un'animazione/video, se il workflow ComfyUI lo produce).

Requisito chiave: **coerenza del personaggio** tra generazioni diverse, usando fino a 3 immagini di riferimento indipendenti (identità/volto, corpo-costume, posa) invece di una sola foto genericamente riusata.

---

## 2. Persistenza dati (tutto locale nel browser, mai su un server)

- **IndexedDB** (un database, più "store"): workflow ComfyUI caricati (con relativa mappatura nodi), libreria personaggi (immagini), archivio immagini/video generati.
- **localStorage**: impostazioni di connessione ComfyUI (IP/porta/credenziali), chiavi API dei provider esterni, bozza corrente della scena in lavorazione, scene salvate (elenco), modalità di generazione attiva (locale/esterna), provider esterno attivo.
- Nessun dato dell'utente (foto, chiavi, prompt) viene mai inviato altrove tranne: l'istanza ComfyUI configurata dall'utente, l'API del provider esterno scelto, e l'API pubblica di traduzione (vedi punto 8).

---

## 3. Schede/tab dell'interfaccia

Header in alto: selettore di modalità **"ComfyUI locale" / "IA Esterna"**, e un indicatore di stato connessione ComfyUI (pallino colorato + testo).

1. **Connessione ComfyUI** — form con protocollo (http/https), IP, porta, utente/password opzionali (Basic Auth o Bearer token). Pulsante "Testa connessione" che chiama `/system_stats`. Mostra la versione di ComfyUI se raggiungibile.
2. **IA Esterne** — una card per provider (Google Gemini, OpenAI, Leonardo.ai): campo per la chiave API, radio button "Provider attivo". Indicazione se il provider supporta l'immagine di riferimento del personaggio o solo testo→immagine.
3. **Workflow** — upload di uno o più file `.json` di workflow ComfyUI in **formato API** (non il salvataggio normale — validare che sia un oggetto piatto `{ "id_nodo": {class_type, inputs, ...}, ... }` e NON un oggetto con array `nodes`/`links`, altrimenti rifiutare con messaggio chiaro che spiega come esportare in formato API). Lista dei workflow caricati con pulsanti: "Seleziona" (imposta come attivo), "Mappa nodi", "Elimina".
4. **Personaggi** — libreria personaggi: griglia di card, ognuna con immagine principale (corpo/costume), pulsante per caricare/rimuovere una seconda foto opzionale di **identità** (volto), nome (rinominabile), pulsanti "Copia immagine" (negli appunti, per incollarla altrove) e "Scarica", icona 👁️ per nascondere/sfocare la miniatura (privacy sullo schermo), eliminazione.
5. **Crea Scena** — il flusso principale, vedi sezione 9.
6. **Archivio** — galleria di tutto ciò che è stato generato (immagini o video/animazioni, riconosciuti automaticamente dall'estensione/tipo file e mostrati con un player `<video>` invece di `<img>` quando serve), con privacy toggle, toggle "Attiva" (per marcare cosa fa parte del progetto corrente), download con estensione corretta, eliminazione.

---

## 4. Mappatura nodi del workflow (concetto centrale)

I workflow ComfyUI cambiano da modello a modello: nomi dei nodi, `class_type`, e soprattutto **nomi dei campi di input** non sono standard (es. un `CLIPTextEncode` usa il campo `text`, ma nodi come `TextEncodeQwenImageEdit`/`TextEncodeQwenImageEditPlus` usano `prompt`). Quindi: **non assumere mai nomi di campo fissi**. Serve un pannello "Mappa nodi" dove l'utente, per il workflow attivo, associa manualmente:

- **Prompt positivo**: una lista (aggiungibile/rimuovibile) di `{nodeId, field}` — permette di scrivere lo stesso prompt su più nodi encoder contemporaneamente (es. un `CLIPTextEncode` classico + un `TextEncodeQwenImageEditPlus`, ognuno col proprio nome di campo).
- **Prompt negativo**: stessa cosa, lista di `{nodeId, field}`.
- **Seed**: singolo `{nodeId, field}` (default `seed`), valore casuale generato a ogni invio.
- **Risoluzione**: singolo `{nodeId, widthField, heightField}` (default `width`/`height`) — di solito il nodo `EmptyLatentImage` o simili.
- **Numero di frame** (per workflow di animazione/video): singolo `{nodeId, field}` — default `frame_count`, ma per nodi come `WanImageToVideo` il campo reale è `length`, quindi dev'essere modificabile a mano.
- **FPS** (animazione): singolo `{nodeId, field}` — default `frame_rate` (tipico di `VHS_VideoCombine`).
- **Immagini di riferimento**: lista (aggiungibile/rimuovibile) di `{nodeId, field, source, label}` dove:
  - `field` è quasi sempre `image` (il campo standard del nodo `LoadImage` — **non** `image1`/`image2`/`image3`, quelli appartengono a un nodo diverso come `TextEncodeQwenImageEditPlus` che riceve l'immagine tramite collegamento/link dal nodo `LoadImage`, non è un campo che l'app deve toccare direttamente).
  - `source` è uno tra `identity` (volto), `character` (corpo/costume, valore di default per compatibilità), `pose` (posa/composizione, opzionale).
  - `label` è un nome libero opzionale, utile quando si combinano più personaggi diversi nella stessa immagine.

Tutte queste mappature vanno salvate insieme al workflow (in IndexedDB) e riutilizzate ogni volta che quel workflow è attivo.

---

## 5. Selettori "personaggio" dinamici in base al workflow attivo

Nella scheda "Crea Scena", il primo passo genera **un selettore indipendente per ogni voce mappata come immagine di riferimento**:

- Se il workflow attivo non ha nodi immagine mappati (o si è in modalità IA Esterna, che supporta una sola immagine di riferimento): un solo selettore generico "Personaggio di riferimento".
- Altrimenti: un selettore per ogni voce con `source = identity` o `character` (etichettato con il nome scelto + il tipo, es. "Alice — Identità (volto)"), popolato con l'elenco dei personaggi salvati. Le voci con `source = pose` **non** hanno un selettore di personaggio: mostrano invece un messaggio che rimanda a un caricamento immagine separato e opzionale ("Riferimento posa"), perché la posa in genere non appartiene a nessun personaggio specifico salvato — è un'immagine usa e getta per quella scena, che se non viene caricata **non deve generare errori né nomi di file vuoti**: il nodo mappato resta semplicemente non toccato.

Ogni selettore può puntare a un personaggio diverso: questo permette di combinare **più personaggi diversi nella stessa immagine** (fino a quanti nodi LoadImage ha il workflow).

Un riepilogo testuale mostra sempre, prima dell'invio: sorgente → nodo → campo → nome del file che verrà effettivamente usato (o "non impostata" se vuota).

---

## 6. Sistema "Personaggio Coerente" (consistency block)

Un interruttore "Modalità Personaggio Coerente" attiva la generazione automatica di un blocco di testo aggiunto al prompt positivo, che descrive esplicitamente all'IA cosa preservare, **solo per le sorgenti realmente presenti in quella generazione** (mai menzionare un'immagine identità/posa che non è stata caricata):

- Se è presente un'immagine di identità: istruzione di preservare identità facciale esatta, struttura del viso, occhi, capelli, età apparente, carnagione — presa dall'immagine identità.
- Se è presente un'immagine personaggio: istruzione di preservare proporzioni corporee, costume, materiali, simboli, accessori, palette colori — presa dall'immagine personaggio.
- Se è presente un'immagine posa: istruzione di seguire **solo** la posa/composizione di quell'immagine, esplicitamente **senza** copiarne identità, volto o vestiti.
- Frasi aggiuntive di coerenza (facciale, costume) e una frase finale opzionale che libera scena/sfondo/azione/espressione/inquadratura/luce a cambiare come vuole.

Ogni frase è modulata con la sintassi standard di enfasi `(frase:peso)` (supportata dalla maggior parte degli encoder di testo CLIP-based), dove il peso deriva da 6 controlli a slider (0–100%, con default ragionevoli intorno al 70%):
`peso = 0.6 + (valore_slider / 100) × 0.9` → range 0.60–1.50.

I 6 slider: **Forza identità, Forza corpo/costume, Forza posa, Coerenza volto, Coerenza costume, Libertà creativa scenario**.

Un selettore di preset posa/azione (facoltativo, si applica solo se la modalità è attiva) aggiunge un tag descrittivo: Ritratto, Figura intera, Azione, Combattimento, Corsa/salto, Scena cinematografica, oppure nessuno (posa libera dalla descrizione testuale).

---

## 7. Upload immagini a ComfyUI: attenzione alle collisioni

Quando si caricano più immagini di riferimento nella stessa generazione (es. identità + corpo/costume dello stesso personaggio, che sono DUE file diversi), ognuna deve avere un **nome file univoco e distinto** lato ComfyUI (es. `identity-<idpersonaggio>.png` vs `char-<idpersonaggio>.png` vs `pose-reference.png`), altrimenti un caricamento sovrascrive l'altro sul server prima che la generazione parta. Deduplica i caricamenti per non ricaricare due volte lo stesso identico file nella stessa richiesta (es. se due nodi diversi usano lo stesso personaggio+ruolo).

Sanifica sempre il nome file (solo lettere/numeri) prima di caricarlo: nomi con spazi o caratteri speciali hanno causato errori di validazione lato ComfyUI in passato.

---

## 8. Traduzione italiano → inglese e composizione finale del prompt

- Traduzione tramite l'API pubblica gratuita MyMemory (`api.mymemory.translated.net`), con un piccolo dizionario locale di fallback (parole/frasi comuni per personaggi/fumetti) usato se l'API non è raggiungibile.
- Due campi di testo separati in italiano: **descrizione personaggio** (dettagli fisici non necessariamente coperti dalle foto: capelli, occhi, cicatrici, voce...) e **descrizione scena/azione** (cosa sta facendo, dove, espressione). Vengono tradotti separatamente e poi uniti: prima il personaggio, poi la scena.
- Il testo tradotto viene "ottimizzato a tag": spezzato in frasi (su punti/a capo), ricomposto come lista comma-separated (formato tipico richiesto dai modelli di generazione immagini), senza duplicati.
- Prompt positivo finale, in quest'ordine: [descrizione personaggio + scena tradotta e tag-izzata] → stile scelto (fumetto classico / manga / graphic novel / cover americana / nessuno) → tag della camera/regia (vedi punto 10) → tag di qualità selezionati → tag del formato immagine → (se modalità coerente attiva) tag preset posa + blocco di coerenza → booster di qualità fissi finali ("highly detailed, sharp focus, professional illustration, 4k").
- Prompt negativo: base fissa orientata all'anatomia corretta (mani/dita deformate, arti mancanti o extra, proporzioni distorte, viso asimmetrico, teste multiple, collo lungo, testa/fronte/viso tagliati fuori dall'inquadratura, bassa qualità, watermark, testo) + eventuali elementi negativi extra scritti dall'utente in italiano e tradotti. **Nessun** booster di qualità nel negativo.
- Il prompt visualizzato si ricalcola automaticamente (senza richiamare l'API di traduzione) ogni volta che cambia stile, camera, tag di qualità, formato o impostazioni di coerenza — riusando l'ultimo testo tradotto.

---

## 9. "Regia" / Director's Mode — camera, luce, composizione

Tre diagrammi 2D interattivi (non usano la fotocamera del dispositivo, sono diagrammi disegnati su `<canvas>`, trascinabili col dito/mouse):

1. **Vista dall'alto**: un'icona che rappresenta la camera si trascina intorno a una sagoma centrale (il personaggio), lungo un cerchio, per scegliere l'angolo orizzontale (frontale / laterale / da dietro / diagonali intermedie). Trascinando l'icona anche radialmente (più vicino/lontano dal centro) si controlla anche lo zoom, sincronizzato col diagramma di inquadratura (punto 3).
2. **Vista laterale**: controlla l'altezza della camera (dal basso verso l'alto, a livello occhi, dall'alto).
3. **Inquadratura/zoom**: una linea trascinabile sopra una sagoma umana stilizzata mostra visivamente cosa resta dentro/fuori dall'inquadratura, da un primissimo piano sul viso fino alla figura intera — sincronizzata con lo zoom del primo diagramma (stessa scala convertita).

Più due select: **illuminazione** (naturale morbida, controluce drammatico, controluce cinematografico, neon/cyberpunk, ora dorata al tramonto, faretto da studio) e **composizione** (regola dei terzi, simmetrica centrale, diagonale dinamica, spazio negativo).

Un riquadro "Anteprima scena" traduce sempre in italiano leggibile cosa è impostato in quel momento (es. "Vista: laterale destra", "Zoom: primo piano"). Un pulsante "Applica alla scena" trasforma le scelte correnti in tag inglesi e li inserisce nel prompt.

**Importante**: le scelte di camera/luce/composizione sono **un valore alla volta per categoria**, non si accumulano mai (cambiare l'angolo sostituisce il tag precedente, non lo aggiunge) — altrimenti i tag vecchi restano nel prompt e degradano la generazione (es. causando inquadrature sbagliate/testa tagliata).

---

## 10. Formato immagine, qualità, animazione

- **Formato immagine**: select con opzioni 1:1, 16:9, 9:16, 4:3, 3:4, 21:9 (più "automatico" = nessuna modifica). Ogni opzione ha sia un tag testuale da aggiungere al prompt, sia una risoluzione reale in pixel (preferibilmente valori standard "bucket" da ~1 megapixel, es. 1024×1024, 1344×768, 768×1344, 1152×896, 896×1152, 1536×640) da scrivere nel nodo "Risoluzione" mappato, se presente.
- **Tag di qualità**: checkbox multiple (selezionabili insieme) — alta risoluzione, fotorealistico, ultra dettagliato, cinematografico, 8K, HDR — ognuna aggiunge una frase tag specifica.
- **Animazione**: campi numerici "Numero di frame" e "FPS" (entrambi opzionali, si applicano solo se il workflow ha i relativi nodi mappati), con calcolo automatico e visualizzato della durata stimata in secondi (frame ÷ fps).

---

## 11. Invio a ComfyUI e gestione del risultato

- Endpoint REST usati: `/system_stats` (test connessione), `/upload/image` (upload immagini, multipart/form-data, **senza** impostare l'header `Content-Type: application/json` sulla richiesta `/prompt` — impostarlo forza una preflight CORS OPTIONS che ComfyUI di default non gestisce con gli header giusti, causando un falso "errore di rete"; lasciare che il browser mandi `text/plain` di default, ComfyUI interpreta comunque il body come JSON), `/prompt` (POST, invia il grafo con i valori sostituiti), `/history/{prompt_id}` (polling per sapere quando la generazione è completata), `/view` (scarica il file risultato).
- WebSocket opzionale `/ws?clientId=...` per il progresso live durante la generazione — se non disponibile o silenzioso, non deve bloccare nulla: il completamento si rileva comunque via polling su `/history`. Il campo `prompt_id` nei messaggi di progresso potrebbe non essere presente in alcune versioni di ComfyUI: non scartare l'evento solo per questo.
- Timeout generoso per la generazione (10–20 minuti), perché workflow complessi (upscaling, animazione) possono richiedere molto tempo. Mostrare sempre un indicatore di tempo trascorso, anche senza percentuale precisa, così l'attesa non sembra bloccata.
- Il risultato può arrivare sotto chiavi diverse nell'output del nodo finale: `images` (immagini statiche), ma anche `gifs` (usata da `VHS_VideoCombine` anche per file mp4/webm, per motivi storici del nodo) o `videos` — vanno controllate tutte.
- Il file scaricato va salvato in Archivio con il **nome/estensione reale** restituiti da ComfyUI (non assumere sempre `.png`): serve per capire se è un video (mostrarlo con un player `<video>`) o un'immagine (`<img>`), e per scaricarlo con l'estensione corretta.

---

## 12. Modalità "IA Esterna"

Chiamate dirette dal browser alle API pubbliche di:
- **Google Gemini** (`generativelanguage.googleapis.com`, generazione immagine con `responseModalities: ["IMAGE"]`), supporta immagine di riferimento.
- **OpenAI** (`api.openai.com/v1/images/generations` o `/edits`), supporta immagine di riferimento (endpoint edits).
- **Leonardo.ai** (`cloud.leonardo.ai/api/rest/v1/generations`, generazione asincrona con polling), solo testo→immagine per ora.

Se l'utente non ha una chiave API ma vuole comunque usare ChatGPT/Gemini "a mano" dal sito web (es. con un abbonamento consumer, non API), un pulsante copia il prompt negli appunti **e** apre direttamente il sito del provider scelto in una nuova scheda; un pulsante separato nella libreria personaggi copia l'immagine del personaggio negli appunti (convertita in PNG), da incollare manualmente nella chat.

---

## 13. Scene salvate

Un pulsante "Salva scena" registra uno snapshot completo della configurazione corrente (testo personaggio e scena in italiano, stile, formato, tag qualità, frame/fps, personaggi selezionati per ogni slot, stato completo di camera/luce/composizione, impostazioni modalità coerente e slider) — **non** l'immagine generata — con un nome scelto dall'utente. Un elenco permette di ricaricare una scena salvata per rigenerarla o modificarla.

---

## 14. Cose da NON fare (bug già risolti in passato, da non reintrodurre)

- Non impostare `Content-Type: application/json` sulla richiesta `/prompt` (causa un falso errore CORS).
- Non accettare workflow non in formato API (con array `nodes`/`links`): validare e rifiutare con messaggio chiaro.
- Non assumere che il campo dei nodi encoder di testo si chiami sempre `text` (può essere `prompt` o altro): sempre configurabile.
- Non assumere che il campo delle immagini di riferimento sia `image1`/`image2`/`image3`: quello è tipico di nodi come `TextEncodeQwenImageEditPlus`, che riceve l'immagine per collegamento da un nodo `LoadImage` separato — è il campo `image` del `LoadImage` che va impostato.
- Non lasciare che le impostazioni di camera/luce/composizione si accumulino invece di sostituirsi.
- Non caricare due immagini diverse (es. identità e corpo/costume dello stesso personaggio) con lo stesso nome file — si sovrascrivono a vicenda lato server.
- Non mandare mai un nome file vuoto per un'immagine di riferimento opzionale (es. posa) non caricata: semplicemente non impostare quel campo.
- Non assumere che il risultato della generazione sia sempre sotto la chiave `images`: controllare anche `gifs`/`videos`.
- Non forzare sempre l'estensione `.png` in download/anteprima: usare l'estensione reale del file restituito da ComfyUI.

---

Fine specifica. Chi implementa può procedere modulo per modulo (connessione → workflow/mappatura → personaggi → regia → generazione → archivio), testando ogni parte prima di passare alla successiva.

---

## 15. Smart Replacement Dictionary — implementato in V1.0

L'app include un sistema attivabile “Safe Prompt Optimization” che applica sostituzioni intelligenti prima della traduzione, senza distinzione tra maiuscole e minuscole e dando priorità alle frasi più lunghe. Le sostituzioni sono mostrate all'utente nel relativo rapporto. Il dizionario è disponibile anche nel file `smart-replacements.json`.
