# KNOWN_ISSUES.md

## Limiti noti della Fase 1

1. **Provider "native" non installa nulla automaticamente.** Il catalogo seed
   segna BioShock 2, Quake, Quake II e DOOM come `provider: "native"`, ma non
   esiste ancora un `NativeModProvider` reale: ogni mod nativa è diversa e va
   integrata singolarmente. Oggi l'app riconosce il gioco e mostra il profilo,
   ma "Configura VR" per questi titoli non troverà un provider applicabile
   finché non verrà scritto un provider dedicato (Fase 2+).
2. **Nessun download reale.** `InstallPlan`/`planInstall()` e `install()` di
   `UevrProvider` scrivono solo un `config.json` locale con le impostazioni
   consigliate: non scaricano l'iniettore UEVR né mod da internet. L'utente
   deve avere UEVR già installato sul proprio PC. Il download da fonti
   ufficiali (spec §18/§19) è previsto ma non implementato in questa fase.
3. **Cover remote non implementate.** `coverPath` resta `null` finché non si
   implementa il recupero da Steam/SteamGridDB (spec §25, Fase 2).
4. **Quest/ADB non implementati.** Tutta la sezione Fase 3 della specifica
   (rilevamento Quest via USB, installazione APK, copia file) non è presente:
   l'app oggi gestisce solo PCVR.
5. **Iniezione UEVR non testata su un gioco reale.** Il piano di lancio
   (`launchPlanner`/`launcher`) è testato con un runner di processi finto (spec
   §94/§22): l'esecuzione reale con un gioco e UEVR installati va verificata
   dall'utente su Windows. Se qualcosa non funziona, il modo più utile per
   segnalarlo è: titolo del gioco, contenuto di `userData/logs/vrhub.log`, e se
   possibile il config.json generato in `Engine/Binaries/Win64/uevr/config.json`.
6. **Filtri "PCVR"/"Quest" nella sidebar sono placeholder.** Al momento questi
   due filtri non escludono nulla (richiedono di leggere `vrModes` dal profilo
   risolto per ogni card, non solo dai dati già in `LibraryGame`): comportamento
   da rifinire in Fase 2/4 (Polish UI).
7. **Nessun watcher di aggiornamento automatico del database remoto.**
   `settings.autoUpdateDatabase`/`autoUpdateMods` esistono nelle Impostazioni
   ma non fanno ancora nulla: non c'è ancora un manifest remoto reale da
   interrogare (spec §17/§44).
8. **L'installer Windows non viene pubblicato in `docs/downloads/`** come le
   APK Android di questo stesso repository: un installer NSIS/Electron pesa
   tipicamente 80-150MB contro i ~15-20MB di una APK, e committarlo ad ogni
   push farebbe crescere rapidamente le dimensioni della cronologia Git. Viene
   invece pubblicato come artifact della build GitHub Actions (scaricabile
   autenticandosi su GitHub). Se si vuole un link di download pubblico e fisso,
   la strada più adatta è una GitHub Release con l'installer come asset.
9. **Nessuna build reale è ancora stata eseguita su Windows.** Il codice compila
   (TypeScript, 0 errori) e tutti i test core passano in sandbox Linux, ma la
   prima build reale dell'installer Windows avviene sul primo run della pipeline
   CI dopo il push: va controllato che sia verde.
