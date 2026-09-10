import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createAppServices } from '../src/main/core/appServices';
import { LibraryService } from '../src/main/core/library/libraryService';

const repoRoot = path.join(__dirname, '..');

function touch(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, 'x');
}

describe('LibraryService (integrazione: aggiungi Non-Steam -> configura VR -> avvia -> ripristina)', () => {
  let userDataDir: string;
  let gamesRoot: string;

  beforeEach(() => {
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrhub-userdata-'));
    gamesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vrhub-games-'));
  });

  afterEach(() => {
    fs.rmSync(userDataDir, { recursive: true, force: true });
    fs.rmSync(gamesRoot, { recursive: true, force: true });
  });

  it('flusso completo con un gioco Unreal Engine sconosciuto al catalogo', async () => {
    const services = createAppServices(userDataDir, repoRoot);
    const library = new LibraryService(services);

    // Prepara una finta cartella di gioco Unreal Engine (Non-Steam).
    const gameDir = path.join(gamesRoot, 'MyIndieGame');
    touch(path.join(gameDir, 'MyIndieGame.uproject'));
    touch(path.join(gameDir, 'Engine', 'Binaries', 'Win64', 'MyIndieGame-Win64-Shipping.exe'));

    const game = library.addNonSteamGame(gameDir);
    expect(game.engine.engine).toBe('UnrealEngine5');
    expect(game.exePath).toContain('MyIndieGame-Win64-Shipping.exe');

    // Il gioco non è nel catalogo: gli viene creato un profilo di default con provider nullo.
    let profile = library.resolveProfile(game.id);
    expect(profile).not.toBeNull();
    expect(profile!.provider).toBeNull();

    // L'utente assegna manualmente il provider UEVR e conferma il motore (spec §106, pannello avanzato).
    services.database.saveOverride(game.id, { provider: 'uevr', runtime: 'openxr', engineConfidence: 'confirmed' });
    profile = library.resolveProfile(game.id);
    expect(profile!.provider).toBe('uevr');

    // Ora aggiorniamo anche il profilo "catalogo" salvato per riflettere l'engine/engineConfidence
    // (in Fase 1 il merge unisce override sopra profilo di base; qui verifichiamo che il piano si costruisca).
    const plan = library.planInstall(game.id);
    expect(plan).not.toBeNull();
    expect(plan!.steps.length).toBeGreaterThan(0);

    const result = await library.configureVr(game.id);
    expect(result.ok).toBe(true);

    const validation = library.validate(game.id);
    expect(validation?.valid).toBe(true);

    const launchPlan = library.buildLaunchPlanFor(game.id);
    expect(launchPlan?.game.exePath).toContain('MyIndieGame-Win64-Shipping.exe');

    const restoreResult = await library.restoreGame(game.id);
    expect(restoreResult.ok).toBe(true);
  });

  it('removeGame rimuove dalla libreria senza toccare la cartella del gioco su disco (spec §66)', () => {
    const services = createAppServices(userDataDir, repoRoot);
    const library = new LibraryService(services);

    const gameDir = path.join(gamesRoot, 'SomeGame');
    touch(path.join(gameDir, 'SomeGame.exe'));
    const game = library.addNonSteamGame(gameDir);

    library.removeGame(game.id);

    expect(services.database.getGame(game.id)).toBeNull();
    expect(fs.existsSync(gameDir)).toBe(true); // il gioco resta installato
  });

  it('un gioco che corrisponde al catalogo (DOOM) riceve subito un profilo con provider "native"', () => {
    const services = createAppServices(userDataDir, repoRoot);
    const library = new LibraryService(services);

    const gameDir = path.join(gamesRoot, 'DOOM');
    touch(path.join(gameDir, 'DOOMx64vk.exe'));
    const game = library.addNonSteamGame(gameDir);

    const profile = library.resolveProfile(game.id);
    expect(profile).not.toBeNull();
    expect(profile!.title).toBe('DOOM');
    expect(profile!.provider).toBe('native');
  });
});
