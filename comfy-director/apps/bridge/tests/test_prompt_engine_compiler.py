from __future__ import annotations

from bridge.prompt_engine.compiler import (
    CharacterInfo,
    StructuredPromptInput,
    coherent_identity_block,
    compose_prompt,
)


def test_minimal_input_produces_single_subject_line_only() -> None:
    text = compose_prompt(StructuredPromptInput(gender="female"))
    assert text == (
        "SINGLE SUBJECT ONLY — exactly one adult woman; do not add a second person, "
        "duplicate subject, twin, clone or background person"
    )


def test_male_gender_changes_subject_phrase() -> None:
    text = compose_prompt(StructuredPromptInput(gender="male"))
    assert "adult man" in text
    assert "adult woman" not in text


def test_age_under_18_is_never_included() -> None:
    text = compose_prompt(StructuredPromptInput(gender="female", age=17))
    assert "17 years old" not in text


def test_age_18_or_over_is_included() -> None:
    text = compose_prompt(StructuredPromptInput(gender="female", age=25))
    assert "25 years old" in text


def test_clothing_state_underwear_with_item() -> None:
    text = compose_prompt(StructuredPromptInput(gender="female", clothing_state="underwear", underwear_item="lace bodysuit"))
    assert "wearing lace bodysuit" in text


def test_clothing_state_underwear_without_item_falls_back() -> None:
    text = compose_prompt(StructuredPromptInput(gender="female", clothing_state="underwear"))
    assert "wearing underwear" in text


def test_clothing_state_strips_leading_adult_word() -> None:
    text = compose_prompt(StructuredPromptInput(gender="female", clothing_state="adult nude"))
    assert ", nude" in text
    assert "adult nude" not in text.split(",", 1)[1]  # non ripetuto senza "adult"


def test_free_text_override_suppresses_clothing_state() -> None:
    """Se l'utente scrive esplicitamente 'topless' nel testo libero, non deve comparire
    ANCHE la frase di stato abbigliamento generata dal catalogo — evita un prompt
    contraddittorio (es. 'fully clothed, ... topless ...')."""
    text = compose_prompt(
        StructuredPromptInput(gender="female", clothing_state="fully clothed", custom_action="standing topless on a beach")
    )
    assert "fully clothed" not in text
    assert "topless" in text


def test_body_descriptors_are_included_in_order() -> None:
    text = compose_prompt(StructuredPromptInput(gender="female", body={"build": "athletic body", "waist": "narrow waist"}))
    assert "athletic body" in text
    assert "narrow waist" in text


def test_face_create_mode_includes_face_descriptors() -> None:
    text = compose_prompt(StructuredPromptInput(gender="female", face_mode="create", face={"eyes": "large eyes"}))
    assert "large eyes" in text


def test_face_descriptors_omitted_without_create_mode() -> None:
    text = compose_prompt(StructuredPromptInput(gender="female", face_mode="", face={"eyes": "large eyes"}))
    assert "large eyes" not in text


def test_coherent_character_adds_identity_block_and_suppresses_face_descriptors() -> None:
    character = CharacterInfo(name="Aria", description="una guerriera", tags=["fantasy"], notes="occhi verdi")
    text = compose_prompt(
        StructuredPromptInput(gender="female", face_mode="create", face={"eyes": "large eyes"}), character=character
    )
    assert "CHARACTER CONSISTENCY" in text
    assert "Character name: Aria." in text
    assert "large eyes" not in text  # sostituito dall'identità del personaggio, mai sommato


def test_coherent_identity_block_omits_missing_fields() -> None:
    character = CharacterInfo(name="Aria")
    block = coherent_identity_block(character)
    assert "Character name: Aria." in block
    assert "Character description:" not in block
    assert "Saved character traits:" not in block
    assert "Character notes:" not in block


def test_hair_keep_mode_requires_a_coherent_character() -> None:
    without_character = compose_prompt(StructuredPromptInput(gender="female", hair_mode="keep"))
    assert "HAIRSTYLE" not in without_character

    with_character = compose_prompt(
        StructuredPromptInput(gender="female", hair_mode="keep"), character=CharacterInfo(name="Aria")
    )
    assert "HAIRSTYLE — LOCKED" in with_character


def test_hair_change_mode_with_style_and_color() -> None:
    text = compose_prompt(StructuredPromptInput(gender="female", hair_mode="change", hair="long wavy hair", hair_color="red hair"))
    assert "change the hairstyle to long wavy hair" in text
    assert "hair color red hair" in text


def test_hair_change_mode_prefers_custom_hair_over_catalog_hair() -> None:
    text = compose_prompt(
        StructuredPromptInput(gender="female", hair_mode="change", hair="long wavy hair", custom_hair="messy pixie cut")
    )
    assert "change the hairstyle to messy pixie cut" in text
    assert "long wavy hair" not in text


def test_hair_change_with_reference_warns_not_to_preserve_reference_hairstyle() -> None:
    text = compose_prompt(
        StructuredPromptInput(gender="female", hair_mode="change", hair="red hair"), character=CharacterInfo(name="Aria")
    )
    assert "do NOT preserve the reference hairstyle" in text


def test_custom_action_overrides_catalog_action() -> None:
    text = compose_prompt(StructuredPromptInput(gender="female", action="standing", custom_action="doing a cartwheel"))
    assert "doing a cartwheel" in text
    assert "standing" not in text


def test_environment_and_custom_scene() -> None:
    text = compose_prompt(StructuredPromptInput(gender="female", environment="beach"))
    assert "beach" in text
    text2 = compose_prompt(StructuredPromptInput(gender="female", environment="beach", custom_scene="a rainy alley at night"))
    assert "a rainy alley at night" in text2
    assert "beach" not in text2


def test_camera_fields_use_strong_markers() -> None:
    text = compose_prompt(
        StructuredPromptInput(gender="female", camera_framing="close-up shot", camera_angle="top-down overhead shot", camera_lens="50mm natural lens")
    )
    assert "FRAMING — STRONG: close-up shot" in text
    assert "CAMERA VIEWPOINT — STRONG: top-down overhead shot" in text
    assert "LENS — 50mm natural lens" in text


def test_light_and_custom_photo_appended() -> None:
    text = compose_prompt(StructuredPromptInput(gender="female", light="cinematic lighting", custom_photo="shot on film grain"))
    assert text.endswith("shot on film grain")
    assert "cinematic lighting" in text


def test_duplicate_fragments_are_deduplicated_case_insensitively() -> None:
    text = compose_prompt(
        StructuredPromptInput(gender="female", action="Standing", custom_scene="standing"),
    )
    assert text.count("standing") + text.count("Standing") == 1


def test_empty_optional_fields_never_produce_empty_fragments() -> None:
    text = compose_prompt(StructuredPromptInput(gender="female"))
    assert ", ," not in text
    assert not text.endswith(",")
    assert not text.startswith(",")
