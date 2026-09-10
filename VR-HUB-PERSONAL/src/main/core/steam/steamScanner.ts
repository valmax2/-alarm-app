import * as fs from 'fs';
import * as path from 'path';
import { parseVdf, getRootNode, VdfNode } from './vdf';

export interface SteamLibraryFolder {
  path: string;
}

export interface SteamAppManifest {
  appId: string;
  name: string;
  installDir: string;
  /** percorso assoluto: <library>/steamapps/common/<installDir> */
  installPath: string;
  stateFlags?: string;
}

/**
 * Legge `<steamRoot>/steamapps/libraryfolders.vdf` e restituisce tutte le
 * cartelle libreria configurate (inclusa quella di default, se presente nel file
 * come una delle voci — Steam moderno la elenca sempre anche per l'installazione
 * principale).
 */
export function readLibraryFolders(steamRoot: string): SteamLibraryFolder[] {
  const vdfPath = path.join(steamRoot, 'steamapps', 'libraryfolders.vdf');
  if (!fs.existsSync(vdfPath)) {
    // Fallback: nessun file libraryfolders.vdf trovato, consideriamo solo la root.
    return [{ path: steamRoot }];
  }
  const content = fs.readFileSync(vdfPath, 'utf8');
  const parsed = parseVdf(content);
  const root = getRootNode(parsed, 'libraryfolders');
  const folders: SteamLibraryFolder[] = [];
  if (root) {
    for (const key of Object.keys(root)) {
      const entry = root[key];
      if (entry && typeof entry !== 'string') {
        const p = entry['path'];
        if (typeof p === 'string' && p.length > 0) {
          folders.push({ path: p });
        }
      }
    }
  }
  if (folders.length === 0) {
    folders.push({ path: steamRoot });
  }
  return folders;
}

/**
 * Legge tutti gli `appmanifest_*.acf` presenti in `<libraryPath>/steamapps/`.
 */
export function scanLibraryManifests(libraryPath: string): SteamAppManifest[] {
  const steamappsDir = path.join(libraryPath, 'steamapps');
  if (!fs.existsSync(steamappsDir)) return [];

  const manifests: SteamAppManifest[] = [];
  const files = fs.readdirSync(steamappsDir).filter((f) => /^appmanifest_\d+\.acf$/i.test(f));

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(steamappsDir, file), 'utf8');
      const parsed = parseVdf(content);
      const appState = getRootNode(parsed, 'appstate');
      if (!appState) continue;

      const appId = asString(appState['appid']);
      const name = asString(appState['name']);
      const installDir = asString(appState['installdir']);
      const stateFlags = asString(appState['stateflags']);
      if (!appId || !installDir) continue;

      manifests.push({
        appId,
        name: name || installDir,
        installDir,
        installPath: path.join(steamappsDir, 'common', installDir),
        stateFlags
      });
    } catch {
      // Manifest illeggibile/corrotto: lo saltiamo senza far fallire la scansione intera.
      continue;
    }
  }
  return manifests;
}

/** Scansiona tutte le librerie Steam raggiungibili da una installazione Steam. */
export function scanSteamLibraries(steamRoot: string): SteamAppManifest[] {
  const folders = readLibraryFolders(steamRoot);
  const all: SteamAppManifest[] = [];
  const seenAppIds = new Set<string>();

  for (const folder of folders) {
    for (const manifest of scanLibraryManifests(folder.path)) {
      if (seenAppIds.has(manifest.appId)) continue;
      seenAppIds.add(manifest.appId);
      all.push(manifest);
    }
  }
  return all;
}

/** Un gioco Steam è "installato" se la cartella del manifest esiste ed è pienamente installato (no update/download in corso). */
export function isFullyInstalled(manifest: SteamAppManifest): boolean {
  if (!fs.existsSync(manifest.installPath)) return false;
  // StateFlags 4 = "fully installed" nella maggior parte delle versioni di Steam.
  if (manifest.stateFlags) {
    const flags = parseInt(manifest.stateFlags, 10);
    if (!Number.isNaN(flags) && (flags & 4) === 0) return false;
  }
  return true;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
