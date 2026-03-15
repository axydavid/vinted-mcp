import { TokenCache } from "./token-cache";
import { getBaseUrl, getCountry } from "../models/country";
import type { AuthSession } from "../types";
import { defaultDesktopUserAgent, runtimeRequire } from "./utils";

type OptionalChromium = {
  use?: (plugin: unknown) => void;
  launch: (opts: Record<string, unknown>) => Promise<any>;
};

export class CookieFactory {
  constructor(private readonly tokenCache: TokenCache = new TokenCache()) {}

  async createSession(country: string): Promise<AuthSession> {
    const cached = this.tokenCache.get(country);
    if (cached) {
      return cached;
    }

    const chromium = this.loadChromiumWithStealth();
    const countryInfo = getCountry(country);
    const baseUrl = getBaseUrl(country);

    const browser = await chromium.launch({
      headless: true,
      args: browserArgs()
    });

    try {
      const context = await browser.newContext({
        userAgent: defaultDesktopUserAgent(),
        locale: countryInfo.language,
        viewport: { width: 1920, height: 1080 }
      });

      const page = await context.newPage();
      await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(2000);

      try {
        const acceptBtn = page.locator(
          '[data-testid="cookie-consent-accept"], #onetrust-accept-btn-handler, .cookie-consent-accept'
        );
        await acceptBtn.click({ timeout: 3000 });
        await page.waitForTimeout(1000);
      } catch {
        // Consent button can be absent depending on region or cached consent.
      }

      const allCookies = await context.cookies();
      const cookies: Record<string, string> = {};
      for (const cookie of allCookies) {
        cookies[cookie.name] = cookie.value;
      }

      const csrfToken = cookies.csrf_token || cookies._csrf_token || "";
      const response = await page.evaluate(async (params: { baseUrl: string; csrfToken: string }) => {
        const res = await fetch(`${params.baseUrl}/api/v2/users/current`, {
          headers: {
            Accept: "application/json",
            "X-CSRF-Token": params.csrfToken
          },
          credentials: "include"
        });

        if (!res.ok) {
          return { error: res.status, body: await res.text() };
        }

        return { data: await res.json() };
      }, { baseUrl, csrfToken });

      let accessToken = "";
      if (response && typeof response === "object" && "data" in response && response.data) {
        accessToken = (response as any).data.access_token || "";
      }

      if (!accessToken) {
        accessToken = cookies.access_token || cookies.access_token_web || "";
      }

      const session: AuthSession = {
        accessToken,
        cookies,
        csrfToken,
        country: country.toLowerCase(),
        expiresAt: Date.now() + 25 * 60 * 1000
      };

      this.tokenCache.set(country, session);
      return session;
    } finally {
      await browser.close();
    }
  }

  private loadChromiumWithStealth(): OptionalChromium {
    try {
      const playwrightExtra = runtimeRequire("playwright-extra") as { chromium?: OptionalChromium };
      const stealthFactory = runtimeRequire("puppeteer-extra-plugin-stealth") as unknown;
      const chromium = playwrightExtra.chromium;

      if (!chromium) {
        throw new Error("playwright-extra does not expose chromium");
      }

      if (typeof chromium.use === "function") {
        const plugin = typeof stealthFactory === "function" ? stealthFactory() : (stealthFactory as any).default?.();
        if (plugin) {
          chromium.use(plugin);
        }
      }

      return chromium;
    } catch {
      try {
        const playwright = runtimeRequire("playwright") as { chromium?: OptionalChromium };
        if (!playwright.chromium) {
          throw new Error("playwright is missing chromium launcher");
        }
        return playwright.chromium;
      } catch {
        throw new Error(
          "Playwright is not available. Install playwright and optionally playwright-extra for stealth-based cookie auth."
        );
      }
    }
  }
}

function browserArgs(): string[] {
  if (process.platform === "linux") {
    return [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu"
    ];
  }

  return ["--disable-dev-shm-usage"];
}
