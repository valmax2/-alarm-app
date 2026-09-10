import { contextBridge, ipcRenderer } from 'electron';

/**
 * API sicura esposta al renderer (contextIsolation attivo, nessun accesso
 * diretto a Node/Electron dalla pagina). Ogni funzione qui corrisponde a un
 * canale IPC gestito in `src/main/ipc.ts`.
 */
contextBridge.exposeInMainWorld('vrhub', {
  listGames: () => ipcRenderer.invoke('library:list'),
  scanSteam: () => ipcRenderer.invoke('library:scanSteam'),
  pickFolder: () => ipcRenderer.invoke('dialog:pickFolder'),
  addNonSteamGame: (folderPath: string) => ipcRenderer.invoke('library:addNonSteam', folderPath),
  removeGame: (gameId: string) => ipcRenderer.invoke('library:removeGame', gameId),
  getProfile: (gameId: string) => ipcRenderer.invoke('library:profile', gameId),
  planInstall: (gameId: string) => ipcRenderer.invoke('library:planInstall', gameId),
  configureVr: (gameId: string) => ipcRenderer.invoke('library:configureVr', gameId),
  validate: (gameId: string) => ipcRenderer.invoke('library:validate', gameId),
  restoreGame: (gameId: string) => ipcRenderer.invoke('library:restoreGame', gameId),
  launch: (gameId: string) => ipcRenderer.invoke('library:launch', gameId),
  catalogInfo: () => ipcRenderer.invoke('catalog:info'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (partial: Record<string, unknown>) => ipcRenderer.invoke('settings:update', partial),
  readDiagnostics: (gameId?: string) => ipcRenderer.invoke('diagnostics:read', gameId)
});
