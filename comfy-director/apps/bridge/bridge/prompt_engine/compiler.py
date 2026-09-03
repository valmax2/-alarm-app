"""Smart Prompt Compiler: compone un prompt inglese strutturato a partire da selezioni
guidate (corpo, viso, capelli, abbigliamento, azione/posa/ambiente, camera, luce) e,
opzionalmente, un Personaggio della libreria per la coerenza dell'identità.

Portato — riorganizzato in modo pulito, tipizzato e testabile — dalla logica
`composePrompt`/`coherentIdentityBlock` di PromptStudio, su richiesta esplicita
dell'utente ("qui volevo organizzarla meglio"). Adattamenti deliberati rispetto
all'originale, dichiarati:
- Camera Director (`camera_director_prompt`): portato fedelmente da
  `cameraDirectorPrompt()`/`app.js`, cinque parametri numerici (orbita/elevazione/
  distanza/FOV/tilt) mappati a frasi inglesi — quando attivo SOSTITUISCE del tutto i
  cataloghi framing/angolo/lens (stessa regola dichiarata nell'originale: "sostituisce
  DEL TUTTO i pulsanti Taglio/Inquadratura"). Non portata la logica più sofisticata di
  `smart_prompt_compiler.js` (versione successiva nel codice originale, non quella
  usata da `composePrompt`/`app.js`): lì il testo della Regia viene spezzato in singole
  frasi per un troncamento token-aware e un lens del catalogo può convivere col FOV
  della Regia in certe condizioni — qui, più semplicemente, la Regia è un unico
  frammento e sostituisce SEMPRE framing/angolo/lens quando attiva, mai una fusione
  parziale. Anche la vista 3D (i tre diagrammi SVG trascinabili top/frontale/destra)
  non è portata: solo i cinque controlli numerici e il prompt che producono davvero.
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

    # Camera Director: quando attivo, i cinque parametri sostituiscono del tutto
    # camera_framing/camera_angle/camera_lens sopra — mai una fusione parziale.
    camera_director_active: bool = False
    camera_director_orbit: float = 0.0
    camera_director_elevation: float = 0.0
    camera_director_distance: float = 80.0
    camera_director_fov: float = 50.0
    camera_director_tilt: float = 0.0


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


def camera_director_prompt(orbit: float, elevation: float, distance: float, fov: float, tilt: float) -> str:
    """Porting fedele di `cameraDirectorPrompt()` (PromptStudio `app.js`): mappa i
    cinque parametri numerici della Regia Camera a frasi inglesi, ognuna che nomina
    esplicitamente "camera" all'inizio — nell'originale questo evita che il modello
    legga la frase come un'istruzione sulla POSA del soggetto invece che sulla
    posizione della camera (commento originale mantenuto qui per lo stesso motivo)."""
    o = ((orbit % 360) + 360) % 360
    if o > 180:
        o -= 360
    a = abs(o)
    side = "right" if o > 0 else "left"
    if a < 25:
        orbit_text = "camera directly in front of the subject, front view"
    elif a < 70:
        orbit_text = f"camera positioned at a three-quarter front angle, on the subject's {side} side"
    elif a < 115:
        orbit_text = f"camera positioned directly to the subject's {side} side, profile view"
    elif a < 155:
        orbit_text = f"camera positioned at a three-quarter back angle, on the subject's {side} side"
    else:
        orbit_text = "camera positioned directly behind the subject, rear view"

    if elevation >= 45:
        elevation_text = "camera positioned high above the subject, bird's-eye view"
    elif elevation >= 15:
        elevation_text = "camera positioned above eye level, high-angle shot down at the subject"
    elif elevation > -15:
        elevation_text = "camera at the subject's eye level"
    elif elevation > -45:
        elevation_text = "camera positioned below eye level, low-angle shot up at the subject"
    else:
        elevation_text = "camera positioned low near the ground, worm's-eye view up at the subject"

    if distance <= 35:
        framing_text = "camera very close, extreme close-up on the face"
    elif distance <= 55:
        framing_text = "camera close, close-up shot framing head and shoulders"
    elif distance <= 75:
        framing_text = "camera at medium distance, medium shot framed from the waist up"
    elif distance <= 105:
        framing_text = "camera at full-body distance, full body shot"
    else:
        framing_text = "camera far away, wide shot with the subject small in the environment"

    parts = [orbit_text, elevation_text, framing_text]
    if fov <= 30:
        parts.append("camera telephoto lens, compressed perspective")
    elif fov >= 75:
        parts.append("camera wide-angle lens, expanded perspective")
    if tilt > 4:
        parts.append(f"camera roll {tilt:g}° clockwise")
    elif tilt < -4:
        parts.append(f"camera roll {abs(tilt):g}° counter-clockwise")
    parts.append("camera position only, does not change the subject's own pose or body orientation")
    return ", ".join(parts)


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

    if data.camera_director_active:
        # La Regia Camera sostituisce DEL TUTTO i cataloghi framing/angolo/lens
        # sotto — mai una fusione parziale (stessa regola dell'originale).
        fragments.append(
            "CAMERA DIRECTOR — STRONG: "
            + camera_director_prompt(
                data.camera_director_orbit, data.camera_director_elevation,
                data.camera_director_distance, data.camera_director_fov, data.camera_director_tilt,
            )
        )
    else:
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
