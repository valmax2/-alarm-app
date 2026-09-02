from __future__ import annotations

import struct
import zlib

import pytest

from bridge.media.png_metadata import PngParseError, read_png_text_chunks

_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def _chunk(chunk_type: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + chunk_type + data + struct.pack(">I", zlib.crc32(chunk_type + data))


def _png(*chunks: bytes) -> bytes:
    return _SIGNATURE + b"".join(chunks) + _chunk(b"IEND", b"")


def _text_chunk(keyword: str, text: str) -> bytes:
    return _chunk(b"tEXt", keyword.encode("latin-1") + b"\x00" + text.encode("latin-1"))


def _ztxt_chunk(keyword: str, text: str) -> bytes:
    compressed = zlib.compress(text.encode("latin-1"))
    return _chunk(b"zTXt", keyword.encode("latin-1") + b"\x00\x00" + compressed)


def _itxt_chunk(keyword: str, text: str, compressed: bool = False) -> bytes:
    payload = zlib.compress(text.encode("utf-8")) if compressed else text.encode("utf-8")
    body = (
        keyword.encode("utf-8")
        + b"\x00"
        + bytes([1 if compressed else 0, 0])  # compression flag, compression method
        + b"\x00"  # language tag (vuoto)
        + b"\x00"  # translated keyword (vuoto)
        + payload
    )
    return _chunk(b"iTXt", body)


def test_reads_text_chunk() -> None:
    result = read_png_text_chunks(_png(_text_chunk("prompt", '{"1": {"class_type": "KSampler"}}')))
    assert result["prompt"] == '{"1": {"class_type": "KSampler"}}'


def test_reads_compressed_ztxt_chunk() -> None:
    workflow_json = '{"nodes": [{"id": 1, "type": "CheckpointLoaderSimple"}], "links": []}'
    result = read_png_text_chunks(_png(_ztxt_chunk("workflow", workflow_json)))
    assert result["workflow"] == workflow_json


def test_reads_itxt_chunk_utf8() -> None:
    result = read_png_text_chunks(_png(_itxt_chunk("prompt", '{"soggetto": "città"}')))
    assert result["prompt"] == '{"soggetto": "città"}'


def test_reads_compressed_itxt_chunk() -> None:
    result = read_png_text_chunks(_png(_itxt_chunk("workflow", '{"a": "b" }', compressed=True)))
    assert result["workflow"] == '{"a": "b" }'


def test_reads_multiple_chunks() -> None:
    result = read_png_text_chunks(_png(_text_chunk("prompt", "p"), _text_chunk("workflow", "w")))
    assert result == {"prompt": "p", "workflow": "w"}


def test_no_workflow_or_prompt_chunk_returns_empty_dict() -> None:
    result = read_png_text_chunks(_png(_text_chunk("Software", "GIMP")))
    assert "workflow" not in result
    assert "prompt" not in result


def test_rejects_non_png_data() -> None:
    with pytest.raises(PngParseError):
        read_png_text_chunks(b"not a png at all")


def test_rejects_truncated_chunk() -> None:
    # Dichiara un chunk di 1000 byte ma il file finisce molto prima: deve fallire in
    # modo pulito (PngParseError), mai un IndexError/crash.
    truncated = _SIGNATURE + struct.pack(">I", 1000) + b"tEXt" + b"short"
    with pytest.raises(PngParseError):
        read_png_text_chunks(truncated)


def test_ignores_corrupt_ztxt_without_crashing() -> None:
    bad_ztxt = _chunk(b"zTXt", b"workflow\x00\x00" + b"not actually zlib compressed data")
    result = read_png_text_chunks(_png(bad_ztxt, _text_chunk("prompt", "still readable")))
    assert "workflow" not in result
    assert result["prompt"] == "still readable"
