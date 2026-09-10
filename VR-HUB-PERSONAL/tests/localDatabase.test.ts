import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { LocalDatabase } from '../src/main/core/database/localDatabase';
import { createDefaultProfile, mergeGameProfile } from '../src/main/core/model/gameProfile';
import { LibraryGame } from '../src/main/core/model/types';

function makeGame(id: string, title: string): LibraryGame {
  return {
    id,
    title,
    platform: 'manual',
    installPath: `/games/${title}`,
    exePath: `/games/${title}/${title}.exe`,
    engine: { engine: 'Unknown', confidence: 'unknown', signals: [] },
    vrReadiness: 'not_found',
    profileId: null,
    addedAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    userConfirmed: false
  };
}

describe('LocalDatabase', () => {
  let tmpDir: string;
  let db: LocalDatabase;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrhub-db-'));
    db = new LocalDatabase(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('parte con libreria vuota se non esiste ancora games.json', () => {
    expect(db.loadGames()).toEqual([]);
  });

  it('upsertGame aggiunge e poi aggiorna lo stesso gioco', () => {
    const game = makeGame('doom', 'DOOM');
    db.upsertGame(game);
    expect(db.loadGames()).toHaveLength(1);

    const updated = { ...game, vrReadiness: 'ready' as const };
    db.upsertGame(updated);

    const games = db.loadGames();
    expect(games).toHaveLength(1);
    expect(games[0].vrReadiness).toBe('ready');
  });

  it('removeGame rimuove dalla libreria ma non tocca il filesystem del gioco (spec §66)', () => {
    db.upsertGame(makeGame('doom', 'DOOM'));
    db.upsertGame(makeGame('quake', 'Quake'));
    db.removeGame('doom');

    const games = db.loadGames();
    expect(games).toHaveLength(1);
    expect(games[0].id).toBe('quake');
  });

  it('i dati persistono ricreando una nuova istanza sullo stesso dataDir (persistenza tra riavvii)', () => {
    db.upsertGame(makeGame('doom', 'DOOM'));
    const db2 = new LocalDatabase(tmpDir);
    expect(db2.loadGames()).toHaveLength(1);
  });

  it('se games.json è corrotto, non fa crashare l\'app e restituisce libreria vuota', () => {
    fs.writeFileSync(path.join(tmpDir, 'games.json'), '{ questo non è json valido', 'utf8');
    expect(db.loadGames()).toEqual([]);
  });

  it('salva e ricarica un profilo VR', () => {
    const profile = createDefaultProfile('doom', 'DOOM');
    db.saveProfile(profile);
    const loaded = db.loadProfile('doom');
    expect(loaded).toEqual(profile);
  });

  it('un override utente sopravvive e si combina con il profilo catalogo, senza essere sovrascritto da un update', () => {
    const catalogProfile = createDefaultProfile('doom', 'DOOM');
    catalogProfile.compatibility = 'good';
    catalogProfile.provider = 'uevr';

    db.saveOverride('doom', { compatibility: 'perfect', recommendedSettings: { motionBlur: 'off', dlssFrameGeneration: 'off', taa: 'on' } });

    const override = db.loadOverride('doom');
    const merged = mergeGameProfile(catalogProfile, override);

    expect(merged.compatibility).toBe('perfect'); // scelta utente preservata
    expect(merged.provider).toBe('uevr'); // campo non toccato dall'utente resta quello del catalogo
    expect(merged.recommendedSettings.taa).toBe('on'); // override annidato applicato
    expect(merged.recommendedSettings.motionBlur).toBe('off');

    // "Ripristina consigliati" (spec §82): dopo clearOverride, torna il profilo di catalogo puro.
    db.clearOverride('doom');
    expect(db.loadOverride('doom')).toBeNull();
  });

  it('listProfileIds elenca i profili salvati', () => {
    db.saveProfile(createDefaultProfile('doom', 'DOOM'));
    db.saveProfile(createDefaultProfile('quake', 'Quake'));
    expect(db.listProfileIds().sort()).toEqual(['doom', 'quake']);
  });
});
