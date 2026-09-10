import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  readLibraryFolders,
  scanLibraryManifests,
  scanSteamLibraries,
  isFullyInstalled
} from '../src/main/core/steam/steamScanner';

function makeAcf(appId: string, name: string, installDir: string, stateFlags = '4'): string {
  return `"AppState"\n{\n\t"appid"\t\t"${appId}"\n\t"name"\t\t"${name}"\n\t"StateFlags"\t\t"${stateFlags}"\n\t"installdir"\t\t"${installDir}"\n}\n`;
}

describe('steamScanner', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vrhub-steam-'));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('con nessun libraryfolders.vdf, usa la root come unica libreria', () => {
    const folders = readLibraryFolders(tmpRoot);
    expect(folders).toEqual([{ path: tmpRoot }]);
  });

  it('legge libraryfolders.vdf con più librerie', () => {
    const steamappsDir = path.join(tmpRoot, 'steamapps');
    fs.mkdirSync(steamappsDir, { recursive: true });
    const secondLib = path.join(tmpRoot, 'second_library');
    const vdf = `"libraryfolders"\n{\n\t"0"\n\t{\n\t\t"path"\t\t"${escapeForVdf(tmpRoot)}"\n\t}\n\t"1"\n\t{\n\t\t"path"\t\t"${escapeForVdf(secondLib)}"\n\t}\n}\n`;
    fs.writeFileSync(path.join(steamappsDir, 'libraryfolders.vdf'), vdf, 'utf8');

    const folders = readLibraryFolders(tmpRoot);
    expect(folders.map((f) => f.path)).toEqual([tmpRoot, secondLib]);
  });

  it('trova i giochi installati leggendo gli appmanifest_*.acf', () => {
    const steamappsDir = path.join(tmpRoot, 'steamapps');
    fs.mkdirSync(steamappsDir, { recursive: true });
    fs.writeFileSync(path.join(steamappsDir, 'appmanifest_620.acf'), makeAcf('620', 'Portal 2', 'Portal 2'), 'utf8');
    fs.writeFileSync(path.join(steamappsDir, 'appmanifest_400.acf'), makeAcf('400', 'Portal', 'Portal'), 'utf8');
    // file non manifest, deve essere ignorato
    fs.writeFileSync(path.join(steamappsDir, 'notes.txt'), 'ignorami', 'utf8');

    const manifests = scanLibraryManifests(tmpRoot);
    expect(manifests).toHaveLength(2);
    const portal2 = manifests.find((m) => m.appId === '620')!;
    expect(portal2.name).toBe('Portal 2');
    expect(portal2.installPath).toBe(path.join(steamappsDir, 'common', 'Portal 2'));
  });

  it('salta manifest corrotti senza far fallire la scansione', () => {
    const steamappsDir = path.join(tmpRoot, 'steamapps');
    fs.mkdirSync(steamappsDir, { recursive: true });
    fs.writeFileSync(path.join(steamappsDir, 'appmanifest_1.acf'), '{{{ non valido', 'utf8');
    fs.writeFileSync(path.join(steamappsDir, 'appmanifest_620.acf'), makeAcf('620', 'Portal 2', 'Portal 2'), 'utf8');

    const manifests = scanLibraryManifests(tmpRoot);
    expect(manifests).toHaveLength(1);
    expect(manifests[0].appId).toBe('620');
  });

  it('scanSteamLibraries deduplica gli appId tra librerie diverse', () => {
    const steamappsDir = path.join(tmpRoot, 'steamapps');
    const secondLib = path.join(tmpRoot, 'second_library');
    const secondSteamapps = path.join(secondLib, 'steamapps');
    fs.mkdirSync(steamappsDir, { recursive: true });
    fs.mkdirSync(secondSteamapps, { recursive: true });

    const vdf = `"libraryfolders"\n{\n\t"0"\n\t{\n\t\t"path"\t\t"${escapeForVdf(tmpRoot)}"\n\t}\n\t"1"\n\t{\n\t\t"path"\t\t"${escapeForVdf(secondLib)}"\n\t}\n}\n`;
    fs.writeFileSync(path.join(steamappsDir, 'libraryfolders.vdf'), vdf, 'utf8');
    fs.writeFileSync(path.join(steamappsDir, 'appmanifest_620.acf'), makeAcf('620', 'Portal 2', 'Portal 2'), 'utf8');
    // stesso appId in una seconda "libreria": deve contare una sola volta
    fs.writeFileSync(path.join(secondSteamapps, 'appmanifest_620.acf'), makeAcf('620', 'Portal 2', 'Portal 2'), 'utf8');
    fs.writeFileSync(path.join(secondSteamapps, 'appmanifest_570.acf'), makeAcf('570', 'Dota 2', 'dota 2 beta'), 'utf8');

    const all = scanSteamLibraries(tmpRoot);
    expect(all).toHaveLength(2);
    expect(all.map((m) => m.appId).sort()).toEqual(['570', '620']);
  });

  it('isFullyInstalled è false se la cartella di installazione non esiste', () => {
    const manifest = {
      appId: '620',
      name: 'Portal 2',
      installDir: 'Portal 2',
      installPath: path.join(tmpRoot, 'steamapps', 'common', 'Portal 2'),
      stateFlags: '4'
    };
    expect(isFullyInstalled(manifest)).toBe(false);

    fs.mkdirSync(manifest.installPath, { recursive: true });
    expect(isFullyInstalled(manifest)).toBe(true);
  });

  it('isFullyInstalled è false se StateFlags indica download/update in corso', () => {
    const installPath = path.join(tmpRoot, 'steamapps', 'common', 'Portal 2');
    fs.mkdirSync(installPath, { recursive: true });
    const manifest = { appId: '620', name: 'Portal 2', installDir: 'Portal 2', installPath, stateFlags: '2' };
    expect(isFullyInstalled(manifest)).toBe(false);
  });
});

function escapeForVdf(value: string): string {
  return value.replace(/\\/g, '\\\\');
}
