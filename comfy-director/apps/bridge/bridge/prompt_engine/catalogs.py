"""Cataloghi statici del compositore di prompt strutturato ("Smart Prompt Compiler",
portato — riorganizzato in modo pulito e testabile — da PromptStudio su richiesta
esplicita dell'utente).

Vocabolario di prompt engineering (etichetta italiana → frammento inglese da inserire
nel prompt), non dati derivati da ComfyUI: qui l'hardcoding è corretto (è testo
editoriale, non un parametro che ComfyUI potrebbe cambiare) — diverso dalla regola
"mai hardcodare parametri custom-node", che riguarda schema/valori che SOLO ComfyUI
conosce (docs/comfyui-api.md).

Puro dato + tipi, nessuna dipendenza da FastAPI/DB — `routers/prompt_engine.py`
lo espone via API, `compiler.py` lo consuma per comporre il prompt finale.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Option:
    label_it: str
    value_en: str


@dataclass(frozen=True)
class OptionGroup:
    key: str
    label_it: str
    options: tuple[Option, ...]


def _opts(*pairs: tuple[str, str]) -> tuple[Option, ...]:
    return tuple(Option(label_it=it, value_en=en) for it, en in pairs)


BODY: dict[str, tuple[OptionGroup, ...]] = {
    "female": (
        OptionGroup("build", "Corporatura", _opts(
            ("Snella", "slim body"), ("Magra", "thin body"), ("Atletica", "athletic body"),
            ("Fit", "fit body"), ("Muscolosa", "muscular body"), ("Curvy", "curvy body"),
            ("Robusta", "chubby body"), ("Sovrappeso", "overweight body"),
            ("Clessidra", "hourglass figure"), ("Pera", "pear-shaped body"),
        )),
        OptionGroup("height", "Altezza", _opts(
            ("Bassa", "short stature"), ("Petite", "petite"), ("Media", "average height"),
            ("Alta", "tall"), ("Molto alta", "very tall"),
        )),
        OptionGroup("breast-size", "Seno", _opts(
            ("Piatto", "flat chest"), ("Piccolo", "small breasts"), ("Medio", "medium breasts"),
            ("Grande", "large breasts"), ("Molto grande", "huge breasts"), ("Voluttuoso", "voluptuous breasts"),
        )),
        OptionGroup("breast-shape", "Forma seno", _opts(
            ("Naturale", "natural breasts"), ("Sodo", "firm breasts"), ("Arrotondato", "rounded breasts"),
            ("Cadente", "sagging breasts"), ("Décolleté definito", "defined cleavage"),
        )),
        OptionGroup("waist", "Vita", _opts(
            ("Stretta", "narrow waist"), ("Media", "average waist"), ("Larga", "wide waist"), ("Definita", "defined waist"),
        )),
        OptionGroup("hips", "Fianchi", _opts(
            ("Stretti", "narrow hips"), ("Medi", "average hips"), ("Larghi", "wide hips"),
            ("Arrotondati", "rounded hips"), ("Curvy", "curvy hips"),
        )),
        OptionGroup("butt-size", "Glutei", _opts(
            ("Piccoli", "small buttocks"), ("Medi", "medium buttocks"), ("Grandi", "large buttocks"),
            ("Rotondi", "round buttocks"), ("Sodi", "firm buttocks"), ("Larghi", "wide buttocks"),
        )),
        OptionGroup("legs", "Gambe", _opts(
            ("Sottili", "thin legs"), ("Slanciate", "slim legs"), ("Atletiche", "athletic legs"),
            ("Muscolose", "muscular legs"), ("Lunghe", "long legs"), ("Molto lunghe", "very long legs"),
            ("Cosce definite", "defined thighs"), ("Polpacci definiti", "defined calves"),
        )),
        OptionGroup("skin-tone", "Pelle", _opts(
            ("Chiara", "fair skin"), ("Pallida", "pale skin"), ("Olivastra", "olive skin"),
            ("Abbronzata", "tanned skin"), ("Scura", "dark skin"),
        )),
        OptionGroup("skin-detail", "Texture pelle", _opts(
            ("Pori visibili", "visible pores"), ("Lentiggini", "freckles"), ("Pelle liscia", "smooth skin"),
            ("Pelle matura", "mature skin"), ("Rughe naturali", "natural wrinkles"),
            ("Tatuaggi", "tattoos"), ("Cicatrici", "scars"),
        )),
        OptionGroup("areola-size", "Areola", _opts(
            ("Piccola", "small areolae"), ("Media", "medium areolae"), ("Grande", "large areolae"),
        )),
        OptionGroup("areola-color", "Colore areola", _opts(
            ("Rosa", "pink areolae"), ("Chiara", "light areolae"), ("Marrone", "brown areolae"), ("Scura", "dark areolae"),
        )),
        OptionGroup("pubic-style", "Grooming pubico", _opts(
            ("Rasata", "clean-shaven pubic area"), ("Ricrescita leggera", "light pubic stubble"),
            ("Corta e curata", "short trimmed pubic hair"), ("Naturale", "natural pubic hair"),
            ("Folto", "full pubic hair"), ("Striscia", "landing strip pubic hair"), ("Sagomato", "groomed pubic hair"),
        )),
    ),
    "male": (
        OptionGroup("build", "Corporatura", _opts(
            ("Snello", "slim body"), ("Magro", "thin body"), ("Atletico", "athletic body"), ("Fit", "fit body"),
            ("Muscoloso", "muscular body"), ("Robusto", "broad build"), ("Sovrappeso", "overweight body"),
        )),
        OptionGroup("height", "Altezza", _opts(
            ("Basso", "short stature"), ("Media", "average height"), ("Alto", "tall"), ("Molto alto", "very tall"),
        )),
        OptionGroup("chest", "Torace", _opts(
            ("Snello", "slim chest"), ("Definito", "defined chest"), ("Atletico", "athletic chest"),
            ("Muscoloso", "muscular chest"), ("Ampio", "broad chest"), ("Pettorali grandi", "large pectorals"),
        )),
        OptionGroup("waist", "Vita", _opts(
            ("Stretta", "narrow waist"), ("Media", "average waist"), ("Larga", "wide waist"), ("Definita", "defined waist"),
        )),
        OptionGroup("hips", "Fianchi", _opts(
            ("Stretti", "narrow hips"), ("Medi", "average hips"), ("Larghi", "wide hips"),
        )),
        OptionGroup("butt-size", "Glutei", _opts(
            ("Piccoli", "small buttocks"), ("Medi", "medium buttocks"), ("Grandi", "large buttocks"),
            ("Atletici", "athletic buttocks"), ("Sodi", "firm buttocks"),
        )),
        OptionGroup("legs", "Gambe", _opts(
            ("Sottili", "thin legs"), ("Slanciate", "slim legs"), ("Atletiche", "athletic legs"),
            ("Muscolose", "muscular legs"), ("Lunghe", "long legs"), ("Cosce definite", "defined thighs"),
        )),
        OptionGroup("skin-tone", "Pelle", _opts(
            ("Chiara", "fair skin"), ("Olivastra", "olive skin"), ("Abbronzata", "tanned skin"), ("Scura", "dark skin"),
        )),
        OptionGroup("skin-detail", "Texture pelle", _opts(
            ("Pori visibili", "visible pores"), ("Lentiggini", "freckles"), ("Pelle matura", "mature skin"),
            ("Rughe naturali", "natural wrinkles"), ("Tatuaggi", "tattoos"), ("Cicatrici", "scars"),
        )),
    ),
}

FACE: tuple[OptionGroup, ...] = (
    OptionGroup("face-shape", "Forma viso", _opts(
        ("Ovale", "oval face"), ("Rotondo", "round face"), ("Quadrato", "square face"), ("A cuore", "heart-shaped face"),
        ("Diamante", "diamond-shaped face"), ("Lungo", "long face"), ("Angolare", "angular face"),
    )),
    OptionGroup("jaw", "Mascella", _opts(
        ("Morbida", "soft jawline"), ("Definita", "defined jawline"), ("Forte", "strong jawline"), ("Quadrata", "square jaw"),
    )),
    OptionGroup("cheek", "Zigomi", _opts(
        ("Morbidi", "soft cheekbones"), ("Alti", "high cheekbones"), ("Definiti", "defined cheekbones"), ("Prominenti", "prominent cheekbones"),
    )),
    OptionGroup("chin", "Mento", _opts(
        ("Piccolo", "small chin"), ("Rotondo", "rounded chin"), ("Appuntito", "pointed chin"),
        ("Forte", "strong chin"), ("Quadrato", "square chin"),
    )),
    OptionGroup("eyes", "Occhi", _opts(
        ("Grandi", "large eyes"), ("Piccoli", "small eyes"), ("A mandorla", "almond-shaped eyes"),
        ("Profondi", "deep-set eyes"), ("Distanziati", "wide-set eyes"),
    )),
    OptionGroup("eye-color", "Colore occhi", _opts(
        ("Azzurri", "blue eyes"), ("Verdi", "green eyes"), ("Marroni", "brown eyes"), ("Nocciola", "hazel eyes"), ("Grigi", "gray eyes"),
    )),
    OptionGroup("nose", "Naso", _opts(
        ("Piccolo", "small nose"), ("Dritto", "straight nose"), ("Sottile", "narrow nose"),
        ("Pronunciato", "prominent nose"), ("Aquiline", "aquiline nose"),
    )),
    OptionGroup("lips", "Labbra", _opts(
        ("Sottili", "thin lips"), ("Medie", "medium lips"), ("Carnose", "full lips"), ("Arco di Cupido", "defined cupid's bow"),
    )),
)

HAIR_CATEGORIES: dict[str, tuple[Option, ...]] = {
    "Corti": _opts(
        ("Pixie classico", "classic pixie cut"), ("Pixie lungo", "long pixie cut"), ("Pixie spettinato", "messy pixie cut"),
        ("Garçonne", "garcon crop"), ("Buzz cut", "buzz cut"), ("Crew cut", "crew cut"),
        ("Corti scalati", "short layered hair"), ("Corti spettinati", "short tousled hair"), ("Bowl cut", "bowl cut"),
    ),
    "Bob e caschetti": _opts(
        ("Bob al mento", "chin-length bob haircut"), ("Bob corto", "short bob haircut"), ("Long bob / Lob", "long bob haircut"),
        ("Bob asimmetrico", "asymmetrical bob haircut"), ("Bob francese", "French bob haircut"),
        ("Bob mosso", "wavy bob haircut"), ("Bob riccio", "curly bob haircut"),
        ("Bob con frangia", "bob haircut with bangs"), ("Caschetto pari", "blunt bob haircut"),
    ),
    "Medi e lunghi": _opts(
        ("Media lunghezza", "medium-length hair"), ("Lunghi lisci", "long straight hair"), ("Lunghi mossi", "long wavy hair"),
        ("Lunghi ricci", "long curly hair"), ("Lunghi scalati", "long layered hair"), ("Onde morbide", "soft wavy hair"),
        ("Onde Hollywood", "Hollywood waves"), ("Ricci stretti", "tight curly hair"), ("Afro", "afro hairstyle"),
    ),
    "Code e codini": _opts(
        ("Coda alta", "high ponytail"), ("Coda bassa", "low ponytail"), ("Coda media", "mid-height ponytail"),
        ("Coda laterale destra", "side ponytail on the right"), ("Coda laterale sinistra", "side ponytail on the left"),
        ("Codino alto a destra", "high side ponytail on the right"), ("Codino alto a sinistra", "high side ponytail on the left"),
        ("Due codini laterali", "two side ponytails"), ("Due codini alti", "two high pigtails"),
        ("Due codini bassi", "two low pigtails"), ("Codini laterali stile bambola", "two playful side pigtails"),
        ("Bubble ponytail", "bubble ponytail"), ("Coda intrecciata", "braided ponytail"),
    ),
    "Trecce": _opts(
        ("Treccia singola", "single braid"), ("Treccia laterale destra", "side braid on the right"),
        ("Treccia laterale sinistra", "side braid on the left"), ("Doppie trecce", "double braids"),
        ("Boxer braids", "double boxer braids"), ("Treccia francese", "French braid"), ("Treccia olandese", "Dutch braid"),
        ("Treccia a spina di pesce", "fishtail braid"), ("Treccine multiple", "multiple small braids"),
        ("Cornrows", "cornrow braids"), ("Crown braid", "crown braid"),
    ),
    "Raccolti": _opts(
        ("Chignon alto", "high hair bun"), ("Chignon basso", "low hair bun"), ("Messy bun", "messy hair bun"),
        ("Doppio chignon alto", "double high buns"), ("Space buns", "space buns"),
        ("Mezzo raccolto", "half-up half-down hairstyle"), ("Top knot", "top knot"),
        ("Raccolto elegante", "elegant updo"), ("French twist", "French twist updo"),
    ),
    "Laterali e rasati": _opts(
        ("Rasati ai lati", "shaved sides hairstyle"), ("Undercut", "undercut hairstyle"),
        ("Sidecut destro", "right sidecut hairstyle"), ("Sidecut sinistro", "left sidecut hairstyle"),
        ("Capelli tutti a destra", "hair swept entirely to the right"), ("Capelli tutti a sinistra", "hair swept entirely to the left"),
        ("Riga laterale profonda", "deep side part hairstyle"),
    ),
    "Frange e ciuffi": _opts(
        ("Frangia piena", "full bangs"), ("Frangia a tendina", "curtain bangs"),
        ("Frangia laterale destra", "side-swept bangs to the right"), ("Frangia laterale sinistra", "side-swept bangs to the left"),
        ("Baby bangs", "baby bangs"), ("Ciuffo alto", "high quiff"), ("Ciuffo laterale", "side-swept fringe"),
    ),
    "Fantasy e particolari": _opts(
        ("Mohawk", "mohawk hairstyle"), ("Faux hawk", "faux hawk hairstyle"), ("Dreadlocks", "dreadlocks"),
        ("Dreadlocks raccolti", "tied-up dreadlocks"), ("Bantu knots", "Bantu knots"), ("Locs lunghi", "long locs"),
        ("Capelli effetto bagnato", "wet-look hair"), ("Capelli spettinati dal vento", "windswept hair"),
    ),
}

HAIR_COLORS: tuple[Option, ...] = _opts(
    ("Nero", "black hair"), ("Castano scuro", "dark brown hair"), ("Castano", "brown hair"), ("Castano chiaro", "light brown hair"),
    ("Biondo scuro", "dark blonde hair"), ("Biondo", "blonde hair"), ("Biondo chiaro", "light blonde hair"), ("Platino", "platinum blonde hair"),
    ("Rosso", "red hair"), ("Rame", "copper hair"), ("Auburn", "auburn hair"), ("Grigio", "gray hair"), ("Bianco", "white hair"),
    ("Nero blu", "blue-black hair"), ("Rosa", "pink hair"), ("Blu", "blue hair"), ("Viola", "purple hair"), ("Verde", "green hair"),
)

CLOTHING_STATES: tuple[Option, ...] = _opts(
    ("Vestita", "fully clothed"),
    ("Biancheria intima", "underwear"),
    ("Topless", "adult topless"),
    ("Seminuda", "adult partially clothed"),
    ("Nuda", "adult nude"),
    ("Nudo artistico", "adult artistic nude"),
)

UNDERWEAR_CATEGORIES: dict[str, tuple[Option, ...]] = {
    "Reggiseni": _opts(
        ("Reggiseno classico", "classic bra"), ("Balconette", "balconette bra"), ("Push-up", "push-up bra"), ("Bralette", "bralette"),
        ("A triangolo", "triangle bra"), ("Bandeau", "bandeau bra"), ("Senza spalline", "strapless bra"), ("Sportivo", "sports bra"),
        ("Longline", "longline bra"), ("Plunge", "plunge bra"), ("Minimizer", "minimizer bra"), ("Full cup", "full-cup bra"),
    ),
    "Slip e mutandine": _opts(
        ("Slip classico", "classic briefs"), ("Bikini brief", "bikini briefs"), ("Hipster", "hipster briefs"), ("Boyshort", "boyshort underwear"),
        ("Brasiliana", "Brazilian briefs"), ("Culotte", "high-waisted briefs"), ("Perizoma", "thong underwear"), ("Tanga", "tanga briefs"),
        ("Seamless", "seamless briefs"), ("Sportivo", "sports briefs"),
    ),
    "Completi": _opts(
        ("Completo coordinato", "matching bra and briefs set"), ("Completo pizzo", "lace lingerie set"), ("Completo satin", "satin lingerie set"),
        ("Completo sportivo", "matching sports underwear set"), ("Completo minimal", "minimal underwear set"),
        ("Completo vintage", "vintage-inspired lingerie set"),
    ),
    "Body e corsetteria": _opts(
        ("Body classico", "classic bodysuit underwear"), ("Body in pizzo", "lace bodysuit"), ("Body satin", "satin bodysuit"),
        ("Corsetto", "corset lingerie"), ("Bustier", "bustier lingerie"), ("Guêpière", "basque lingerie"), ("Teddy", "teddy lingerie"),
    ),
    "Sottovesti e notte": _opts(
        ("Sottoveste", "slip dress lingerie"), ("Chemise", "chemise lingerie"), ("Babydoll", "babydoll nightwear"),
        ("Canotta intima", "underwear camisole"), ("Completo canotta e slip", "camisole and briefs set"), ("Pigiama leggero", "light sleepwear"),
    ),
    "Calze e accessori": _opts(
        ("Collant", "tights"), ("Calze autoreggenti", "thigh-high stockings"), ("Calze con reggicalze", "stockings with garter belt"),
        ("Gambaletti", "knee-high stockings"), ("Leggings intimi", "underlayer leggings"),
    ),
}

ACTIONS: tuple[Option, ...] = _opts(
    ("In piedi", "standing"), ("Cammina", "walking"), ("Corre", "running"), ("Fa jogging", "jogging"), ("Salta", "jumping"),
    ("Siede", "sitting"), ("Beve un caffè", "drinking coffee"), ("Mangia", "eating"), ("Parla", "talking"), ("Ride", "laughing"),
    ("Sorride", "smiling"), ("Balla", "dancing"), ("Lavora al computer", "working at a computer"),
    ("Gioca a tennis", "playing tennis"), ("Fa stretching", "stretching"),
)

POSES: tuple[Option, ...] = _opts(
    ("Frontale", "front-facing pose"), ("Tre quarti", "three-quarter pose"), ("Profilo", "side profile pose"),
    ("Di spalle", "back-facing pose"), ("Seduta su sedia", "sitting on a chair"), ("Seduta a terra", "sitting on the floor"),
    ("Accovacciata", "squatting pose"), ("In ginocchio", "kneeling pose"), ("Sdraiata supina", "lying on back"),
    ("Sdraiata su un fianco", "lying on side"), ("Braccia incrociate", "arms crossed"), ("Mani sui fianchi", "hands on hips"),
    ("Mani dietro la testa", "hands behind head"), ("Guardando indietro", "looking back over shoulder"),
    ("Posa dinamica", "dynamic pose"), ("Posa rilassata", "relaxed pose"),
)

ENVIRONMENTS: tuple[Option, ...] = _opts(
    ("Studio neutro", "neutral photography studio"), ("Salotto", "living room"), ("Camera da letto", "bedroom interior"),
    ("Cucina", "kitchen interior"), ("Ufficio", "office"), ("Ristorante", "restaurant"), ("Bar / Caffè", "cafe"),
    ("Strada urbana", "urban street"), ("Città futuristica", "futuristic city"), ("Spiaggia", "beach"),
    ("Piscina", "swimming pool"), ("Bosco", "forest"), ("Montagna", "mountain landscape"), ("Parco", "park"),
    ("Palestra", "gym"), ("Tramonto", "sunset environment"),
)

CAMERA: tuple[OptionGroup, ...] = (
    OptionGroup("framing", "Taglio / Inquadratura", _opts(
        ("Primo piano", "close-up shot"), ("Testa e spalle", "head and shoulders shot"), ("Mezzo busto", "medium shot"),
        ("Cowboy shot", "cowboy shot"), ("Figura intera", "full body shot"), ("Campo largo", "wide shot"),
    )),
    OptionGroup("angle", "Angolo camera", _opts(
        ("Frontale", "camera directly in front of the subject"),
        ("Dal basso", "strong low-angle shot, camera below the subject looking upward"),
        ("Dall'alto", "strong high-angle shot, camera above the subject looking downward"),
        ("Top-down", "top-down overhead shot"),
        ("Tre quarti DX", "camera at a three-quarter angle on the subject's right side"),
        ("Tre quarti SX", "camera at a three-quarter angle on the subject's left side"),
        ("Profilo DX", "camera on the subject's right side, side-profile viewpoint"),
        ("Profilo SX", "camera on the subject's left side, side-profile viewpoint"),
        ("Da dietro", "camera behind the subject, rear viewpoint"),
    )),
    OptionGroup("lens", "Ottica / Lens", _opts(
        ("14 mm", "14mm ultra-wide-angle lens"), ("18 mm", "18mm ultra-wide-angle lens"), ("24 mm", "24mm wide-angle lens"),
        ("35 mm", "35mm lens"), ("50 mm", "50mm natural lens"), ("85 mm", "85mm portrait lens"),
        ("105 mm", "105mm telephoto portrait lens"), ("135 mm", "135mm telephoto lens"), ("200 mm", "200mm telephoto lens"),
    )),
)

LIGHTS: tuple[Option, ...] = _opts(
    ("Naturale morbida", "soft natural lighting"), ("Studio uniforme", "soft even studio lighting"),
    ("Cinematografica", "cinematic lighting"), ("Rembrandt", "Rembrandt lighting"), ("Butterfly", "butterfly lighting"),
    ("Controluce", "backlighting"), ("Laterale", "side lighting"), ("Golden hour", "golden hour lighting"),
    ("Neon", "neon lighting"), ("Volumetrica", "volumetric lighting"), ("Drammatica", "dramatic lighting"),
    ("Notturna", "night lighting"),
)

NEGATIVE_DEFAULT = (
    "two people, multiple people, duplicate person, duplicate subject, twins, clone, extra person, "
    "low quality, worst quality, blurry, bad anatomy, deformed anatomy, malformed hands, extra fingers, "
    "missing fingers, extra limbs, duplicate subject, distorted face, asymmetrical eyes, cropped head, "
    "jpeg artifacts, watermark, signature, text"
)
