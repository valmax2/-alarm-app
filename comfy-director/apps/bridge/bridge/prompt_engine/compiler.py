"""Smart Prompt Compiler: compone un prompt inglese strutturato a partire da selezioni
guidate (corpo, viso, capelli, abbigliamento, azione/posa/ambiente, camera, luce) e,
opzionalmente, un Personaggio della libreria per la coerenza dell'identità.

Portato — riorganizzato in modo pulito, tipizzato e testabile — dalla logica
`composePrompt`/`coherentIdentityBlock` di PromptStudio, su richiesta esplicita
dell'utente ("qui volevo organizzarla meglio"). Adattamenti deliberati rispetto
all'originale, dichiarati:
- Nessun `cameraDirectorText` (controllo camera interattivo trascinabile): qui la
  camera è solo tramite i cataloghi framing/angolo/lens — deferito esplicitamente.
- Nessuna modalità "viso da immagine di riferimento generica": Comfy Director non ha
  ancora un campo per allegare un'immagine di riferimento diversa da un Personaggio
  della libreria (dipende dal Workflow Intelligence Engine, Fase 5) — la "coerenza"
  in questa consegna passa SEMPRE da un `CharacterInfo` esplicito, mai da un
  riferimento generico anonimo.
- `CharacterInfo` usa i campi reali di `CharacterRecord` (name/description/tags/notes)
  — PromptStudio aveva anche un campo libero `type` che qui non esiste, sostituito
  dalla `description`.

Puro: nessuna dipendenza da FastAPI/DB — prende dati già caricati, non li carica lui
stesso (i router restano l'unico punto che tocca la sessione DB).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Literal

Gender = Literal["female", "male"]
FaceMode = Literal["", "create"]
HairMode = Literal["", "keep", "change"]

_CLOTHING_OVERRIDE_RE = re.compile(r"\b(topless|nude|naked|seminude|semi-nude|shirtless)\b", re.IGNORECASE)


@dataclass(frozen=True)
class CharacterInfo:
    """Vista minima di un Personaggio della libreria (Fase 7) usata per il blocco di
    coerenza — disaccoppiata da `CharacterRecord` così questo modulo non dipende
    dagli ORM model (coerente con `bridge/characters/pack.py`)."""

    name: str
    description: str | None = None
    tags: list[str] = field(default_factory=list)
    notes: str | None = None


@dataclass(frozen=True)
class StructuredPromptInput:
    gender: Gender = "female"
    age: int | None = None
    clothing_state: str | None = None  # frammento EN dal catalogo CLOTHING_STATES, o None
    underwear_item: str | None = None  # frammento EN dal catalogo UNDERWEAR_CATEGORIES

    body: dict[str, str] = field(default_factory=dict)  # group_key -> frammento EN

    face_mode: FaceMode = ""
    face: dict[str, str] = field(default_factory=dict)  # group_key -> frammento EN

    hair_mode: HairMode = ""
    hair: str | None = None
    custom_hair: str | None = None
    hair_color: str | None = None

    custom_action: str | None = None
    action: str | None = None
    pose: str | None = None
    custom_scene: str | None = None
    environment: str | None = None
    custom_photo: str | None = None

    camera_framing: str | None = None
    camera_angle: str | None = None
    camera_lens: str | None = None
    light: str | None = None


def coherent_identity_block(character: CharacterInfo) -> str:
    meta = " ".join(
        filter(
            None,
            [
                f"Character name: {character.name}." if character.name else "",
                f"Character description: {character.description}." if character.description else "",
                f"Saved character traits: {', '.join(character.tags)}." if character.tags else "",
                f"Character notes: {character.notes}." if character.notes else "",
            ],
        )
    )
    base = (
        "CHARACTER CONSISTENCY — STRONG: use the attached reference image of the selected coherent "
        "character as the primary identity reference. Preserve the exact same person and recognizable "
        "facial identity. Preserve facial structure, face shape, eyes, nose, mouth, skin tone, age "
        "appearance, natural skin texture and distinctive facial features. Do not redesign, reinterpret, "
        "beautify, average, replace or morph the face into another person. Changes requested to body "
        "proportions, clothing, hairstyle, expression, pose, action, environment, camera, lens or lighting "
        "must NOT alter the person's core facial identity. Keep the identity consistent throughout the "
        "generation."
    )
    return f"{base} {meta}".strip()


def compose_prompt(data: StructuredPromptInput, character: CharacterInfo | None = None) -> str:
    """Compone il prompt inglese finale — mai un campo lasciato in silenzio se
    valorizzato, mai un frammento inventato se non selezionato."""
    fragments: list[str] = []

    subject = "adult woman" if data.gender == "female" else "adult man"
    fragments.append(
        f"SINGLE SUBJECT ONLY — exactly one {subject}; do not add a second person, "
        "duplicate subject, twin, clone or background person"
    )
    if data.age is not None and data.age >= 18:
        fragments.append(f"{data.age} years old")

    free_text = " ".join(filter(None, [data.custom_action, data.custom_scene, data.custom_photo]))
    user_overrides_clothing = bool(_CLOTHING_OVERRIDE_RE.search(free_text))
    if data.clothing_state == "underwear" and not user_overrides_clothing:
        fragments.append(f"wearing {data.underwear_item}" if data.underwear_item else "wearing underwear")
    elif data.clothing_state and not user_overrides_clothing:
        fragments.append(re.sub(r"^adult\s+", "", data.clothing_state))

    if character is not None:
        fragments.append(coherent_identity_block(character))
        # L'identità del personaggio coerente sostituisce la descrizione generica del
        # viso, non si sommano: coerente con PromptStudio (mai un doppio riferimento
        # d'identità nello stesso prompt).
    elif data.face_mode == "create":
        fragments.extend(v for v in data.face.values() if v)

    fragments.extend(v for v in data.body.values() if v)

    has_reference = character is not None
    if data.hair_mode == "keep" and has_reference:
        fragments.append("HAIRSTYLE — LOCKED: preserve the same hairstyle as the character's reference image")
    if data.hair_mode == "change":
        style = (data.custom_hair or "").strip() or (data.hair or "")
        color = data.hair_color or ""
        if style or color:
            parts = []
            if style:
                parts.append(f"change the hairstyle to {style}")
            if color:
                parts.append(f"hair color {color}")
            piece = "; ".join(parts)
            if has_reference:
                piece += "; do NOT preserve the reference hairstyle; preserve facial identity while changing only the hair"
            fragments.append(f"HAIRSTYLE CHANGE — STRONG: {piece}")

    custom_action = (data.custom_action or "").strip()
    if custom_action:
        fragments.append(custom_action)
    elif data.action:
        fragments.append(data.action)

    if data.pose:
        fragments.append(data.pose)

    custom_scene = (data.custom_scene or "").strip()
    if custom_scene:
        fragments.append(custom_scene)
    elif data.environment:
        fragments.append(data.environment)

    if data.camera_framing:
        fragments.append(f"FRAMING — STRONG: {data.camera_framing}")
    if data.camera_angle:
        fragments.append(f"CAMERA VIEWPOINT — STRONG: {data.camera_angle}")
    if data.camera_lens:
        fragments.append(f"LENS — {data.camera_lens}")

    if data.light:
        fragments.append(data.light)

    custom_photo = (data.custom_photo or "").strip()
    if custom_photo:
        fragments.append(custom_photo)

    return _dedupe_join(fragments)


def _dedupe_join(fragments: list[str]) -> str:
    seen: set[str] = set()
    clean: list[str] = []
    for item in fragments:
        item = item.strip()
        if not item:
            continue
        key = item.lower()
        if key in seen:
            continue
        seen.add(key)
        clean.append(item)
    return ", ".join(clean)
