import { spawn } from 'child_process';
import { ProcessRunner, SpawnedProcess } from './core/launch/launcher';

/**
 * Implementazione reale di `ProcessRunner` (usata solo dal main process
 * Electron, mai importata dai test core): avvia processi veri con
 * `child_process.spawn`. Su Windows questo è ciò che avvia davvero il gioco
 * e, se previsto, l'injector.
 */
export class NodeProcessRunner implements ProcessRunner {
  spawn(command: string, args: string[], options: { cwd: string; env: Record<string, string> }): SpawnedProcess {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      detached: true,
      stdio: 'ignore'
    });

    const exited = new Promise<number>((resolve) => {
      child.on('exit', (code) => resolve(code ?? -1));
      child.on('error', () => resolve(-1));
    });

    return { pid: child.pid ?? -1, exited };
  }

  wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
