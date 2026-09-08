# Runware Studio

App Android nativa (Kotlin + Jetpack Compose) per generare immagini con l'API di
[Runware](https://runware.ai) scrivendo la descrizione in italiano.

## Cosa fa

- **Prompt in italiano → inglese**: scrivi la descrizione in italiano, l'app la traduce in
  inglese on-device (ML Kit, nessun servizio esterno) prima di inviarla a Runware, che lavora
  in inglese. La traduzione tradotta resta visibile e modificabile prima di generare.
- **Modelli pronti all'uso**: un catalogo curato di modelli Runware (generali, fotorealistici,
  anime, e una categoria "18+" per contenuti adulti) con parametri consigliati (steps, CFG
  scale, risoluzione, scheduler) che si compilano da soli alla selezione — sempre modificabili
  a mano in "Parametri avanzati".
- **Foto di riferimento del personaggio**: importa fino a 4 foto per mantenere lo stesso
  volto/aspetto tra più generazioni (img2img classico, o coerenza ACE++ per i modelli che la
  supportano).
- **Filtro contenuti**: dietro un gate esplicito 18+/consenso al primo avvio e una conferma
  dedicata nelle Impostazioni, è possibile disattivare il filtro NSFW di Runware per contenuti
  espliciti tra **adulti consenzienti** — mai minori, in nessuna forma.
- **Archivio locale**: ogni generazione completata (prompt IT/EN, modello, parametri, foto di
  riferimento e risultati) viene salvata sul dispositivo, consultabile e riutilizzabile
  ("Riusa questi parametri") anche offline.
- **Esporta e salva**: ogni immagine puoi salvarla nella Galleria di sistema, esportarla con il
  file manager/le app di destinazione che preferisci (picker di sistema ACTION_CREATE_DOCUMENT),
  o condividerla con altre app.

## Come iniziare

1. Crea un account gratuito su [my.runware.ai](https://my.runware.ai) e genera una API key.
2. Apri l'app, accetta il gate 18+/consenso, poi vai in **Impostazioni** e incolla la API key
   (resta cifrata sul dispositivo, non viene mai condivisa altrove).
3. Torna in **Genera**, scrivi il prompt in italiano, scegli un modello e premi **Genera**.

## Architettura

- `data/api` — client REST per `POST https://api.runware.ai/v1` (protocollo array-di-task in
  JSON), via OkHttp + kotlinx.serialization, nessun SDK esterno.
- `data/translate` — traduzione IT→EN on-device con ML Kit.
- `data/archive` — download/copia delle immagini su storage privato dell'app + Room per i
  metadati di ogni lavoro salvato.
- `data/export` — salvataggio in Galleria (MediaStore) ed esportazione via file manager (SAF).
- `data/settings` — preferenze (DataStore) e API key cifrata (EncryptedSharedPreferences).
- `ui` — Jetpack Compose + Navigation, tre ViewModel (Genera, Archivio, Impostazioni) creati una
  volta in `MainActivity` così lo stato non si perde cambiando scheda.

## Build

```
./gradlew assembleDebug
```

Richiede accesso di rete al repository Maven di Google (`dl.google.com`) per il Android Gradle
Plugin e le librerie AndroX/Compose — non verificabile in ambienti con questo host bloccato
dalla policy di rete (build non eseguita in questa sessione per questo motivo; il codice è
stato revisionato manualmente).
