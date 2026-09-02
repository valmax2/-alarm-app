from __future__ import annotations

from dataclasses import dataclass

from bridge.compatibility.resolve import (
    CompatibilitySignal,
    filter_models_by_family,
    resolve,
)


def test_resolve_no_signals_is_unknown_never_compatible() -> None:
    result = resolve([])
    assert result.compatibility == "unknown"


def test_resolve_comfy_reported_wins_over_everything() -> None:
    signals = [
        CompatibilitySignal("compatible", "regola interna dice ok", "internal_rule", 0.9),
        CompatibilitySignal("incompatible", "ComfyUI ha rifiutato il tipo di input", "comfy_reported", 1.0),
    ]
    result = resolve(signals)
    assert result.compatibility == "incompatible"
    assert result.source == "comfy_reported"


def test_resolve_node_schema_wins_over_internal_rule() -> None:
    signals = [
        CompatibilitySignal("compatible", "nome file sembra combaciare", "internal_rule", 0.4),
        CompatibilitySignal("incompatible", "tipo porta MODEL vs CLIP", "node_schema", 1.0),
    ]
    result = resolve(signals)
    assert result.compatibility == "incompatible"
    assert result.source == "node_schema"


def test_resolve_strong_compatible_without_conflict() -> None:
    signals = [CompatibilitySignal("compatible", "famiglia combacia", "metadata", 0.9)]
    result = resolve(signals)
    assert result.compatibility == "compatible"


def test_resolve_conflicting_rules_produce_warning() -> None:
    signals = [
        CompatibilitySignal("compatible", "regola interna A dice compatibile", "internal_rule", 0.65),
        CompatibilitySignal("incompatible", "osservato in un workflow che ha fallito", "analyzed_workflow", 0.55),
    ]
    result = resolve(signals)
    assert result.compatibility == "warning"
    assert "regola interna A" in result.reason
    assert "osservato in un workflow" in result.reason


def test_resolve_weak_signals_only_remain_unknown() -> None:
    signals = [CompatibilitySignal("compatible", "ipotesi AI non corroborata", "ai_suggested", 0.4)]
    result = resolve(signals)
    # ai_suggested da solo, sotto soglia, non basta MAI a dichiarare compatibile (spec §5 punto 9)
    assert result.compatibility != "compatible"


@dataclass
class _FakeModel:
    id: str
    family: str | None
    detection_confidence: float
    detection_source: str


def test_filter_models_by_family_matching() -> None:
    models = [_FakeModel("m1", "flux", 0.9, "metadata")]
    scored = filter_models_by_family(models, "flux")
    assert scored[0].result.compatibility == "compatible"


def test_filter_models_by_family_mismatch_high_confidence_is_incompatible() -> None:
    models = [_FakeModel("m1", "sdxl", 0.9, "metadata")]
    scored = filter_models_by_family(models, "flux")
    assert scored[0].result.compatibility == "incompatible"


def test_filter_models_by_family_mismatch_low_confidence_is_warning_not_incompatible() -> None:
    models = [_FakeModel("m1", "sdxl", 0.3, "internal_rule")]
    scored = filter_models_by_family(models, "flux")
    assert scored[0].result.compatibility == "warning"


def test_filter_models_by_family_unknown_family_stays_unknown() -> None:
    models = [_FakeModel("m1", None, 0.0, "internal_rule")]
    scored = filter_models_by_family(models, "flux")
    assert scored[0].result.compatibility == "unknown"
