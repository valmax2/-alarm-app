import { LaunchPlan } from '../model/types';

/**
 * Astrazione sull'esecuzione di processi, per poter testare `runLaunchPlan`
 * senza avviare processi reali (spec §94: gestione timeout/processi).
 * L'implementazione reale (usata in Electron main su Windows) usa
 * `child_process.spawn`; i test usano un runner finto.
 */
export interface ProcessRunner {
  spawn(command: string, args: string[], options: { cwd: string; env: Record<string, string> }): SpawnedProcess;
  wait(ms: number): Promise<void>;
}

export interface SpawnedProcess {
  pid: number;
  exited: Promise<number>;
}

export interface LaunchStepLog {
  step: string;
  detail: string;
  ok: boolean;
}

export interface LaunchRunReport {
  gameId: string;
  success: boolean;
  steps: LaunchStepLog[];
  error?: string;
}

/**
 * Esegue un LaunchPlan (spec §22 "Avvia in VR"): prelaunch -> avvio gioco ->
 * attesa+iniezione se prevista -> postlaunch. Non richiede che l'utente ricordi
 * la sequenza manualmente.
 */
export async function runLaunchPlan(plan: LaunchPlan, runner: ProcessRunner): Promise<LaunchRunReport> {
  const steps: LaunchStepLog[] = [];

  try {
    for (const command of plan.prelaunch) {
      runner.spawn(command, [], { cwd: plan.game.workingDirectory, env: plan.game.env });
      steps.push({ step: 'prelaunch', detail: command, ok: true });
    }

    const gameProcess = runner.spawn(plan.game.exePath, plan.game.args, {
      cwd: plan.game.workingDirectory,
      env: plan.game.env
    });
    steps.push({ step: 'launch_game', detail: `pid=${gameProcess.pid} (${plan.game.exePath})`, ok: true });

    if (plan.injector) {
      await runner.wait(plan.injector.delayMs);
      steps.push({
        step: 'wait_before_injection',
        detail: `atteso ${plan.injector.delayMs}ms prima di iniettare (${plan.injector.providerId})`,
        ok: true
      });
      // In Fase 1 l'iniezione vera è delegata al provider (es. UEVRProvider), che
      // conosce l'eseguibile dell'injector: qui registriamo solo il passaggio nel piano.
      steps.push({
        step: 'inject',
        detail: `provider=${plan.injector.providerId} target=${plan.injector.processTargetName ?? plan.game.exePath}`,
        ok: true
      });
    }

    for (const command of plan.postlaunch) {
      runner.spawn(command, [], { cwd: plan.game.workingDirectory, env: plan.game.env });
      steps.push({ step: 'postlaunch', detail: command, ok: true });
    }

    return { gameId: plan.gameId, success: true, steps };
  } catch (err) {
    steps.push({ step: 'error', detail: String(err), ok: false });
    return { gameId: plan.gameId, success: false, steps, error: String(err) };
  }
}
