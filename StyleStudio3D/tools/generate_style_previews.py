#!/usr/bin/env python3
"""
Genera in batch le 65 anteprime fotorealistiche del catalogo stili (capelli, barba, trucco)
usando l'API OpenAI Images, e le salva pronte per essere copiate in
app/src/main/assets/style_previews/ (l'app le trova da sola, vedi il README li' dentro).

USO:
    1. pip install --user openai
    2. export OPENAI_API_KEY="sk-..."          (la tua chiave, MAI messa in questo file)
    3. python3 generate_style_previews.py
       (rigenera solo le immagini mancanti nella cartella di output; rilancialo se si
        interrompe a meta', riprende da dove si era fermato)

Questo script va eseguito sul TUO computer, non nel sandbox di Claude: il sandbox non ha
accesso di rete verso api.openai.com. Una volta generate le immagini, comprimi la cartella
"output" e mandamela in chat: le copio io in app/src/main/assets/style_previews/ e
pubblico la build.
"""
import base64
import os
import sys
import time

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")

# (id, prompt) — id = nome file atteso da app/src/main/assets/style_previews/<id>.jpg
STILE_BASE = (
    "Fotografia professionale da studio fotografico, ritratto mezzobusto, sfondo neutro grigio "
    "chiaro sfumato, illuminazione softbox da beauty photography, altissima definizione, foto "
    "realistica (NON disegno, NON illustrazione, NON cartone animato, NON 3D render), "
    "inquadratura leggermente di tre quarti, espressione naturale e rilassata."
)


def hair(id_, nome, genere, lunghezza, volume, texture, colore, tags):
    prompt = (
        f"{STILE_BASE} Soggetto: {genere}. Acconciatura in stile \"{nome}\" ({', '.join(tags)}), "
        f"lunghezza {lunghezza}, volume {volume}, texture {texture}, colore capelli {colore}. "
        f"L'acconciatura e' l'elemento protagonista dell'inquadratura."
    )
    return (f"seed-capelli-{id_}", prompt)


def beard(id_, nome, genere, lunghezza, volume, colore, tags):
    prompt = (
        f"{STILE_BASE} Soggetto: uomo. Barba/baffi in stile \"{nome}\" ({', '.join(tags)}), "
        f"lunghezza {lunghezza}, volume {volume}, colore {colore}. "
        f"La barba/i baffi sono l'elemento protagonista dell'inquadratura, capelli curati neutri."
    )
    return (f"seed-barba-{id_}", prompt)


def makeup(id_, nome, intensita, colore, tags):
    prompt = (
        f"{STILE_BASE} Soggetto: volto femminile in primo piano beauty. Trucco professionale da "
        f"photoshoot in stile \"{nome}\" ({', '.join(tags)}), intensita' {intensita} su 1, "
        f"colore dominante {colore}. Il trucco e' l'elemento protagonista dell'inquadratura."
    )
    return (f"seed-trucco-{id_}", prompt)


VOCI = [
    hair("01", "Undercut sfumato", "persona", "corto", "scolpito", "liscio", "#2B1B12", ["undercut", "fade"]),
    hair("02", "Pompadour classico", "uomo", "medio", "voluminoso", "liscio", "#1C120B", ["pompadour"]),
    hair("03", "Buzz cut", "persona", "rasato", "piatto", "liscio", "#2B1B12", ["buzz cut"]),
    hair("04", "Caschetto (bob) liscio", "donna", "corto", "naturale", "liscio", "#3B2A1F", ["bob"]),
    hair("05", "Long bob (lob) mosso", "donna", "medio", "naturale", "mosso", "#4A2F1E", ["lob"]),
    hair("06", "Shag scalato", "persona", "medio", "voluminoso", "mosso", "#5C3A22", ["shag", "layers"]),
    hair("07", "Trecce boxer", "persona", "lungo", "scolpito", "trecce", "#1A1310", ["box braids"]),
    hair("08", "Treccia a spiga (fishtail)", "donna", "lungo", "naturale", "trecce", "#6B4226", ["fishtail braid"]),
    hair("09", "Afro naturale", "persona", "medio", "voluminoso", "afro", "#1B1310", ["afro"]),
    hair("10", "Twist afro corti", "persona", "corto", "voluminoso", "afro", "#241713", ["twists"]),
    hair("11", "Coda alta liscia", "donna", "lungo", "piatto", "liscio", "#2E2015", ["sleek ponytail"]),
    hair("12", "Chignon basso", "donna", "lungo", "scolpito", "liscio", "#2E2015", ["chignon", "raccolto"]),
    hair("13", "Ricci definiti extra long", "donna", "extra lungo", "voluminoso", "riccio", "#4A2F1E", ["curly"]),
    hair("14", "Beach waves", "persona", "lungo", "naturale", "mosso", "#8C6A3F", ["beach waves"]),
    hair("15", "Pixie cut corto", "donna", "cortissimo", "scolpito", "liscio", "#2E2015", ["pixie cut"]),
    hair("16", "Crew cut", "uomo", "cortissimo", "naturale", "liscio", "#2B1B12", ["crew cut"]),
    hair("17", "Mullet moderno", "persona", "medio", "voluminoso", "mosso", "#3B2A1F", ["modern mullet"]),
    hair("18", "Slick back", "uomo", "medio", "piatto", "liscio", "#120C08", ["slick back"]),
    hair("19", "Curtain bangs con lunghezza", "persona", "lungo", "naturale", "mosso", "#5C3A22", ["curtain bangs"]),
    hair("20", "Frangia piena netta", "donna", "medio", "naturale", "liscio", "#1B140F", ["blunt bangs"]),
    hair("21", "French crop", "uomo", "corto", "scolpito", "liscio", "#2B1B12", ["french crop"]),
    hair("22", "Man bun", "uomo", "lungo", "scolpito", "liscio", "#1B140F", ["man bun"]),
    hair("23", "Ricci corti afro-latini", "uomo", "corto", "voluminoso", "riccio", "#1B140F", ["curly crop"]),
    hair("24", "Wolf cut", "persona", "medio", "voluminoso", "mosso", "#5C3A22", ["wolf cut"]),
    hair("25", "Coda bassa con ciocca liscia", "persona", "lungo", "naturale", "liscio", "#2E2015", ["low ponytail"]),
    hair("26", "Rasato ai lati, top lungo", "uomo", "lungo", "voluminoso", "mosso", "#2B1B12", ["disconnected undercut"]),
    hair("27", "Treccia olandese doppia", "donna", "lungo", "naturale", "trecce", "#6B4226", ["dutch braids"]),
    hair("28", "Capelli lisci extra lunghi", "donna", "extra lungo", "piatto", "liscio", "#0E0B09", ["long sleek"]),
    hair("29", "Taglio asimmetrico", "persona", "corto", "scolpito", "liscio", "#3B2A1F", ["asymmetric cut"]),
    hair("30", "Onde old Hollywood", "donna", "medio", "scolpito", "mosso", "#1B140F", ["finger waves"]),
    beard("01", "Barba lunga folta", "uomo", "lungo", "voluminoso", "#2B1B12", ["full beard"]),
    beard("02", "Barba corta curata", "uomo", "corto", "scolpito", "#2B1B12", ["short boxed beard"]),
    beard("03", "Ombra di barba (5 o'clock shadow)", "uomo", "rasato", "piatto", "#2B1B12", ["stubble"]),
    beard("04", "Pizzetto (goatee)", "uomo", "corto", "scolpito", "#2B1B12", ["goatee"]),
    beard("05", "Barba a catena (chin strap)", "uomo", "cortissimo", "piatto", "#2B1B12", ["chin strap"]),
    beard("06", "Baffi a manubrio", "uomo", "corto", "scolpito", "#2B1B12", ["handlebar mustache"]),
    beard("07", "Baffi a spazzola", "uomo", "cortissimo", "naturale", "#2B1B12", ["brush mustache"]),
    beard("08", "Baffi sottili", "uomo", "cortissimo", "piatto", "#2B1B12", ["pencil mustache"]),
    beard("09", "Barba hipster con baffi", "uomo", "medio", "voluminoso", "#3B2A1F", ["hipster beard"]),
    beard("10", "Barba a forma di ancora", "uomo", "corto", "scolpito", "#1B140F", ["anchor beard"]),
    beard("11", "Basette lunghe raccordate", "uomo", "medio", "naturale", "#2B1B12", ["mutton chops"]),
    beard("12", "Barba fluviale (Balbo)", "uomo", "corto", "scolpito", "#1B140F", ["balbo beard"]),
    beard("13", "Barba grigio naturale", "uomo", "medio", "naturale", "#9B9B9B", ["salt and pepper"]),
    beard("14", "Viso rasato pulito", "uomo", "rasato", "piatto", "pelle naturale", ["clean shave"]),
    beard("15", "Barba lunga intrecciata", "uomo", "extra lungo", "scolpito", "#2B1B12", ["braided beard"]),
    makeup("01", "Nude naturale da giorno", "0.25", "#C9A784", ["natural nude"]),
    makeup("02", "Cat eye smokey", "0.8", "#1A1A1A", ["smokey eye", "cat eye"]),
    makeup("03", "Rossetto rosso classico", "0.6", "#B01030", ["red lip"]),
    makeup("04", "Glow estivo (dewy skin)", "0.4", "#E8B98F", ["dewy", "glow"]),
    makeup("05", "Trucco sposa soft glam", "0.55", "#D9A6A0", ["bridal", "soft glam"]),
    makeup("06", "Occhio bronzo caldo", "0.5", "#A0692E", ["bronze eye"]),
    makeup("07", "Labbra nude effetto matte", "0.35", "#B98868", ["nude matte lip"]),
    makeup("08", "Trucco serale glitter", "0.85", "#8A6BB1", ["glitter", "sera"]),
    makeup("09", "Sopracciglia scolpite laminate", "0.3", "#3B2A1F", ["brow lamination"]),
    makeup("10", "Blush pesca luminoso", "0.3", "#F2A488", ["peach blush"]),
    makeup("11", "Contouring scolpito", "0.5", "#8A5A3B", ["contouring"]),
    makeup("12", "Eyeliner grafico colorato", "0.6", "#1F6FB2", ["graphic liner"]),
    makeup("13", "Trucco autunnale toni caldi", "0.55", "#8C4A2B", ["autumn look"]),
    makeup("14", "Trucco invernale toni freddi", "0.55", "#5A4A8C", ["winter look"]),
    makeup("15", "No-makeup makeup", "0.15", "#D8B79A", ["no makeup look"]),
    makeup("16", "Occhio rosa millennial", "0.45", "#D98CA0", ["millennial pink"]),
    makeup("17", "Trucco anni '90 grunge", "0.6", "#6B2E3B", ["90s grunge"]),
    makeup("18", "Halo eye luminoso", "0.5", "#C99A5B", ["halo eye"]),
    makeup("19", "Baffetto highlighter scolpito", "0.4", "#F0D9A8", ["strobing"]),
    makeup("20", "Trucco editoriale audace", "0.9", "#101010", ["editorial", "avant-garde"]),
]


def main():
    if not os.environ.get("OPENAI_API_KEY"):
        sys.exit("Errore: imposta prima OPENAI_API_KEY (export OPENAI_API_KEY=sk-...)")
    try:
        from openai import OpenAI
    except ImportError:
        sys.exit("Manca il pacchetto 'openai'. Esegui: pip install --user openai")

    client = OpenAI()
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    totale = len(VOCI)
    for i, (id_, prompt) in enumerate(VOCI, start=1):
        destinazione = os.path.join(OUTPUT_DIR, f"{id_}.jpg")
        if os.path.exists(destinazione):
            print(f"[{i}/{totale}] {id_}: gia' presente, salto")
            continue
        print(f"[{i}/{totale}] {id_}: genero...")
        try:
            risposta = client.images.generate(
                model="gpt-image-1",
                prompt=prompt,
                size="1024x1024",
                n=1,
            )
            dati = base64.b64decode(risposta.data[0].b64_json)
            with open(destinazione, "wb") as f:
                f.write(dati)
            print(f"    fatto -> {destinazione}")
        except Exception as e:
            print(f"    ERRORE su {id_}: {e}")
        time.sleep(1)  # margine di cortesia sul rate limit

    print("\nCompletato. Ora comprimi la cartella 'output' (o mandami i file) cosi' li integro nell'app.")


if __name__ == "__main__":
    main()
