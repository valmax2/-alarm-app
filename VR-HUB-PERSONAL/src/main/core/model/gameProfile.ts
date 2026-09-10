import {
  ControllerProfile,
  EngineName,
  GameProfile,
  RecommendedSettings
} from './types';

const DEFAULT_CONTROLLERS: ControllerProfile = {
  gamepad: 'unavailable',
  keyboardMouse: 'unavailable',
  questTouch: 'unavailable',
  motionController: 'unavailable'
};

const DEFAULT_SETTINGS: RecommendedSettings = {
  // Regola richiesta dalla specifica (§14): default consigliato Motion Blur OFF,
  // Frame Generation OFF, TAA preferibilmente OFF. Un gioco può avere bisogno di
  // TAA per il rendering temporale: in quel caso l'override esplicito imposta 'required'.
  motionBlur: 'off',
  dlssFrameGeneration: 'off',
  taa: 'off'
};

/** Crea un profilo VR "vuoto"/di base per un gioco nuovo, non ancora configurato. */
export function createDefaultProfile(gameId: string, title: string, engine: EngineName = 'Unknown'): GameProfile {
  return {
    gameId,
    title,
    engine,
    engineConfidence: 'unknown',
    platforms: [],
    vrModes: [],
    provider: null,
    runtime: null,
    controllers: { ...DEFAULT_CONTROLLERS },
    recommendedSettings: { ...DEFAULT_SETTINGS },
    launch: null,
    sources: [],
    schemaVersion: 1,
    profileVersion: '0.0.0',
    testedStatus: 'to_verify',
    compatibility: 'unknown'
  };
}

/**
 * Unisce un profilo "catalogo" (upstream, aggiornabile da remoto) con un
 * override locale dell'utente (spec §82/§86/§87: un update remoto NON deve
 * cancellare le scelte dell'utente). L'override vince campo per campo dove presente;
 * gli oggetti annidati vengono uniti a un livello, gli array dell'override sostituiscono
 * interamente quelli del catalogo se presenti.
 */
export function mergeGameProfile(catalogProfile: GameProfile, override: Partial<GameProfile> | null): GameProfile {
  if (!override) return catalogProfile;

  const merged: GameProfile = { ...catalogProfile, ...stripUndefined(override) };

  if (override.controllers) {
    merged.controllers = { ...catalogProfile.controllers, ...override.controllers };
  }
  if (override.recommendedSettings) {
    merged.recommendedSettings = { ...catalogProfile.recommendedSettings, ...override.recommendedSettings };
  }
  if (override.launch) {
    merged.launch = { ...(catalogProfile.launch ?? {}), ...override.launch } as GameProfile['launch'];
  }

  return merged;
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}

/** Validazione minima: usata prima di persistere un profilo o prima di "Configura VR". */
export function validateGameProfile(profile: GameProfile): string[] {
  const errors: string[] = [];
  if (!profile.gameId) errors.push('gameId mancante');
  if (!profile.title) errors.push('title mancante');
  if (typeof profile.schemaVersion !== 'number') errors.push('schemaVersion non valido');
  const allowedCompat = ['perfect', 'good', 'playable', 'experimental', 'known_issues', 'not_working', 'unknown'];
  if (!allowedCompat.includes(profile.compatibility)) errors.push('compatibility non valida');
  if (profile.provider && !profile.launch) {
    errors.push('un profilo con provider impostato dovrebbe avere una configurazione di lancio (launch)');
  }
  return errors;
}
