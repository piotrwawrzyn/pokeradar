/**
 * Buffer for scan results with batch write capability.
 */

import { ProductResult } from '../../shared/types';

/**
 * Repository interface for product results.
 */
export interface IProductResultRepository {
  upsertHourlyBatch(results: ProductResult[]): Promise<void>;
}

/**
 * Logger interface for buffer operations.
 */
interface ILogger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Manages buffering of scan results for batch database writes.
 */
export class ResultBuffer {
  private buffer: ProductResult[] = [];

  constructor(
    private repository?: IProductResultRepository,
    private logger?: ILogger,
  ) {}

  /**
   * Adds a result to the buffer.
   */
  add(result: ProductResult): void {
    this.buffer.push(result);
  }

  /**
   * Gets the current buffer size.
   */
  size(): number {
    return this.buffer.length;
  }

  /**
   * Flushes all buffered results to the database.
   */
  async flush(): Promise<void> {
    const count = this.buffer.length;

    if (!this.repository || count === 0) {
      this.buffer = [];
      return;
    }

    try {
      await this.repository.upsertHourlyBatch(this.buffer);
      this.logger?.info('Flushed scan results to database', { count });
    } catch (error) {
      this.logger?.error('Failed to flush scan results', {
        count,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    this.buffer = [];
  }

  /**
   * Clears the buffer without writing to database.
   */
  clear(): void {
    this.buffer = [];
  }
}
