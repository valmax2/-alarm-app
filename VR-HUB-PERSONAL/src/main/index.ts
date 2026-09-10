import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { createAppServices } from './core/appServices';
import { registerIpcHandlers } from './ipc';

let mainWindow: BrowserWindow | null = null;

/** Percorso Steam predefinito su Windows: solo un suggerimento, mai imposto (spec §47, modificabile nelle Impostazioni). */
const DEFAULT_WINDOWS_STEAM_PATH = 'C:\\Program Files (x86)\\Steam';

function createWindow(resourcesDir: string): void {
  const userDataDir = app.getPath('userData');
  const services = createAppServices(userDataDir, resourcesDir);

  if (services.settings.steamPath === null && process.platform === 'win32') {
    services.settingsStore.update({ steamPath: DEFAULT_WINDOWS_STEAM_PATH });
  }

  registerIpcHandlers(services, () => mainWindow);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#12121a',
    title: 'VR HUB PERSONAL',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  services.logger.info('VR HUB PERSONAL avviato', { platform: process.platform, userDataDir });
}

app.whenReady().then(() => {
  // `app.getAppPath()` punta alla root del progetto in sviluppo e dentro l'app
  // (anche se in app.asar, che Node/Electron leggono in modo trasparente) in
  // produzione: stesso codice funziona in entrambi i casi (vedi package.json "files").
  const resourcesDir = app.getAppPath();
  createWindow(resourcesDir);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(resourcesDir);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
