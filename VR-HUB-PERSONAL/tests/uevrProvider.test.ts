import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { UevrProvider, DEFAULT_UEVR_CONFIG_RELATIVE_PATH } from '../src/main/core/providers/uevrProvider';
import { ProviderRegistry } from '../src/main/core/providers/providerRegistry';
import { createDefaultProfile } from '../src/main/core/model/gameProfile';
import { GameProfile, LibraryGame } from '../src/main/core/model/types';

function makeGame(installPath: string): LibraryGame {
  return {
    id: 'hogwarts_legacy',
    title: 'Hogwarts Legacy',
    platform: 'manual',
    installPath,
    exePath: path.join(installPath, 'Engine', 'Binaries', 'Win64', 'HogwartsLegacy-Win64-Shipping.exe'),
    engine: { engine: 'UnrealEngine4', confidence: 'probable', signals: [] },
    vrReadiness: 'configuration_required',
    profileId: 'hogwarts_legacy',
    addedAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    userConfirmed: true
  };
}

function makeProfile(): GameProfile {
  return {
    ...createDefaultProfile('hogwarts_legacy', 'Hogwarts Legacy', 'UnrealEngine4'),
    engineConfidence: 'probable',
    provider: 'uevr',
    runtime: 'openxr'
  };
}

describe('UevrProvider (spec §12/§56/§70)', () => {
  let tmpDir: string;
  let gameDir: string;
  let provider: UevrProvider;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrhub-uevr-'));
    gameDir = path.join(tmpDir, 'HogwartsLegacy');
    fs.mkdirSync(gameDir, { recursive: true });
    provider = new UevrProvider({
      backupDir: path.join(tmpDir, 'backups'),
      manifestsDir: path.join(tmpDir, 'manifests')
    });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detect/checkCompatibility riconosce Unreal Engine e rifiuta altri motori', () => {
    const game = makeGame(gameDir);
    const ueProfile = makeProfile();
    expect(provider.detect(game, ueProfile)).toBe(true);
    expect(provider.checkCompatibility(game, ueProfile).compatible).toBe(true);

    const nonUeProfile: GameProfile = { ...ueProfile, engine: 'idTech' };
    expect(provider.detect(game, nonUeProfile)).toBe(false);
    expect(provider.checkCompatibility(game, nonUeProfile).compatible).toBe(false);
  });

  it('planInstall (dry-run / "Simula installazione", spec §70) non scrive nulla su disco', () => {
    const game = makeGame(gameDir);
    const profile = makeProfile();
    const plan = provider.planInstall(game, profile);

    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.manualStepsRequired.length).toBeGreaterThan(0);
    const configPath = path.join(gameDir, DEFAULT_UEVR_CONFIG_RELATIVE_PATH);
    expect(fs.existsSync(configPath)).toBe(false); // nessuna scrittura reale
  });

  it('install scrive il config UEVR, crea un manifest, e validate lo confirma valido', async () => {
    const game = makeGame(gameDir);
    const profile = makeProfile();

    const manifest = await provider.install(game, profile);
    const configPath = path.join(gameDir, DEFAULT_UEVR_CONFIG_RELATIVE_PATH);

    expect(fs.existsSync(configPath)).toBe(true);
    const written = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    expect(written.graphics.motion_blur).toBe(false); // spec §14: Motion Blur OFF di default
    expect(written.graphics.frame_generation).toBe(false);
    expect(manifest.entries).toHaveLength(1);
    expect(manifest.entries[0].type).toBe('added'); // non esisteva prima

    const validation = provider.validate(game, profile);
    expect(validation.valid).toBe(true);
    expect(validation.problems).toEqual([]);
  });

  it('una seconda install fa il backup della precedente (entry "modified")', async () => {
    const game = makeGame(gameDir);
    const profile = makeProfile();

    await provider.install(game, profile);
    const secondManifest = await provider.install(game, profile);

    expect(secondManifest.entries[0].type).toBe('modified');
    expect(secondManifest.entries[0].backupPath).not.toBeNull();
    expect(fs.existsSync(secondManifest.entries[0].backupPath!)).toBe(true);
  });

  it('uninstall ripristina lo stato precedente ("RIMUOVI MOD VR", spec §37)', async () => {
    const game = makeGame(gameDir);
    const profile = makeProfile();
    const configPath = path.join(gameDir, DEFAULT_UEVR_CONFIG_RELATIVE_PATH);

    // il gioco aveva già un config.json prima della nostra installazione
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify({ original: true }), 'utf8');

    const manifest = await provider.install(game, profile);
    expect(manifest.entries[0].type).toBe('modified');

    await provider.uninstall(game, manifest);

    const restored = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    expect(restored).toEqual({ original: true });
  });

  it('validate segnala il problema se il config manca', () => {
    const game = makeGame(gameDir);
    const profile = makeProfile();
    const validation = provider.validate(game, profile);
    expect(validation.valid).toBe(false);
    expect(validation.problems.some((p) => p.includes('non trovato'))).toBe(true);
  });
});

describe('ProviderRegistry', () => {
  it('findApplicable seleziona il provider giusto in base al motore del profilo', () => {
    const registry = new ProviderRegistry();
    const provider = new UevrProvider({ backupDir: '/tmp/x', manifestsDir: '/tmp/y' });
    registry.register(provider);

    const game = makeGame('/tmp/game');
    const ueProfile = makeProfile();
    expect(registry.findApplicable(game, ueProfile)?.id).toBe('uevr');

    const nonUeProfile: GameProfile = { ...ueProfile, engine: 'Unity' };
    expect(registry.findApplicable(game, nonUeProfile)).toBeNull();
  });
});
