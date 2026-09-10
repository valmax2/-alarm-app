import { describe, it, expect } from 'vitest';
import { buildLaunchPlan } from '../src/main/core/launch/launchPlanner';
import { GameProfile, LibraryGame } from '../src/main/core/model/types';
import { createDefaultProfile } from '../src/main/core/model/gameProfile';

function makeGame(overrides: Partial<LibraryGame> = {}): LibraryGame {
  return {
    id: 'doom',
    title: 'DOOM',
    platform: 'manual',
    installPath: 'C:/Games/DOOM',
    exePath: 'C:/Games/DOOM/DOOMx64vk.exe',
    engine: { engine: 'idTech', confidence: 'probable', signals: [] },
    vrReadiness: 'ready',
    profileId: 'doom',
    addedAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    userConfirmed: true,
    ...overrides
  };
}

describe('buildLaunchPlan (spec §93)', () => {
  it('usa game.exePath quando il profilo non ha una configurazione di lancio propria', () => {
    const game = makeGame();
    const profile = createDefaultProfile('doom', 'DOOM');
    const plan = buildLaunchPlan(game, profile);

    expect(plan.game.exePath).toBe(game.exePath);
    expect(plan.injector).toBeNull();
    expect(plan.monitorProcess).toBe(true);
    expect(plan.prelaunch).toEqual([]);
    expect(plan.postlaunch).toEqual([]);
  });

  it('lancia un errore chiaro se manca sia profile.launch che game.exePath', () => {
    const game = makeGame({ exePath: null });
    const profile = createDefaultProfile('doom', 'DOOM');
    expect(() => buildLaunchPlan(game, profile)).toThrow(/nessun eseguibile configurato/);
  });

  it('costruisce il piano di iniezione UEVR con delay e processo target dal profilo', () => {
    const game = makeGame();
    const profile: GameProfile = {
      ...createDefaultProfile('hogwarts', 'Hogwarts Legacy'),
      provider: 'uevr',
      runtime: 'openxr',
      launch: {
        exePath: 'C:/Games/Hogwarts/Engine/Binaries/Win64/HogwartsLegacy-Win64-Shipping.exe',
        workingDirectory: 'C:/Games/Hogwarts',
        args: ['-vr'],
        env: { UEVR_CONFIG: 'hogwarts.json' },
        injector: { providerId: 'uevr', delayMs: 8000, processTargetName: 'HogwartsLegacy-Win64-Shipping.exe' }
      }
    };

    const plan = buildLaunchPlan(game, profile);
    expect(plan.game.exePath).toContain('HogwartsLegacy-Win64-Shipping.exe');
    expect(plan.game.args).toEqual(['-vr']);
    expect(plan.injector).toEqual({
      providerId: 'uevr',
      delayMs: 8000,
      processTargetName: 'HogwartsLegacy-Win64-Shipping.exe'
    });
  });

  it('applica un delay di default (5000ms) se l\'injector non specifica delayMs', () => {
    const game = makeGame();
    const profile: GameProfile = {
      ...createDefaultProfile('doom', 'DOOM'),
      launch: {
        exePath: game.exePath!,
        injector: { providerId: 'uevr' }
      }
    };
    const plan = buildLaunchPlan(game, profile);
    expect(plan.injector?.delayMs).toBe(5000);
  });
});
