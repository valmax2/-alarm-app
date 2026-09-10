import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Logger } from '../src/main/core/diagnostics/logger';
import { SettingsStore, defaultSettings } from '../src/main/core/settings/settingsStore';

describe('Logger (spec §62/§33)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrhub-logger-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('scrive righe INFO/WARNING/ERROR ma filtra DEBUG con minLevel INFO (default)', () => {
    const logger = new Logger({ logsDir: tmpDir });
    logger.debug('non dovrebbe apparire');
    logger.info('avvio applicazione');
    logger.warn('percorso Steam non trovato');
    logger.error('installazione fallita', { gameId: 'doom' });

    const lines = logger.readRecent();
    expect(lines).toHaveLength(3);
    const parsed = lines.map((l) => JSON.parse(l));
    expect(parsed.map((p) => p.level)).toEqual(['INFO', 'WARNING', 'ERROR']);
    expect(parsed[2].context).toEqual({ gameId: 'doom' });
  });

  it('con minLevel DEBUG registra anche i messaggi di debug', () => {
    const logger = new Logger({ logsDir: tmpDir, minLevel: 'DEBUG' });
    logger.debug('dettaglio interno');
    expect(logger.readRecent()).toHaveLength(1);
  });

  it('ruota il file quando supera la dimensione massima', () => {
    const logger = new Logger({ logsDir: tmpDir, maxFileSizeBytes: 500, maxFiles: 2 });
    for (let i = 0; i < 50; i++) {
      logger.info(`riga di log numero ${i} con un po' di testo per occupare spazio`);
    }
    // Deve esistere almeno un file ruotato oltre a quello corrente.
    const files = fs.readdirSync(tmpDir);
    expect(files.some((f) => f === 'vrhub.log')).toBe(true);
    expect(files.some((f) => f.startsWith('vrhub.1'))).toBe(true);
  });
});

describe('SettingsStore (spec §47)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrhub-settings-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('restituisce le impostazioni di default se non esiste ancora settings.json', () => {
    const store = new SettingsStore(tmpDir);
    expect(store.load()).toEqual(defaultSettings(tmpDir));
  });

  it('update salva solo i campi cambiati e mantiene gli altri default', () => {
    const store = new SettingsStore(tmpDir);
    const updated = store.update({ steamPath: 'C:/Program Files (x86)/Steam', debugMode: true });

    expect(updated.steamPath).toBe('C:/Program Files (x86)/Steam');
    expect(updated.debugMode).toBe(true);
    expect(updated.language).toBe('it'); // default non toccato

    const store2 = new SettingsStore(tmpDir);
    expect(store2.load()).toEqual(updated);
  });

  it('se settings.json è corrotto, ricade sui default senza crashare', () => {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'settings.json'), '{{{corrotto', 'utf8');
    const store = new SettingsStore(tmpDir);
    expect(store.load()).toEqual(defaultSettings(tmpDir));
  });
});
