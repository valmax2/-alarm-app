import { ipcMain, dialog, BrowserWindow } from 'electron';
import { AppServices } from './core/appServices';
import { LibraryService } from './core/library/libraryService';
import { runLaunchPlan } from './core/launch/launcher';
import { NodeProcessRunner } from './nodeProcessRunner';
import { AppSettings } from './core/settings/settingsStore';

/**
 * Registra tutti i canali IPC usati dal renderer (esposti in modo sicuro tramite
 * `preload.ts` + `contextBridge`, mai `nodeIntegration` diretto).
 */
export function registerIpcHandlers(services: AppServices, getWindow: () => BrowserWindow | null): void {
  const library = new LibraryService(services);
  const runner = new NodeProcessRunner();

  ipcMain.handle('library:list', () => services.database.loadGames());

  ipcMain.handle('library:scanSteam', () => library.scanSteam());

  ipcMain.handle('dialog:pickFolder', async () => {
    const win = getWindow();
    const result = await dialog.showOpenDialog(win ?? undefined as unknown as BrowserWindow, {
      properties: ['openDirectory'],
      title: 'Scegli la cartella del gioco'
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('library:addNonSteam', (_event, folderPath: string) => library.addNonSteamGame(folderPath));

  ipcMain.handle('library:removeGame', (_event, gameId: string) => {
    library.removeGame(gameId);
    return true;
  });

  ipcMain.handle('library:profile', (_event, gameId: string) => library.resolveProfile(gameId));

  ipcMain.handle('library:planInstall', (_event, gameId: string) => library.planInstall(gameId));

  ipcMain.handle('library:configureVr', (_event, gameId: string) => library.configureVr(gameId));

  ipcMain.handle('library:validate', (_event, gameId: string) => library.validate(gameId));

  ipcMain.handle('library:restoreGame', (_event, gameId: string) => library.restoreGame(gameId));

  ipcMain.handle('library:launch', async (_event, gameId: string) => {
    const plan = library.buildLaunchPlanFor(gameId);
    if (!plan) return { success: false, gameId, steps: [], error: 'Nessun piano di lancio disponibile.' };
    services.logger.info(`Avvio in VR richiesto per "${gameId}"`);
    const report = await runLaunchPlan(plan, runner);
    if (!report.success) {
      services.logger.error(`Avvio in VR fallito per "${gameId}"`, { error: report.error });
    }
    return report;
  });

  ipcMain.handle('catalog:info', () => ({
    databaseVersion: services.catalog.databaseVersion,
    entriesCount: services.catalog.entries.length
  }));

  ipcMain.handle('settings:get', () => services.settingsStore.load());

  ipcMain.handle('settings:update', (_event, partial: Partial<AppSettings>) => services.settingsStore.update(partial));

  ipcMain.handle('diagnostics:read', (_event, gameId?: string) => {
    const logs = services.logger.readRecent();
    if (!gameId) return { logs, providerLogs: [] };
    const providerId = library.resolveProfile(gameId)?.provider ?? null;
    const provider = providerId ? services.providers.get(providerId) : null;
    const game = services.database.getGame(gameId);
    const providerLogs = provider && game ? provider.collectLogs(game) : null;
    return { logs, providerLogs };
  });
}
