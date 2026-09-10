import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { isPathInside, assertPathInside, sanitizeFileSegment } from '../src/main/core/security/pathSafety';

describe('pathSafety (protezione path traversal / "zip slip", spec §38/§96)', () => {
  const base = '/data/vrhub/downloads/game1';

  it('accetta un percorso relativo normale dentro la base', () => {
    expect(isPathInside(base, 'config/settings.json')).toBe(true);
  });

  it('accetta la base stessa', () => {
    expect(isPathInside(base, '.')).toBe(true);
  });

  it('rifiuta un tentativo di path traversal con ..', () => {
    expect(isPathInside(base, '../../etc/passwd')).toBe(false);
  });

  it('rifiuta un tentativo di path traversal annidato in sottocartelle', () => {
    expect(isPathInside(base, 'assets/../../../outside.txt')).toBe(false);
  });

  it('rifiuta un percorso assoluto che punta fuori dalla base', () => {
    expect(isPathInside(base, '/etc/passwd')).toBe(false);
  });

  it('assertPathInside lancia un errore descrittivo per percorsi non sicuri', () => {
    expect(() => assertPathInside(base, '../../evil.dll', 'estrazione zip mod')).toThrow(/non sicuro/);
  });

  it('assertPathInside restituisce il path assoluto risolto quando è sicuro', () => {
    const resolved = assertPathInside(base, 'config/settings.json', 'test');
    expect(resolved).toBe(path.resolve(base, 'config/settings.json'));
  });

  it('sanitizeFileSegment rimuove separatori di percorso e ".." da un nome arbitrario', () => {
    const sanitized = sanitizeFileSegment('../../evil');
    expect(sanitized).not.toContain('..');
    expect(sanitized).not.toContain('/');
    expect(sanitized.endsWith('evil')).toBe(true);
    expect(sanitizeFileSegment('Game: Special <Edition>?')).not.toMatch(/[:<>?]/);
    expect(sanitizeFileSegment('normale')).toBe('normale');
  });
});
