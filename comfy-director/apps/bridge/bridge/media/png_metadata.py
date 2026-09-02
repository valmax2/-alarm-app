"""Lettura dei chunk di testo PNG (`tEXt`, `zTXt`, `iTXt`) — nessuna dipendenza esterna.

ComfyUI salva le immagini generate incorporando il workflow direttamente nel file PNG,
tipicamente come chunk `tEXt`/`iTXt` con keyword `prompt` (il grafo in formato API,
quello effettivamente inviato) e/o `workflow` (il grafo in formato UI, con posizioni e
gruppi — quello da cui si può ricostruire la canvas). Questo modulo legge quei chunk
così come sono, senza interpretarli: l'interpretazione (JSON→grafo) è responsabilità di
`bridge.workflow_import` (spec §8: "Workflow da Immagine").

Formato PNG (specifica pubblica, stabile): 8 byte di signature, poi una sequenza di
chunk `[length(4, big-endian) type(4, ASCII) data(length) crc(4, big-endian)]` fino a
`IEND`. Qui leggiamo SOLO l'involucro dei chunk (mai decodifica dei pixel) — economico
anche su immagini grandi.
"""

from __future__ import annotations

import struct
import zlib

_PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


class PngParseError(Exception):
    """Il file non è un PNG valido (signature assente) o un chunk è malformato/troncato."""


def read_png_text_chunks(data: bytes) -> dict[str, str]:
    """Ritorna `{keyword: testo}` da tutti i chunk `tEXt`/`zTXt`/`iTXt` trovati.

    Se una keyword compare più volte, vince l'ultima occorrenza (comportamento
    ragionevole e documentato, non un'assunzione nascosta). Chunk singolarmente
    malformati (es. `zTXt` con dati compressi corrotti) vengono ignorati con un
    keyword mancante piuttosto che far fallire l'intera lettura — un file "quasi
    valido" non deve impedire di leggere gli altri metadata presenti.
    """
    if not data.startswith(_PNG_SIGNATURE):
        raise PngParseError("Il file non inizia con la signature PNG attesa")

    result: dict[str, str] = {}
    offset = len(_PNG_SIGNATURE)
    total = len(data)

    while offset + 8 <= total:
        (length,) = struct.unpack(">I", data[offset : offset + 4])
        chunk_type = data[offset + 4 : offset + 8].decode("ascii", errors="replace")
        data_start = offset + 8
        data_end = data_start + length
        if data_end + 4 > total:
            raise PngParseError(f"Chunk '{chunk_type}' dichiara {length} byte ma il file finisce prima")
        chunk_data = data[data_start:data_end]

        if chunk_type == "tEXt":
            _parse_text(chunk_data, result)
        elif chunk_type == "zTXt":
            _parse_ztxt(chunk_data, result)
        elif chunk_type == "iTXt":
            _parse_itxt(chunk_data, result)
        elif chunk_type == "IEND":
            break

        offset = data_end + 4  # salta anche il CRC (non verificato: robustezza > rigore qui)

    return result


def _parse_text(chunk_data: bytes, result: dict[str, str]) -> None:
    if b"\x00" not in chunk_data:
        return
    keyword, _, text = chunk_data.partition(b"\x00")
    try:
        result[keyword.decode("latin-1")] = text.decode("latin-1")
    except UnicodeDecodeError:
        pass


def _parse_ztxt(chunk_data: bytes, result: dict[str, str]) -> None:
    if b"\x00" not in chunk_data:
        return
    keyword, _, rest = chunk_data.partition(b"\x00")
    if len(rest) < 1:
        return
    # rest[0] è il compression method (0 = zlib, unico definito dalla spec)
    compressed = rest[1:]
    try:
        text = zlib.decompress(compressed).decode("latin-1")
    except (zlib.error, UnicodeDecodeError):
        return
    result[keyword.decode("latin-1", errors="replace")] = text


def _parse_itxt(chunk_data: bytes, result: dict[str, str]) -> None:
    """Layout iTXt (spec PNG): keyword\\0 compression_flag(1) compression_method(1)
    language_tag\\0 translated_keyword\\0 text. `compression_flag`/`compression_method`
    sono campi a lunghezza FISSA (non delimitati da null) — un blind `split(b"\\0")` è
    sbagliato perché quei byte possono valere 0x00 e vengono scambiati per separatori
    (bug reale trovato scrivendo i test di questo modulo). Qui l'offset è calcolato
    esplicitamente, campo per campo.
    """
    keyword_end = chunk_data.find(b"\x00")
    if keyword_end == -1:
        return
    keyword_bytes = chunk_data[:keyword_end]

    flags_start = keyword_end + 1
    if flags_start + 2 > len(chunk_data):
        return
    compression_flag = chunk_data[flags_start]
    # chunk_data[flags_start + 1] è il compression method: unico valore definito dalla
    # spec è 0 (zlib), non serve altrimenti per decomprimere con `zlib.decompress`.

    lang_start = flags_start + 2
    lang_end = chunk_data.find(b"\x00", lang_start)
    if lang_end == -1:
        return

    translated_start = lang_end + 1
    translated_end = chunk_data.find(b"\x00", translated_start)
    if translated_end == -1:
        return

    text_bytes = chunk_data[translated_end + 1 :]
    try:
        keyword = keyword_bytes.decode("utf-8", errors="replace")
        text = zlib.decompress(text_bytes).decode("utf-8") if compression_flag else text_bytes.decode("utf-8")
    except (zlib.error, UnicodeDecodeError):
        return
    result[keyword] = text
