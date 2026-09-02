# PIANO DI TEST — Comfy Director

Riferimento: spec §40. Framework: `pytest` + `pytest-asyncio` per il Bridge Python
(mock del trasporto HTTP con `respx`, mai chiamate di rete reali nei test unitari);
`vitest` + `@testing-library/react` per il frontend. Ogni fase aggiunge i propri test a
questa suite; l'intera suite viene rieseguita prima di ogni nuova fase (regola 6).

## Bridge
| Test | Cosa verifica | Fase |
|---|---|---|
| `test_health.py` | `GET /health` risponde 200 con stato processo | 1 |
| `test_comfy_status_online.py` | `comfy_client` con `/system_stats` mockato → `ComfyStatus.status == "online"` + versione estratta correttamente | 1 |
| `test_comfy_status_offline.py` | `/system_stats` mockato per rifiutare connessione → `status == "offline"`, nessuna eccezione propagata al router | 1 |
| `test_comfy_status_timeout.py` | `/system_stats` mockato per non rispondere entro il timeout configurato → `status == "offline"`, reason = timeout | 1 |
| `test_object_info_parsing.py` | Parsing di uno schema `/object_info` di esempio (fixture) → `input_summary`/`output_summary` normalizzati correttamente, inclusi enum/min/max/default | 2 |
| `test_settings_crud.py` | `GET/PUT /settings` persiste e rilegge `comfy.base_url` | 1 |

## Inventory
| Test | Cosa verifica | Fase |
|---|---|---|
| detection | Scansione di una fixture di file modello (nomi/estensioni noti) → tipo/family/confidence attesi | 2 |
| aggiornamento (sync incrementale) | Un secondo sync senza modifiche non riscrive `last_seen` in modo eccessivo / aggiorna `last_seen` senza duplicare righe | 2 |
| file rimosso | Un modello presente in DB ma non più riportato da ComfyUI → marcato non più presente (mai cancellato silenziosamente senza traccia, per compatibilità con `generations` storiche che lo referenziano) | 2 |
| duplicato | Stesso hash, path diversi → due record distinti ma collegabili (stesso `sha256`), nessun crash | 2 |

## Compatibility Engine
| Test | Cosa verifica | Fase |
|---|---|---|
| compatible | Fonte `node_schema` con tipi porta coincidenti → `compatible`, confidence 1.0 | 4 |
| incompatible | Fonte `comfy_reported` (node_errors simulati) → `incompatible`, reason leggibile | 4 |
| unknown | Nessuna fonte applicabile → `unknown`, mai `compatible` di default | 4 |
| conflicting rules | Una fonte `internal_rule` dice compatible, un'altra `analyzed_workflow` con bassa confidence dice incompatible → risultato `warning` con entrambe le motivazioni riportate | 4 |

## Workflow (modello interno)
| Test | Cosa verifica | Fase |
|---|---|---|
| serialize/deserialize | `dump(load(json)) == json` (round-trip) su una fixture di grafo | 3 |
| add/remove node | Aggiungere e rimuovere un nodo aggiorna correttamente archi collegati (rimozione nodo rimuove/segnala archi orfani) | 3 |
| connection validation | Collegare porte di tipo incompatibile viene rifiutato con errore tipizzato | 3 |
| required inputs | `validate_structure` segnala porte required non collegate | 3 |

## Comfy compilation
| Test | Cosa verifica | Fase |
|---|---|---|
| internal graph → API payload | Un `WorkflowGraph` di fixture compila nel formato atteso da `POST /prompt` (struttura `{node_id: {class_type, inputs}}`) | 6 |
| payload validation | Un grafo con un ruolo required non risolto non viene compilato, produce errore prima dell'invio (mai un payload parziale spedito a ComfyUI) | 6 |

## Characters
| Test | Cosa verifica | Fase |
|---|---|---|
| create | Creazione personaggio persiste su DB | 7 |
| image add/remove | Aggiunta immagine scrive su filesystem + riga DB coerente; rimozione elimina entrambi, mai solo uno dei due (no orfani) | 7 |
| persistence | Riavvio del processo Bridge (simulato riaprendo la sessione DB) rilegge correttamente personaggi e immagini | 7 |

## Metadata import
| Test | Cosa verifica | Fase |
|---|---|---|
| immagine ComfyUI con workflow | PNG di fixture con chunk metadata ComfyUI → grafo ricostruito, componenti mancanti rilevati correttamente | 8 |
| immagine senza metadata | PNG senza chunk workflow → risposta esplicita "non trovato", mai un grafo inventato | 8 |

## Frontend
| Test | Cosa verifica | Fase |
|---|---|---|
| `BridgeStatus.test.tsx` | Il componente mostra "Offline" quando `/comfy/status` risponde offline, "Online vX.Y" quando risponde online, "Bridge non raggiungibile" quando `/health` stesso fallisce (tre stati distinti, mai confusi) | 1 |
| Settings form | Salvare l'URL ComfyUI chiama `PUT /settings` e il valore persiste dopo reload (mock fetch) | 1 |
| (Fase 3+) canvas↔model sync | Modificare un arco in canvas aggiorna lo store; modificare lo store aggiorna la canvas | 3 |

## Esecuzione
- Bridge: `cd apps/bridge && pytest`
- Frontend: `cd apps/frontend && npm test`
- Entrambe le suite girano in CI-ready mode senza dipendenze esterne (nessun ComfyUI
  reale richiesto) — la verifica di integrazione reale contro ComfyUI resta un passo
  manuale documentato in `apps/bridge/README.md`, da ripetere ad ogni fase che tocca il
  Bridge (vedi `AUDIT.md`).
