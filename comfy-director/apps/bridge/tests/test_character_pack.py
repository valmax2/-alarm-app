from __future__ import annotations

import json
import zipfile
from io import BytesIO

import pytest

from bridge.characters.pack import (
    CharacterPackError,
    SourceImage,
    build_character_pack,
    parse_character_pack,
)


def _source_image(**overrides) -> SourceImage:
    defaults = {
        "data": b"fake-image-bytes",
        "original_filename": "photo.png",
        "role": "main",
        "order_index": 0,
        "source": "upload",
        "width": 512,
        "height": 512,
    }
    defaults.update(overrides)
    return SourceImage(**defaults)


def test_round_trip_preserves_all_fields() -> None:
    zip_bytes = build_character_pack(
        name="Aria", description="Una protagonista", tags=["fantasy", "hero"], notes="note private",
        is_private=True, images=[_source_image()],
    )
    pack = parse_character_pack(zip_bytes)
    assert pack.name == "Aria"
    assert pack.description == "Una protagonista"
    assert pack.tags == ["fantasy", "hero"]
    assert pack.notes == "note private"
    assert pack.is_private is True
    assert len(pack.images) == 1
    image = pack.images[0]
    assert image.data == b"fake-image-bytes"
    assert image.role == "main"
    assert image.source == "upload"
    assert image.width == 512
    assert image.height == 512


def test_round_trip_with_no_images() -> None:
    zip_bytes = build_character_pack(name="Solo", description=None, tags=[], notes=None, is_private=False, images=[])
    pack = parse_character_pack(zip_bytes)
    assert pack.images == []


def test_round_trip_with_multiple_images_preserves_order() -> None:
    zip_bytes = build_character_pack(
        name="Multi", description=None, tags=[], notes=None, is_private=False,
        images=[
            _source_image(original_filename="a.png", order_index=0, data=b"AAA"),
            _source_image(original_filename="b.jpg", order_index=1, role="reference", data=b"BBB"),
        ],
    )
    pack = parse_character_pack(zip_bytes)
    assert [i.data for i in pack.images] == [b"AAA", b"BBB"]
    assert pack.images[1].role == "reference"


def test_rejects_non_zip_file() -> None:
    with pytest.raises(CharacterPackError, match="ZIP"):
        parse_character_pack(b"not a zip at all")


def test_rejects_zip_without_manifest() -> None:
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("hello.txt", "not a character pack")
    with pytest.raises(CharacterPackError, match="character.json"):
        parse_character_pack(buffer.getvalue())


def test_rejects_manifest_with_wrong_format_marker() -> None:
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("character.json", json.dumps({"format": "something-else", "format_version": 1, "name": "X"}))
    with pytest.raises(CharacterPackError, match="Character Pack"):
        parse_character_pack(buffer.getvalue())


def test_rejects_unsupported_future_format_version() -> None:
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr(
            "character.json",
            json.dumps({"format": "comfy-director-character-pack", "format_version": 999, "name": "X"}),
        )
    with pytest.raises(CharacterPackError, match="[Vv]ersione"):
        parse_character_pack(buffer.getvalue())


def test_rejects_manifest_referencing_missing_image_file() -> None:
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr(
            "character.json",
            json.dumps(
                {
                    "format": "comfy-director-character-pack", "format_version": 1, "name": "X",
                    "images": [{"filename": "ghost.png", "role": "main", "order_index": 0, "source": "upload"}],
                }
            ),
        )
        # 'images/ghost.png' non esiste davvero nell'archivio
    with pytest.raises(CharacterPackError, match="ghost.png"):
        parse_character_pack(buffer.getvalue())


def test_rejects_manifest_without_name() -> None:
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("character.json", json.dumps({"format": "comfy-director-character-pack", "format_version": 1}))
    with pytest.raises(CharacterPackError, match="nome"):
        parse_character_pack(buffer.getvalue())


def test_rejects_invalid_role() -> None:
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("images/a.png", b"data")
        archive.writestr(
            "character.json",
            json.dumps(
                {
                    "format": "comfy-director-character-pack", "format_version": 1, "name": "X",
                    "images": [{"filename": "a.png", "role": "villain", "order_index": 0, "source": "upload"}],
                }
            ),
        )
    with pytest.raises(CharacterPackError, match="role"):
        parse_character_pack(buffer.getvalue())


def test_rejects_malformed_json_manifest() -> None:
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("character.json", "{not valid json")
    with pytest.raises(CharacterPackError, match="JSON"):
        parse_character_pack(buffer.getvalue())
