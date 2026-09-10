import * as fs from 'fs';
import * as path from 'path';
import { ExeCandidate } from '../model/types';

/**
 * Nomi/pattern di eseguibili da penalizzare pesantemente: non sono il gioco,
 * sono strumenti di supporto (spec §7: "Esempi di EXE da evitare").
 */
const NEGATIVE_PATTERNS: Array<{ regex: RegExp; penalty: number; reason: string }> = [
  { regex: /crashreport/i, penalty: 100, reason: 'crash reporter' },
  { regex: /unins(tall)?/i, penalty: 100, reason: 'uninstaller' },
  { regex: /^setup/i, penalty: 90, reason: 'installer/setup' },
  { regex: /vc_?redist/i, penalty: 100, reason: 'prerequisite (Visual C++ Redistributable)' },
  { regex: /dxsetup|directx/i, penalty: 100, reason: 'prerequisite (DirectX)' },
  { regex: /redist/i, penalty: 80, reason: 'redistributable' },
  { regex: /updater|update\.exe$/i, penalty: 60, reason: 'updater' },
  { regex: /eac_?(setup|helper|bootstrap)|easyanticheat.*setup/i, penalty: 90, reason: 'anti-cheat bootstrapper' },
  { regex: /battleye/i, penalty: 70, reason: 'anti-cheat helper' },
  { regex: /helper|service|daemon/i, penalty: 40, reason: 'processo di supporto' },
  { regex: /launcher/i, penalty: 10, reason: 'launcher secondario (penalità leggera, potrebbe essere corretto)' },
  { regex: /^ue4prereqsetup|^uereqsetup/i, penalty: 90, reason: 'prerequisiti Unreal Engine' }
];

const IGNORED_DIR_NAMES = new Set([
  '_commonredist',
  'redist',
  'directx',
  '__installer',
  'installscript',
  'battleye',
  'easyanticheat',
  '$recycle.bin',
  'system volume information'
]);

export interface ScanOptions {
  maxDepth?: number;
}

/** Cerca tutti i file `.exe` sotto `rootDir`, con limite di profondità e cartelle da ignorare. */
export function listExeFiles(rootDir: string, options: ScanOptions = {}): string[] {
  const maxDepth = options.maxDepth ?? 8;
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
        if (IGNORED_DIR_NAMES.has(entry.name.toLowerCase())) continue;
        walk(full, depth + 1);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.exe')) {
        results.push(full);
      }
    }
  }

  walk(rootDir, 0);
  return results;
}

/**
 * Assegna un punteggio a un candidato EXE. Punteggio più alto = più probabile
 * sia l'eseguibile principale del gioco. Non scegliamo mai "il primo .exe trovato"
 * (spec §7): ogni scelta è motivata da `reasons`.
 */
export function scoreExeCandidate(exePath: string, rootDir: string): ExeCandidate {
  const fileName = path.basename(exePath);
  const relativeDepth = path.relative(rootDir, exePath).split(path.sep).length - 1;
  const rootFolderName = path.basename(rootDir).toLowerCase();
  const baseName = fileName.replace(/\.exe$/i, '').toLowerCase();

  let score = 100;
  const reasons: string[] = [];

  for (const pattern of NEGATIVE_PATTERNS) {
    if (pattern.regex.test(fileName)) {
      score -= pattern.penalty;
      reasons.push(`-${pattern.penalty}: ${pattern.reason}`);
    }
  }

  // Preferiamo eseguibili vicini alla radice della cartella di gioco.
  const depthPenalty = relativeDepth * 5;
  if (depthPenalty > 0) {
    score -= depthPenalty;
    reasons.push(`-${depthPenalty}: si trova a ${relativeDepth} livelli di profondità`);
  }

  // Bonus se il nome del file assomiglia al nome della cartella del gioco.
  if (baseName === rootFolderName || rootFolderName.includes(baseName) || baseName.includes(rootFolderName)) {
    score += 30;
    reasons.push('+30: nome simile alla cartella del gioco');
  }

  // Bonus per posizione tipica di eseguibili Unreal (Binaries/Win64) o Unity (root).
  const lowerPath = exePath.toLowerCase();
  if (lowerPath.includes(`${path.sep}binaries${path.sep}win64${path.sep}`)) {
    score += 15;
    reasons.push('+15: percorso tipico Unreal Engine (Binaries/Win64)');
  }
  if (relativeDepth === 0) {
    score += 10;
    reasons.push('+10: si trova nella cartella radice del gioco');
  }

  // Penalità per dimensione molto piccola (probabile stub/launcher minimale).
  try {
    const size = fs.statSync(exePath).size;
    if (size < 200 * 1024) {
      score -= 15;
      reasons.push('-15: file molto piccolo, probabile stub/launcher');
    } else if (size > 5 * 1024 * 1024) {
      score += 10;
      reasons.push('+10: file di dimensioni consistenti con un eseguibile di gioco');
    }
  } catch {
    // se stat fallisce, non blocchiamo lo scoring
  }

  return { path: exePath, fileName, score, reasons };
}

export interface NonSteamScanResult {
  candidates: ExeCandidate[];
  mainExe: ExeCandidate | null;
}

/** Scansiona una cartella scelta dall'utente e propone l'EXE principale (spec §6/§7). */
export function scanNonSteamFolder(rootDir: string, options: ScanOptions = {}): NonSteamScanResult {
  const exeFiles = listExeFiles(rootDir, options);
  const candidates = exeFiles
    .map((exe) => scoreExeCandidate(exe, rootDir))
    .sort((a, b) => b.score - a.score);

  return {
    candidates,
    mainExe: candidates.length > 0 ? candidates[0] : null
  };
}
