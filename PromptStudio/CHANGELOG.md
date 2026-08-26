# Changelog — Prompt Studio

Versione mostrata in alto a destra nell'app, accanto all'icona Archivio.
Da qui in poi, ogni round di modifiche aggiorna il numero e questa pagina.

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
