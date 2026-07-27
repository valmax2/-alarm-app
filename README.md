# Orologio Radio (Bedside Clock)

Orologio da comodino in Flutter con radio internet, sveglia, temi giorno/notte
e protezione anti burn-in per il display.

## Funzionalità

- **Quadrante in 3 stili**: Android (testo), Pallini (dot-matrix), Linee (7 segmenti)
- **Personalizzazione testo**: carattere, dimensione, grassetto, colore d'accento
- **Formato orario**: 12/24 ore, secondi opzionali, data opzionale
- **Temi**: giorno / notte / automatico in base all'ora
- **Protezione anti burn-in**: il quadrante si sposta leggermente a intervalli regolari
- **Radio internet**: stazioni preimpostate + possibilità di aggiungere un URL stream personalizzato
- **Sveglia**: orario, ripetizione per giorno della settimana, rinvio (snooze), suoneria radio opzionale

> La sveglia suona in modo affidabile finché l'app resta aperta in primo piano
> (uso previsto: telefono dedicato come orologio da comodino, sempre acceso).
> Per farla suonare anche ad app chiusa/telefono bloccato serve un plugin di
> scheduling nativo aggiuntivo (non incluso in questa prima versione).

## Sviluppo

```
flutter pub get
flutter run
```

## Build APK

Il workflow GitHub Actions in `.github/workflows/build_apk.yml` compila un APK
release ad ogni push su `main`/`master`, oppure manualmente da Actions
("Run workflow").
