import { GameProfile, LaunchPlan, LibraryGame } from '../model/types';

/**
 * Costruisce il "piano di lancio" (spec §93) a partire dal profilo del gioco.
 * Funzione pura, senza side-effect: serve per debug/test e viene mostrata
 * all'utente prima di "Avvia in VR" tramite `AVVIA IN VR`.
 */
export function buildLaunchPlan(game: LibraryGame, profile: GameProfile): LaunchPlan {
  const launch = profile.launch;
  const exePath = launch?.exePath ?? game.exePath;

  if (!exePath) {
    throw new Error(
      `Impossibile costruire il piano di lancio per "${game.title}": nessun eseguibile configurato (profilo.launch.exePath o game.exePath).`
    );
  }

  return {
    gameId: game.id,
    prelaunch: launch?.preLaunch ?? [],
    game: {
      exePath,
      workingDirectory: launch?.workingDirectory ?? dirnameOf(exePath),
      args: launch?.args ?? [],
      env: launch?.env ?? {}
    },
    injector: launch?.injector
      ? {
          providerId: launch.injector.providerId,
          delayMs: launch.injector.delayMs ?? 5000,
          processTargetName: launch.injector.processTargetName ?? null
        }
      : null,
    postlaunch: launch?.postLaunch ?? [],
    monitorProcess: true
  };
}

function dirnameOf(filePath: string): string {
  const idx = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return idx >= 0 ? filePath.slice(0, idx) : '.';
}
