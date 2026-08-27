# Changelog — Prompt Studio

Versione mostrata in alto a destra nell'app, accanto all'icona Archivio.
Da qui in poi, ogni round di modifiche aggiorna il numero e questa pagina.

## v0.3.4

- **Trovato (grazie a un video che mi hai mandato!) il vero motivo per cui
  la sezione "Prompt" con la freccia ⬇️ a volte non si vede proprio, con
  nessun workflow reale**: il codice riconosceva un nodo come "prompt"
  solo se si chiamava esattamente `CLIPTextEncode`. Il tuo workflow
  (Qwen + ClownsharKSampler) usa un nodo diverso per il testo — quindi la
  sezione Prompt non veniva disegnata affatto, non era un problema di
  scroll. Ora il riconoscimento è molto più permissivo: qualunque nodo il
  cui nome assomigli a testo/prompt/encode viene controllato per un campo
  di testo plausibile, indipendentemente dal nome esatto del nodo o del
  campo. Riempire/aggiornare il prompt ora scrive nel campo giusto anche
  per questi workflow non standard.

## v0.3.3

- **Nuova opzione "📋 Incolla testo"** in ogni finestra di importazione file
  di testo/JSON (workflow, inventario): oltre a "Gestore file / Cloud" e
  alle due cartelle sul PC, ora puoi anche incollare direttamente il
  contenuto del file in un riquadro di testo. Serve soprattutto quando il
  selettore file del telefono/browser non si apre (es. dentro pagine di
  anteprima "chiuse" come l'anteprima mobile) — incollare il testo
  funziona sempre, in qualunque situazione.

## v0.3.2

- **Corretto "Importa workflow JSON" (ComfyUI Studio → Libreria Workflow)**:
  quando il Bridge era raggiungibile, importare un file salvava il
  workflow in libreria ma **non lo rendeva quello attivo** — restava solo
  un messaggio che spariva in fretta, e l'Editor continuava a mostrare
  qualsiasi altro workflow (o nessuno) fosse attivo prima. Sembrava che
  "importare non facesse niente". Ora importare un workflow lo rende
  subito quello attivo e ti porta direttamente nell'Editor con il suo
  contenuto vero, come già succedeva scegliendo "Seleziona" da un
  workflow già in libreria.

## v0.3.1

- **Trovato e corretto il vero motivo per cui cambiare telecamera, vestiti
  o fisico "non cambiava niente"**: molte categorie a pulsanti (es.
  Corporatura: Magra/Curvy/Atletica...) permettevano di tenere selezionate
  contemporaneamente due opzioni in contraddizione fra loro (es. "Magra" E
  "Curvy" entrambe attive) — il pulsante nuovo si aggiungeva invece di
  sostituire il vecchio, quindi il prompt finale restava con la
  descrizione vecchia ancora dentro, mischiata con quella nuova, e il
  risultato non cambiava in modo visibile.
- Ora le categorie che descrivono UN solo tratto (Corporatura, Altezza,
  Vita, Fianchi, Braccia, tono/dimensione di Seno/Sedere/Gambe/Pelle,
  Forma del volto, Età apparente, Colore occhi, Livello di nudità/
  abbigliamento, e altre) funzionano a scelta singola: selezionarne una
  nuova sostituisce sempre la precedente, come un interruttore.
- Le categorie "Seno", "Gambe", "Pelle", "Sedere", "Torso" e "Petto" sono
  state divise in sotto-categorie più precise (es. Seno → dimensione /
  sodezza / forma / posizione) così restano comunque combinabili tra loro
  quando ha senso (es. "piccolo" + "cadente" + "a goccia" insieme), ma non
  più contraddittorie all'interno della stessa sotto-categoria.
- Corretto anche un bug più profondo nell'interfaccia: cliccando un
  pulsante veniva aggiornato solo quel pulsante a schermo, quindi in una
  categoria a scelta singola il vecchio pulsante restava visivamente
  "acceso" anche se non lo era più nei dati.

## v0.3.0

- **Telecamera "da professionista", riscritta**: ora ha due viste
  sincronizzate — dall'alto (orbita per frontale/3-4/profilo/posteriore,
  come prima) e **laterale** (nuova: trascina su/giù per regolare
  l'altezza della camera, dal terreno fino a sopra la testa; il cono
  punta sempre verso il volto del soggetto, quindi a terra si inclina
  automaticamente verso l'alto). Aggiunta anche una **rotella di zoom**
  condivisa che, mentre la trascini, avvicina/allontana in tempo reale
  la fotocamera (e stringe/allarga il cono) in ENTRAMBE le viste
  contemporaneamente.
- **Corretto un bug serio**: ComfyUI continuava a generare sempre la
  stessa immagine anche cambiando scena/oggetti/luoghi nel percorso
  guidato. Causa: la scritta "✅ prompt già inserito" nell'editor del
  workflow controllava solo il progetto, non il testo — quindi restava
  "verde" anche quando il testo nel workflow era ormai vecchio, e la
  schermata Genera non lo segnalava né mostrava cosa stava per essere
  inviato. Ora: editor e schermata Genera mostrano un avviso chiaro
  quando il prompt è "vecchio" (e bloccano la generazione finché non lo
  aggiorni), e la schermata Genera mostra sempre il testo esatto che
  sta per essere inviato a ComfyUI.
- **Aggiunta randomizzazione del seed** (attiva di default, disattivabile)
  ad ogni generazione: con lo stesso prompt e lo stesso seed, ComfyUI
  riusa la sua cache interna e restituisce di nuovo l'identica immagine
  — questo evitava variazione anche a prompt corretto.

## v0.2.0

- **Pallini step numerati e cliccabili**: in cima al percorso guidato ora
  ogni pallino mostra il numero dello step ed è un pulsante — un tap e
  salti subito a quello step, avanti o indietro.
- **Telecamera interattiva a 360°** nello Step 7 (Camera e luce): trascina
  l'icona della fotocamera intorno al soggetto per scegliere il punto di
  vista (frontale, 3/4, profilo, posteriore); un cono indica sempre
  l'inquadratura verso il soggetto, una freccina verde fissa mostra dove
  guarda il soggetto. Gli angoli verticali (low angle, dal basso, top
  down, ecc.) restano pulsanti extra separati, senza essere cancellati
  dal trascinamento.
- **Corpo molto più dettagliato**: seno (18 varianti: dimensione, sodezza,
  forma, posizione — a coppa di champagne, cadente, naturale, ecc.),
  sopracciglia (12 varianti: folte, piccole, ad ala di gabbiano, ecc.),
  stili di peli pubici (rasato, a triangolo, a striscia, corto, folto).
- **Nuova sezione "Abbigliamento / Nudità"** nello Step 2 (Corpo), sempre a
  pulsanti: livello di nudità (nuda/o, topless, solo intimo, vestita/o...),
  intimo/lingerie (reggiseno di pizzo, perizoma, reggicalze...), coperture
  (lenzuolo, accappatoio aperto, asciugamano...).
- **Pose molto più ricche**: da 13 a oltre 40 pose, divise in 5 gruppi
  (orientamento, in piedi, seduta/sdraiata, dinamica, espressiva/artistica).
- **Filtri per le immagini generate** (🎨 Filtri, in ComfyUI Studio e in
  Archivio → Immagini): pellicola calda/fredda, vintage, bianco e nero,
  cinematografico, morbido/soft glow, grana pellicola, desaturato,
  vignettatura — per un risultato meno "artificiale". Il filtro viene
  salvato come nuova immagine, l'originale resta intatto.
- **Corretto**: il prompt finale (Step 8) poteva "congelarsi" dopo una
  modifica manuale, ignorando in silenzio le modifiche fatte dopo tornando
  indietro agli step precedenti (es. aggiungendo dettagli alla scena). Ora
  compare un avviso chiaro con un pulsante per rigenerarlo dagli step.

## v0.1.1

- **Le immagini generate con ComfyUI ora vengono salvate davvero
  nell'Archivio dell'app** (prima venivano solo mostrate a video, prese
  al volo da ComfyUI, e sparivano se non le scaricavi a mano). Ora
  compaiono anche in Archivio → Immagini, con l'occhio di privacy come
  tutte le altre foto.

## v0.1.0

Prima versione tracciata. Comprende tutto il lavoro fatto finora:

**Modulo 1 — Crea personaggio / prompt**
- Percorso guidato a 8 step (persona, corpo, volto, capelli, azione/posa,
  scena, camera/luce, prompt finale)
- Libreria corpo estesa con glossario anatomico completo (9 sotto-categorie)
- Ogni pulsante mostra italiano sopra / inglese sotto
- Tassello "➕ Aggiungi" in ogni categoria: crea pulsanti personalizzati
  (dettatura vocale + traduzione automatica IT→EN), salvati per sempre
- Identity Lock per foto di riferimento, con occhio di privacy unificato
  (nascondere una foto la nasconde ovunque appaia nell'app)

**Modulo 2 — ComfyUI Studio**
- Bridge locale (Python, nessuna dipendenza esterna) con scansione
  inventario, libreria workflow, generazione
- Editor workflow: Checkpoint e LoRA come menu a tendina raggruppati per
  famiglia rilevata (compatibilità verde/giallo/rosso), non testo libero
- Assegnazione immagini ai nodi Load Image: da file, da un personaggio
  salvato in Archivio, o dalla reference del progetto corrente
- Avvisi preventivi prima di generare: immagini mancanti, nodi/custom
  node non installati
- Card guidata "prossimo passo" (scegli workflow → inserisci prompt →
  genera)
- Messaggi di errore leggibili da ComfyUI invece di traceback grezzi

**Modulo 3 — Genera con IA esterne**
- Conversione del prompt in testo naturale per ChatGPT/Gemini/Meta AI

**Archivio**
- Personaggi con Reference Pack, progetti salvati, galleria immagini

**Generale**
- `AVVIA_TUTTO.bat`: un doppio clic avvia Bridge + server + browser
- Anteprima mobile pubblicata (senza Bridge/ComfyUI, solo Moduli 1 e 3)
