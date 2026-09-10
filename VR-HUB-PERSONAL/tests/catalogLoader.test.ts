import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { loadCatalog, matchGameToCatalog } from '../src/main/core/database/catalogLoader';

const catalogPath = path.join(__dirname, '..', 'database', 'catalog.json');

describe('catalogLoader (catalogo reale spedito con l\'app)', () => {
  it('carica il catalogo seed senza errori e con almeno i titoli previsti dalla specifica (§77)', () => {
    const catalog = loadCatalog(catalogPath);
    expect(catalog.entries.length).toBeGreaterThanOrEqual(4);
    const titles = catalog.entries.map((e) => e.title);
    expect(titles).toContain('BioShock 2');
    expect(titles).toContain('Quake');
    expect(titles).toContain('Quake II');
    expect(titles).toContain('DOOM');
  });

  it('trova una corrispondenza confirmed tramite Steam App ID', () => {
    const catalog = loadCatalog(catalogPath);
    const doomEntry = catalog.entries.find((e) => e.title === 'DOOM')!;
    const match = matchGameToCatalog(catalog, { title: 'qualcosa di diverso', steamAppId: doomEntry.steamAppId });
    expect(match?.confidence).toBe('confirmed');
    expect(match?.entry.gameId).toBe(doomEntry.gameId);
  });

  it('trova una corrispondenza probable tramite titolo/alias quando manca lo Steam App ID', () => {
    const catalog = loadCatalog(catalogPath);
    const match = matchGameToCatalog(catalog, { title: 'Quake 2' }); // alias comune
    expect(match?.confidence).toBe('probable');
    expect(match?.entry.title).toBe('Quake II');
  });

  it('restituisce null se nessun segnale corrisponde', () => {
    const catalog = loadCatalog(catalogPath);
    const match = matchGameToCatalog(catalog, { title: 'Gioco Totalmente Sconosciuto XYZ' });
    expect(match).toBeNull();
  });
});
