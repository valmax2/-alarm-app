# Server locale gratuito per VoiceClone Studio

Fa girare sul tuo PC lo stesso motore di clonazione vocale (Coqui **XTTS-v2**, open source,
gratuito) che probabilmente stai già usando, e lo rende raggiungibile dall'app Android sulla
tua rete di casa — **zero costi, nessuna chiave API**. Il telefono manda testo + i campioni
della voce, il PC genera l'audio e lo rimanda indietro.

## Limite da sapere

XTTS-v2 fa **testo → voce clonata** (quello che nell'app è la tab "Testo → voce"), non
conversione audio→audio. La tab "Conversione" dell'app resta disponibile solo con il backend
ElevenLabs (a pagamento) — se ti serve gratis, serve un programma diverso (es. RVC), non
coperto da questo server.

## Installazione

Se hai già un ambiente Python con `TTS` (Coqui) funzionante per il tuo uso attuale:

```bash
pip install fastapi uvicorn python-multipart
```

...e basta, il resto (torch, TTS) ce l'hai già. Altrimenti, da zero:

```bash
cd VoiceCloneStudio/server
pip install -r requirements.txt
```

Se hai una GPU NVIDIA la userà automaticamente (molto più veloce); senza, funziona lo stesso
sulla CPU, solo più lentamente.

## Avvio

```bash
python xtts_server.py
```

La prima chiamata scarica il modello XTTS-v2 (qualche GB, solo la prima volta) e lo carica in
memoria — la primissima generazione richiede quindi un po' di più. Il server resta poi in
ascolto sulla porta **8020**.

## Collegare il telefono

1. Assicurati che il telefono sia sulla **stessa rete WiFi** del PC
2. Trova l'indirizzo IP locale del PC:
   - Windows: apri il Prompt dei comandi, digita `ipconfig`, cerca "Indirizzo IPv4"
   - Mac/Linux: apri il Terminale, digita `ifconfig` (o `ip addr`), cerca qualcosa come
     `inet 192.168.1.XX`
3. Nell'app, in **Impostazioni → Server personale**, inserisci:
   ```
   http://192.168.1.XX:8020
   ```
   (con il tuo indirizzo IP reale) e tocca "Verifica connessione"

Se il PC va in stop/sospensione o il server non è avviato, l'app non riesce a collegarsi —
deve restare acceso e con `xtts_server.py` in esecuzione mentre usi l'app.
