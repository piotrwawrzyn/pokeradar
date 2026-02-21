import * as fs from 'fs';
import * as path from 'path';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface ILogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: unknown): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

export class Logger implements ILogger {
  private logFile: string;
  private logLevel: LogLevel;
  private silent: boolean;

  constructor(
    logFileName: string = 'app.log',
    logLevel: LogLevel = 'info',
    silent: boolean = false,
  ) {
    this.logFile = path.join(process.cwd(), 'logs', logFileName);
    this.logLevel = logLevel;
    this.silent = silent;
    this.ensureLogDirectory();
  }

  private ensureLogDirectory(): void {
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.write('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.write('warn', message, meta);
  }

  error(message: string, error?: unknown): void {
    this.write('error', message, error);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.logLevel === 'debug') {
      this.write('debug', message, meta);
    }
  }

  formatError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private write(level: LogLevel, message: string, meta?: unknown): void {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    const fullLog = meta ? `${logLine} ${JSON.stringify(meta)}\n` : `${logLine}\n`;

    fs.appendFileSync(this.logFile, fullLog);

    if (!this.silent) {
      const output = meta ? `${logLine} ${JSON.stringify(meta)}` : logLine;
      switch (level) {
        case 'error':
          console.error(output);
          break;
        case 'warn':
          console.warn(output);
          break;
        default:
          console.log(output);
      }
    }
  }
}
