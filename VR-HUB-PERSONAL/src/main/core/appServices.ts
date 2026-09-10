import * as path from 'path';
import { LocalDatabase } from './database/localDatabase';
import { loadCatalog } from './database/catalogLoader';
import { Logger } from './diagnostics/logger';
import { SettingsStore } from './settings/settingsStore';
import { ProviderRegistry } from './providers/providerRegistry';
import { UevrProvider } from './providers/uevrProvider';

/**
 * Cablaggio dei servizi core dell'app, indipendente da Electron: preso `userDataDir`
 * (in Electron sarà `app.getPath('userData')`), costruisce tutto ciò che serve
 * a `ipc.ts`. Separato per poter essere istanziato anche nei test se necessario.
 */
export function createAppServices(userDataDir: string, resourcesDir: string) {
  const settingsStore = new SettingsStore(userDataDir);
  const settings = settingsStore.load();

  const database = new LocalDatabase(userDataDir);
  const logger = new Logger({ logsDir: path.join(userDataDir, 'logs'), minLevel: settings.debugMode ? 'DEBUG' : 'INFO' });
  const catalog = loadCatalog(path.join(resourcesDir, 'database', 'catalog.json'));

  const manifestsDir = path.join(userDataDir, 'manifests');
  const providers = new ProviderRegistry();
  providers.register(
    new UevrProvider({
      backupDir: settings.backupDir,
      manifestsDir
    })
  );

  return { settingsStore, settings, database, logger, catalog, providers, manifestsDir };
}

export type AppServices = ReturnType<typeof createAppServices>;
