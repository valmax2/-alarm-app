from __future__ import annotations

from bridge.prompt_engine.compiler import (
    CharacterInfo,
    StructuredPromptInput,
    camera_director_prompt,
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


def test_camera_director_active_replaces_catalog_camera_fields_entirely() -> None:
    text = compose_prompt(
        StructuredPromptInput(
            gender="female", camera_framing="close-up shot", camera_angle="top-down overhead shot",
            camera_lens="50mm natural lens", camera_director_active=True,
            camera_director_orbit=0, camera_director_elevation=0, camera_director_distance=80,
            camera_director_fov=50, camera_director_tilt=0,
        )
    )
    assert "FRAMING — STRONG:" not in text
    assert "CAMERA VIEWPOINT — STRONG:" not in text
    assert "LENS — 50mm natural lens" not in text
    assert "CAMERA DIRECTOR — STRONG: camera directly in front of the subject" in text


def test_camera_director_inactive_uses_catalog_fields_as_before() -> None:
    text = compose_prompt(
        StructuredPromptInput(gender="female", camera_framing="close-up shot", camera_director_active=False)
    )
    assert "FRAMING — STRONG: close-up shot" in text
    assert "CAMERA DIRECTOR" not in text


class TestCameraDirectorPrompt:
    """Porting fedele di `cameraDirectorPrompt()` — un test per ogni confine di bucket
    dell'originale, sugli stessi cinque parametri (orbita/elevazione/distanza/FOV/tilt)."""

    def test_front_view_near_zero_orbit(self) -> None:
        text = camera_director_prompt(orbit=0, elevation=0, distance=80, fov=50, tilt=0)
        assert text.startswith("camera directly in front of the subject, front view")

    def test_orbit_wraps_past_180_and_side_follows_sign(self) -> None:
        right = camera_director_prompt(orbit=45, elevation=0, distance=80, fov=50, tilt=0)
        left = camera_director_prompt(orbit=-45, elevation=0, distance=80, fov=50, tilt=0)
        assert "right side" in right
        assert "left side" in left

    def test_orbit_near_180_is_rear_view(self) -> None:
        text = camera_director_prompt(orbit=180, elevation=0, distance=80, fov=50, tilt=0)
        assert "directly behind the subject, rear view" in text

    def test_orbit_beyond_360_normalizes_the_same_as_within_range(self) -> None:
        assert camera_director_prompt(orbit=405, elevation=0, distance=80, fov=50, tilt=0) == (
            camera_director_prompt(orbit=45, elevation=0, distance=80, fov=50, tilt=0)
        )

    def test_elevation_buckets(self) -> None:
        assert "bird's-eye view" in camera_director_prompt(orbit=0, elevation=50, distance=80, fov=50, tilt=0)
        assert "high-angle shot down" in camera_director_prompt(orbit=0, elevation=20, distance=80, fov=50, tilt=0)
        assert "at the subject's eye level" in camera_director_prompt(orbit=0, elevation=0, distance=80, fov=50, tilt=0)
        assert "low-angle shot up" in camera_director_prompt(orbit=0, elevation=-20, distance=80, fov=50, tilt=0)
        assert "worm's-eye view" in camera_director_prompt(orbit=0, elevation=-50, distance=80, fov=50, tilt=0)

    def test_distance_buckets_control_framing(self) -> None:
        assert "extreme close-up on the face" in camera_director_prompt(orbit=0, elevation=0, distance=30, fov=50, tilt=0)
        assert "close-up shot framing head and shoulders" in camera_director_prompt(orbit=0, elevation=0, distance=50, fov=50, tilt=0)
        assert "medium shot framed from the waist up" in camera_director_prompt(orbit=0, elevation=0, distance=70, fov=50, tilt=0)
        assert "full body shot" in camera_director_prompt(orbit=0, elevation=0, distance=100, fov=50, tilt=0)
        assert "wide shot with the subject small" in camera_director_prompt(orbit=0, elevation=0, distance=140, fov=50, tilt=0)

    def test_fov_extremes_add_a_lens_phrase_neutral_fov_adds_nothing(self) -> None:
        assert "telephoto lens" in camera_director_prompt(orbit=0, elevation=0, distance=80, fov=20, tilt=0)
        assert "wide-angle lens" in camera_director_prompt(orbit=0, elevation=0, distance=80, fov=100, tilt=0)
        neutral = camera_director_prompt(orbit=0, elevation=0, distance=80, fov=50, tilt=0)
        assert "telephoto" not in neutral and "wide-angle" not in neutral

    def test_tilt_beyond_threshold_adds_roll_phrase_small_tilt_is_silent(self) -> None:
        assert "camera roll 10° clockwise" in camera_director_prompt(orbit=0, elevation=0, distance=80, fov=50, tilt=10)
        assert "camera roll 10° counter-clockwise" in camera_director_prompt(orbit=0, elevation=0, distance=80, fov=50, tilt=-10)
        silent = camera_director_prompt(orbit=0, elevation=0, distance=80, fov=50, tilt=2)
        assert "camera roll" not in silent

    def test_always_ends_with_the_pose_independence_safety_clause(self) -> None:
        text = camera_director_prompt(orbit=0, elevation=0, distance=80, fov=50, tilt=0)
        assert text.endswith("camera position only, does not change the subject's own pose or body orientation")


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
