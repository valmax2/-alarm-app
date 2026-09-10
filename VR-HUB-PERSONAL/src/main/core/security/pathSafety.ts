import * as path from 'path';

/**
 * Protezione path traversal / "zip slip": verifica che `targetPath` resti
 * effettivamente dentro `baseDir` una volta risolti tutti i `..` e i link relativi.
 *
 * Usato prima di:
 *  - estrarre un archivio scaricato (ogni entry dello zip);
 *  - scrivere un file di backup o di installazione mod;
 *  - copiare file su richiesta di un provider VR.
 */
export function isPathInside(baseDir: string, targetPath: string): boolean {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(baseDir, targetPath);
  const relative = path.relative(resolvedBase, resolvedTarget);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

/**
 * Come `isPathInside`, ma lancia un errore descrittivo invece di restituire booleano.
 * Da usare in ogni punto in cui scriviamo/estraiamo file derivati da input esterno
 * (nome entry di uno zip, path dichiarato in un manifest remoto, ecc.).
 */
export function assertPathInside(baseDir: string, targetPath: string, context: string): string {
  if (!isPathInside(baseDir, targetPath)) {
    throw new Error(
      `Percorso non sicuro rifiutato (${context}): "${targetPath}" uscirebbe dalla cartella consentita "${baseDir}".`
    );
  }
  return path.resolve(baseDir, targetPath);
}

/**
 * Normalizza un nome file/cartella rimuovendo componenti pericolosi (".."), utile
 * quando costruiamo un path a partire da un titolo di gioco o da un id arbitrario.
 */
export function sanitizeFileSegment(segment: string): string {
  return segment
    .replace(/[/\\]/g, '_')
    .replace(/\.\./g, '_')
    .replace(/[:*?"<>|]/g, '_')
    .trim();
}
