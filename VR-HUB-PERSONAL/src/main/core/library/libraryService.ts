import * as path from 'path';
import { AppServices } from '../appServices';
import { scanSteamLibraries, isFullyInstalled } from '../steam/steamScanner';
import { scanNonSteamFolder } from '../nonsteam/exeScanner';
import { detectEngine } from '../nonsteam/engineDetector';
import { matchGameToCatalog } from '../database/catalogLoader';
import { createDefaultProfile, mergeGameProfile } from '../model/gameProfile';
import { buildLaunchPlan } from '../launch/launchPlanner';
import { GameProfile, LibraryGame } from '../model/types';
import { InstallPlan, ValidationResult } from '../providers/provider';
import { loadManifest } from '../manifest/installManifest';

/**
 * Orchestrazione ad alto livello usata da `ipc.ts`: mette insieme scanner,
 * database, catalogo e provider. Nessuna dipendenza da Electron qui dentro,
 * per restare testabile.
 */
export class LibraryService {
  constructor(private readonly services: AppServices) {}

  /** Spec §5: Steam viene rilevato e la libreria costruita automaticamente, l'utente non aggiunge nulla a mano. */
  scanSteam(): LibraryGame[] {
    const { settings, database, catalog, logger } = this.services;
    if (!settings.steamPath) {
      logger.warn('Scansione Steam richiesta ma nessun percorso Steam configurato nelle Impostazioni.');
      return [];
    }

    const manifests = scanSteamLibraries(settings.steamPath).filter(isFullyInstalled);
    const results: LibraryGame[] = [];

    for (const manifest of manifests) {
      const match = matchGameToCatalog(catalog, { title: manifest.name, steamAppId: manifest.appId });
      const existing = database.getGame(`steam:${manifest.appId}`);

      const game: LibraryGame = {
        id: `steam:${manifest.appId}`,
        title: manifest.name,
        platform: 'steam',
        installPath: manifest.installPath,
        exePath: existing?.exePath ?? null,
        steamAppId: manifest.appId,
        coverPath: existing?.coverPath ?? null,
        engine: existing?.engine ?? { engine: 'Unknown', confidence: 'unknown', signals: [] },
        vrReadiness: match ? 'configuration_required' : 'not_compatible',
        profileId: match?.entry.gameId ?? existing?.profileId ?? null,
        addedAt: existing?.addedAt ?? new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        userConfirmed: existing?.userConfirmed ?? match?.confidence === 'confirmed'
      };

      if (match && !database.loadProfile(match.entry.gameId)) {
        database.saveProfile(match.entry.profile);
      }

      database.upsertGame(game);
      results.push(game);
    }

    logger.info(`Scansione Steam completata: ${results.length} giochi trovati.`);
    return results;
  }

  /** Spec §6/§7: aggiunta manuale di un gioco Non-Steam a partire da una cartella scelta dall'utente. */
  addNonSteamGame(folderPath: string): LibraryGame {
    const { database, catalog, logger } = this.services;

    const scan = scanNonSteamFolder(folderPath);
    const engine = detectEngine(folderPath);
    const title = path.basename(folderPath);
    const id = `manual:${sanitizeId(title)}:${Date.now()}`;

    const match = matchGameToCatalog(catalog, {
      title,
      exeFileName: scan.mainExe?.fileName ?? null
    });

    const game: LibraryGame = {
      id,
      title,
      platform: 'manual',
      installPath: folderPath,
      exePath: scan.mainExe?.path ?? null,
      coverPath: null,
      engine,
      // Se non c'è corrispondenza nel catalogo, creiamo comunque un profilo "vuoto"
      // (spec §52: aggiunta manuale profilo) indicizzato sull'id del gioco stesso,
      // così la scheda ha sempre un profilo su cui l'utente può intervenire.
      vrReadiness: match ? 'configuration_required' : 'not_compatible',
      profileId: match?.entry.gameId ?? id,
      addedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      userConfirmed: false,
      notes: scan.mainExe
        ? `EXE proposto: ${scan.mainExe.fileName} (punteggio ${scan.mainExe.score}). Motivi: ${scan.mainExe.reasons.join('; ')}`
        : 'Nessun eseguibile trovato automaticamente: assegnalo manualmente.'
    };

    if (match && !database.loadProfile(match.entry.gameId)) {
      database.saveProfile(match.entry.profile);
    } else if (!match) {
      database.saveProfile(createDefaultProfile(id, title, engine.engine));
    }

    database.upsertGame(game);
    logger.info(`Aggiunto gioco Non-Steam "${title}"`, { id, exe: scan.mainExe?.fileName });
    return game;
  }

  removeGame(gameId: string): void {
    // Spec §66: rimuove dalla libreria, non tocca il filesystem del gioco.
    this.services.database.removeGame(gameId);
  }

  resolveProfile(gameId: string): GameProfile | null {
    const { database } = this.services;
    const game = database.getGame(gameId);
    if (!game || !game.profileId) return null;
    const catalogProfile = database.loadProfile(game.profileId);
    if (!catalogProfile) return null;
    const override = database.loadOverride(gameId);
    return mergeGameProfile(catalogProfile, override);
  }

  /** "Configura VR" -> mostra prima il piano (spec §56/§70), non modifica nulla. */
  planInstall(gameId: string): InstallPlan | null {
    const { database, providers } = this.services;
    const game = database.getGame(gameId);
    const profile = this.resolveProfile(gameId);
    if (!game || !profile) return null;

    const provider = profile.provider ? providers.get(profile.provider) : providers.findApplicable(game, profile);
    if (!provider) return null;
    return provider.planInstall(game, profile);
  }

  /** "Configura VR" confermato dall'utente: esegue davvero l'installazione. */
  async configureVr(gameId: string): Promise<{ ok: boolean; message: string }> {
    const { database, providers, logger } = this.services;
    const game = database.getGame(gameId);
    const profile = this.resolveProfile(gameId);
    if (!game || !profile) return { ok: false, message: 'Gioco o profilo non trovato.' };

    const provider = profile.provider ? providers.get(profile.provider) : providers.findApplicable(game, profile);
    if (!provider) return { ok: false, message: 'Nessun provider VR applicabile per questo gioco.' };

    const compat = provider.checkCompatibility(game, profile);
    if (!compat.compatible) return { ok: false, message: compat.reason };

    try {
      await provider.install(game, profile);
      database.upsertGame({ ...game, vrReadiness: 'ready' });
      logger.info(`Configurazione VR completata per "${game.title}"`, { provider: provider.id });
      return { ok: true, message: 'CONFIGURAZIONE COMPLETATA' };
    } catch (err) {
      logger.error(`Configurazione VR fallita per "${game.title}"`, { error: String(err) });
      return { ok: false, message: `Errore durante la configurazione: ${String(err)}` };
    }
  }

  validate(gameId: string): ValidationResult | null {
    const { database, providers } = this.services;
    const game = database.getGame(gameId);
    const profile = this.resolveProfile(gameId);
    if (!game || !profile || !profile.provider) return null;
    const provider = providers.get(profile.provider);
    return provider ? provider.validate(game, profile) : null;
  }

  buildLaunchPlanFor(gameId: string) {
    const { database } = this.services;
    const game = database.getGame(gameId);
    const profile = this.resolveProfile(gameId);
    if (!game || !profile) return null;
    return buildLaunchPlan(game, profile);
  }

  /** "RIPRISTINA GIOCO" (spec §35/§37): rollback reale via manifest + provider.uninstall. */
  async restoreGame(gameId: string): Promise<{ ok: boolean; message: string }> {
    const { database, providers, manifestsDir } = this.services;
    const game = database.getGame(gameId);
    const profile = this.resolveProfile(gameId);
    if (!game || !profile || !profile.provider) return { ok: false, message: 'Gioco o profilo non trovato.' };

    const provider = providers.get(profile.provider);
    if (!provider) return { ok: false, message: 'Provider non trovato.' };

    const manifest = loadManifest(manifestsDir, gameId);
    if (!manifest) {
      return { ok: false, message: 'Nessuna installazione registrata da ripristinare per questo gioco.' };
    }

    try {
      await provider.uninstall(game, manifest);
      database.upsertGame({ ...game, vrReadiness: 'configuration_required' });
      return { ok: true, message: 'Gioco ripristinato allo stato precedente all\'installazione VR.' };
    } catch (err) {
      this.services.logger.error(`Ripristino fallito per "${game.title}"`, { error: String(err) });
      return { ok: false, message: String(err) };
    }
  }
}

function sanitizeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}
