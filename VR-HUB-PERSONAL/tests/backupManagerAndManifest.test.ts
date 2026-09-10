import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { backupFileIfExists, restoreFromEntry } from '../src/main/core/backup/backupManager';
import {
  createManifest,
  withEntry,
  saveManifest,
  loadManifest,
  restoreManifest
} from '../src/main/core/manifest/installManifest';

describe('backupManager + installManifest (transazione installa -> ripristina, spec §35/§36/§37)', () => {
  let tmpDir: string;
  let backupDir: string;
  let gameDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrhub-backup-'));
    backupDir = path.join(tmpDir, 'backups');
    gameDir = path.join(tmpDir, 'game');
    fs.mkdirSync(gameDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('backupFileIfExists restituisce null se il file non esiste ancora (sarà una entry "added")', () => {
    const target = path.join(gameDir, 'config.json');
    const backupPath = backupFileIfExists(target, backupDir, 'game1');
    expect(backupPath).toBeNull();
  });

  it('backupFileIfExists copia il file esistente prima di modificarlo', () => {
    const target = path.join(gameDir, 'config.json');
    fs.writeFileSync(target, 'contenuto originale', 'utf8');

    const backupPath = backupFileIfExists(target, backupDir, 'game1');
    expect(backupPath).not.toBeNull();
    expect(fs.readFileSync(backupPath!, 'utf8')).toBe('contenuto originale');

    // Simuliamo la modifica reale del file (quello che farebbe il provider dopo il backup)
    fs.writeFileSync(target, 'contenuto modificato dalla mod VR', 'utf8');
    expect(fs.readFileSync(target, 'utf8')).toBe('contenuto modificato dalla mod VR');
  });

  it('flusso completo: installa (backup + scrivi) poi ripristina, ritorna esattamente al contenuto originale', () => {
    const configPath = path.join(gameDir, 'config.json');
    const newFilePath = path.join(gameDir, 'uevr_injected.dll');
    fs.writeFileSync(configPath, 'ORIGINALE', 'utf8');

    let manifest = createManifest('game1', 'uevr', '1.0.0', null);

    // step 1: modifica un file esistente (con backup)
    const backupPath = backupFileIfExists(configPath, backupDir, 'game1');
    fs.writeFileSync(configPath, 'MODIFICATO', 'utf8');
    manifest = withEntry(manifest, { type: 'modified', targetPath: configPath, backupPath, sha256: null });

    // step 2: aggiunge un file nuovo (nessun backup necessario)
    fs.writeFileSync(newFilePath, 'dll iniettata', 'utf8');
    manifest = withEntry(manifest, { type: 'added', targetPath: newFilePath, backupPath: null, sha256: null });

    const manifestsDir = path.join(tmpDir, 'manifests');
    saveManifest(manifestsDir, manifest);

    const loaded = loadManifest(manifestsDir, 'game1');
    expect(loaded).not.toBeNull();
    expect(loaded!.entries).toHaveLength(2);

    // ora ripristiniamo
    const report = restoreManifest(loaded!);
    expect(report.errors).toEqual([]);
    expect(report.restoredEntries).toBe(1);
    expect(report.deletedEntries).toBe(1);

    expect(fs.readFileSync(configPath, 'utf8')).toBe('ORIGINALE');
    expect(fs.existsSync(newFilePath)).toBe(false);
  });

  it('restoreFromEntry lancia un errore chiaro se il backup dichiarato manca (mai un fallimento silenzioso)', () => {
    expect(() =>
      restoreFromEntry({ type: 'modified', targetPath: path.join(gameDir, 'x.json'), backupPath: '/non/esiste.bak', sha256: null })
    ).toThrow(/Backup mancante/);
  });
});
