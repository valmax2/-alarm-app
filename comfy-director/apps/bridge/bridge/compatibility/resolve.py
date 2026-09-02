"""Compatibility Engine v1 — algoritmo di combinazione fonti (docs/compatibility-engine.md).

Codice puro, senza dipendenze da FastAPI/DB/ComfyUI: testabile in isolamento (regola 9
della spec — "le funzioni critiche devono avere test automatici"). I chiamanti (router,
inventory) passano segnali già raccolti.

Default esplicito: se nessun segnale è conclusivo, il risultato è `unknown`, MAI
`compatible` — vietato dichiarare compatibile ciò che non si sa essere tale (spec §5).
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from typing import Literal, Protocol

Compatibility = Literal["compatible", "incompatible", "unknown", "warning"]

# Fonti "autorevoli": se presenti, decidono da sole (fatti osservati/strutturali, non
# inferenze) — docs/compatibility-engine.md §2, punti 1-2.
_AUTHORITATIVE_SOURCES = ("comfy_reported", "node_schema")


@dataclass(frozen=True)
class CompatibilitySignal:
    """Un singolo segnale da una fonte (docs/compatibility-engine.md §1-2)."""

    compatibility: Compatibility
    reason: str
    source: str
    confidence: float
    rule_version: int | None = None


@dataclass(frozen=True)
class CompatibilityResult:
    compatibility: Compatibility
    reason: str
    source: str
    confidence: float
    signals: tuple[CompatibilitySignal, ...] = ()


def resolve(signals: Iterable[CompatibilitySignal]) -> CompatibilityResult:
    """Algoritmo di combinazione deterministico v1 (docs/compatibility-engine.md §3)."""
    signals = list(signals)
    if not signals:
        return CompatibilityResult("unknown", "Nessuna fonte di compatibilità disponibile", "internal_rule", 0.0)

    for authoritative in _AUTHORITATIVE_SOURCES:
        for s in signals:
            if s.source == authoritative:
                return CompatibilityResult(s.compatibility, s.reason, s.source, s.confidence, tuple(signals))

    strong_incompatible = [s for s in signals if s.compatibility == "incompatible" and s.confidence >= 0.7]
    if strong_incompatible:
        best = max(strong_incompatible, key=lambda s: s.confidence)
        return CompatibilityResult(best.compatibility, best.reason, best.source, best.confidence, tuple(signals))

    strong_compatible = [
        s
        for s in signals
        if s.compatibility == "compatible" and s.source in ("internal_rule", "metadata") and s.confidence >= 0.6
    ]
    any_conflict = any(s.compatibility in ("incompatible", "warning") and s.confidence >= 0.5 for s in signals)
    if strong_compatible and not any_conflict:
        best = max(strong_compatible, key=lambda s: s.confidence)
        return CompatibilityResult(best.compatibility, best.reason, best.source, best.confidence, tuple(signals))

    has_warning = any(s.compatibility == "warning" for s in signals)
    if has_warning or (strong_compatible and any_conflict):
        reasons = "; ".join(sorted({s.reason for s in signals if s.compatibility != "unknown"}))
        return CompatibilityResult(
            "warning", reasons or "Segnali contrastanti tra le fonti", "internal_rule", 0.5, tuple(signals)
        )

    return CompatibilityResult("unknown", "Nessun segnale conclusivo", "internal_rule", 0.0, tuple(signals))


def explain(result: CompatibilityResult) -> str:
    label = {
        "compatible": "Compatibile",
        "incompatible": "Incompatibile",
        "warning": "Compatibilità incerta",
        "unknown": "Compatibilità non verificata",
    }[result.compatibility]
    return f"{label}: {result.reason} (fonte: {result.source}, confidenza: {result.confidence:.0%})"


class FamilyAware(Protocol):
    family: str | None
    detection_confidence: float
    detection_source: str


@dataclass(frozen=True)
class ScoredModel:
    model: FamilyAware
    result: CompatibilityResult


def filter_models_by_family(models: Iterable[FamilyAware], target_family: str) -> list[ScoredModel]:
    """Valuta la compatibilità di ciascun modello rispetto alla famiglia scelta
    dall'utente (spec §5 §14: "TIPO WORKFLOW + FAMIGLIA/MOTORE" -> filtra i pannelli).

    Non filtra silenziosamente: ogni modello torna con il proprio CompatibilityResult
    allegato — la UI decide se nascondere gli incompatibili, dietro il toggle "Mostra
    incompatibili" (§36), sempre con un motivo visibile.
    """
    scored: list[ScoredModel] = []
    for m in models:
        if m.family is None:
            signal = CompatibilitySignal(
                "unknown", "Famiglia non determinata per questo modello", "internal_rule", 0.0
            )
        elif m.family == target_family:
            signal = CompatibilitySignal(
                "compatible",
                f"Famiglia rilevata '{m.family}' corrisponde alla famiglia richiesta '{target_family}'",
                m.detection_source,
                m.detection_confidence,
            )
        else:
            # Bassa confidenza sulla detection -> non escludiamo con certezza, solo un warning.
            level: Compatibility = "incompatible" if m.detection_confidence >= 0.6 else "warning"
            signal = CompatibilitySignal(
                level,
                f"Famiglia rilevata '{m.family}' diversa da quella richiesta '{target_family}'",
                m.detection_source,
                m.detection_confidence,
            )
        scored.append(ScoredModel(model=m, result=resolve([signal])))
    return scored
