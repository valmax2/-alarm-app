import * as fs from 'fs';
import * as path from 'path';

export interface AppSettings {
  steamPath: string | null;
  extraLibraryPaths: string[];
  cacheDir: string;
  backupDir: string;
  preferredRuntime: 'openxr' | 'openvr';
  questMethod: 'quest_link' | 'air_link' | 'virtual_desktop';
  autoUpdateDatabase: boolean;
  autoUpdateMods: boolean;
  downloadDir: string;
  language: 'it' | 'en';
  debugMode: boolean;
}

export function defaultSettings(userDataDir: string): AppSettings {
  return {
    steamPath: null,
    extraLibraryPaths: [],
    cacheDir: path.join(userDataDir, 'cache'),
    backupDir: path.join(userDataDir, 'backups'),
    preferredRuntime: 'openxr',
    questMethod: 'quest_link',
    autoUpdateDatabase: true,
    autoUpdateMods: false,
    downloadDir: path.join(userDataDir, 'downloads'),
    language: 'it',
    debugMode: false
  };
}

/** Impostazioni app (spec §47), persistite in un singolo JSON. */
export class SettingsStore {
  private readonly filePath: string;

  constructor(private readonly userDataDir: string) {
    fs.mkdirSync(userDataDir, { recursive: true });
    this.filePath = path.join(userDataDir, 'settings.json');
  }

  load(): AppSettings {
    if (!fs.existsSync(this.filePath)) {
      return defaultSettings(this.userDataDir);
    }
    try {
      const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      return { ...defaultSettings(this.userDataDir), ...raw };
    } catch {
      return defaultSettings(this.userDataDir);
    }
  }

  save(settings: AppSettings): void {
    const tmpPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(settings, null, 2), 'utf8');
    fs.renameSync(tmpPath, this.filePath);
  }

  update(partial: Partial<AppSettings>): AppSettings {
    const merged = { ...this.load(), ...partial };
    this.save(merged);
    return merged;
  }
}
