# COMPATIBILITY ENGINE — design (Fase 4)

Riferimento: spec §5. Questo è il "cuore" del progetto insieme al Workflow Intelligence
Engine (`docs/workflow-intelligence-engine.md`). Obiettivo: mai dichiarare compatibile
qualcosa che non lo è, mai nascondere l'incertezza dietro un "sì" comodo.

## 1. Modello del risultato

```python
class CompatibilityResult(BaseModel):
    compatibility: Literal["compatible", "incompatible", "unknown", "warning"]
    reason: str
    source: Literal[
        "metadata", "node_schema", "comfy_reported", "analyzed_workflow",
        "internal_rule", "user_declared", "ai_suggested",
    ]
    confidence: float  # 0..1
    rule_version: int | None = None
```

**Default esplicito:** se nessuna fonte produce un risultato, `compatibility = "unknown"`,
non `"compatible"`. Il default "ottimista" è vietato dalla spec ("se non sai... NON
dichiararli compatibili").

## 2. Fonti (in ordine di priorità quando più fonti concordano/discordano)

1. **`comfy_reported`** — priorità massima: se ComfyUI stesso rifiuta un `POST /prompt`
   con `node_errors` che indica un tipo di input errato, quello è un fatto osservato, non
   un'inferenza. Confidence 1.0, sempre vince su regole interne.
2. **`node_schema`** — dal `/object_info`: se il tipo di output di un nodo (es.
   `MODEL`) non combacia col tipo di input richiesto da un altro nodo, è incompatibilità
   strutturale certa (confidence 1.0, indipendente da famiglia).
3. **`metadata`** — header `.safetensors` o metadata equivalenti che dichiarano
   esplicitamente l'architettura (es. campo `modelspec.architecture`). Confidence alta
   (0.8-0.95) ma non assoluta: i metadata possono essere assenti, errati o di terze parti.
4. **`analyzed_workflow`** — pattern osservati in workflow JSON importati e validati
   dall'utente come funzionanti (Fase 8): "questo LoRA è stato usato con successo insieme
   a questo checkpoint in un workflow che l'utente ha eseguito". Registra una
   *osservazione*, non una regola universale — la spec vieta esplicitamente di confondere
   "ha funzionato una volta" con "compatibile sempre" (§23). Confidence iniziale moderata
   (0.5), che può salire con osservazioni multiple indipendenti (fino a un tetto, mai 1.0
   per questa sola fonte).
5. **`internal_rule`** — regole versionate scritte/curate esplicitamente (es. "i LoRA con
   nome file matching `*flux*` E che dichiarano `family=flux` nei metadata sono
   compatibili con checkpoint `family=flux`"). Le regole sono dati versionati in
   `compatibility_rules` (vedi `docs/data-model.md`), non `if` sparsi nel codice — così
   sono ispezionabili/esportabili/aggiornabili senza deploy.
6. **`user_declared`** — l'utente può forzare/annotare una compatibilità (spec §5 punto 8,
   §37 modalità avanzata: "forzare una scelta incompatibile con warning"). Persistita,
   ma sempre visibile come dichiarata dall'utente, non come verità di sistema.
7. **`ai_suggested`** — l'AI Assistant (Fase 10) può proporre una valutazione di
   compatibilità in linguaggio naturale, ma **mai come unica fonte per una decisione
   critica** (regola esplicita §5 punto 9): un suggerimento AI senza corroborazione da
   una fonte 1-5 resta `unknown` con nota "ipotesi AI non verificata", non diventa mai da
   solo `compatible`.

## 3. Algoritmo di combinazione (v1, deterministico — niente ML nella Fase 4)

```
per ogni coppia (subject, target, contesto):
  raccogli tutti i CompatibilityResult dalle fonti applicabili
  se esiste un risultato "comfy_reported" o "node_schema" → quello vince, fine
  altrimenti:
    se esiste almeno un risultato "incompatible" con confidence >= 0.7 → incompatible (usa quello con confidence più alta come reason)
    altrimenti se esiste un risultato "compatible" da internal_rule o metadata con confidence >= 0.6
        E nessun risultato "incompatible"/"warning" con confidence >= 0.5 → compatible
    altrimenti se esiste un risultato "warning" o segnali contrastanti → warning (spiega il contrasto)
    altrimenti → unknown
```

Questo algoritmo è **codice puro testabile** (`compatibility_engine/resolve.py`),
indipendente da FastAPI e da ComfyUI — coerente con "le funzioni critiche devono avere
test automatici" (regola 9) e con la testabilità richiesta dal piano test (§40:
compatible/incompatible/unknown/conflicting rules).

## 4. Family detection (input principale per molte regole)

Segnali usati, in ordine di affidabilità decrescente:
1. Metadata espliciti nel file (`modelspec.architecture`, chiavi note per famiglia).
2. Euristiche strutturali sui nomi dei tensori/shape presenti nell'header safetensors
   (es. presenza di chiavi tipiche dell'architettura FLUX vs SDXL vs SD1.x) — regole
   versionate, documentate e testabili con fixture di header reali/sintetici.
3. Segnali dal nome file/percorso (peso basso, mai da solo sufficiente per
   `compatible`, coerente con "NON basarsi esclusivamente sul nome del file" — usato solo
   per alzare/abbassare `confidence`, mai come unica fonte di verità).
4. Nodi collegati nell'installazione (es. la presenza di loader FLUX-specifici in
   `/object_info` è un segnale indiretto sull'ecosistema installato, non sulla famiglia di
   un singolo file).

L'elenco famiglie (FLUX, SD1.x, SDXL, WAN, Qwen, ...) è un **registro estensibile**
(tabella/enum aperto, non hardcoded in modo chiuso) — nuove famiglie si aggiungono
registrando nuove euristiche, senza toccare l'algoritmo di combinazione.

## 5. Uso nella UI

`compatibility_engine.filter_compatible(items, context)` restituisce ogni item con il suo
`CompatibilityResult` allegato, mai una lista silenziosamente filtrata: la UI decide se
nascondere gli `incompatible` di default (Fase 5+) mostrando comunque il toggle "Mostra
incompatibili" (§36) con motivo visibile per ciascuno.

## 6. Cosa NON fa la Fase 4

Non c'è ancora machine learning/embedding di similarità, non c'è ancora un training loop
sulla knowledge base — la spec chiede una v1 basata su regole+fonti osservabili
(§5, §23). Un motore più sofisticato è un'estensione futura esplicitamente fuori scope
per non introdurre "conoscenza AI come unica fonte per decisioni critiche".
