"""Lettura dell'header `.safetensors` — SOLO l'header JSON, mai i tensori.

Formato del contenitore `.safetensors` (specifica pubblica, stabile): i primi 8 byte
sono la lunghezza dell'header in byte (intero a 64 bit, little-endian), seguiti da
quella quantità di byte di JSON UTF-8. I dati dei tensori veri e propri vengono dopo e
non vengono mai letti qui — questo rende la lettura economica anche su file di più GB
(§35 della spec: evitare scansioni pesanti inutili).

Usato da Fase 2 SOLO quando il Bridge ha accesso diretto al file (percorso modelli
configurato e risolvibile sul filesystem locale del Bridge stesso — non garantito se
Bridge e ComfyUI girano su macchine diverse, vedi ARCHITECTURE_DECISION.md). Quando non
disponibile, la family detection ripiega sull'euristica del nome file (bassa
confidenza, mai spacciata per certa — vedi family_detection.py).
"""

from __future__ import annotations

import json
import struct
from pathlib import Path

# Un header .safetensors reale è tipicamente pochi KB, al massimo qualche MB per
# checkpoint con moltissimi tensori. Un file che non è realmente in formato
# .safetensors (es. rinominato per errore, corrotto, o un altro formato con la stessa
# estensione) può avere nei primi 8 byte dati arbitrari che, interpretati come intero
# a 64 bit, producono un numero enorme: senza un limite, `f.read(header_len)` proverebbe
# ad allocare gigabyte/terabyte di memoria (MemoryError reale, osservato in verifica
# manuale) invece di fallire in modo pulito. Questo limite protegge la sync da un
# singolo file malformato senza far crashare l'intero processo.
_MAX_PLAUSIBLE_HEADER_BYTES = 64 * 1024 * 1024  # 64 MB


class SafetensorsHeaderError(Exception):
    """File assente, troppo corto, header implausibile, o non decodificabile come JSON."""


def read_safetensors_header(path: Path) -> dict:
    try:
        file_size = path.stat().st_size
        with path.open("rb") as f:
            length_bytes = f.read(8)
            if len(length_bytes) < 8:
                raise SafetensorsHeaderError(f"{path}: file troppo corto per un header .safetensors valido")
            (header_len,) = struct.unpack("<Q", length_bytes)

            if header_len > _MAX_PLAUSIBLE_HEADER_BYTES or header_len > file_size:
                raise SafetensorsHeaderError(
                    f"{path}: lunghezza header dichiarata ({header_len} byte) implausibile "
                    "— probabilmente non è un vero file .safetensors"
                )

            header_bytes = f.read(header_len)
            if len(header_bytes) < header_len:
                raise SafetensorsHeaderError(f"{path}: header troncato (letti {len(header_bytes)}/{header_len} byte)")
    except OSError as exc:
        raise SafetensorsHeaderError(f"{path}: impossibile leggere il file ({exc})") from exc

    try:
        header = json.loads(header_bytes)
    except json.JSONDecodeError as exc:
        raise SafetensorsHeaderError(f"{path}: header non è JSON valido") from exc

    if not isinstance(header, dict):
        raise SafetensorsHeaderError(f"{path}: header JSON non è un oggetto")
    return header
