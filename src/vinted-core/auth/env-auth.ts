import { TokenCache } from "./token-cache";
import type { AuthSession } from "../types";

export class EnvAuth {
  constructor(private readonly tokenCache: TokenCache = new TokenCache()) {}

  createSession(country: string): AuthSession {
    const key = country.toLowerCase();
    const cached = this.tokenCache.get(key);
    if (cached) {
      return cached;
    }

    const accessToken = process.env.VINTED_AUTH_ACCESS_TOKEN?.trim() || "";
    const csrfToken = process.env.VINTED_AUTH_CSRF_TOKEN?.trim() || "";
    const cookieValue = process.env.VINTED_AUTH_COOKIES?.trim() || "";
    const cookies = parseCookies(cookieValue);

    if (!accessToken && !csrfToken && Object.keys(cookies).length === 0) {
      throw new Error(
        "Auth mode is 'env' but no credentials were found. Set VINTED_AUTH_COOKIES, VINTED_AUTH_ACCESS_TOKEN, or VINTED_AUTH_CSRF_TOKEN."
      );
    }

    const session: AuthSession = {
      accessToken,
      csrfToken,
      cookies,
      country: key,
      expiresAt: Date.now() + 25 * 60 * 1000
    };

    this.tokenCache.set(key, session);
    return session;
  }

  invalidate(country: string): void {
    this.tokenCache.invalidate(country);
  }

  clear(): void {
    this.tokenCache.invalidateAll();
  }
}

function parseCookies(raw: string): Record<string, string> {
  if (!raw) {
    return {};
  }

  if (raw.startsWith("{")) {
    try {
      const json = JSON.parse(raw) as Record<string, unknown>;
      const out: Record<string, string> = {};
      for (const [key, value] of Object.entries(json)) {
        if (typeof value === "string") {
          out[key] = value;
        }
      }
      return out;
    } catch {
      return {};
    }
  }

  const out: Record<string, string> = {};
  for (const part of raw.split(";")) {
    const entry = part.trim();
    if (!entry) {
      continue;
    }
    const idx = entry.indexOf("=");
    if (idx <= 0) {
      continue;
    }
    const key = entry.slice(0, idx).trim();
    const value = entry.slice(idx + 1).trim();
    if (key) {
      out[key] = value;
    }
  }
  return out;
}
