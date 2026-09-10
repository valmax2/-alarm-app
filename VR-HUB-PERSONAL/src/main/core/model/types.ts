/**
 * Tipi condivisi da tutto il core di VR HUB PERSONAL.
 * Nessuna dipendenza da Electron qui: questo file (e i moduli che lo usano)
 * deve poter essere importato ed eseguito anche in ambiente Node "nudo" (test).
 */

export type Platform = 'steam' | 'manual';

export type VrMode = 'pcvr' | 'quest_standalone';

export type EngineName =
  | 'UnrealEngine4'
  | 'UnrealEngine5'
  | 'Unity'
  | 'Source'
  | 'Source2'
  | 'idTech'
  | 'REEngine'
  | 'CryEngine'
  | 'Unknown';

export type DetectionConfidence = 'confirmed' | 'probable' | 'unknown';

export type ProviderId = 'uevr' | 'reframework' | 'native' | 'sourcevr' | 'quest_port';

export type RuntimeId = 'openxr' | 'openvr' | 'quest_link' | 'air_link' | 'virtual_desktop';

export type ControllerSupport = 'native' | 'good' | 'partial' | 'experimental' | 'unavailable';

export type VrCompatibilityLevel =
  | 'perfect'
  | 'good'
  | 'playable'
  | 'experimental'
  | 'known_issues'
  | 'not_working'
  | 'unknown';

export type VrReadiness =
  | 'ready'
  | 'configuration_required'
  | 'update_available'
  | 'not_found'
  | 'not_compatible';

export interface EngineDetectionResult {
  engine: EngineName;
  confidence: DetectionConfidence;
  signals: string[];
}

export interface ExeCandidate {
  /** percorso assoluto del file .exe */
  path: string;
  /** nome file, senza percorso */
  fileName: string;
  /** punteggio di probabilità che sia l'eseguibile principale del gioco (più alto = più probabile) */
  score: number;
  /** motivi che hanno contribuito al punteggio (per trasparenza in UI/log) */
  reasons: string[];
}

export interface ControllerProfile {
  gamepad: ControllerSupport;
  keyboardMouse: ControllerSupport;
  questTouch: ControllerSupport;
  motionController: ControllerSupport;
  limitations?: string[];
}

export interface RecommendedSettings {
  motionBlur: 'off' | 'on';
  dlssFrameGeneration: 'off' | 'on';
  taa: 'off' | 'on' | 'required';
  preset?: string;
  resolution?: string;
  upscaling?: string;
  targetFrameRate?: number;
  notes?: string[];
}

export interface LaunchConfig {
  exePath: string;
  workingDirectory?: string;
  args?: string[];
  env?: Record<string, string>;
  launcherExePath?: string;
  preLaunch?: string[];
  postLaunch?: string[];
  injector?: {
    providerId: ProviderId;
    delayMs?: number;
    processTargetName?: string;
  };
}

export interface KnownIssue {
  description: string;
  workaround?: string;
}

export interface VrProfileSource {
  url: string;
  type: 'github_release' | 'official_site' | 'flat2vr' | 'other';
  version: string;
  date: string;
  sha256?: string;
  author?: string;
}

/** Corrisponde allo schema JSON di profilo descritto nella specifica (§15, §54). */
export interface GameProfile {
  gameId: string;
  title: string;
  engine: EngineName;
  engineConfidence: DetectionConfidence;
  platforms: Platform[];
  vrModes: VrMode[];
  provider: ProviderId | null;
  runtime: RuntimeId | null;
  controllers: ControllerProfile;
  recommendedSettings: RecommendedSettings;
  launch: LaunchConfig | null;
  sources: VrProfileSource[];
  schemaVersion: number;
  profileVersion: string;
  gameVersionCompatibility?: string;
  modVersion?: string;
  testedStatus: 'tested' | 'experimental' | 'obsolete' | 'incompatible' | 'to_verify';
  compatibility: VrCompatibilityLevel;
  knownIssues?: KnownIssue[];
}

/** Voce libreria: un gioco installato/aggiunto dall'utente, con o senza profilo VR associato. */
export interface LibraryGame {
  id: string;
  title: string;
  platform: Platform;
  installPath: string;
  exePath: string | null;
  steamAppId?: string;
  coverPath?: string | null;
  engine: EngineDetectionResult;
  vrReadiness: VrReadiness;
  profileId: string | null;
  addedAt: string;
  lastSeenAt: string;
  userConfirmed: boolean;
  notes?: string;
}

export interface LaunchPlan {
  gameId: string;
  prelaunch: string[];
  game: {
    exePath: string;
    workingDirectory: string;
    args: string[];
    env: Record<string, string>;
  };
  injector: {
    providerId: ProviderId;
    delayMs: number;
    processTargetName: string | null;
  } | null;
  postlaunch: string[];
  monitorProcess: boolean;
}

export interface InstallManifestEntry {
  type: 'added' | 'modified' | 'replaced';
  targetPath: string;
  backupPath: string | null;
  sha256: string | null;
}

export interface InstallManifest {
  gameId: string;
  providerId: ProviderId;
  version: string;
  timestamp: string;
  source: VrProfileSource | null;
  entries: InstallManifestEntry[];
}
