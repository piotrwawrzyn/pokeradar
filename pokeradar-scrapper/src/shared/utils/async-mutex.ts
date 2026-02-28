/**
 * Simple async mutex for serializing concurrent async operations.
 * Used to protect shared notification flush from parallel shop workers.
 */
export class AsyncMutex {
  private locked = false;
  private waitQueue: (() => void)[] = [];

  private acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  private release(): void {
    const next = this.waitQueue.shift();
    if (next) {
      next();
    } else {
      this.locked = false;
    }
  }

  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}
