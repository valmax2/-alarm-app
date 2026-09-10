import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseVdf, getRootNode } from '../src/main/core/steam/vdf';

const fixturesDir = path.join(__dirname, 'fixtures');

describe('parseVdf', () => {
  it('parsa libraryfolders.vdf ed estrae il path della libreria', () => {
    const content = fs.readFileSync(path.join(fixturesDir, 'libraryfolders.vdf'), 'utf8');
    const parsed = parseVdf(content);
    const root = getRootNode(parsed, 'libraryfolders');
    expect(root).not.toBeNull();
    const entry0 = root!['0'];
    expect(typeof entry0).not.toBe('string');
    expect((entry0 as any).path).toBe('/tmp/fake_steam_root');
    expect((entry0 as any).apps['620']).toBe('6417000');
  });

  it('parsa appmanifest_*.acf ed estrae appid/name/installdir', () => {
    const content = fs.readFileSync(path.join(fixturesDir, 'steamapps', 'appmanifest_620.acf'), 'utf8');
    const parsed = parseVdf(content);
    const appState = getRootNode(parsed, 'appstate');
    expect(appState).not.toBeNull();
    expect(appState!['appid']).toBe('620');
    expect(appState!['name']).toBe('Portal 2');
    expect(appState!['installdir']).toBe('Portal 2');
    expect(appState!['StateFlags'.toLowerCase()] ?? appState!['StateFlags']).toBeDefined();
  });

  it('gestisce virgolette annidate/escape senza andare in loop infinito', () => {
    const content = '"root"\n{\n  "key"  "value with \\"quotes\\" inside"\n}\n';
    const parsed = parseVdf(content);
    const root = getRootNode(parsed, 'root');
    expect(root!['key']).toBe('value with "quotes" inside');
  });

  it('gestisce nodi vuoti e commenti', () => {
    const content = '// commento\n"root"\n{\n  "empty"\n  {\n  }\n}\n';
    const parsed = parseVdf(content);
    const root = getRootNode(parsed, 'root');
    expect(root!['empty']).toEqual({});
  });
});
