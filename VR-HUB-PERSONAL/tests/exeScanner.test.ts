import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { listExeFiles, scoreExeCandidate, scanNonSteamFolder } from '../src/main/core/nonsteam/exeScanner';

function writeFile(filePath: string, sizeBytes = 10 * 1024 * 1024) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, Buffer.alloc(sizeBytes, 1));
}

describe('exeScanner', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vrhub-nonsteam-'));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('trova tutti i file .exe ricorsivamente', () => {
    writeFile(path.join(tmpRoot, 'Game.exe'));
    writeFile(path.join(tmpRoot, 'Engine', 'Binaries', 'Win64', 'Game-Win64-Shipping.exe'));
    writeFile(path.join(tmpRoot, 'notes.txt'), 10);

    const files = listExeFiles(tmpRoot);
    expect(files).toHaveLength(2);
  });

  it('ignora le cartelle _CommonRedist e simili', () => {
    writeFile(path.join(tmpRoot, 'Game.exe'));
    writeFile(path.join(tmpRoot, '_CommonRedist', 'vcredist', 'vcredist_x64.exe'));

    const files = listExeFiles(tmpRoot);
    expect(files).toHaveLength(1);
    expect(files[0]).toContain('Game.exe');
  });

  it('penalizza fortemente crash reporter, uninstaller e prerequisiti', () => {
    writeFile(path.join(tmpRoot, 'MyGame.exe'));
    const gameScore = scoreExeCandidate(path.join(tmpRoot, 'MyGame.exe'), tmpRoot);

    writeFile(path.join(tmpRoot, 'CrashReportClient.exe'));
    const crashScore = scoreExeCandidate(path.join(tmpRoot, 'CrashReportClient.exe'), tmpRoot);

    writeFile(path.join(tmpRoot, 'Unins000.exe'));
    const uninsScore = scoreExeCandidate(path.join(tmpRoot, 'Unins000.exe'), tmpRoot);

    expect(gameScore.score).toBeGreaterThan(crashScore.score);
    expect(gameScore.score).toBeGreaterThan(uninsScore.score);
  });

  it('scanNonSteamFolder NON scegie semplicemente il primo .exe: preferisce quello che assomiglia al nome del gioco', () => {
    // "primo" in ordine alfabetico/filesystem sarebbe UE4PrereqSetup
    writeFile(path.join(tmpRoot, 'UE4PrereqSetup_x64.exe'));
    writeFile(path.join(tmpRoot, 'Engine', 'Binaries', 'Win64', 'HogwartsLegacy-Win64-Shipping.exe'));
    fs.mkdirSync(path.join(tmpRoot), { recursive: true });

    // rinominiamo il rootDir "virtualmente" tramite un secondo scan con nome cartella dedicato
    const gameRoot = path.join(tmpRoot, 'HogwartsLegacy');
    writeFile(path.join(gameRoot, 'UE4PrereqSetup_x64.exe'));
    writeFile(path.join(gameRoot, 'Engine', 'Binaries', 'Win64', 'HogwartsLegacy-Win64-Shipping.exe'));

    const result = scanNonSteamFolder(gameRoot);
    expect(result.mainExe).not.toBeNull();
    expect(result.mainExe!.fileName).toBe('HogwartsLegacy-Win64-Shipping.exe');
  });

  it('con un solo eseguibile plausibile, lo propone come principale', () => {
    const gameRoot = path.join(tmpRoot, 'Doom');
    writeFile(path.join(gameRoot, 'DOOM.exe'));
    const result = scanNonSteamFolder(gameRoot);
    expect(result.mainExe?.fileName).toBe('DOOM.exe');
  });
});
