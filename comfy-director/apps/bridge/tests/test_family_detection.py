from __future__ import annotations

from bridge.inventory.family_detection import (
    detect_family,
    guess_family_from_filename,
    guess_family_from_header,
)


def test_guess_from_filename_detects_flux() -> None:
    guess = guess_family_from_filename("flux1-dev-fp8.safetensors")
    assert guess.family == "flux"
    assert guess.source == "internal_rule"
    assert 0 < guess.confidence < 0.6  # bassa affidabilità: mai spacciata per certa


def test_guess_from_filename_detects_sdxl() -> None:
    assert guess_family_from_filename("sd_xl_base_1.0.safetensors").family == "sdxl"
    assert guess_family_from_filename("juggernaut-xl-v9.safetensors").family == "sdxl"


def test_guess_from_filename_does_not_false_positive_on_substring() -> None:
    # "xl" incollato senza separatore (es. camelCase "dreamshaperXL") non genera un
    # falso positivo: euristica volutamente conservativa (mai certezza finta, spec §5).
    assert guess_family_from_filename("dreamshaperXL_v21.safetensors").family is None
    assert guess_family_from_filename("pixldust.safetensors").family is None


def test_guess_from_filename_no_match_returns_none_not_a_guess() -> None:
    guess = guess_family_from_filename("mystery_model_v3.safetensors")
    assert guess.family is None
    assert guess.confidence == 0.0


def test_guess_from_header_declared_architecture_wins() -> None:
    header = {"__metadata__": {"modelspec.architecture": "flux-1-dev"}}
    guess = guess_family_from_header(header)
    assert guess.family == "flux"
    assert guess.source == "metadata"
    assert guess.confidence >= 0.9  # dichiarazione esplicita: alta confidenza


def test_guess_from_header_structural_signal_flux() -> None:
    header = {
        "double_blocks.0.img_attn.qkv.weight": {"shape": [1, 2]},
        "single_blocks.0.linear1.weight": {"shape": [1, 2]},
    }
    guess = guess_family_from_header(header)
    assert guess.family == "flux"
    assert guess.source == "metadata"


def test_guess_from_header_no_signal_returns_none() -> None:
    header = {"some.random.tensor.weight": {"shape": [1]}}
    guess = guess_family_from_header(header)
    assert guess.family is None


def test_detect_family_prefers_header_over_filename() -> None:
    header = {"__metadata__": {"modelspec.architecture": "sdxl-base-1.0"}}
    # nome file fuorviante (contiene "flux") ma l'header è conclusivo -> header vince
    guess = detect_family("my_flux_folder_export.safetensors", header=header)
    assert guess.family == "sdxl"
    assert guess.source == "metadata"


def test_detect_family_falls_back_to_filename_when_no_header() -> None:
    guess = detect_family("flux1-schnell.safetensors", header=None)
    assert guess.family == "flux"
    assert guess.source == "internal_rule"


def test_detect_family_falls_back_when_header_inconclusive() -> None:
    guess = detect_family("flux1-schnell.safetensors", header={"unrecognized.key": {}})
    assert guess.family == "flux"
    assert guess.source == "internal_rule"
