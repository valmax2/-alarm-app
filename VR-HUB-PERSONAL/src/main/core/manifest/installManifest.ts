import * as fs from 'fs';
import * as path from 'path';
import { InstallManifest, InstallManifestEntry, ProviderId, VrProfileSource } from '../model/types';
import { restoreFromEntry } from '../backup/backupManager';
import { sanitizeFileSegment } from '../security/pathSafety';

/** Crea un nuovo manifest di installazione (spec §36), inizialmente senza entry. */
export function createManifest(
  gameId: string,
  providerId: ProviderId,
  version: string,
  source: VrProfileSource | null
): InstallManifest {
  return {
    gameId,
    providerId,
    version,
    timestamp: new Date().toISOString(),
    source,
    entries: []
  };
}

export function withEntry(manifest: InstallManifest, entry: InstallManifestEntry): InstallManifest {
  return { ...manifest, entries: [...manifest.entries, entry] };
}

function manifestPath(manifestsDir: string, gameId: string): string {
  return path.join(manifestsDir, `${sanitizeFileSegment(gameId)}.manifest.json`);
}

export function saveManifest(manifestsDir: string, manifest: InstallManifest): void {
  fs.mkdirSync(manifestsDir, { recursive: true });
  const filePath = manifestPath(manifestsDir, manifest.gameId);
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(manifest, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

export function loadManifest(manifestsDir: string, gameId: string): InstallManifest | null {
  const filePath = manifestPath(manifestsDir, gameId);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as InstallManifest;
  } catch {
    return null;
  }
}

export function deleteManifest(manifestsDir: string, gameId: string): void {
  const filePath = manifestPath(manifestsDir, gameId);
  if (fs.existsSync(filePath)) fs.rmSync(filePath);
}

export interface RestoreReport {
  restoredEntries: number;
  deletedEntries: number;
  errors: string[];
}

/**
 * "Ripristina gioco" (spec §35/§37): applica il rollback di tutte le entry del
 * manifest, in ordine inverso rispetto all'installazione, e poi elimina il manifest
 * (il gioco torna nello stato "non configurato").
 */
export function restoreManifest(manifest: InstallManifest): RestoreReport {
  const report: RestoreReport = { restoredEntries: 0, deletedEntries: 0, errors: [] };

  for (const entry of [...manifest.entries].reverse()) {
    try {
      const result = restoreFromEntry(entry);
      if (result.action === 'restored') report.restoredEntries++;
      if (result.action === 'deleted') report.deletedEntries++;
    } catch (err) {
      report.errors.push(`${entry.targetPath}: ${String(err)}`);
    }
  }

  return report;
}
