import type { AuthSession } from "../types";

export class TokenCache {
  private readonly cache = new Map<string, AuthSession>();

  constructor(private readonly ttlMs = 25 * 60 * 1000) {}

  get(country: string): AuthSession | null {
    const key = country.toLowerCase();
    const session = this.cache.get(key);
    if (!session) {
      return null;
    }

    if (Date.now() >= session.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return session;
  }

  set(country: string, session: AuthSession): void {
    this.cache.set(country.toLowerCase(), {
      ...session,
      expiresAt: session.expiresAt || Date.now() + this.ttlMs
    });
  }

  invalidate(country: string): void {
    this.cache.delete(country.toLowerCase());
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}
