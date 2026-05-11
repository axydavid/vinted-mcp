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

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.6; rv:132.0) Gecko/20100101 Firefox/132.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
];

export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export function getBrowserHeaders(userAgent: string, isMobile = false): Record<string, string> {
  const isFirefox = userAgent.includes("Firefox");
  const isSafari = userAgent.includes("Safari") && !userAgent.includes("Chrome");

  const headers: Record<string, string> = {
    "User-Agent": userAgent,
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
  };

  if (!isSafari) {
    headers["Sec-Ch-Ua-Mobile"] = isMobile ? "?1" : "?0";
    headers["Sec-Ch-Ua-Platform"] = userAgent.includes("Windows") ? '"Windows"' : userAgent.includes("Mac OS") ? '"macOS"' : '"Linux"';
    if (!isFirefox) {
      const match = userAgent.match(/Chrome\/(\d+)/);
      const version = match ? match[1] : "122";
      headers["Sec-Ch-Ua"] = `"Chromium";v="${version}", "Google Chrome";v="${version}", "Not-A.Brand";v="99"`;
    }
  }

  headers["Sec-Fetch-Dest"] = "empty";
  headers["Sec-Fetch-Mode"] = "cors";
  headers["Sec-Fetch-Site"] = "same-origin";

  return headers;
}

export function defaultDesktopUserAgent(): string {
  return getRandomUserAgent();
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
      } else {
        inExpiresValue = false;
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
