"""Family detection v1 — docs/compatibility-engine.md §4.

Due livelli di segnale, in ordine di affidabilità (mai il nome file da solo come fonte
di certezza — regola esplicita della spec §5):

1. `guess_family_from_header`: header `.safetensors` reale (quando il file è
   accessibile — vedi `safetensors_header.py`). Fonte `metadata`, confidenza più alta.
2. `guess_family_from_filename`: euristica sul nome file. Fonte `internal_rule`,
   confidenza volutamente bassa (0.3) — usata solo come indizio debole, MAI da sola per
   dichiarare `compatible` in modo definitivo (vedi compatibility/resolve.py).

Entrambe sono regole versionate (vedi *_RULES_VERSION) — invalidabili/aggiornabili
senza toccare il resto del sistema.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

FILENAME_RULES_VERSION = 1
HEADER_RULES_VERSION = 1

# Famiglie note "di esempio" citate dalla spec (§4, §14) — elenco esplicitamente NON
# chiuso: una famiglia non elencata qui può comunque essere assegnata da una regola
# futura senza modificare questo tipo (è solo una stringa libera altrove nello schema).
KNOWN_FAMILIES = ("flux", "sdxl", "sd15", "wan", "qwen")


@dataclass(frozen=True)
class FamilyGuess:
    family: str | None
    confidence: float  # 0..1
    source: str  # "internal_rule" | "metadata"
    reason: str


_FILENAME_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("flux", re.compile(r"flux", re.IGNORECASE)),
    ("sdxl", re.compile(r"(sdxl|[_-]xl(?=[_.\-]|$))", re.IGNORECASE)),
    ("sd15", re.compile(r"(sd[\s_-]?1[.\-_]?5)", re.IGNORECASE)),
    ("wan", re.compile(r"\bwan[\s_-]?2?\b", re.IGNORECASE)),
    ("qwen", re.compile(r"qwen", re.IGNORECASE)),
)


def guess_family_from_filename(name: str) -> FamilyGuess:
    for family, pattern in _FILENAME_PATTERNS:
        if pattern.search(name):
            return FamilyGuess(
                family=family,
                confidence=0.3,
                source="internal_rule",
                reason=(
                    f"il nome file contiene un indizio della famiglia '{family}' "
                    f"(regola filename v{FILENAME_RULES_VERSION}, bassa affidabilità: "
                    "usare con cautela, mai come unica base per dichiarare compatibilità)"
                ),
            )
    return FamilyGuess(family=None, confidence=0.0, source="internal_rule", reason="nessun indizio nel nome file")


def guess_family_from_header(header: dict) -> FamilyGuess:
    """Euristica su un header `.safetensors` già letto (vedi `read_safetensors_header`).
    Non tocca mai i tensori stessi, solo l'header JSON."""
    raw_metadata = header.get("__metadata__")
    metadata = raw_metadata if isinstance(raw_metadata, dict) else {}
    declared = str(metadata.get("modelspec.architecture", "")).lower()

    if "flux" in declared:
        return FamilyGuess("flux", 0.9, "metadata", "modelspec.architecture dichiara FLUX")
    if "sdxl" in declared or "xl-base" in declared:
        return FamilyGuess("sdxl", 0.9, "metadata", "modelspec.architecture dichiara SDXL")
    if declared.startswith("stable-diffusion-v1") or "sd-v1" in declared:
        return FamilyGuess("sd15", 0.9, "metadata", "modelspec.architecture dichiara SD 1.x")

    tensor_keys = [k for k in header if k != "__metadata__"]
    joined = " ".join(tensor_keys).lower()
    if "double_blocks" in joined and "single_blocks" in joined:
        return FamilyGuess(
            "flux", 0.7, "metadata",
            f"struttura tensori tipica FLUX: double_blocks/single_blocks (regola header v{HEADER_RULES_VERSION})",
        )
    if any("conditioner.embedders.1" in k.lower() for k in tensor_keys):
        return FamilyGuess(
            "sdxl", 0.6, "metadata",
            f"presenza di un secondo text encoder, tipica di SDXL (regola header v{HEADER_RULES_VERSION})",
        )

    return FamilyGuess(None, 0.0, "metadata", "nessun segnale riconosciuto nell'header")


def detect_family(name: str, header: dict | None) -> FamilyGuess:
    """Combina le due fonti: preferisce l'header (se disponibile e conclusivo),
    altrimenti ripiega sull'euristica sul nome file."""
    if header is not None:
        from_header = guess_family_from_header(header)
        if from_header.family is not None:
            return from_header
    return guess_family_from_filename(name)
