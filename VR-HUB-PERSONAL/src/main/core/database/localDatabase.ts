import * as fs from 'fs';
import * as path from 'path';
import { GameProfile, LibraryGame } from '../model/types';
import { sanitizeFileSegment } from '../security/pathSafety';

const GAMES_SCHEMA_VERSION = 1;

interface GamesFile {
  schemaVersion: number;
  games: LibraryGame[];
}

/**
 * Database locale su file JSON versionati (spec §16, opzione scelta: "JSON
 * strutturati versionati", vedi ARCHITETTURA_VR_HUB_PERSONAL.md §1).
 *
 * Layout su disco (dentro `dataDir`, tipicamente la userData dell'app):
 *   games.json                    -> elenco LibraryGame (libreria dell'utente)
 *   profiles/<gameId>.json        -> GameProfile "catalogo" risolto per quel gioco
 *   profiles/overrides/<id>.json  -> override utente (merge, mai sovrascritto da update remoti)
 */
export class LocalDatabase {
  constructor(private readonly dataDir: string) {
    fs.mkdirSync(this.dataDir, { recursive: true });
    fs.mkdirSync(path.join(this.dataDir, 'profiles'), { recursive: true });
    fs.mkdirSync(path.join(this.dataDir, 'profiles', 'overrides'), { recursive: true });
  }

  private gamesFilePath(): string {
    return path.join(this.dataDir, 'games.json');
  }

  loadGames(): LibraryGame[] {
    const filePath = this.gamesFilePath();
    if (!fs.existsSync(filePath)) return [];
    try {
      const raw: GamesFile = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return Array.isArray(raw.games) ? raw.games : [];
    } catch {
      // File corrotto: non far crashare l'app all'avvio, restituiamo libreria vuota.
      // (la UI dovrebbe segnalarlo come WARNING nel log)
      return [];
    }
  }

  saveGames(games: LibraryGame[]): void {
    const payload: GamesFile = { schemaVersion: GAMES_SCHEMA_VERSION, games };
    writeJsonAtomic(this.gamesFilePath(), payload);
  }

  upsertGame(game: LibraryGame): LibraryGame[] {
    const games = this.loadGames();
    const idx = games.findIndex((g) => g.id === game.id);
    if (idx >= 0) {
      games[idx] = game;
    } else {
      games.push(game);
    }
    this.saveGames(games);
    return games;
  }

  /** Rimuove dalla libreria (spec §66: NON disinstalla il gioco dal disco). */
  removeGame(gameId: string): LibraryGame[] {
    const games = this.loadGames().filter((g) => g.id !== gameId);
    this.saveGames(games);
    return games;
  }

  getGame(gameId: string): LibraryGame | null {
    return this.loadGames().find((g) => g.id === gameId) ?? null;
  }

  private profilePath(gameId: string): string {
    return path.join(this.dataDir, 'profiles', `${sanitizeFileSegment(gameId)}.json`);
  }

  private overridePath(gameId: string): string {
    return path.join(this.dataDir, 'profiles', 'overrides', `${sanitizeFileSegment(gameId)}.json`);
  }

  saveProfile(profile: GameProfile): void {
    writeJsonAtomic(this.profilePath(profile.gameId), profile);
  }

  loadProfile(gameId: string): GameProfile | null {
    const filePath = this.profilePath(gameId);
    if (!fs.existsSync(filePath)) return null;
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8')) as GameProfile;
    } catch {
      return null;
    }
  }

  saveOverride(gameId: string, override: Partial<GameProfile>): void {
    writeJsonAtomic(this.overridePath(gameId), override);
  }

  loadOverride(gameId: string): Partial<GameProfile> | null {
    const filePath = this.overridePath(gameId);
    if (!fs.existsSync(filePath)) return null;
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<GameProfile>;
    } catch {
      return null;
    }
  }

  /** Spec §82: pulsante "Ripristina consigliati" -> elimina l'override utente. */
  clearOverride(gameId: string): void {
    const filePath = this.overridePath(gameId);
    if (fs.existsSync(filePath)) fs.rmSync(filePath);
  }

  listProfileIds(): string[] {
    const dir = path.join(this.dataDir, 'profiles');
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.json'))
      .map((e) => e.name.replace(/\.json$/, ''));
  }
}

/** Scrittura atomica: file temporaneo + rename, per non corrompere il DB in caso di crash a metà scrittura. */
function writeJsonAtomic(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}
