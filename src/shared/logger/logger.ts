/**
 * Logger service for file and console output.
 */

import * as fs from 'fs';
import * as path from 'path';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

/**
 * Logger interface for dependency injection.
 */
export interface ILogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: unknown): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

/**
 * File and console logger.
 */
export class Logger implements ILogger {
  private logFile: string;
  private logLevel: LogLevel;
  private silent: boolean;

  constructor(logLevel: LogLevel = 'info', silent: boolean = false) {
    // Use logs directory relative to project root
    this.logFile = path.join(process.cwd(), 'logs', 'app.log');
    this.logLevel = logLevel;
    this.silent = silent;
    this.ensureLogDirectory();
  }

  /**
   * Ensures the logs directory exists.
   */
  private ensureLogDirectory(): void {
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  /**
   * Logs an info message.
   */
  info(message: string, meta?: Record<string, unknown>): void {
    this.write('info', message, meta);
  }

  /**
   * Logs a warning message.
   */
  warn(message: string, meta?: Record<string, unknown>): void {
    this.write('warn', message, meta);
  }

  /**
   * Logs an error message.
   */
  error(message: string, error?: unknown): void {
    this.write('error', message, error);
  }

  /**
   * Logs a debug message.
   */
  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.logLevel === 'debug') {
      this.write('debug', message, meta);
    }
  }

  /**
   * Formats an error for logging.
   */
  formatError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  /**
   * Writes a log entry to file and console.
   */
  private write(level: LogLevel, message: string, meta?: unknown): void {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    const fullLog = meta ? `${logLine} ${JSON.stringify(meta)}\n` : `${logLine}\n`;

    // Write to file
    fs.appendFileSync(this.logFile, fullLog);

    // Write to console only if not silent
    if (!this.silent) {
      switch (level) {
        case 'error':
          console.error(logLine, meta || '');
          break;
        case 'warn':
          console.warn(logLine, meta || '');
          break;
        default:
          console.log(logLine, meta || '');
      }
    }
  }
}
