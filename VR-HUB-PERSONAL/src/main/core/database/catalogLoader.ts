import * as fs from 'fs';
import { GameProfile } from '../model/types';

export interface CatalogEntry {
  gameId: string;
  title: string;
  aliases: string[];
  steamAppId?: string;
  exeNameHints: string[];
  profile: GameProfile;
}

export interface Catalog {
  schema: number;
  databaseVersion: string;
  entries: CatalogEntry[];
}

export function loadCatalog(catalogPath: string): Catalog {
  if (!fs.existsSync(catalogPath)) {
    return { schema: 1, databaseVersion: '0.0.0', entries: [] };
  }
  const raw = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  return {
    schema: raw.schema ?? 1,
    databaseVersion: raw.databaseVersion ?? '0.0.0',
    entries: Array.isArray(raw.entries) ? raw.entries : []
  };
}

export interface MatchResult {
  entry: CatalogEntry;
  confidence: 'confirmed' | 'probable';
  reason: string;
}

/**
 * Matching gioco <-> catalogo (spec §51): combina Steam App ID, titolo, alias ed
 * EXE. L'App ID è l'unico segnale che consideriamo "confirmed" da solo; tutto il
 * resto resta "probable" (l'utente dovrà confermare in UI, spec §51: "CONFERMA GIOCO").
 */
export function matchGameToCatalog(
  catalog: Catalog,
  input: { title: string; steamAppId?: string | null; exeFileName?: string | null }
): MatchResult | null {
  if (input.steamAppId) {
    const byAppId = catalog.entries.find((e) => e.steamAppId === input.steamAppId);
    if (byAppId) {
      return { entry: byAppId, confidence: 'confirmed', reason: `Steam App ID ${input.steamAppId}` };
    }
  }

  const normalizedTitle = normalize(input.title);
  const byTitle = catalog.entries.find(
    (e) => normalize(e.title) === normalizedTitle || e.aliases.some((a) => normalize(a) === normalizedTitle)
  );
  if (byTitle) {
    return { entry: byTitle, confidence: 'probable', reason: `titolo/alias corrispondente a "${byTitle.title}"` };
  }

  if (input.exeFileName) {
    const normalizedExe = normalize(input.exeFileName.replace(/\.exe$/i, ''));
    const byExe = catalog.entries.find((e) => e.exeNameHints.some((hint) => normalize(hint) === normalizedExe));
    if (byExe) {
      return { entry: byExe, confidence: 'probable', reason: `nome eseguibile corrispondente a "${byExe.title}"` };
    }
  }

  return null;
}

// Rimuove i segni diacritici (accenti) dopo la normalizzazione Unicode NFKD:
// il range ̀-ͯ copre i "combining diacritical marks" (es. l'accento
// separato dalla lettera base dopo normalize('NFKD')).
const COMBINING_MARKS_REGEX = /[̀-ͯ]/g;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(COMBINING_MARKS_REGEX, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
