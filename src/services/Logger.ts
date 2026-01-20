import * as fs from 'fs';
import * as path from 'path';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export class Logger {
  private logFile: string;
  private logLevel: LogLevel;

  constructor(logLevel: LogLevel = 'info') {
    this.logFile = path.join(__dirname, '../../logs/app.log');
    this.logLevel = logLevel;
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
  info(message: string, meta?: any): void {
    this.write('info', message, meta);
  }

  /**
   * Logs a warning message.
   */
  warn(message: string, meta?: any): void {
    this.write('warn', message, meta);
  }

  /**
   * Logs an error message.
   */
  error(message: string, error?: any): void {
    this.write('error', message, error);
  }

  /**
   * Logs a debug message.
   */
  debug(message: string, meta?: any): void {
    if (this.logLevel === 'debug') {
      this.write('debug', message, meta);
    }
  }

  /**
   * Writes a log entry to file and console.
   */
  private write(level: LogLevel, message: string, meta?: any): void {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    const fullLog = meta
      ? `${logLine} ${JSON.stringify(meta)}\n`
      : `${logLine}\n`;

    // Write to file
    fs.appendFileSync(this.logFile, fullLog);

    // Write to console with appropriate method
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
