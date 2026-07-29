# Prompt Director V3.4 — Comic Studio

Applicazione web statica in HTML, CSS e JavaScript vanilla per creare prompt, gestire personaggi coerenti, workflow ComfyUI, regia visuale, provider esterni, scene e archivio.

## Novità V3.4

- **Import workflow ComfyUI "normale":** oltre al formato API, ora si può importare anche il workflow salvato di default da ComfyUI (`Save`, con `nodes`/`links`). Viene convertito automaticamente in formato API leggendo `/object_info` da una connessione ComfyUI attiva, e da lì si mappa esattamente come un workflow API.
- **Nomi personalizzati per i nodi:** nel pannello "Mappa nodi" si può assegnare un nome semplice a ogni nodo (utile per custom node poco leggibili); se il workflow importato aveva già un titolo da ComfyUI, viene ripreso automaticamente.
- **Scheda "Crea Scena" riorganizzata in accordion:** Stile e formato, Qualità visiva, Personaggio coerente & Sanitizer, Regia (camera/luce/composizione) sono ora sezioni richiudibili, per un'interfaccia più pulita.
- **Archivio molto più ricco:** Illuminazione (6 → 24 opzioni), Composizione (4 → 16 opzioni), Qualità visiva (6 → 20 opzioni), più un nuovo selettore **Obiettivo / lente** (13 opzioni: grandangolo, teleobiettivo, fisheye, macro, tilt-shift, anamorfico, profondità di campo, drone...).
- **Header e barra tab più compatti**, sempre fissi in alto durante lo scroll.
- Corretto un bug per cui "Carica scena" rompeva le interazioni successive del Director's Mode.

## Novità V3.3

- **Anti-duplicazione della dettatura:** i risultati provvisori sono mostrati solo come anteprima; vengono inseriti esclusivamente i risultati finali e ogni frase finale ripetuta dal browser viene ignorata.

- Pulsante **🎤 Detta** sotto i campi testuali dell'app.
- Dettatura continua con Web Speech API.
- Inserimento nel punto del cursore senza cancellare il testo esistente.
- Comandi vocali italiani: “virgola”, “punto”, “punto interrogativo”, “punto esclamativo”, “due punti”, “punto e virgola”, “a capo” e “nuova riga”.
- Lingua selezionabile dall'intestazione.
- Indicatore visibile “In ascolto” e pulsante di arresto.
- Gestione dei principali errori e browser non compatibili.
- Smart Replacement Dictionary e Prompt Sanitizer conservati.

## Avvio consigliato su Windows

1. Estrai completamente lo ZIP.
2. Fai doppio clic su `AVVIA_WINDOWS.bat`.
3. Apri l'indirizzo mostrato, normalmente `http://127.0.0.1:8080`.
4. Usa Chrome o Edge e autorizza il microfono quando richiesto.

La dettatura può non funzionare aprendo direttamente `index.html` tramite `file://`, perché i browser richiedono in genere un contesto sicuro. L'avvio tramite localhost risolve questa limitazione.

## ComfyUI

Avvia ComfyUI, configura host e porta nella scheda Connessione e importa un workflow esportato in formato API. Usa “Mappa nodi” per associare i campi reali del workflow.

## Privacy

Personaggi, workflow, scene e archivio restano nel browser tramite IndexedDB/localStorage. La Web Speech API può usare il servizio di riconoscimento vocale del browser; il comportamento dipende dal browser utilizzato.


## Novità V3.3
- Correzione dettatura duplicata: solo risultati finali, filtro di frasi ripetute, parole adiacenti e sovrapposizioni.
- Freccia verde “SGUARDO” visibile in tutte e tre le finestre del Director’s Mode.
- Backup Vault: salvataggio esterno in una cartella scelta, backup automatico ogni 5 minuti, esportazione e ripristino JSON.

Il file esterno non viene cancellato quando si eliminano i dati del browser. Dopo la pulizia, riaprire l’app e importare `prompt-director-backup.json`.
