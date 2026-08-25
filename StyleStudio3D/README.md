# Style Studio 3D — prototipo Android

Prototipo nativo Android in Kotlin e Jetpack Compose per sessioni di stile: capelli, barba,
trucco, abbigliamento e scarpe, con armocromia, prova virtuale, sincronizzazione Google Drive e
uno "Studio Fotografico" come passaggio finale prima della generazione dello scatto.

Pensato per essere usato da chiunque, senza distinzioni di genere nell'interfaccia o nel
catalogo stili.

## Funzioni incluse

- **Home a categorie fisse** (Capelli & Barba, Trucco, Abbigliamento, Scarpe, Armocromia,
  Figura intera, Studio Fotografico, Impostazioni): nessuno scorrimento infinito, solo pulsanti.
- **Onboarding al primo avvio**: tutorial scritto passo-passo per ogni categoria, con narrazione
  vocale opzionale tramite il motore TextToSpeech di sistema (sceglie automaticamente la voce
  italiana di qualita' piu' alta disponibile sul dispositivo).
- **Catalogo stili molto ampio e apribile**: 65 voci di serie (30 acconciature, 15 barbe/baffi,
  20 trucchi) con terminologia reale da hairstyling/barbering/makeup — e nessun limite: dalla
  stessa schermata si crea una nuova voce scrivendo un nome libero (in qualsiasi lingua), scelte
  di lunghezza/volume/texture/colore/intensita', e un tasto "Crea" la aggiunge subito al catalogo.
- **Anteprima di ogni stile** con tocco lungo (mobile) o passaggio del mouse (PC/emulatore):
  mostra un'anteprima ingrandita generata da un renderer procedurale interno — sempre disponibile,
  anche per gli stili appena creati, senza bisogno di immagini esterne. Ogni voce puo' anche
  ricevere un'anteprima **fotorealistica importata** (bottone dedicato): generarla in locale con
  ComfyUI o un altro strumento Stable Diffusion e importarla nell'app sostituisce la miniatura
  procedurale.
- **Editing IA di capelli/barba/trucco e prova virtuale di abbigliamento/scarpe** tramite
  l'abbonamento IA gia' esistente dell'utente (BYO: l'utente inserisce URL ed API key del proprio
  provider nelle Impostazioni). Se nessun abbonamento e' collegato, un'anteprima locale (composita
  2D, non fotorealistica) mantiene provabile l'intero flusso.
- **Guardaroba virtuale**: ogni capo/scarpa nasce da una foto reale caricata dall'utente; colore
  dominante estratto automaticamente.
- **Armocromia**: questionario di tre domande (nessuna foto obbligatoria), classificazione nelle
  quattro stagioni cromatiche classiche, palette consigliata e incrocio automatico con i colori
  del guardaroba.
- **Figura intera**: manichino "stile turntable" che si ruota trascinando il dito, con capelli,
  barba, trucco e colori dell'outfit applicati in tempo reale.
- **Studio Fotografico**: scelta di inquadratura (viso/mezzo busto/figura intera), angolazione,
  luci e sfondo, poi generazione dello scatto finale — dalla foto reale gia' modificata se
  presente, altrimenti dal manichino procedurale.
- **Sincronizzazione Google Drive** delle foto del guardaroba e degli scatti generati (richiede
  configurazione OAuth, vedi sotto).
- **Esportazione verso Meta AI/social**: condivide lo scatto finale con l'app Meta installata
  (Instagram/WhatsApp/Facebook) o con la Sharesheet generica di Android.

## Come aprire il progetto

1. Installa Android Studio e l'SDK Android 35.
2. Apri la cartella `StyleStudio3D`.
3. Attendi la sincronizzazione Gradle.
4. Avvia su un telefono o emulatore Android 8.0 (API 26) o successivo.

Su Windows puoi anche compilare dalla cartella del progetto con:

```bat
gradlew.bat assembleDebug
```

L'APK di debug verra' creato in `app\build\outputs\apk\debug\`.

## Configurazione necessaria prima dell'uso reale

- **Abbonamento IA**: nessuna chiave e' inclusa nel repository. L'utente inserisce dalle
  Impostazioni l'URL base e l'API key del proprio provider (per default si assume un formato
  "compatibile OpenAI": `POST {baseUrl}/images/edits`, multipart con campi `image`/`prompt`,
  risposta `{ "data": [ { "b64_json" | "url": ... } ] }`). Se il provider dell'utente usa un
  contratto diverso, va adattato `RemoteHairMakeupAiService`/`RemoteVirtualTryOnService`.
- **Google Drive**: richiede un progetto Google Cloud con OAuth configurato e lo SHA-1 della
  firma dell'app registrato, altrimenti l'autorizzazione fallisce con un errore di
  configurazione (non un bug del codice). Il token resta solo in memoria per la sessione: ad
  ogni riavvio dell'app va rifatto l'accesso.
- **Meta AI**: non esiste un'API pubblica gratuita di terze parti per inviare un'immagine e
  ricevere indietro un video animato via IA. L'app prepara il file e apre l'app Meta installata
  (o la Sharesheet), dopodiche' l'animazione va avviata manualmente dall'utente dentro l'app Meta.

## Limiti consapevoli del prototipo

- La "Figura intera" e lo Studio Fotografico usano un **manichino procedurale disegnato a
  runtime** (silhouette + colori + luci + sfondo), non un motore 3D poligonale con asset e
  materiali: e' una scelta deliberata per non dipendere da asset 3D con licenza ne' da una
  pipeline di rendering pesante, restando comunque coerente con capelli/barba/trucco/outfit
  scelti e con le impostazioni di Studio Fotografico. Vedi `PRODUCT_SPEC.md`.
- L'anteprima locale di editing capelli/barba/trucco e di prova virtuale e' un composito 2D
  (colorazione di zone approssimative / sovrapposizione dell'immagine del capo), non un editing
  fotorealistico: quello richiede il vero abbonamento IA esterno.
- Il caricamento foto usa solo il Photo Picker di sistema (nessuna cattura diretta da fotocamera
  in questo prototipo, per restare con permessi minimi).
- Nessuna build/test e' stata eseguita in locale in questa sessione (ambiente senza Android SDK
  disponibile): la verifica avviene tramite la GitHub Action inclusa
  (`.github/workflows/build_stylestudio3d_apk.yml`), sullo stesso schema di FaceGuard/FortKnoxVault.

## Prima della pubblicazione

- Test strumentali su dispositivo reale (nessuna verifica UI e' stata possibile in questa sessione).
- Audit del contratto HTTP verso provider IA reali diversi da quello assunto di default.
- Configurazione OAuth Google Cloud + test end-to-end della sincronizzazione Drive.
- Persistenza del token Drive tra riavvii (oggi richiede un nuovo accesso ad ogni apertura app).
- Eventuale libreria di rendering 3D reale (es. Filament/SceneView con asset glTF con licenza)
  se si vuole sostituire il manichino procedurale con un vero avatar poligonale.
- Localizzazione: tutte le stringhe sono oggi in italiano, scritte direttamente nel codice Compose.
- Privacy policy e Data Safety del Play Store (foto utente, dati del guardaroba, sincronizzazione Drive).
