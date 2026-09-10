import { describe, it, expect } from 'vitest';
import { runLaunchPlan, ProcessRunner, SpawnedProcess } from '../src/main/core/launch/launcher';
import { LaunchPlan } from '../src/main/core/model/types';

/** Runner finto: registra ogni comando "avviato" senza eseguire nulla di reale (niente processi Windows in sandbox Linux). */
function makeFakeRunner() {
  const calls: { command: string; args: string[] }[] = [];
  const waits: number[] = [];
  let nextPid = 1000;

  const runner: ProcessRunner = {
    spawn(command, args): SpawnedProcess {
      calls.push({ command, args });
      const pid = nextPid++;
      return { pid, exited: Promise.resolve(0) };
    },
    async wait(ms) {
      waits.push(ms);
    }
  };

  return { runner, calls, waits };
}

const basePlan: LaunchPlan = {
  gameId: 'doom',
  prelaunch: [],
  game: { exePath: 'C:/Games/DOOM/DOOM.exe', workingDirectory: 'C:/Games/DOOM', args: [], env: {} },
  injector: null,
  postlaunch: [],
  monitorProcess: true
};

describe('runLaunchPlan (spec §22 "Avvia in VR")', () => {
  it('avvia semplicemente il gioco quando non ci sono prelaunch/injector/postlaunch', async () => {
    const { runner, calls } = makeFakeRunner();
    const report = await runLaunchPlan(basePlan, runner);

    expect(report.success).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].command).toBe('C:/Games/DOOM/DOOM.exe');
    expect(report.steps.map((s) => s.step)).toEqual(['launch_game']);
  });

  it('esegue prelaunch, poi il gioco, poi postlaunch, nell\'ordine giusto', async () => {
    const { runner, calls } = makeFakeRunner();
    const plan: LaunchPlan = {
      ...basePlan,
      prelaunch: ['set_openxr_runtime.bat'],
      postlaunch: ['notify_done.bat']
    };
    const report = await runLaunchPlan(plan, runner);

    expect(report.success).toBe(true);
    expect(calls.map((c) => c.command)).toEqual([
      'set_openxr_runtime.bat',
      'C:/Games/DOOM/DOOM.exe',
      'notify_done.bat'
    ]);
    expect(report.steps.map((s) => s.step)).toEqual(['prelaunch', 'launch_game', 'postlaunch']);
  });

  it('quando c\'è un injector, attende il delay prima di registrare l\'iniezione', async () => {
    const { runner, waits } = makeFakeRunner();
    const plan: LaunchPlan = {
      ...basePlan,
      injector: { providerId: 'uevr', delayMs: 7000, processTargetName: 'DOOM.exe' }
    };
    const report = await runLaunchPlan(plan, runner);

    expect(report.success).toBe(true);
    expect(waits).toEqual([7000]);
    expect(report.steps.map((s) => s.step)).toEqual(['launch_game', 'wait_before_injection', 'inject']);
    expect(report.steps.find((s) => s.step === 'inject')?.detail).toContain('uevr');
  });

  it('se lo spawn del gioco lancia un errore, il report riporta il fallimento senza far crashare il processo main', async () => {
    const runner: ProcessRunner = {
      spawn() {
        throw new Error('ENOENT: eseguibile non trovato');
      },
      async wait() {}
    };
    const report = await runLaunchPlan(basePlan, runner);
    expect(report.success).toBe(false);
    expect(report.error).toContain('ENOENT');
  });
});
