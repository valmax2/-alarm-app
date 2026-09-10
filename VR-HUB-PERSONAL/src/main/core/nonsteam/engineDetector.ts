import * as fs from 'fs';
import * as path from 'path';
import { EngineDetectionResult, EngineName } from '../model/types';

/**
 * Rilevamento euristico del motore grafico (spec §8). Non è mai presentato come
 * certo se si basa solo su euristiche debole: usiamo `confidence`
 * ('confirmed' | 'probable' | 'unknown') per essere onesti in UI.
 */
export function detectEngine(rootDir: string): EngineDetectionResult {
  const signals: string[] = [];
  let best: { engine: EngineName; strength: number } = { engine: 'Unknown', strength: 0 };

  const consider = (engine: EngineName, strength: number, signal: string) => {
    signals.push(signal);
    if (strength > best.strength) best = { engine, strength };
  };

  // --- Unreal Engine ---
  const binariesWin64 = findFirstMatchingDir(rootDir, ['Binaries', 'Win64']);
  if (binariesWin64) {
    consider('UnrealEngine4', 60, `Trovata struttura Binaries/Win64 in ${relative(rootDir, binariesWin64)}`);
    if (fs.existsSync(path.join(rootDir, '..', 'Engine'))) {
      consider('UnrealEngine4', 70, 'Trovata cartella Engine adiacente');
    }
  }
  const pakFiles = findFilesByExtension(rootDir, '.pak', 3);
  if (pakFiles.length > 0) {
    consider('UnrealEngine4', 55, `Trovati ${pakFiles.length} file .pak (tipico Unreal Engine)`);
  }
  const uprojectFiles = findFilesByExtension(rootDir, '.uproject', 4);
  if (uprojectFiles.length > 0) {
    consider('UnrealEngine5', 80, `Trovato file .uproject: ${path.basename(uprojectFiles[0])}`);
  }
  if (findFileByName(rootDir, /^UnrealEditor.*\.exe$/i, 4)) {
    consider('UnrealEngine5', 75, 'Trovato UnrealEditor*.exe (Unreal Engine 5)');
  }
  if (findFileByName(rootDir, /^UE4Editor.*\.exe$/i, 4)) {
    consider('UnrealEngine4', 75, 'Trovato UE4Editor*.exe (Unreal Engine 4)');
  }

  // --- Unity ---
  if (findFileByName(rootDir, /^UnityPlayer\.dll$/i, 3)) {
    consider('Unity', 70, 'Trovato UnityPlayer.dll');
  }
  const dataFolder = findFirstMatchingSuffixDir(rootDir, '_Data');
  if (dataFolder) {
    consider('Unity', 65, `Trovata cartella "${path.basename(dataFolder)}" (pattern Unity <Nome>_Data)`);
    if (fs.existsSync(path.join(dataFolder, 'Managed', 'Assembly-CSharp.dll'))) {
      consider('Unity', 85, 'Trovato Assembly-CSharp.dll (progetto Unity confermato)');
    }
  }

  // --- Source / Source 2 ---
  if (findFileByName(rootDir, /^engine2\.dll$/i, 4)) {
    consider('Source2', 75, 'Trovato engine2.dll (Source 2)');
  }
  if (findFileByName(rootDir, /^engine\.dll$/i, 4) && findFilesByExtension(rootDir, '.vpk', 3).length > 0) {
    consider('Source', 70, 'Trovati engine.dll + file .vpk (Source Engine)');
  }

  // --- id Tech (Quake/Doom-style) ---
  const pk3Files = findFilesByExtension(rootDir, '.pk3', 3);
  if (pk3Files.length > 0) {
    consider('idTech', 55, `Trovati ${pk3Files.length} file .pk3 (id Tech, Quake III-family)`);
  }
  const pakArchives = findFilesByExtension(rootDir, '.pak', 3).filter((f) => /^pak\d+\.pak$/i.test(path.basename(f)));
  if (pakArchives.length > 0) {
    consider('idTech', 55, `Trovati file PAK*.PAK classici (id Tech, Quake/Doom)`);
  }

  // --- RE Engine (Capcom) ---
  if (findFileByName(rootDir, /^re_chunk_\d+\.pak$/i, 3)) {
    consider('REEngine', 80, 'Trovato re_chunk_*.pak (RE Engine, Capcom)');
  }

  // --- CryEngine ---
  if (findFileByName(rootDir, /^cryengine\.dll$/i, 4) || fs.existsSync(path.join(rootDir, 'GameSDK'))) {
    consider('CryEngine', 60, 'Trovati indizi CryEngine (cryengine.dll o cartella GameSDK)');
  }

  const confidence = best.strength >= 75 ? 'confirmed' : best.strength >= 40 ? 'probable' : 'unknown';

  return {
    engine: best.strength > 0 ? best.engine : 'Unknown',
    confidence,
    signals
  };
}

function relative(base: string, target: string): string {
  return path.relative(base, target) || '.';
}

function findFirstMatchingDir(root: string, pathParts: string[], maxDepth = 4): string | null {
  let found: string | null = null;
  const target = pathParts.map((p) => p.toLowerCase());

  function walk(dir: string, depth: number, matchIndex: number) {
    if (found || depth > maxDepth) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const full = path.join(dir, entry.name);
      if (entry.name.toLowerCase() === target[matchIndex]) {
        if (matchIndex === target.length - 1) {
          found = full;
          return;
        }
        walk(full, depth + 1, matchIndex + 1);
      } else {
        walk(full, depth + 1, matchIndex);
      }
      if (found) return;
    }
  }

  walk(root, 0, 0);
  return found;
}

function findFirstMatchingSuffixDir(root: string, suffix: string, maxDepth = 3): string | null {
  let found: string | null = null;
  function walk(dir: string, depth: number) {
    if (found || depth > maxDepth) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.endsWith(suffix)) {
        found = path.join(dir, entry.name);
        return;
      }
      walk(path.join(dir, entry.name), depth + 1);
      if (found) return;
    }
  }
  walk(root, 0);
  return found;
}

function findFilesByExtension(root: string, extension: string, maxDepth = 3): string[] {
  const results: string[] = [];
  function walk(dir: string, depth: number) {
    if (depth > maxDepth) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, depth + 1);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(extension.toLowerCase())) {
        results.push(full);
      }
    }
  }
  walk(root, 0);
  return results;
}

function findFileByName(root: string, pattern: RegExp, maxDepth = 3): string | null {
  let found: string | null = null;
  function walk(dir: string, depth: number) {
    if (found || depth > maxDepth) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, depth + 1);
      } else if (pattern.test(entry.name)) {
        found = full;
        return;
      }
      if (found) return;
    }
  }
  walk(root, 0);
  return found;
}
