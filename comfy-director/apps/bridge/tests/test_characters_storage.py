from __future__ import annotations

from pathlib import Path

from bridge.characters import (
    delete_character_directory,
    delete_character_image,
    guess_extension,
    save_character_image,
)


def test_guess_extension_prefers_filename():
    assert guess_extension("photo.PNG", "image/jpeg") == ".png"


def test_guess_extension_falls_back_to_content_type():
    assert guess_extension(None, "image/webp") == ".webp"


def test_guess_extension_unknown_is_honest_bin():
    assert guess_extension("file.xyz", "application/octet-stream") == ".bin"


def test_save_character_image_writes_real_bytes_and_returns_relative_path(tmp_path: Path):
    relative = save_character_image(tmp_path, "char1", b"fake-image-bytes", "photo.png", "image/png")
    assert relative.startswith("characters/char1/")
    assert relative.endswith(".png")
    assert (tmp_path / relative).read_bytes() == b"fake-image-bytes"


def test_save_character_image_generates_unique_names(tmp_path: Path):
    first = save_character_image(tmp_path, "char1", b"a", "x.png", "image/png")
    second = save_character_image(tmp_path, "char1", b"b", "x.png", "image/png")
    assert first != second
    assert (tmp_path / first).exists() and (tmp_path / second).exists()


def test_delete_character_image_removes_file(tmp_path: Path):
    relative = save_character_image(tmp_path, "char1", b"data", "x.png", "image/png")
    assert (tmp_path / relative).exists()
    delete_character_image(tmp_path, relative)
    assert not (tmp_path / relative).exists()


def test_delete_character_image_tolerates_missing_file(tmp_path: Path):
    delete_character_image(tmp_path, "characters/does-not-exist/x.png")  # non deve sollevare


def test_delete_character_directory_removes_all_images(tmp_path: Path):
    save_character_image(tmp_path, "char1", b"a", "a.png", "image/png")
    save_character_image(tmp_path, "char1", b"b", "b.png", "image/png")
    assert (tmp_path / "characters" / "char1").exists()
    delete_character_directory(tmp_path, "char1")
    assert not (tmp_path / "characters" / "char1").exists()


def test_delete_character_directory_tolerates_missing_directory(tmp_path: Path):
    delete_character_directory(tmp_path, "does-not-exist")  # non deve sollevare
