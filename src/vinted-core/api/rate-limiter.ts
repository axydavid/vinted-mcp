export class RateLimiter {
  private readonly queue: Array<() => void> = [];
  private activeCount = 0;
  private lastRequestTime = 0;

  constructor(
    private readonly maxConcurrency = 5,
    private readonly delayMs = 500
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();

    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private async acquire(): Promise<void> {
    while (this.activeCount >= this.maxConcurrency) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }

    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs - elapsed));
    }

    this.activeCount += 1;
    this.lastRequestTime = Date.now();
  }

  private release(): void {
    this.activeCount -= 1;
    const next = this.queue.shift();
    if (next) {
      next();
    }
  }
}
