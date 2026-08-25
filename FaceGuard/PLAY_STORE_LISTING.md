# Bozza scheda Google Play — FaceGuard

Testi pronti da incollare in Play Console. Rivedili con le tue parole prima di pubblicare —
sono un punto di partenza, non testo definitivo.

## Titolo (max 30 caratteri)
```
FaceGuard
```

## Descrizione breve (max 80 caratteri)
```
Copre lo schermo quando non riconosce più il tuo volto davanti alla fotocamera.
```

## Descrizione completa (max 4000 caratteri)
```
FaceGuard tiene d'occhio la fotocamera frontale e copre lo schermo del telefono
non appena il tuo volto non viene più riconosciuto — perfetto per proteggere lo
schermo quando ti allontani, o per evitare che qualcun altro veda cosa c'è sopra.

COME FUNZIONA
Registri il tuo volto una volta sola (con conferma tramite l'impronta o il
Face Unlock del telefono, per essere sicuri che sia davvero tu). Da quel
momento, FaceGuard confronta in tempo reale ciò che vede la fotocamera con il
tuo profilo: se non ti riconosce più per il tempo che hai scelto — anche
solo un secondo — copre lo schermo.

TRE MODALITÀ DI COPERTURA
• Schermo nero — oscura completamente il display (gratis)
• Immagine personalizzata — mostra una foto a tua scelta (FaceGuard Pro)
• Blocco schermo — blocca subito il telefono con lo sblocco di sicurezza di
  sistema (FaceGuard Pro)

PENSATA PER LA PRIVACY
• Tutta l'elaborazione avviene sul dispositivo: nessuna immagine, volto o
  impronta lascia mai il telefono.
• Il profilo del volto è cifrato con AES-256 nell'Android Keystore.
• Nessuna pubblicità, nessun tracciamento.

TEMA CHIARO E SCURO
Interfaccia Material 3 con tema chiaro, scuro o automatico in base al sistema.

FaceGuard Pro è uno sblocco unico, senza abbonamento.
```

## Categoria
Strumenti (Tools) — alternativa: Produttività

## Tag / parole chiave suggerite
privacy schermo, blocco automatico, rilevamento volto, sicurezza telefono

## Icona e grafica
- Icona già pronta nel repo (`app/src/main/res/mipmap-*`), 512×512 da esportare separatamente
  per lo store (Play Console la ridimensiona da un PNG ad alta risoluzione).
- Serve una **feature graphic** 1024×500 (banner in alto nella scheda) — non generata qui.
- Servono **almeno 2 screenshot** reali del telefono (consigliati: schermata Monitor, schermata
  Impostazioni, schermata di registrazione volto) — vanno presi da un dispositivo reale o
  emulatore avviando l'app.

## Classificazione contenuti
Da compilare nel questionario di Play Console — FaceGuard non ha contenuti per adulti,
violenza, ecc. La fotocamera è l'unico dato sensibile trattato (vedi Privacy Policy).

## Privacy Policy
URL da inserire in Play Console: quello di `docs/privacy-policy.html` una volta pubblicato
tramite GitHub Pages (vedi istruzioni nel messaggio di Claude).

## Dichiarazione permessi sensibili
Play Console chiederà di giustificare alcuni permessi nel modulo "App content":
- **Fotocamera**: funzione principale dell'app (rilevamento volto).
- **Accesso in background alla fotocamera**: necessario per il monitoraggio continuo anche
  quando l'app non è in primo piano — è l'intera ragione d'essere dell'app, va dichiarato
  esplicitamente e con chiarezza nel modulo.
- **Disegna sopra le altre app**: necessario per mostrare la copertura sopra qualsiasi app.
- **Amministratore dispositivo**: opzionale, solo per la modalità "Blocco schermo".
