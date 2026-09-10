import * as fs from 'fs';
import * as path from 'path';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';

const LEVEL_ORDER: Record<LogLevel, number> = { DEBUG: 0, INFO: 1, WARNING: 2, ERROR: 3 };

export interface LoggerOptions {
  /** Cartella dove scrivere i file di log (spec §62: log rotanti). */
  logsDir: string;
  /** Livello minimo che arriva effettivamente su file (default INFO). */
  minLevel?: LogLevel;
  /** Dimensione massima di un singolo file di log prima di ruotare (default 2MB). */
  maxFileSizeBytes?: number;
  /** Numero massimo di file storici da conservare (default 5). */
  maxFiles?: number;
}

/**
 * Logger rotante (spec §62/§33). Non registra mai dati privati inutili: chi
 * chiama il logger è responsabile di non passare percorsi/segreti superflui
 * nel messaggio.
 */
export class Logger {
  private readonly logsDir: string;
  private readonly minLevel: LogLevel;
  private readonly maxFileSizeBytes: number;
  private readonly maxFiles: number;
  private readonly currentFile: string;

  constructor(options: LoggerOptions) {
    this.logsDir = options.logsDir;
    this.minLevel = options.minLevel ?? 'INFO';
    this.maxFileSizeBytes = options.maxFileSizeBytes ?? 2 * 1024 * 1024;
    this.maxFiles = options.maxFiles ?? 5;
    fs.mkdirSync(this.logsDir, { recursive: true });
    this.currentFile = path.join(this.logsDir, 'vrhub.log');
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.write('DEBUG', message, context);
  }
  info(message: string, context?: Record<string, unknown>): void {
    this.write('INFO', message, context);
  }
  warn(message: string, context?: Record<string, unknown>): void {
    this.write('WARNING', message, context);
  }
  error(message: string, context?: Record<string, unknown>): void {
    this.write('ERROR', message, context);
  }

  private write(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) return;

    this.rotateIfNeeded();

    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      message,
      ...(context ? { context } : {})
    });
    fs.appendFileSync(this.currentFile, line + '\n', 'utf8');
  }

  private rotateIfNeeded(): void {
    if (!fs.existsSync(this.currentFile)) return;
    const size = fs.statSync(this.currentFile).size;
    if (size < this.maxFileSizeBytes) return;

    // Rotazione semplice: vrhub.log -> vrhub.1.log -> vrhub.2.log -> ... fino a maxFiles.
    for (let i = this.maxFiles - 1; i >= 1; i--) {
      const from = this.rotatedPath(i);
      const to = this.rotatedPath(i + 1);
      if (fs.existsSync(from)) {
        if (i + 1 > this.maxFiles) {
          fs.rmSync(from);
        } else {
          fs.renameSync(from, to);
        }
      }
    }
    fs.renameSync(this.currentFile, this.rotatedPath(1));
  }

  private rotatedPath(index: number): string {
    return path.join(this.logsDir, `vrhub.${index}.log`);
  }

  /** Legge le ultime `count` righe del log corrente (per la UI "Diagnostica VR", spec §33). */
  readRecent(count = 200): string[] {
    if (!fs.existsSync(this.currentFile)) return [];
    const content = fs.readFileSync(this.currentFile, 'utf8');
    const lines = content.split('\n').filter((l) => l.length > 0);
    return lines.slice(-count);
  }
}
