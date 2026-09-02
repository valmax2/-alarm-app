# MODELLO DATI — Comfy Director

Entità da spec §24, con campi concreti. Implementate come tabelle SQLite via SQLAlchemy;
migrazioni gestite da Alembic. Le tabelle marcate **[Fase N]** sono state (o saranno)
introdotte in quella fase — vengono aggiunte quando il modulo corrispondente viene
costruito, per evitare schema morto non testato (regola 1: non fingere funzionalità).
Stato aggiornato: `settings`, `comfy_instances`, `errors` (Fase 1), `nodes`,
`node_schemas`, `models` (Fase 2), `ai_providers` (Fase 9, portata avanti su richiesta
esplicita — vedi la sua sezione) esistono e sono popolate da dati reali;
`model_metadata` esiste nello schema ma non è ancora scritta (vedi nota nella sua
sezione); le altre restano da costruire nelle fasi indicate.

Convenzioni comuni: `id` (UUID stringa, PK), `created_at`/`updated_at` (UTC, ISO8601),
foreign key con `ON DELETE` esplicito indicato tra parentesi.

---

## `settings` — [Fase 1]
Coppie chiave/valore per la configurazione applicativa (non le API key, che vivono in
`ai_providers`).

| campo | tipo | note |
|---|---|---|
| key | str, PK | es. `comfy.base_url`, `comfy.root_path`, `ui.mode` (simple/advanced) |
| value | str (JSON-encoded) | |
| updated_at | datetime | |

## `comfy_instances` — [Fase 1]
Una o più configurazioni di connessione ComfyUI (multi-istanza previsto ma non richiesto
subito: schema pronto, UI mostra solo la corrente in Fase 1).

| campo | tipo | note |
|---|---|---|
| id | str, PK | |
| name | str | es. "Locale" |
| base_url | str | es. `http://127.0.0.1:8188` |
| root_path | str, nullable | percorso filesystem installazione ComfyUI, se noto |
| models_path | str, nullable | |
| custom_nodes_path | str, nullable | |
| workflow_dirs | str (JSON list), nullable | cartelle indicizzate per la libreria workflow |
| is_default | bool | |
| last_sync_at | datetime, nullable | |
| last_status | str, nullable | `online`/`offline`/`error` — ultimo stato osservato |
| last_version | str, nullable | versione ComfyUI riportata da `/system_stats` |
| created_at / updated_at | datetime | |

## `nodes` — [Fase 2]
Nodi realmente registrati nell'istanza ComfyUI collegata (snapshot dell'ultima sync).

| campo | tipo | note |
|---|---|---|
| id | str, PK | `{comfy_instance_id}:{class_type}` |
| comfy_instance_id | FK → comfy_instances.id (CASCADE) | |
| class_type | str | nome classe nodo reale (es. `CheckpointLoaderSimple`) |
| display_name | str | |
| category | str | categoria dichiarata da ComfyUI |
| is_custom_node | bool | true se non è un nodo core ComfyUI (euristica: elenco core noto vs resto) |
| source_extension | str, nullable | nome della custom node extension, se determinabile |
| last_seen | datetime | aggiornato a ogni sync in cui il nodo è ancora presente |

## `node_schemas` — [Fase 2]
Schema `/object_info` grezzo per ciascun nodo (fonte per i widget dinamici, §11).

| campo | tipo | note |
|---|---|---|
| node_id | FK → nodes.id (CASCADE), PK | |
| raw_schema | text (JSON) | risposta `/object_info/{class_type}` così com'è, non reinterpretata a monte |
| input_summary | text (JSON) | vista normalizzata: lista di `{name, kind (required/optional), type, widget_hint, min, max, step, default, enum_values}` |
| output_summary | text (JSON) | lista di `{name, type}` |
| fetched_at | datetime | |

## `models` — [Fase 2]
Elementi di inventario (checkpoint, LoRA, VAE, ControlNet, ecc.).

| campo | tipo | note |
|---|---|---|
| id | str, PK | hash del path assoluto + comfy_instance_id |
| comfy_instance_id | FK → comfy_instances.id (CASCADE) | |
| name | str | nome file |
| path | str | path riportato da ComfyUI (relativo alla cartella modelli tipizzata) |
| model_type | str | `checkpoint`\|`diffusion_model`\|`unet`\|`lora`\|`vae`\|`clip`\|`text_encoder`\|`controlnet`\|`ipadapter`\|`instantid`\|`upscale`\|`embedding`\|`other` |
| extension | str | |
| size_bytes | int, nullable | |
| sha256 | str, nullable | calcolato on-demand (può essere costoso su file grandi: lazy + cache) |
| family | str, nullable | es. `flux`, `sdxl`, `sd15`, `wan`, `qwen`, `unknown` |
| architecture | str, nullable | dettaglio tecnico se rilevabile (es. `flux-dev`, `flux-schnell`) |
| detection_confidence | float (0-1) | confidenza della detection famiglia/architettura |
| detection_source | str | vedi `docs/compatibility-engine.md` §fonti |
| last_seen | datetime | |
| created_at | datetime | |

## `model_metadata` — [Fase 2, schema presente ma non ancora scritto]
Metadata grezzi estratti (header safetensors, ecc.) — separata da `models` per non
appesantire le query di lista con blob JSON. La tabella esiste (migrazione
`0002_inventory`) ma la sync Fase 2 v1 usa l'header letto solo in memoria per la family
detection senza persisterlo qui: verrà scritta quando servirà davvero ispezionare
l'header grezzo dalla UI (es. diagnostica di un modello specifico).

| campo | tipo | note |
|---|---|---|
| model_id | FK → models.id (CASCADE), PK | |
| raw_header | text (JSON), nullable | header `.safetensors` se presente |
| extra | text (JSON), nullable | altri metadata (es. civitai info se importati manualmente dall'utente) |

## `compatibility_rules` — [Fase 4]
Regole versionate + osservazioni. Vedi `docs/compatibility-engine.md` per semantica.

| campo | tipo | note |
|---|---|---|
| id | str, PK | |
| subject_type | str | es. `model`, `node`, `family` |
| subject_selector | str (JSON) | criterio di match (es. `{"family": "flux"}`, `{"node_class": "IPAdapterFaceID"}`) |
| target_type | str | come sopra |
| target_selector | str (JSON) | |
| compatibility | str | `compatible`\|`incompatible`\|`unknown`\|`warning` |
| reason | text | |
| source | str | `metadata`\|`node_schema`\|`comfy_reported`\|`analyzed_workflow`\|`internal_rule`\|`user_declared`\|`ai_suggested` |
| confidence | float (0-1) | |
| rule_version | int | per poter invalidare/rivedere regole nel tempo |
| created_at | datetime | |

## `workflows` — [Fase 3/5]
| campo | tipo | note |
|---|---|---|
| id | str, PK | |
| name | str | |
| intent | str, nullable | es. `character_consistency`, `text_to_image`, ... |
| family | str, nullable | famiglia AI target |
| tags | str (JSON list) | |
| source | str | `user_created`\|`imported`\|`generated_by_engine`\|`from_image` |
| current_version_id | FK → workflow_versions.id, nullable | |
| created_at / updated_at | datetime | |

## `workflow_versions` — [Fase 3/5/28]
| campo | tipo | note |
|---|---|---|
| id | str, PK | |
| workflow_id | FK → workflows.id (CASCADE) | |
| version_number | int | |
| graph_json | text (JSON) | modello interno serializzato (nodi, archi, parametri) |
| comfy_api_payload_json | text (JSON), nullable | ultima compilazione riuscita verso il formato API ComfyUI |
| validation_result_json | text (JSON), nullable | risultato ultimo validatore (§26) |
| note | text, nullable | |
| created_at | datetime | |

## `characters` — [Fase 7, consegnata v1: libreria + immagini, nessun collegamento alla generazione]
| campo | tipo | note |
|---|---|---|
| id | str, PK | |
| name | str | |
| description | text, nullable | |
| main_image_id | str, nullable | NON una vera FK a livello DB (nessun `ForeignKey`): evita un riferimento circolare con `character_images.character_id`, che punta già a questa tabella con CASCADE — l'invariante è garantito dal codice applicativo (`routers/characters.py`), vedi `bridge/models.py` |
| tags | str (JSON list) | |
| notes | text, nullable | |
| is_private | bool | controlla SOLO l'oscuramento (blur) dell'anteprima in UI — non un vero controllo d'accesso: il file resta scaricabile via URL diretto (nessuna autenticazione esiste in questa app locale mono-utente) |
| created_at / updated_at | datetime | |

## `character_images` — [Fase 7, consegnata v1]
| campo | tipo | note |
|---|---|---|
| id | str, PK | |
| character_id | FK → characters.id (CASCADE) | |
| storage_path | str | path relativo su filesystem (`data/storage/characters/<character_id>/<uuid>.<ext>`) — MAI base64 in DB |
| role | str | `main`\|`reference` |
| order_index | int | assegnato in ordine di caricamento in v1 — nessuna riordinabilità esplicita ancora |
| source | str | `upload`\|`drag_drop`\|`cloud_drive`\|`generated` — solo `upload` è realmente implementato in v1, gli altri valori sono previsti nello schema per fasi future |
| width / height | int, nullable | non ancora derivati automaticamente dall'immagine in v1 (nessuna dipendenza Pillow aggiunta per questo — dichiarato, mai un valore inventato) |
| created_at | datetime | |

## `generations` — [Fase 6, consegnata v2]
| campo | tipo | note |
|---|---|---|
| id | str, PK | |
| workflow_id | FK → workflows.id (SET NULL) | aggiunta rispetto allo schizzo iniziale: serve a listare le generazioni di un workflow senza passare per un join su workflow_versions, che può essere stata cancellata |
| workflow_version_id | FK → workflow_versions.id (SET NULL) | |
| comfy_instance_id | FK → comfy_instances.id | |
| comfy_prompt_id | str, nullable | ID di coda restituito da ComfyUI |
| status | str | `queued`\|`running`\|`completed`\|`error`\|`aborted` |
| seed | int, nullable | non ancora derivato automaticamente dal grafo in v1 (nessuna assunzione su quale nodo/parametro sia "il seed") |
| output_paths_json | str (JSON list di `{filename, subfolder, type}`) | rinominato da `output_paths` per riflettere il formato reale (non semplici path, ma gli oggetti che ComfyUI restituisce in `/history`) |
| node_errors_json | str (JSON), nullable | errori di validazione riportati DA COMFYUI in risposta a `/prompt` — mai reinterpretati |
| duration_ms | int, nullable | |
| error_message | text, nullable | |
| current_node_id / progress_value / progress_max | str/int, nullable | [Fase 6 v2, migrazione `0009`] aggiornati dal relay WS live (`GET /generations/{id}/live`) se mai connesso — restano `null` finché nessun evento WS è arrivato, mai un valore inventato; fallback per un client che fa solo polling REST |
| created_at / started_at / finished_at | datetime, nullable (tranne created_at) | |

## `prompts` — [Fase 9, consegnata v1: cronologia autonoma, nessun collegamento a una generazione]
| campo | tipo | note |
|---|---|---|
| id | str, PK | |
| generation_id | FK → generations.id (SET NULL), nullable | resta SEMPRE `null` in questa consegna — nessun collegamento a una generazione/workflow specifico esiste ancora (dipende dal Workflow Builder completo, Fase 5); la colonna esiste già per quando arriverà |
| text_it | text, nullable | |
| text_en | text | |
| negative_text_en | text, nullable | |
| translation_locked | bool | se true, `text_en` non viene sovrascritto da una nuova traduzione (applicato lato frontend: la UI non richiama la traduzione se il flag è attivo) |
| structured_json | text (JSON), nullable | previsto per collegare in futuro l'output di "Prompt da Immagine" (§9) a questa cronologia — non ancora popolato: quel flusso restituisce lo `StructuredPromptOut` direttamente alla UI senza persisterlo qui, dichiarato esplicitamente come miglioramento futuro |
| created_at | datetime | |

## `chat_messages` — [Fase 10, consegnata v1: solo chat, nessun Tool Layer]
Conversazione unica e continua con l'Assistente AI — non lo schizzo originale del
piano (che non la specificava nel dettaglio), aggiunta quando la chat è stata
consegnata prima del Tool Layer completo (§21).

| campo | tipo | note |
|---|---|---|
| id | str, PK | |
| role | str | `user`\|`assistant` |
| text | text | |
| provider_id | FK → ai_providers.id (SET NULL), nullable | nullable perché non ha senso su un messaggio `role='user'` |
| error_message | text, nullable | popolato se la chiamata al provider è fallita (in quel caso non viene creata alcuna riga `assistant`, solo il messaggio `user` resta salvato) |
| created_at | datetime | |

## `errors` — [Fase 1: schema; Fase 11 v1: consegnata — finalmente scritta]
Log applicativo strutturato persistito (oltre al file di log), per la Diagnostica (§25).
Lo schema esisteva dalla migrazione `0001`, ma nessun path di codice la scriveva
davvero fino alla Fase 11 (`bridge/diagnostics.py`, agganciata come exception
handler globale in `main.py`): ogni eccezione non gestita in un router viene ora
persistita qui (messaggio/contesto redatti con lo stesso `redact()` dei log su
file), invece di sparire in un 500 anonimo. v1: solo eccezioni non gestite, non un
log strutturato di ogni richiesta.

| campo | tipo | note |
|---|---|---|
| id | str, PK | |
| level | str | `warning`\|`error`\|`critical` |
| source | str | modulo che ha generato l'errore (es. `comfy_client`, `compatibility_engine`) |
| message | text | |
| context_json | text (JSON), nullable | dettagli non sensibili (segreti già redatti) |
| created_at | datetime | |

## `ai_providers` — [Fase 9, portata avanti dalla Fase 10 su richiesta esplicita]
Costruita insieme a "Prompt da Immagine" (§9) invece che alla Fase 10 (AI Assistant)
come originariamente pianificato: l'analisi immagine→prompt richiede comunque un
provider AI cloud, quindi lo schema/CRUD/cifratura sono stati anticipati qui. L'AI
Assistant (Fase 10) riuserà questa stessa tabella.

| campo | tipo | note |
|---|---|---|
| id | str, PK | |
| kind | str | `local`\|`openai`\|`anthropic` (`local` accettato nello schema ma non ancora utilizzabile per l'analisi — vedi `docs/comfyui-api.md`-equivalente in `bridge/ai_providers/vision.py`) |
| label | str | |
| encrypted_api_key | blob, nullable | cifrata con Fernet (chiave locale in `data/secret.key`, mai committata) — mai in chiaro, mai loggata |
| base_url | str, nullable | per endpoint OpenAI-compatibili non ufficiali |
| default_model | str, nullable | |
| enabled | bool | |
| created_at / updated_at | datetime | |

---

## Note trasversali

- Ogni tabella con dati potenzialmente grandi (`node_schemas.raw_schema`,
  `workflow_versions.graph_json`) usa `TEXT` per JSON piuttosto che colonne JSON native
  SQLite-specifiche, per portabilità e semplicità di migrazione futura verso altro DB se
  mai necessario (non previsto, ma non ci si chiude la porta).
- Nessuna tabella salva immagini/binari: sempre `storage_path` verso `data/storage/...`.
- Indici previsti fin dalla Fase 2: `models(comfy_instance_id, model_type)`,
  `models(family)`, `nodes(comfy_instance_id)` — per rispettare i requisiti di
  performance (§35) quando l'inventario cresce.
