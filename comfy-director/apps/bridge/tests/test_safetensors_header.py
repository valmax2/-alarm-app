from __future__ import annotations

import json
import struct

import pytest

from bridge.inventory.safetensors_header import SafetensorsHeaderError, read_safetensors_header


def _write_fake_safetensors(path, header: dict, tensor_bytes: bytes = b"\x00" * 16) -> None:
    """Costruisce un file nel formato reale .safetensors (8 byte di lunghezza header
    little-endian + header JSON + dati tensori) — non un file finto, il formato è
    quello vero della specifica pubblica safetensors."""
    header_bytes = json.dumps(header).encode("utf-8")
    with path.open("wb") as f:
        f.write(struct.pack("<Q", len(header_bytes)))
        f.write(header_bytes)
        f.write(tensor_bytes)


def test_read_safetensors_header_roundtrip(tmp_path) -> None:
    header = {"__metadata__": {"modelspec.architecture": "flux-1-dev"}, "some.tensor": {"shape": [1, 2]}}
    file_path = tmp_path / "model.safetensors"
    _write_fake_safetensors(file_path, header)

    result = read_safetensors_header(file_path)
    assert result == header


def test_read_safetensors_header_missing_file(tmp_path) -> None:
    with pytest.raises(SafetensorsHeaderError):
        read_safetensors_header(tmp_path / "does_not_exist.safetensors")


def test_read_safetensors_header_too_short(tmp_path) -> None:
    file_path = tmp_path / "broken.safetensors"
    file_path.write_bytes(b"\x01\x02")  # meno di 8 byte
    with pytest.raises(SafetensorsHeaderError):
        read_safetensors_header(file_path)


def test_read_safetensors_header_truncated_header(tmp_path) -> None:
    file_path = tmp_path / "truncated.safetensors"
    with file_path.open("wb") as f:
        f.write(struct.pack("<Q", 1000))  # dichiara un header di 1000 byte
        f.write(b"{}")  # ma ne scrive molti meno
    with pytest.raises(SafetensorsHeaderError):
        read_safetensors_header(file_path)


def test_read_safetensors_header_rejects_implausible_length_instead_of_crashing(tmp_path) -> None:
    """Regressione: un file con estensione .safetensors ma non nel formato reale (es.
    testo semplice rinominato) ha nei primi 8 byte dati arbitrari che, letti come intero
    a 64 bit, possono indicare una lunghezza enorme. Senza un limite questo causava un
    vero MemoryError (osservato in verifica manuale end-to-end), non un
    SafetensorsHeaderError gestibile — deve invece fallire in modo pulito."""
    file_path = tmp_path / "not_really_safetensors.safetensors"
    file_path.write_bytes(b"not a real safetensors but has the extension")

    with pytest.raises(SafetensorsHeaderError):
        read_safetensors_header(file_path)


def test_read_safetensors_header_invalid_json(tmp_path) -> None:
    file_path = tmp_path / "badjson.safetensors"
    bad = b"not json at all"
    with file_path.open("wb") as f:
        f.write(struct.pack("<Q", len(bad)))
        f.write(bad)
    with pytest.raises(SafetensorsHeaderError):
        read_safetensors_header(file_path)
