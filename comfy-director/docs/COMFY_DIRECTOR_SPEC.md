# COMFY DIRECTOR --- MASTER SPECIFICATION FOR CLAUDE CODE

**Versione specifica:** 1.0\
**Data:** 2026-09-02\
**Scopo:** documento operativo da consegnare a Claude Code per
progettare e sviluppare l'applicazione reale.\
**Lingua UI primaria:** Italiano, con prompt destinati ai modelli
automaticamente disponibili in inglese.

------------------------------------------------------------------------

# 0. ISTRUZIONE PRINCIPALE A CLAUDE CODE

Devi costruire **un'applicazione reale e funzionante**, non un mockup e
non una demo grafica.

Il progetto si chiama provvisoriamente **Comfy Director**.

L'applicazione deve essere un livello di gestione intelligente sopra
**ComfyUI locale**.\
ComfyUI deve essere usato principalmente come **motore di
esecuzione/generazione**. L'utente deve poter creare, modificare,
controllare e salvare i workflow dalla nostra applicazione senza dover
lavorare normalmente nell'interfaccia ComfyUI.

## Regole non negoziabili

1.  Non fingere che una funzione sia implementata se è solo grafica.
2.  Non hardcodare i parametri dei custom node se ComfyUI può fornirli
    dinamicamente.
3.  Non inventare compatibilità tra modelli/nodi.
4.  Separare nettamente:
    -   UI;
    -   modello dati workflow;
    -   Bridge ComfyUI;
    -   inventario;
    -   Compatibility Engine;
    -   Workflow Intelligence Engine;
    -   AI Assistant;
    -   Character Library;
    -   prompt engine.
5.  Ogni versione deve essere avviabile e testabile.
6.  Prima di aggiungere nuove funzioni, non rompere quelle già
    funzionanti.
7.  Inserire logging e diagnostica fin dall'inizio.
8.  Creare backup/checkpoint versionati.
9.  Le funzioni critiche devono avere test automatici.
10. Se una parte non è ancora implementata, dichiararla chiaramente
    nell'interfaccia e nel report tecnico.
11. Non sostituire il progetto con una semplificazione arbitraria.
12. Prima di scrivere molto codice, fare audit dell'ambiente e proporre
    l'architettura concreta.

------------------------------------------------------------------------

# 1. OBIETTIVO DEL PROGETTO

Il problema da risolvere è la complessità di ComfyUI:

-   moltissimi workflow;
-   moltissimi custom node;
-   checkpoint e famiglie differenti;
-   LoRA compatibili solo con determinate famiglie;
-   VAE, ControlNet, IPAdapter, text encoder e altri componenti;
-   workflow che smettono di funzionare quando manca un nodo;
-   difficoltà nel sapere quale combinazione sia corretta;
-   parametri differenti per ogni nodo;
-   difficoltà nel ricordare quale workflow usare per un certo
    obiettivo.

L'app deve trasformare questo caos in un sistema guidato.

L'utente deve poter ragionare così:

> Voglio creare una nuova immagine mantenendo coerente questo
> personaggio.\
> Voglio usare FLUX.

Da quel momento l'app deve restringere progressivamente le possibilità e
mostrare **solo ciò che è sensato e compatibile**, pur mantenendo una
modalità avanzata nella quale l'utente può intervenire manualmente.

Il vero valore del progetto NON è soltanto una canvas più bella.

Il vero valore è il **cuore intelligente che comprende il workflow e la
compatibilità dell'ambiente ComfyUI installato**.

------------------------------------------------------------------------

# 2. PRINCIPIO ARCHITETTURALE

Pensare l'app come questi sistemi separati:

``` text
┌───────────────────────────────────────────────┐
│                  COMFY DIRECTOR               │
├───────────────────────────────────────────────┤
│ UI / NODE CANVAS / PANELS / CHARACTER LIBRARY│
├───────────────────────────────────────────────┤
│ WORKFLOW INTELLIGENCE ENGINE                  │
│ COMPATIBILITY ENGINE                          │
│ PROMPT ENGINE                                 │
│ AI ASSISTANT                                  │
├───────────────────────────────────────────────┤
│ INTERNAL WORKFLOW MODEL                       │
│ INVENTORY DATABASE / KNOWLEDGE BASE           │
├───────────────────────────────────────────────┤
│ COMFY BRIDGE                                  │
├───────────────────────────────────────────────┤
│ LOCAL COMFYUI                                 │
│ nodes / models / queue / history / images     │
└───────────────────────────────────────────────┘
```

Comfy Director mantiene il proprio modello interno del workflow.

Quando l'utente preme **GENERA**, l'app converte/serializza il workflow
interno nel formato necessario all'API di ComfyUI, lo invia al backend
locale e segue l'esecuzione.

L'utente non deve essere obbligato ad aprire il workflow
nell'interfaccia standard di ComfyUI.

------------------------------------------------------------------------

# 3. COMFYUI BRIDGE --- COMPONENTE FONDAMENTALE

Creare un Bridge locale robusto.

Il Bridge deve permettere di configurare almeno:

-   URL ComfyUI;
-   host;
-   porta;
-   eventuale percorso root di ComfyUI;
-   percorso models;
-   percorso custom_nodes;
-   directory workflow configurabili.

Esempio tipico:

``` text
http://127.0.0.1:8188
```

Non assumere però percorsi fissi.

## Il Bridge deve verificare

-   ComfyUI raggiungibile;
-   versione;
-   system stats quando disponibili;
-   nodi registrati;
-   schema/input/output dei nodi;
-   queue;
-   history;
-   progress;
-   errori;
-   capacità di inviare un job;
-   capacità di interrompere un job quando supportato;
-   recupero delle immagini generate.

Usare le API reali disponibili nella versione installata di ComfyUI.

Per la descrizione dinamica dei nodi, sfruttare `/object_info` o il
meccanismo equivalente disponibile.

## Sincronizzazione

Pulsante:

**SINCRONIZZA COMFYUI**

Deve aggiornare l'inventario locale.

Mostrare:

``` text
Bridge: ONLINE
ComfyUI: x.x.x
Nodi: 742
Custom node: ...
Checkpoint: ...
LoRA: ...
VAE: ...
ControlNet: ...
IPAdapter: ...
Ultima sincronizzazione: ...
```

Non inventare numeri.

## Bridge server

Fornire un launcher Windows semplice, per esempio:

``` text
START_COMFY_DIRECTOR.bat
START_BRIDGE.bat
```

L'utente deve poter avviare il sistema senza usare manualmente terminali
complessi.

Il Bridge deve gestire correttamente CORS/proxy se necessario.

------------------------------------------------------------------------

# 4. INVENTORY ENGINE

L'app deve costruire un inventario persistente dell'ambiente locale.

Categorie indicative:

-   checkpoints;
-   diffusion models;
-   UNET;
-   LoRA;
-   VAE;
-   CLIP;
-   text encoders;
-   ControlNet;
-   IPAdapter;
-   InstantID;
-   upscale models;
-   embeddings;
-   custom nodes;
-   altri model type rilevati.

Non limitarsi ai nomi dei file.

Per ogni elemento raccogliere, quando possibile:

``` text
id
name
path
type
size
extension
family
architecture
metadata
hash
detected compatibility
source of compatibility information
confidence
last_seen
```

## Famiglie

Il sistema deve poter riconoscere/gestire famiglie come, a titolo di
esempio:

-   FLUX;
-   SD 1.x;
-   SDXL;
-   WAN;
-   Qwen;
-   altre famiglie presenti nell'installazione.

Non assumere che questo elenco sia definitivo.

Deve essere estensibile.

------------------------------------------------------------------------

# 5. COMPATIBILITY ENGINE --- IL CUORE

Questa è una delle parti più importanti del progetto.

Quando l'utente sceglie:

``` text
TIPO WORKFLOW
        +
FAMIGLIA / MOTORE
```

l'app deve mostrare solo gli elementi compatibili o indicare chiaramente
il livello di compatibilità.

Esempio:

``` text
Coerenza personaggio
+
FLUX
```

La UI deve filtrare:

-   checkpoint;
-   diffusion model;
-   text encoder;
-   VAE;
-   LoRA;
-   IPAdapter;
-   ControlNet;
-   custom node;
-   workflow template;
-   altri componenti.

## NON basarsi esclusivamente sul nome del file.

La compatibilità deve poter essere determinata attraverso più fonti:

1.  metadata del modello;
2.  struttura/schema;
3.  informazioni fornite da ComfyUI;
4.  classe del nodo;
5.  input/output type;
6.  workflow funzionanti già analizzati;
7.  regole interne versionate;
8.  eventuali informazioni dichiarate dall'utente;
9.  conoscenza AI, ma NON come unica fonte per decisioni critiche.

Ogni decisione deve poter conservare:

``` text
compatibility = compatible | incompatible | unknown | warning
reason
source
confidence
```

Se non sai se due componenti sono compatibili, NON dichiararli
compatibili.

Mostrare:

**Compatibilità non verificata**

piuttosto che produrre un workflow rotto.

------------------------------------------------------------------------

# 6. WORKFLOW INTELLIGENCE ENGINE

Questo è l'altro grande cuore dell'app.

Deve conoscere concetti funzionali, non soltanto nodi.

Esempi di intenti:

-   Text to Image;
-   Image to Image;
-   Character Consistency;
-   Reference Image;
-   Inpainting;
-   Outpainting;
-   Upscale;
-   Pose / Control;
-   Image to Video;
-   Text to Video;
-   workflow personalizzati.

Per ogni intento deve sapere quali **ruoli logici** servono.

Esempio astratto:

``` text
CHARACTER CONSISTENCY

Model Loader
Text Encoder
Positive Prompt
Negative Prompt
Reference Image Loader
Identity / Reference Module
Latent / Image preparation
Sampler
Decoder
Save / Preview
```

Poi il motore deve mappare questi ruoli sui nodi **realmente
disponibili** nell'installazione.

Quindi:

``` text
INTENTO
↓
REQUIRED CAPABILITIES
↓
AVAILABLE COMPATIBLE NODES
↓
CANDIDATE WORKFLOW
↓
VALIDATION
↓
CANVAS
```

Questa distinzione è fondamentale.

NON creare un workflow intelligente usando soltanto una lista hardcoded
di node name.

------------------------------------------------------------------------

# 7. ANALISI DEI WORKFLOW ESISTENTI

L'utente deve poter indicare cartelle contenenti workflow JSON.

L'app deve indicizzarli.

Per ogni workflow:

-   nome;
-   famiglia;
-   finalità probabile;
-   nodi;
-   collegamenti;
-   modelli richiesti;
-   custom node richiesti;
-   parametri;
-   input/output;
-   eventuali errori;
-   compatibilità con ambiente corrente.

Il sistema deve imparare dai workflow realmente funzionanti.

## Funzioni

-   Import workflow JSON.
-   Trascina workflow.
-   Libreria workflow.
-   Duplica.
-   Rinomina.
-   Tag.
-   Cerca.
-   Analizza.
-   Valida.
-   Apri sulla canvas.
-   Crea variante.

------------------------------------------------------------------------

# 8. WORKFLOW DA IMMAGINE COMFYUI

Pulsante dedicato:

**WORKFLOW DA IMMAGINE**

Non confonderlo con Prompt da Immagine.

L'utente carica una PNG/WebP o altro formato supportato generato da
ComfyUI.

Se l'immagine contiene metadata/workflow:

1.  leggere i metadata;
2.  estrarre prompt/workflow;
3.  ricostruire i nodi;
4.  ricostruire i collegamenti;
5.  ripristinare i parametri;
6.  mostrare componenti mancanti;
7.  aprire il risultato sulla canvas.

Se i metadata non esistono:

``` text
Workflow ComfyUI non trovato nei metadata.
Vuoi analizzare l'immagine per ricavarne un prompt?
```

Non fingere di poter ricostruire esattamente un workflow che non è
presente.

------------------------------------------------------------------------

# 9. PROMPT DA IMMAGINE

È una funzione differente.

Pulsante:

**PROMPT DA IMMAGINE**

Accetta:

-   fotografia;
-   immagine generata;
-   immagine ComfyUI;
-   altra immagine supportata.

Due modalità:

### LOCALE

Vision-language model locale installabile/configurabile.

### CLOUD/API

Provider configurabile dall'utente.

L'analisi dovrebbe produrre un prompt strutturato:

``` text
Soggetto
Identità / caratteristiche visibili
Capelli
Volto
Corpo / abbigliamento
Posa / azione
Ambiente
Camera
Luce
Stile
Dettagli
Prompt finale EN
```

Evitare deduzioni sensibili non necessarie.

------------------------------------------------------------------------

# 10. CANVAS CENTRALE

La schermata principale deve avere una grande **canvas nera**.

Aspetto e comportamento devono ricordare ComfyUI perché l'utente vuole
anche imparare la struttura dei workflow.

Mostrare:

-   nodi;
-   porte input/output;
-   collegamenti colorati;
-   zoom;
-   pan;
-   multi-select;
-   drag;
-   delete;
-   duplicate;
-   copy/paste;
-   auto-layout;
-   fit-to-screen;
-   minimap opzionale;
-   ricerca nodo;
-   undo/redo.

La canvas NON deve essere soltanto decorativa.

Il grafo visualizzato deve rappresentare il vero workflow interno.

Se cambia un collegamento sulla canvas, cambia il workflow.

Se cambia il workflow, cambia la canvas.

Una sola source of truth.

------------------------------------------------------------------------

# 11. NODI DINAMICI

Quando un nodo viene aggiunto, la UI deve leggere il suo schema reale.

Esempio LoRA Loader:

l'app deve mostrare i campi realmente disponibili nella versione/nodo
installato.

Esempio IPAdapter:

mostrare i suoi input reali, eventuali:

-   weight;
-   start;
-   end;
-   preset;
-   image;
-   model;
-   altri parametri definiti dal nodo.

## Widget dinamici

Convertire automaticamente gli input in controlli appropriati:

``` text
INT       → numeric input + slider
FLOAT     → numeric input + slider
BOOLEAN   → toggle
ENUM      → dropdown
STRING    → text / textarea
IMAGE     → image picker
MODEL     → compatible model picker
FILE      → file picker
COLOR     → color input se appropriato
```

Preservare:

-   min;
-   max;
-   step;
-   default;
-   enum;
-   required/optional.

Il pannello destro è **contestuale**.

Nodo selezionato → proprietà reali di quel nodo.

------------------------------------------------------------------------

# 12. UI PRINCIPALE

Non riempire la schermata di controlli.

L'utente ha chiesto espressamente un'interfaccia pulita.

## Layout

``` text
┌──────────────────────────────────────────────────────────┐
│ COMFY DIRECTOR | workflow | Bridge ● | GENERA | ABORT   │
├──────────┬───────────────────────────────┬───────────────┤
│          │                               │               │
│ PULSANTI │                               │ PROPRIETÀ     │
│ SINISTRA │         CANVAS NERA           │ CONTESTUALI   │
│          │                               │               │
│          │        NODI + LINK            │ COMPATIBILI   │
│          │                               │               │
├──────────┴───────────────────────────────┴───────────────┤
│ PROMPT / OUTPUT / PROGRESS / LOG                         │
└──────────────────────────────────────────────────────────┘
```

## Barra sinistra

Solo pulsanti/icone principali.

Cliccando un pulsante si apre una finestra/pannello dedicato.

Indicativamente:

1.  Tipo Flusso
2.  Motore AI
3.  Personaggi
4.  Workflow
5.  Workflow da Immagine
6.  Prompt da Immagine
7.  Modelli
8.  Nodi
9.  Bridge ComfyUI
10. Assistente AI
11. Impostazioni

Non è obbligatorio mostrarli tutti contemporaneamente se peggiora l'UX.

------------------------------------------------------------------------

# 13. TIPO DI FLUSSO

Aprire una schermata/pannello.

Categorie iniziali:

### Coerenza Personaggio

Priorità massima.

### Testo → Immagine

### Immagine → Immagine

### Immagine → Video

### Testo → Video

### Inpainting / Modifica

Architettura estensibile per aggiungere categorie future.

------------------------------------------------------------------------

# 14. MOTORE / FAMIGLIA AI

Dopo la scelta del tipo di flusso, l'utente sceglie la famiglia.

Esempi iniziali:

-   FLUX;
-   Qwen;
-   WAN;
-   altre famiglie rilevate.

Una volta scelta la famiglia, **tutta l'app entra nel relativo contesto
di compatibilità**.

Il pannello modelli NON deve continuare a mostrare indiscriminatamente
tutto.

------------------------------------------------------------------------

# 15. LIBRERIA PERSONAGGI

Pulsante:

**PERSONAGGI**

Apre una vera libreria.

Funzioni:

-   Nuovo personaggio;
-   nome;
-   descrizione opzionale;
-   immagine principale;
-   più immagini reference;
-   carica da PC;
-   drag & drop;
-   import cloud quando configurato;
-   elimina immagine;
-   sostituisci;
-   riordina;
-   visualizza grande;
-   privacy/nascondi preview;
-   tag;
-   note;
-   export;
-   import;
-   duplica personaggio.

I file devono essere realmente persistenti.

NON memorizzare immagini importanti soltanto in localStorage/base64.

Usare storage locale appropriato / filesystem / database e conservare
riferimenti robusti.

Il personaggio deve poter essere trascinato/selezionato in un workflow
di coerenza.

------------------------------------------------------------------------

# 16. COERENZA PERSONAGGIO --- PRIORITÀ PRINCIPALE

È il caso d'uso più importante.

Flusso utente ideale:

``` text
Nuovo workflow
↓
Coerenza Personaggio
↓
Scegli personaggio dalla libreria
↓
Scegli famiglia AI
↓
App trova strategie compatibili installate
↓
App propone la migliore / alternative
↓
Canvas costruita
↓
Utente può modificare ogni nodo/parametro
↓
Scrive prompt
↓
GENERA
```

L'app deve poter proporre più strategie se disponibili.

Esempio concettuale:

``` text
Strategia A — alta fedeltà identità
Strategia B — più libertà posa
Strategia C — più veloce
```

Le strategie devono derivare da capability reali, non da nomi inventati.

------------------------------------------------------------------------

# 17. PROMPT ENGINE

L'utente vuole scrivere normalmente in italiano.

Il prompt destinato al modello deve poter essere prodotto
automaticamente in inglese.

Campi:

``` text
Prompt IT
Prompt EN
Negative prompt se applicabile
```

Funzioni:

-   traduzione IT → EN;
-   modifica manuale dell'inglese;
-   blocca traduzione;
-   copia;
-   cronologia;
-   preset;
-   prompt strutturato;
-   dettatura/microfono dove disponibile;
-   evitare duplicazioni;
-   adattamento del prompt alla famiglia/modello.

La traduzione deve essere una funzione reale.

Prevedere:

-   provider locale;
-   provider API configurabile.

------------------------------------------------------------------------

# 18. GENERAZIONE

Pulsante evidente:

**GENERA**

Comportamento:

1.  validate workflow;
2.  controlla nodi mancanti;
3.  controlla modelli;
4.  controlla collegamenti;
5.  controlla input richiesti;
6.  compila il workflow nel formato API ComfyUI;
7.  invia il job;
8.  riceve ID;
9.  segue queue/progress;
10. mostra percentuale/stato quando disponibile;
11. riceve output;
12. mostra immagine/video;
13. registra log;
14. conserva relazione output ↔ workflow.

Pulsante:

**ABORT**

Deve interrompere il job quando tecnicamente supportato.

------------------------------------------------------------------------

# 19. OUTPUT / GALLERIA

Dopo la generazione:

-   anteprima;
-   zoom;
-   fullscreen;
-   salva;
-   apri cartella;
-   copia;
-   confronta;
-   privacy/occhio;
-   metadata;
-   workflow usato;
-   prompt;
-   seed;
-   modello;
-   data;
-   durata;
-   errori/warning.

Da un'immagine generata deve essere semplice tornare al workflow che
l'ha prodotta.

------------------------------------------------------------------------

# 20. AI ASSISTANT INTEGRATO

Pulsante:

**ASSISTENTE AI**

Apre una chat integrata.

Non deve servire soltanto a costruire workflow.

L'utente vuole poter fare **domande generiche e tecniche**, come in una
normale chat AI.

Esempi:

``` text
Perché questo nodo dà errore?
Quale dei miei modelli è migliore per questo workflow?
Cosa fa questo parametro?
Costruiscimi un workflow di coerenza usando ciò che ho installato.
Perché questa LoRA non appare?
Ottimizza il workflow senza cambiare il risultato.
```

## Provider

Progettare un'astrazione provider.

Possibili categorie:

-   modello locale;
-   OpenAI API;
-   Anthropic API;
-   altri provider futuri.

**Non assumere che un abbonamento consumer ChatGPT Plus/Pro equivalga
automaticamente all'accesso API.**

Le chiavi/API credential devono:

-   essere inserite dall'utente;
-   non essere hardcoded;
-   non finire nei log;
-   non finire nei repository;
-   essere conservate in modo sicuro.

L'assistente deve poter ricevere, con consenso/configurazione:

-   inventario;
-   workflow corrente;
-   nodo selezionato;
-   error log;
-   famiglia scelta;
-   modelli disponibili.

Questa è la differenza tra una chat generica e un vero **Comfy Director
Copilot**.

------------------------------------------------------------------------

# 21. AI TOOL LAYER

L'assistente non deve modificare il workflow manipolando direttamente la
UI.

Creare tool interni controllati, ad esempio:

``` text
get_current_workflow()
get_inventory()
get_selected_node()
search_nodes(capability)
search_models(family)
validate_workflow()
add_node(type)
remove_node(id)
connect_nodes(...)
set_node_parameter(...)
create_workflow(intent, family)
explain_error(...)
```

Le modifiche importanti devono poter essere:

-   mostrate in anteprima;
-   applicate;
-   annullate.

------------------------------------------------------------------------

# 22. SICUREZZA DELLE MODIFICHE AI

Mai lasciare che una risposta testuale dell'AI modifichi arbitrariamente
file o workflow.

Usare:

``` text
AI request
↓
structured tool call
↓
schema validation
↓
compatibility validation
↓
transaction
↓
UI update
```

Implementare undo/redo.

------------------------------------------------------------------------

# 23. KNOWLEDGE BASE LOCALE

Costruire una knowledge base locale che migliori nel tempo.

Deve registrare almeno:

-   nodi installati;
-   schema nodi;
-   famiglie modello;
-   workflow importati;
-   workflow validati;
-   combinazioni funzionanti;
-   errori osservati;
-   regole di compatibilità;
-   preferenze tecniche esplicite.

Non confondere "ha funzionato una volta" con "compatibile
universalmente".

Conservare provenienza e confidence.

------------------------------------------------------------------------

# 24. DATABASE / PERSISTENZA

Usare un database appropriato, per esempio SQLite se adatto
all'architettura scelta.

Entità indicative:

``` text
settings
comfy_instances
nodes
node_schemas
models
model_metadata
compatibility_rules
workflows
workflow_versions
characters
character_images
generations
prompts
errors
ai_providers
```

Le immagini/reference devono stare su filesystem/storage appropriato,
non dentro enormi record base64 se evitabile.

------------------------------------------------------------------------

# 25. DIAGNOSTICA

Creare una schermata:

**DIAGNOSTICA**

Deve mostrare:

-   stato Bridge;
-   URL;
-   ComfyUI version;
-   directory;
-   ultimo sync;
-   numero modelli;
-   numero nodi;
-   custom node mancanti;
-   workflow invalidi;
-   API provider status;
-   error log;
-   test rapido.

Aggiungere:

**ESPORTA REPORT DIAGNOSTICO**

Nascondere/redigere API key e segreti.

------------------------------------------------------------------------

# 26. VALIDATORE WORKFLOW

Prima di GENERA:

``` text
✓ model
✓ text encoder
✓ VAE
✓ required inputs
✓ node types
✓ graph connections
✓ reference image
✓ prompt
⚠ compatibility warnings
```

Se c'è un errore:

non limitarsi a:

``` text
Error
```

Mostrare qualcosa come:

``` text
IPAdapter X richiede un model type diverso da quello selezionato.
Possibili soluzioni:
1. sostituisci IPAdapter con ...
2. cambia famiglia modello
3. apri dettagli
```

------------------------------------------------------------------------

# 27. IMPORT / EXPORT

Supportare progressivamente:

-   workflow JSON;
-   ComfyUI workflow;
-   API workflow;
-   immagini con metadata;
-   Character Pack;
-   preset;
-   backup completo Comfy Director.

Mai distruggere l'originale durante un'importazione.

------------------------------------------------------------------------

# 28. BACKUP E VERSIONING

Workflow:

``` text
workflow
workflow_version
```

Ogni modifica importante può creare checkpoint.

Funzioni:

-   cronologia;
-   ripristina;
-   duplica;
-   confronta.

Anche il progetto software deve avere versioni/changelog.

------------------------------------------------------------------------

# 29. PRIVACY

L'app è pensata soprattutto per uso locale.

Principi:

-   reference locali rimangono locali salvo scelta esplicita;
-   indicare chiaramente quando un'immagine/prompt viene inviato a un
    provider cloud;
-   API key protette;
-   nessun upload nascosto;
-   privacy toggle per anteprime sensibili;
-   log senza segreti.

L'app non deve aggiungere arbitrariamente un proprio filtro sui modelli
locali; deve comunque rispettare i requisiti legali e le policy dei
provider esterni eventualmente configurati.

------------------------------------------------------------------------

# 30. TECNOLOGIA --- NON DECIDERE ALLA CIECA

Claude Code deve prima valutare l'architettura migliore.

Requisiti:

-   uso principale su PC Windows;
-   UI web/desktop a schermo pieno;
-   accesso al filesystem locale tramite backend;
-   comunicazione robusta con ComfyUI;
-   node graph performante;
-   possibile futuro accesso da tablet/LAN;
-   packaging futuro come applicazione desktop.

Una possibile architettura è:

``` text
Frontend: TypeScript + React
Node graph: libreria graph professionale valutata tecnicamente
Backend/Bridge: Python FastAPI oppure Node, motivando la scelta
DB: SQLite
Realtime: WebSocket
```

Ma NON considerare questa scelta obbligatoria senza audit.

Prima produrre:

**ARCHITECTURE_DECISION.md**

con motivazioni e trade-off.

------------------------------------------------------------------------

# 31. STRUTTURA DEL REPOSITORY

Esempio concettuale:

``` text
comfy-director/
  apps/
    frontend/
    bridge/
  packages/
    workflow-core/
    compatibility-engine/
    comfy-client/
    shared-types/
  data/
  docs/
  tests/
  scripts/
  README.md
  ARCHITECTURE_DECISION.md
  CHANGELOG.md
```

Adattare se esiste una struttura migliore.

------------------------------------------------------------------------

# 32. API INTERNE

Definire contratti tipizzati.

Esempi concettuali:

``` text
GET /health
GET /comfy/status
POST /comfy/sync

GET /inventory/models
GET /inventory/nodes

POST /compatibility/query
POST /workflow/validate
POST /workflow/compile
POST /workflow/generate

GET /characters
POST /characters
POST /characters/:id/images
```

Non considerare questi endpoint definitivi: progettare API coerenti.

------------------------------------------------------------------------

# 33. REALTIME

Usare WebSocket/event stream per:

-   progress;
-   queue;
-   execution node;
-   completion;
-   error;
-   bridge status.

La UI deve poter evidenziare sulla canvas il nodo attualmente in
esecuzione se ComfyUI fornisce dati sufficienti.

------------------------------------------------------------------------

# 34. ERROR HANDLING

Gestire esplicitamente:

-   ComfyUI spento;
-   porta errata;
-   modello spostato;
-   nodo disinstallato;
-   schema nodo cambiato;
-   workflow vecchio;
-   API key mancante;
-   timeout;
-   VRAM error;
-   execution error;
-   output mancante.

Non perdere il lavoro dell'utente in caso di errore.

------------------------------------------------------------------------

# 35. PERFORMANCE

L'inventario potrebbe diventare grande.

Quindi:

-   indicizzazione;
-   cache;
-   sync incrementale quando possibile;
-   virtualizzazione liste;
-   ricerca veloce;
-   lazy loading;
-   evitare scansioni complete ad ogni click.

------------------------------------------------------------------------

# 36. RICERCA

Ricerca globale:

``` text
LoRA...
Checkpoint...
IPAdapter...
Nodo...
Workflow...
Personaggio...
```

Il motore di ricerca deve rispettare i filtri di compatibilità correnti.

Possibilità:

**Mostra incompatibili**

come toggle avanzato.

Gli incompatibili devono avere motivo visibile.

------------------------------------------------------------------------

# 37. MODALITÀ SEMPLICE E AVANZATA

### SEMPLICE

L'app decide/proporre la maggior parte della struttura.

### AVANZATA

L'utente può:

-   vedere tutto;
-   aggiungere nodi;
-   modificare collegamenti;
-   forzare una scelta incompatibile con warning;
-   modificare parametri.

Non togliere potenza per rendere semplice la UI.

------------------------------------------------------------------------

# 38. UX --- PRINCIPIO

La schermata centrale deve rimanere libera.

Non mostrare contemporaneamente 50 pannelli.

Usare:

-   pulsanti laterali;
-   pannelli contestuali;
-   modal/sheet;
-   categorie richiudibili;
-   ricerca;
-   breadcrumb quando utile.

Il pannello destro deve essere principalmente contestuale.

------------------------------------------------------------------------

# 39. GOOGLE DRIVE / CLOUD FILE

Prevedere l'architettura per sorgenti multiple:

``` text
PC
drag & drop
Google Drive
altro cloud futuro
```

Non fingere che Google Drive funzioni con un semplice
`<input type=file>`.

Deve essere un'integrazione reale quando implementata.

------------------------------------------------------------------------

# 40. TEST

Test minimi:

### Bridge

-   health;
-   object info;
-   timeout;
-   Comfy offline.

### Inventory

-   rilevamento;
-   aggiornamento;
-   file rimosso;
-   duplicato.

### Compatibility

-   compatible;
-   incompatible;
-   unknown;
-   conflicting rules.

### Workflow

-   serialize/deserialize;
-   add/remove node;
-   connection validation;
-   required inputs.

### Comfy compilation

-   internal graph → API payload;
-   payload validation.

### Characters

-   create;
-   image add/remove;
-   persistence.

### Metadata import

-   Comfy image con workflow;
-   immagine senza workflow.

------------------------------------------------------------------------

# 41. ROADMAP OBBLIGATORIA

NON tentare di costruire tutto in una singola modifica gigantesca.

## FASE 0 --- AUDIT

Produrre:

``` text
AUDIT.md
ARCHITECTURE_DECISION.md
IMPLEMENTATION_PLAN.md
```

Nessuna falsa feature.

## FASE 1 --- FONDAZIONE

-   repository;
-   frontend;
-   backend Bridge;
-   DB;
-   settings;
-   logging;
-   health.

**Definition of Done:** app avviabile e Bridge realmente collegabile.

## FASE 2 --- INVENTARIO REALE

-   `/object_info`;
-   node schema;
-   modelli;
-   directory;
-   sync;
-   DB.

**DoD:** ciò che appare deriva dall'ambiente reale.

## FASE 3 --- CANVAS REALE

-   internal graph;
-   nodes;
-   edges;
-   select;
-   property panel;
-   dynamic widgets.

**DoD:** cambiare canvas modifica realmente il workflow model.

## FASE 4 --- COMPATIBILITY ENGINE V1

-   family detection;
-   compatibility records;
-   reason/source/confidence;
-   filtering.

**DoD:** l'app non propone indiscriminatamente componenti incompatibili.

## FASE 5 --- WORKFLOW BUILDER

-   intent;
-   capabilities;
-   templates;
-   validation;
-   candidate workflow.

Priorità:

**CHARACTER CONSISTENCY**

## FASE 6 --- GENERAZIONE

-   compile;
-   queue;
-   progress;
-   output;
-   abort;
-   history.

**DoD:** workflow creato nell'app genera realmente attraverso ComfyUI.

## FASE 7 --- PERSONAGGI

-   library;
-   multi-reference;
-   persistence;
-   workflow integration.

## FASE 8 --- IMPORT

-   workflow JSON;
-   metadata image;
-   workflow from Comfy image.

## FASE 9 --- PROMPT ENGINE

-   IT→EN;
-   provider abstraction;
-   local/cloud.

## FASE 10 --- AI ASSISTANT

-   chat;
-   context;
-   tools;
-   controlled edits.

## FASE 11 --- HARDENING

-   diagnostics;
-   backups;
-   migration;
-   tests;
-   performance;
-   packaging.

------------------------------------------------------------------------

# 42. DEFINITION OF DONE GENERALE

Una feature NON è "fatta" perché esiste il pulsante.

È fatta soltanto quando:

1.  UI presente;
2.  backend presente se necessario;
3.  dati persistenti;
4.  error handling;
5.  test;
6.  stato reale;
7.  documentazione;
8.  non rompe feature precedenti.

Esempio:

**"Bridge fatto"** non significa che esiste il pulsante Bridge.

Significa:

``` text
ComfyUI spento → OFFLINE corretto
ComfyUI acceso → ONLINE
/object_info letto
inventario aggiornato
errori mostrati
reconnect possibile
test automatico presente
```

------------------------------------------------------------------------

# 43. PRIMA CONSEGNA RICHIESTA A CLAUDE CODE

Quando ricevi questo documento, NON partire creando una UI completa.

Per prima cosa:

1.  leggi interamente questa specifica;
2.  riassumi i requisiti senza eliminarne nessuno;
3.  individua rischi e ambiguità;
4.  scegli e motiva lo stack;
5.  crea `AUDIT.md`;
6.  crea `ARCHITECTURE_DECISION.md`;
7.  crea `IMPLEMENTATION_PLAN.md`;
8.  definisci il modello dati;
9.  definisci i confini dei moduli;
10. definisci come interrogherai ComfyUI;
11. definisci come costruirai Compatibility Engine e Workflow
    Intelligence Engine;
12. definisci i test;
13. SOLO DOPO comincia la Fase 1.

Non chiedere all'utente di scegliere dettagli tecnici che puoi
determinare tramite audit.

Chiedi conferma soltanto quando una decisione cambia realmente il
comportamento desiderato.

------------------------------------------------------------------------

# 44. CHECKLIST DELLA VISIONE UTENTE

Prima di dichiarare il progetto completo, verificare che l'utente possa
realmente fare questo:

``` text
[ ] Apro Comfy Director
[ ] Collego ComfyUI
[ ] L'app legge i miei nodi
[ ] L'app legge i miei modelli
[ ] Aggiungo nuovi modelli e posso risincronizzare
[ ] Scelgo "Coerenza Personaggio"
[ ] Scelgo FLUX/Qwen/WAN o altra famiglia disponibile
[ ] Vedo soltanto opzioni sensate/compatibili
[ ] Scelgo un personaggio salvato
[ ] L'app propone un workflow
[ ] Vedo il workflow sulla canvas
[ ] Vedo i nodi e i fili
[ ] Se clicco un nodo vedo i parametri REALI
[ ] Posso cambiare quei parametri
[ ] Scrivo il prompt in italiano
[ ] Ottengo il prompt inglese
[ ] Posso modificare manualmente il prompt
[ ] Premo GENERA
[ ] ComfyUI esegue
[ ] Vedo progress/errori
[ ] Ricevo l'immagine
[ ] Posso tornare dal risultato al workflow
[ ] Posso caricare un'immagine ComfyUI e recuperarne il workflow se presente
[ ] Posso caricare una qualsiasi immagine e ricavarne un prompt
[ ] Posso aprire la chat AI
[ ] L'AI conosce il workflow corrente e il mio inventario quando autorizzata
[ ] L'AI può spiegare problemi
[ ] L'AI può proporre modifiche controllate
[ ] Posso annullare le modifiche
[ ] Nessuna funzione critica è soltanto simulata
```

------------------------------------------------------------------------

# 45. NOTA FINALE PER CLAUDE CODE

Questo progetto NON deve diventare "un altro ComfyUI".

Deve essere:

> **un direttore intelligente di ComfyUI.**

ComfyUI fornisce il motore e l'ecosistema di nodi.

Comfy Director deve fornire:

-   comprensione;
-   selezione;
-   compatibilità;
-   costruzione guidata;
-   organizzazione;
-   diagnostica;
-   personaggi;
-   prompt;
-   assistenza AI;
-   esperienza d'uso semplice.

La priorità tecnica assoluta è:

``` text
BRIDGE REALE
     ↓
INVENTARIO REALE
     ↓
COMPATIBILITY ENGINE
     ↓
WORKFLOW INTELLIGENCE
     ↓
CANVAS REALE
     ↓
GENERATION
```

Non invertire queste priorità solo per produrre velocemente una UI
appariscente.

**Prima il cuore. Poi la carrozzeria.**
