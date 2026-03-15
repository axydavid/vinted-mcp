export function parseSetCookieHeaders(headers: Headers): string[] {
  const getSetCookie = (headers as any).getSetCookie;
  if (typeof getSetCookie === "function") {
    return getSetCookie.call(headers) as string[];
  }

  const raw = headers.get("set-cookie");
  if (!raw) {
    return [];
  }

  return splitSetCookie(raw);
}

export function parseCookiesFromSetCookie(setCookieHeaders: string[]): Record<string, string> {
  const cookies: Record<string, string> = {};

  for (const cookieStr of setCookieHeaders) {
    const [nameValue] = cookieStr.split(";");
    if (!nameValue) {
      continue;
    }

    const eqIdx = nameValue.indexOf("=");
    if (eqIdx <= 0) {
      continue;
    }

    const name = nameValue.slice(0, eqIdx).trim();
    const value = nameValue.slice(eqIdx + 1).trim();
    if (name) {
      cookies[name] = value;
    }
  }

  return cookies;
}

export function cookieHeaderFromMap(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

export function runtimeRequire(moduleName: string): any {
  return require(moduleName);
}

export function defaultDesktopUserAgent(): string {
  return "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
}

function splitSetCookie(value: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let inExpiresValue = false;

  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === ",") {
      if (!inExpiresValue) {
        parts.push(value.slice(start, i).trim());
        start = i + 1;
      }
      continue;
    }

    if (ch === ";") {
      inExpiresValue = false;
      continue;
    }

    if (value.slice(i, i + 8).toLowerCase() === "expires=") {
      inExpiresValue = true;
      i += 7;
    }
  }

  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}
