from __future__ import annotations

from bridge.inventory.filesystem_scanner import resolve_models_directory, scan_models_directory


def _touch(path, size: int = 10) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"\x00" * size)


def test_resolve_models_directory_with_root_containing_models_subfolder(tmp_path) -> None:
    (tmp_path / "models").mkdir()
    assert resolve_models_directory(tmp_path) == tmp_path / "models"


def test_resolve_models_directory_when_root_is_already_models_folder(tmp_path) -> None:
    (tmp_path / "checkpoints").mkdir()
    # nessuna sottocartella "models": il percorso passato è già la cartella modelli
    assert resolve_models_directory(tmp_path) == tmp_path


def test_scan_models_directory_finds_known_types(tmp_path) -> None:
    _touch(tmp_path / "checkpoints" / "sd_xl_base_1.0.safetensors")
    _touch(tmp_path / "loras" / "my_style.safetensors")
    _touch(tmp_path / "vae" / "vae-ft-mse.safetensors")
    _touch(tmp_path / "checkpoints" / "readme.txt")  # estensione non riconosciuta: ignorato

    results = scan_models_directory(tmp_path)
    by_name = {r.name: r for r in results}

    assert "sd_xl_base_1.0.safetensors" in by_name
    assert by_name["sd_xl_base_1.0.safetensors"].model_type == "checkpoint"
    assert "my_style.safetensors" in by_name
    assert by_name["my_style.safetensors"].model_type == "lora"
    assert "vae-ft-mse.safetensors" in by_name
    assert by_name["vae-ft-mse.safetensors"].model_type == "vae"
    assert "readme.txt" not in by_name
    assert len(results) == 3


def test_scan_models_directory_missing_path_returns_empty(tmp_path) -> None:
    assert scan_models_directory(tmp_path / "does_not_exist") == []


def test_scan_models_directory_ignores_unrecognized_subfolders(tmp_path) -> None:
    _touch(tmp_path / "random_stuff" / "not_a_model.safetensors")
    assert scan_models_directory(tmp_path) == []


def test_scan_models_directory_relative_path_uses_forward_slashes(tmp_path) -> None:
    _touch(tmp_path / "loras" / "subdir" / "nested.safetensors")
    results = scan_models_directory(tmp_path)
    assert results[0].path == "loras/subdir/nested.safetensors"
