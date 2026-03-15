import type { AuthMode } from "./vinted-core/types";

export interface RuntimeConfig {
  authMode: AuthMode;
  proxyUrl?: string;
  maxConcurrency: number;
  requestDelayMs: number;
  maxRetries: number;
}

export function getRuntimeConfig(): RuntimeConfig {
  loadEnvFileIfPresent();

  const authMode = parseAuthMode(process.env.VINTED_AUTH_MODE);
  const maxConcurrency = parsePositiveInt(process.env.VINTED_MAX_CONCURRENCY, 3);
  const requestDelayMs = parsePositiveInt(process.env.VINTED_REQUEST_DELAY_MS, 500);
  const maxRetries = parsePositiveInt(process.env.VINTED_MAX_RETRIES, 3);
  const proxyUrl = process.env.VINTED_PROXY_URL?.trim() || undefined;

  return {
    authMode,
    proxyUrl,
    maxConcurrency,
    requestDelayMs,
    maxRetries
  };
}

function parseAuthMode(value: string | undefined): AuthMode {
  const normalised = (value || "http").toLowerCase();
  if (normalised === "http" || normalised === "playwright" || normalised === "env") {
    return normalised;
  }
  return "http";
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

let envLoaded = false;

function loadEnvFileIfPresent(): void {
  if (envLoaded) {
    return;
  }
  envLoaded = true;

  try {
    const fs = require("fs") as {
      existsSync: (path: string) => boolean;
      readFileSync: (path: string, encoding: string) => string;
    };
    const path = require("path") as { join: (...parts: string[]) => string };

    const cwd = process.cwd?.() || ".";
    const envPath = path.join(cwd, ".env");

    if (!fs.existsSync(envPath)) {
      return;
    }

    const content = fs.readFileSync(envPath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }

      const equalsIndex = line.indexOf("=");
      if (equalsIndex <= 0) {
        continue;
      }

      const key = line.slice(0, equalsIndex).trim();
      const rawValue = line.slice(equalsIndex + 1).trim();
      if (!key) {
        continue;
      }

      if (process.env[key] !== undefined) {
        continue;
      }

      process.env[key] = stripQuotes(rawValue);
    }
  } catch {
    // Ignore .env loading issues and continue with process env only.
  }
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
