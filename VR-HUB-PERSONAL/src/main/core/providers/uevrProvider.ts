import * as fs from 'fs';
import * as path from 'path';
import { GameProfile, InstallManifest, LibraryGame } from '../model/types';
import { backupFileIfExists } from '../backup/backupManager';
import { createManifest, loadManifest, restoreManifest, deleteManifest, withEntry, saveManifest } from '../manifest/installManifest';
import { buildLaunchPlan } from '../launch/launchPlanner';
import { sha256Of } from '../security/hash';
import { CompatibilityCheck, InstallPlan, LogBundle, ValidationResult, VRProvider } from './provider';

/** Percorso relativo di default del config UEVR (spec §12), sovrascrivibile per-profilo. */
export const DEFAULT_UEVR_CONFIG_RELATIVE_PATH = path.join('Engine', 'Binaries', 'Win64', 'uevr', 'config.json');

export interface UevrProviderConfig {
  backupDir: string;
  manifestsDir: string;
}

/**
 * Provider UEVR/Praydog (spec §12/§13): target principale per i giochi Unreal
 * Engine 4/5, runtime OpenXR. Non redistribuisce UEVR: lo orchestra (l'utente
 * deve avere UEVR installato sul proprio PC; qui prepariamo solo il profilo
 * config.json e il piano di lancio/iniezione).
 */
export class UevrProvider implements VRProvider {
  readonly id = 'uevr' as const;

  constructor(private readonly config: UevrProviderConfig) {}

  detect(_game: LibraryGame, profile: GameProfile): boolean {
    return profile.engine === 'UnrealEngine4' || profile.engine === 'UnrealEngine5';
  }

  checkCompatibility(game: LibraryGame, profile: GameProfile): CompatibilityCheck {
    if (!this.detect(game, profile)) {
      return { compatible: false, reason: `Motore "${profile.engine}" non è Unreal Engine: UEVR non è applicabile.` };
    }
    if (profile.engineConfidence === 'unknown') {
      return { compatible: false, reason: 'Motore non identificato con sufficiente certezza per procedere in automatico.' };
    }
    return { compatible: true, reason: `Motore ${profile.engine} rilevato (${profile.engineConfidence}), UEVR è applicabile.` };
  }

  private resolveConfigPath(game: LibraryGame, _profile: GameProfile): string {
    // Fase 1: un solo percorso di default (spec §12). Un profilo futuro potrà
    // sovrascriverlo con un percorso dedicato senza cambiare questa interfaccia.
    return path.join(game.installPath, DEFAULT_UEVR_CONFIG_RELATIVE_PATH);
  }

  planInstall(game: LibraryGame, profile: GameProfile): InstallPlan {
    const configPath = this.resolveConfigPath(game, profile);
    const configExists = fs.existsSync(configPath);

    return {
      steps: [
        ...(configExists
          ? [
              {
                kind: 'backup' as const,
                description: `Backup del config UEVR esistente prima di sovrascriverlo`,
                targetPath: configPath
              }
            ]
          : []),
        {
          kind: 'write_config' as const,
          description: `Scrittura profilo UEVR (Motion Blur OFF, Frame Generation OFF, TAA=${profile.recommendedSettings.taa}) in ${configPath}`,
          targetPath: configPath
        }
      ],
      manualStepsRequired: [
        'Verificare che UEVR sia installato e aggiornato sul PC (non viene scaricato automaticamente in questa versione).',
        'Collegare/avviare Quest Link, Air Link o Virtual Desktop prima di premere "Avvia in VR".'
      ],
      totalDownloadSizeBytes: 0
    };
  }

  async install(game: LibraryGame, profile: GameProfile): Promise<InstallManifest> {
    const configPath = this.resolveConfigPath(game, profile);
    const content = buildUevrConfigContent(profile);
    const serialized = JSON.stringify(content, null, 2);

    const backupPath = backupFileIfExists(configPath, this.config.backupDir, game.id);
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, serialized, 'utf8');

    let manifest = createManifest(game.id, 'uevr', profile.profileVersion, profile.sources[0] ?? null);
    manifest = withEntry(manifest, {
      type: backupPath ? 'modified' : 'added',
      targetPath: configPath,
      backupPath,
      sha256: sha256Of(serialized)
    });

    saveManifest(this.config.manifestsDir, manifest);
    return manifest;
  }

  async update(game: LibraryGame, profile: GameProfile, _previousManifest: InstallManifest): Promise<InstallManifest> {
    // In questa fase l'update è equivalente a una nuova installazione (che backuppa
    // sempre il config precedente prima di sovrascriverlo).
    return this.install(game, profile);
  }

  async uninstall(_game: LibraryGame, manifest: InstallManifest): Promise<void> {
    restoreManifest(manifest);
    deleteManifest(this.config.manifestsDir, manifest.gameId);
  }

  validate(game: LibraryGame, profile: GameProfile): ValidationResult {
    const problems: string[] = [];
    const configPath = this.resolveConfigPath(game, profile);

    if (!fs.existsSync(configPath)) {
      problems.push(`Config UEVR non trovato in ${configPath}`);
    } else {
      try {
        JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } catch {
        problems.push(`Config UEVR presente ma non è JSON valido: ${configPath}`);
      }
    }

    const manifest = loadManifest(this.config.manifestsDir, game.id);
    if (!manifest) {
      problems.push('Nessun manifest di installazione trovato per questo gioco.');
    }

    return { valid: problems.length === 0, problems };
  }

  buildLaunchPlan(game: LibraryGame, profile: GameProfile) {
    return buildLaunchPlan(game, profile);
  }

  collectLogs(game: LibraryGame): LogBundle {
    const candidates = [
      path.join(game.installPath, 'Saved', 'Crashes'),
      path.join(game.installPath, 'Saved', 'Logs'),
      path.join(game.installPath, 'Engine', 'Binaries', 'Win64', 'uevr', 'logs')
    ];
    return {
      gameId: game.id,
      entries: candidates.map((p) => ({ source: 'uevr', path: p, exists: fs.existsSync(p) }))
    };
  }
}

function buildUevrConfigContent(profile: GameProfile): Record<string, unknown> {
  return {
    generatedBy: 'VR HUB PERSONAL',
    profileVersion: profile.profileVersion,
    runtime: profile.runtime ?? 'openxr',
    graphics: {
      motion_blur: profile.recommendedSettings.motionBlur === 'on',
      frame_generation: profile.recommendedSettings.dlssFrameGeneration === 'on',
      taa: profile.recommendedSettings.taa
    },
    controllers: profile.controllers
  };
}
