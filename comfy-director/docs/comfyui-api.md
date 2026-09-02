# COME INTERROGHIAMO COMFYUI — riferimento API del Bridge

Questo documento elenca le API HTTP/WebSocket **reali e pubbliche** di ComfyUI che il
`comfy_client` usa, con le note di robustezza necessarie perché ComfyUI è un progetto in
evoluzione continua e alcune risposte differiscono tra versioni/fork.

**Principio guida (regola 2 e 3 della spec):** il Bridge non hardcoda mai parametri di
nodo che ComfyUI può fornire dinamicamente, e non inventa compatibilità. Ogni chiamata
qui sotto è quindi trattata come **fonte di verità runtime**, non come contratto fisso —
il client deve tollerare campi mancanti/aggiuntivi e degradare a `unknown` piuttosto che
assumere.

## Base URL
Configurabile (`comfy_instances.base_url`), tipicamente `http://127.0.0.1:8188`. Nessun
default hardcoded nel codice applicativo oltre al valore precompilato nel form
impostazioni (che resta comunque modificabile).

## Endpoint usati

### `GET /system_stats`
Usato per: verificare raggiungibilità, leggere versione ComfyUI e info sistema (VRAM,
device) quando disponibili.
Risposta tipica (può variare per versione):
```json
{
  "system": {"os": "...", "comfyui_version": "...", "python_version": "...", "pytorch_version": "..."},
  "devices": [{"name": "...", "type": "cuda", "vram_total": 0, "vram_free": 0}]
}
```
Il client legge `system.comfyui_version` se presente, altrimenti riporta versione
`sconosciuta` — mai un numero placeholder.

### `GET /object_info`
Usato per: inventario nodi (Fase 2) — restituisce **tutti** i nodi registrati (core +
custom) con il loro schema input/output completo. È la fonte primaria per i widget
dinamici (§11) e per riconoscere i custom node installati.
Struttura per ciascuna chiave (class_type):
```json
{
  "<ClassType>": {
    "input": {
      "required": {"<param>": ["<TYPE>", {"default": ..., "min": ..., "max": ..., "step": ...}]},
      "optional": {"...": ["..."]}
    },
    "output": ["<TYPE>", "..."],
    "output_name": ["...", "..."],
    "category": "...",
    "display_name": "..."
  }
}
```
`<TYPE>` può essere un tipo scalare (`INT`, `FLOAT`, `STRING`, `BOOLEAN`, `IMAGE`,
`MODEL`, `CLIP`, `VAE`, `CONDITIONING`, `LATENT`, ...) oppure una **lista di stringhe**
(enum, tipicamente per selezionare un file — es. i checkpoint disponibili: ComfyUI stesso
espone così la lista dei file trovati nelle sue cartelle configurate, il che è la fonte
più affidabile per popolare i picker MODEL/FILE senza scansionare noi stessi il
filesystem quando non necessario).

### `GET /object_info/{class_type}`
Stessa struttura sopra ma per un solo nodo — usato per refresh mirato (es. dopo che
l'utente installa un nuovo custom node e richiede risync di un singolo tipo).

### `GET /queue`
Stato coda corrente (`queue_running`, `queue_pending`), ciascun elemento con
`[number, prompt_id, prompt, extra_data, outputs_to_execute]`.

### `GET /history` e `GET /history/{prompt_id}`
Storico esecuzioni con outputs prodotti (nomi file, subfolder, type) per prompt_id.
Usato per recuperare gli output di un job dopo il completamento (in alternativa/aggiunta
agli eventi WS).

### `POST /prompt`
Invia un job. Payload:
```json
{"prompt": { "<node_id>": {"class_type": "...", "inputs": {...}}, ... }, "client_id": "..."}
```
Risposta: `{"prompt_id": "...", "number": N, "node_errors": {...}}`. `node_errors` non
vuoto indica errori di validazione lato ComfyUI (es. input mancante) — il Bridge li
traduce in messaggi azionabili per il validatore (§26), non li ignora.

### `POST /interrupt`
Interrompe l'esecuzione corrente (ABORT, §18). Nessun payload richiesto in genere.
Alcune versioni supportano `POST /interrupt` con `{"prompt_id": "..."}` per targeting più
preciso: il client tenta prima la forma con `prompt_id` e fa fallback alla forma senza
payload se il server risponde errore — documentato come comportamento tollerante, non
un'assunzione silenziosa di compatibilità.

### `GET /view?filename=...&subfolder=...&type=...`
Scarica un'immagine/video di output. `type` è tipicamente `output`, `input` o `temp`.

### `POST /upload/image`
Upload di un'immagine di input (es. reference per Coerenza Personaggio, Image-to-Image)
— multipart/form-data.

### `WS /ws?clientId=<uuid>`
Canale eventi realtime. Eventi osservati (il client li tratta come union discriminata su
`type`, ignora tipi sconosciuti senza fallire — ComfyUI aggiunge eventi nel tempo):
- `status` — stato coda aggiornato
- `execution_start` — inizio esecuzione di un prompt_id
- `executing` — nodo `node_id` in esecuzione (o `node_id: null` = esecuzione terminata)
- `progress` — `{value, max}` per step di sampling in corso
- `executed` — nodo completato con eventuali output
- `execution_cached` — nodi risolti da cache
- `execution_error` — errore con dettagli (node_id, exception_message, traceback)
- `execution_success` — completamento (versioni più recenti)

Il Bridge mantiene un proprio `client_id` stabile per sessione e traduce questi eventi
nel formato eventi interno esposto su `/ws/events` (vedi ARCHITECTURE_DECISION.md §5),
aggiungendo eventi propri (`bridge_status_changed`) che ComfyUI non emette.

## Tolleranza/robustezza richiesta al client

1. **Timeout configurabile** (default breve, es. 5s per `/system_stats` usato per health
   check periodico; timeout più lungo per `/object_info` che può essere pesante con molti
   custom node installati).
2. **Nessuna eccezione non gestita propagata ai router**: sempre eccezioni tipizzate
   (`ComfyUnreachable`, `ComfyTimeout`, `ComfyHTTPError`, `ComfyProtocolError`).
3. **Nessuna assunzione di versione**: parsing difensivo (campi opzionali con default
   `None`/`sconosciuto`, mai `KeyError` non gestito).
4. **Retry**: solo su errori di connessione (connection refused, timeout) con backoff
   breve e limitato (max 2 retry) — mai retry su errori applicativi 4xx/5xx con corpo
   d'errore (quelli vanno mostrati, non nascosti da un retry silenzioso).

## Cosa NON è verificabile in questa sessione di sviluppo

Come dichiarato in `AUDIT.md`, nessuna istanza ComfyUI reale è raggiungibile in questo
ambiente. Il client è quindi validato con **unit test che mockano il livello di trasporto
HTTP/WS** (payload di esempio basati su questa documentazione), non con una vera chiamata
di rete. La verifica contro un'istanza reale resta un passo esplicito a carico
dell'utente, ripetuto ad ogni fase che tocca `comfy_client` (Fase 1, 2, 6 in particolare).
