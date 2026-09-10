import * as fs from 'fs';
import * as path from 'path';
import { InstallManifestEntry } from '../model/types';
import { assertPathInside, sanitizeFileSegment } from '../security/pathSafety';

/**
 * Backup manager (spec §35): prima di modificare un file di un gioco, ne salva
 * una copia. "Ripristina gioco" (spec §37/§35) usa queste copie per tornare
 * allo stato originale, senza toccare i salvataggi dell'utente (che non sono
 * mai in queste cartelle: solo i file che la nostra app stessa modifica).
 */

/**
 * Se `targetPath` esiste, lo copia dentro `backupDir/<gameId>/` con un nome
 * univoco (basato su timestamp) e restituisce il percorso del backup.
 * Se `targetPath` non esiste ancora, non c'è nulla da backuppare: restituisce
 * `null` (il chiamante registrerà l'entry come "added", non "modified").
 */
export function backupFileIfExists(targetPath: string, backupDir: string, gameId: string): string | null {
  if (!fs.existsSync(targetPath)) return null;

  const gameBackupDir = path.join(backupDir, sanitizeFileSegment(gameId));
  fs.mkdirSync(gameBackupDir, { recursive: true });

  const fileName = `${sanitizeFileSegment(path.basename(targetPath))}.${Date.now()}.bak`;
  const backupPath = assertPathInside(backupDir, path.relative(backupDir, path.join(gameBackupDir, fileName)), 'backupFileIfExists');

  fs.copyFileSync(targetPath, backupPath);
  return backupPath;
}

/** Ripristina un singolo file a partire da una entry di manifest (spec §36/§37). */
export function restoreFromEntry(entry: InstallManifestEntry): { action: 'restored' | 'deleted' | 'noop' } {
  if (entry.type === 'added') {
    // Il file non esisteva prima della nostra installazione: rimuoverlo lo ripristina.
    if (fs.existsSync(entry.targetPath)) {
      fs.rmSync(entry.targetPath);
      return { action: 'deleted' };
    }
    return { action: 'noop' };
  }

  // 'modified' o 'replaced': copiamo indietro il backup.
  if (!entry.backupPath || !fs.existsSync(entry.backupPath)) {
    throw new Error(`Backup mancante per ripristinare "${entry.targetPath}" (atteso in "${entry.backupPath}").`);
  }
  fs.mkdirSync(path.dirname(entry.targetPath), { recursive: true });
  fs.copyFileSync(entry.backupPath, entry.targetPath);
  return { action: 'restored' };
}
