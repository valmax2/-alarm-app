#!/usr/bin/env python3
"""
Server locale gratuito per VoiceClone Studio — nessuna chiave API, nessun costo.

Espone via HTTP, sulla rete di casa, il modello Coqui XTTS-v2 già installato sul PC (lo stesso
motore di clonazione vocale multilingua open source, ottimo in italiano). L'app Android si
collega a questo server (Impostazioni -> "Server personale") invece che a un servizio cloud a
pagamento: il PC fa il lavoro pesante, il telefono fa solo da telecomando.

Uso:
    pip install -r requirements.txt
    python xtts_server.py

Poi, sul telefono (sulla stessa rete WiFi del PC), in Impostazioni dell'app inserisci:
    http://<indirizzo IP del PC>:8020
Trovi l'indirizzo IP del PC con `ipconfig` (Windows) o `ifconfig`/`ip addr` (Mac/Linux) —
di solito qualcosa come 192.168.1.XX.
"""

import io
import tempfile
from pathlib import Path
from typing import List, Optional

import torch
import uvicorn
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

MODEL_NAME = "tts_models/multilingual/multi-dataset/xtts_v2"
PORT = 8020

app = FastAPI(title="VoiceClone Studio — server locale")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_tts = None  # caricato al primo avvio, non all'importazione — lo start-up dell'app resta veloce


def get_tts():
    global _tts
    if _tts is None:
        from TTS.api import TTS  # import ritardato: pesante, e non serve finché non arriva una richiesta

        gpu = torch.cuda.is_available()
        print(f"Carico {MODEL_NAME} (GPU: {'sì' if gpu else 'no, uso la CPU — sarà più lento'})...")
        _tts = TTS(MODEL_NAME, gpu=gpu)
        print("Modello pronto.")
    return _tts


@app.get("/health")
def health():
    return {"status": "ok", "gpu": torch.cuda.is_available()}


@app.post("/tts")
async def synthesize(
    text: str = Form(...),
    language: str = Form("it"),
    speed: float = Form(1.0),
    speaker_wav: List[UploadFile] = File(...),
):
    """
    Genera audio a partire da un testo, clonando la voce dai file audio di riferimento
    caricati in speaker_wav (uno o più — più campioni, meglio è). Ritorna un file WAV.
    """
    tts = get_tts()

    # I file arrivano come upload multipart: li salviamo in file temporanei perché la libreria
    # TTS si aspetta percorsi su disco, non byte in memoria.
    with tempfile.TemporaryDirectory() as tmpdir:
        speaker_paths = []
        for i, upload in enumerate(speaker_wav):
            dest = Path(tmpdir) / f"speaker_{i}_{upload.filename}"
            dest.write_bytes(await upload.read())
            speaker_paths.append(str(dest))

        output_path = str(Path(tmpdir) / "output.wav")

        # Alcune versioni della libreria TTS non accettano il parametro speed su tts_to_file:
        # se fallisce per quel motivo, riprova senza — meglio un audio a velocità di default
        # che un errore.
        try:
            tts.tts_to_file(
                text=text,
                speaker_wav=speaker_paths,
                language=language,
                file_path=output_path,
                speed=speed,
            )
        except TypeError:
            tts.tts_to_file(
                text=text,
                speaker_wav=speaker_paths,
                language=language,
                file_path=output_path,
            )

        audio_bytes = Path(output_path).read_bytes()

    return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/wav")


if __name__ == "__main__":
    # 0.0.0.0 così è raggiungibile da altri dispositivi sulla stessa rete (il telefono), non
    # solo dal PC stesso.
    uvicorn.run(app, host="0.0.0.0", port=PORT)
