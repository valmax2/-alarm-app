# MODELLO DATI — Comfy Director

Entità da spec §24, con campi concreti. Implementate come tabelle SQLite via SQLAlchemy;
migrazioni gestite da Alembic. Le tabelle marcate **[Fase N]** sono state (o saranno)
introdotte in quella fase — vengono aggiunte quando il modulo corrispondente viene
costruito, per evitare schema morto non testato (regola 1: non fingere funzionalità).
Stato aggiornato: `settings`, `comfy_instances`, `errors` (Fase 1), `nodes`,
`node_schemas`, `models` (Fase 2) esistono e sono popolate da dati reali;
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

## `characters` — [Fase 7]
| campo | tipo | note |
|---|---|---|
| id | str, PK | |
| name | str | |
| description | text, nullable | |
| main_image_id | FK → character_images.id, nullable | |
| tags | str (JSON list) | |
| notes | text, nullable | |
| is_private | bool | controlla oscuramento anteprima in UI |
| created_at / updated_at | datetime | |

## `character_images` — [Fase 7]
| campo | tipo | note |
|---|---|---|
| id | str, PK | |
| character_id | FK → characters.id (CASCADE) | |
| storage_path | str | path relativo su filesystem (`data/storage/characters/<character_id>/<file>`) — MAI base64 in DB |
| role | str | `main`\|`reference` |
| order_index | int | |
| source | str | `upload`\|`drag_drop`\|`cloud_drive`\|`generated` |
| width / height | int, nullable | |
| created_at | datetime | |

## `generations` — [Fase 6]
| campo | tipo | note |
|---|---|---|
| id | str, PK | |
| workflow_version_id | FK → workflow_versions.id (SET NULL) | |
| comfy_instance_id | FK → comfy_instances.id | |
| comfy_prompt_id | str, nullable | ID di coda restituito da ComfyUI |
| status | str | `queued`\|`running`\|`completed`\|`error`\|`aborted` |
| seed | int, nullable | |
| output_paths | str (JSON list) | path relativi immagini/video scaricati |
| duration_ms | int, nullable | |
| error_message | text, nullable | |
| started_at / finished_at | datetime, nullable | |

## `prompts` — [Fase 9]
| campo | tipo | note |
|---|---|---|
| id | str, PK | |
| generation_id | FK → generations.id, nullable | |
| text_it | text, nullable | |
| text_en | text | |
| negative_text_en | text, nullable | |
| translation_locked | bool | se true, `text_en` non viene sovrascritto da nuove traduzioni automatiche |
| structured_json | text (JSON), nullable | campi strutturati (§9: soggetto, capelli, volto, ...) quando prodotti da Prompt-da-Immagine |
| created_at | datetime | |

## `errors` — [Fase 1, popolata progressivamente]
Log applicativo strutturato persistito (oltre al file di log), per la Diagnostica (§25).

| campo | tipo | note |
|---|---|---|
| id | str, PK | |
| level | str | `warning`\|`error`\|`critical` |
| source | str | modulo che ha generato l'errore (es. `comfy_client`, `compatibility_engine`) |
| message | text | |
| context_json | text (JSON), nullable | dettagli non sensibili (segreti già redatti) |
| created_at | datetime | |

## `ai_providers` — [Fase 10, schema presente prima per non rompere Diagnostica]
| campo | tipo | note |
|---|---|---|
| id | str, PK | |
| kind | str | `local`\|`openai`\|`anthropic`\|`other` |
| label | str | |
| encrypted_api_key | blob, nullable | mai in chiaro, mai loggata |
| base_url | str, nullable | per provider locali/self-hosted |
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
