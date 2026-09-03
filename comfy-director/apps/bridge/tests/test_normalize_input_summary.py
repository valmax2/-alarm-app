from __future__ import annotations

from bridge.inventory.sync import normalize_input_summary


def test_image_upload_flag_is_captured_when_comfyui_publishes_it() -> None:
    # Forma reale di LoadImage.image in /object_info: enum di file esistenti +
    # opts.image_upload=True — il segnale REALE che distingue "scegli un file da
    # caricare" da un semplice elenco fisso (es. sampler_name).
    raw = {"required": {"image": [["existing.png"], {"image_upload": True}]}}
    summary = normalize_input_summary(raw)
    assert summary[0]["name"] == "image"
    assert summary[0]["image_upload"] is True


def test_image_upload_flag_defaults_false_for_a_plain_enum_widget() -> None:
    # Un dropdown ordinario (es. sampler_name) non ha image_upload: mai dedotto dal
    # nome del campo, solo dal flag reale che ComfyUI pubblica.
    raw = {"required": {"sampler_name": [["euler", "dpmpp_2m"], {}]}}
    summary = normalize_input_summary(raw)
    assert summary[0]["image_upload"] is False


def test_image_upload_flag_defaults_false_when_opts_missing_entirely() -> None:
    raw = {"required": {"seed": ["INT"]}}
    summary = normalize_input_summary(raw)
    assert summary[0]["image_upload"] is False
