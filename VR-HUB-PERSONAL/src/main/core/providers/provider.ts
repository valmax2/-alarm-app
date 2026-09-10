import { GameProfile, InstallManifest, LaunchPlan, LibraryGame, ProviderId } from '../model/types';

export interface CompatibilityCheck {
  compatible: boolean;
  reason: string;
}

export type InstallStepKind = 'download' | 'backup' | 'write_config' | 'copy' | 'manual' | 'other';

export interface InstallPlanStep {
  kind: InstallStepKind;
  description: string;
  targetPath?: string;
  approximateSizeBytes?: number;
}

/** Piano "cosa farà" (spec §56) e base della modalità DRY RUN / "Simula installazione" (spec §70). */
export interface InstallPlan {
  steps: InstallPlanStep[];
  manualStepsRequired: string[];
  totalDownloadSizeBytes: number;
}

export interface ValidationResult {
  valid: boolean;
  problems: string[];
}

export interface LogBundle {
  gameId: string;
  entries: { source: string; path: string; exists: boolean }[];
}

/**
 * Interfaccia comune a ogni "soluzione VR" (spec §11/§92). Ogni metodo VR
 * (UEVR, REFramework, mod native, port Quest, SourceVR, ...) implementa questa
 * interfaccia come un file separato in `providers/`, senza toccare UI o database.
 */
export interface VRProvider {
  readonly id: ProviderId;

  /** Il provider è potenzialmente applicabile a questo gioco/motore? */
  detect(game: LibraryGame, profile: GameProfile): boolean;

  checkCompatibility(game: LibraryGame, profile: GameProfile): CompatibilityCheck;

  /** Non modifica nulla: descrive cosa farebbe "Configura VR" (usato anche da "Simula installazione"). */
  planInstall(game: LibraryGame, profile: GameProfile): InstallPlan;

  install(game: LibraryGame, profile: GameProfile): Promise<InstallManifest>;

  update(game: LibraryGame, profile: GameProfile, previousManifest: InstallManifest): Promise<InstallManifest>;

  uninstall(game: LibraryGame, manifest: InstallManifest): Promise<void>;

  validate(game: LibraryGame, profile: GameProfile): ValidationResult;

  buildLaunchPlan(game: LibraryGame, profile: GameProfile): LaunchPlan;

  collectLogs(game: LibraryGame): LogBundle;
}
