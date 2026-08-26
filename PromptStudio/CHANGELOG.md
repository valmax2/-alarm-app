# Changelog — Prompt Studio

Versione mostrata in alto a destra nell'app, accanto all'icona Archivio.
Da qui in poi, ogni round di modifiche aggiorna il numero e questa pagina.

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
