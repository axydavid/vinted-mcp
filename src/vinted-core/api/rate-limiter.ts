export class RateLimiter {
  private readonly queue: Array<() => void> = [];
  private activeCount = 0;
  private lastRequestTime = 0;
  private pauseUntil = 0;

  constructor(
    private readonly maxConcurrency = 5,
    private readonly delayMs = 500,
    private readonly jitterMs = 300
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();

    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  pause(durationMs: number): void {
    const newPauseUntil = Date.now() + durationMs;
    if (newPauseUntil > this.pauseUntil) {
      this.pauseUntil = newPauseUntil;
    }
  }

  private async acquire(): Promise<void> {
    while (this.activeCount >= this.maxConcurrency) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }

    const now = Date.now();
    
    // Handle queue pause
    if (now < this.pauseUntil) {
      await new Promise((resolve) => setTimeout(resolve, this.pauseUntil - now));
    }

    const currentNow = Date.now();
    const elapsed = currentNow - this.lastRequestTime;
    const currentJitter = Math.floor(Math.random() * this.jitterMs);
    const targetDelay = this.delayMs + currentJitter;

    if (elapsed < targetDelay) {
      await new Promise((resolve) => setTimeout(resolve, targetDelay - elapsed));
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
