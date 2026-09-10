import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { detectEngine } from '../src/main/core/nonsteam/engineDetector';

function touch(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, 'x');
}

describe('detectEngine', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vrhub-engine-'));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('rileva Unreal Engine 5 da un file .uproject', () => {
    touch(path.join(tmpRoot, 'MyGame.uproject'));
    touch(path.join(tmpRoot, 'Engine', 'Binaries', 'Win64', 'MyGame-Win64-Shipping.exe'));

    const result = detectEngine(tmpRoot);
    expect(result.engine).toBe('UnrealEngine5');
    expect(result.confidence).toBe('confirmed');
    expect(result.signals.length).toBeGreaterThan(0);
  });

  it('rileva Unity da UnityPlayer.dll e Assembly-CSharp.dll', () => {
    touch(path.join(tmpRoot, 'UnityPlayer.dll'));
    touch(path.join(tmpRoot, 'MyGame_Data', 'Managed', 'Assembly-CSharp.dll'));

    const result = detectEngine(tmpRoot);
    expect(result.engine).toBe('Unity');
    expect(result.confidence).toBe('confirmed');
  });

  it('rileva id Tech da file .pk3 (Quake III family)', () => {
    touch(path.join(tmpRoot, 'baseq3', 'pak0.pk3'));

    const result = detectEngine(tmpRoot);
    expect(result.engine).toBe('idTech');
  });

  it('rileva RE Engine da re_chunk_000.pak', () => {
    touch(path.join(tmpRoot, 're_chunk_000.pak'));

    const result = detectEngine(tmpRoot);
    expect(result.engine).toBe('REEngine');
    expect(result.confidence).toBe('confirmed');
  });

  it('restituisce Unknown se non trova nessun segnale', () => {
    touch(path.join(tmpRoot, 'readme.txt'));
    const result = detectEngine(tmpRoot);
    expect(result.engine).toBe('Unknown');
    expect(result.confidence).toBe('unknown');
  });

  it('non dichiara mai "confirmed" con un solo segnale debole', () => {
    touch(path.join(tmpRoot, 'Binaries', 'Win64', 'placeholder.txt'));
    const result = detectEngine(tmpRoot);
    expect(result.confidence).not.toBe('confirmed');
  });
});
