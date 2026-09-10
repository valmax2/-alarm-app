import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { sha256Of, sha256OfFile, verifySha256 } from '../src/main/core/security/hash';

describe('hash (verifica integrità download, spec §19/§38)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrhub-hash-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('sha256Of è deterministico per la stessa stringa', () => {
    expect(sha256Of('ciao')).toBe(sha256Of('ciao'));
    expect(sha256Of('ciao')).not.toBe(sha256Of('mondo'));
  });

  it('sha256OfFile calcola correttamente l\'hash di un file su disco', async () => {
    const filePath = path.join(tmpDir, 'data.bin');
    fs.writeFileSync(filePath, 'contenuto di test per hash');
    const hash = await sha256OfFile(filePath);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(sha256Of('contenuto di test per hash'));
  });

  it('verifySha256 confronta ignorando maiuscole/minuscole', () => {
    const hash = sha256Of('x');
    expect(verifySha256(hash, hash.toUpperCase())).toBe(true);
    expect(verifySha256(hash, 'deadbeef')).toBe(false);
  });
});
