import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { getRuntimeConfig } from "./env";
import { getCategoriesData, categoriesResource } from "./resources/categories";
import { getCountriesData, countriesResource } from "./resources/countries";
import { comparePricesTool, handleComparePrices } from "./tools/compare-prices";
import { getItemTool, handleGetItem } from "./tools/get-item";
import { getSellerTool, handleGetSeller } from "./tools/get-seller";
import { getTrendingTool, handleGetTrending } from "./tools/get-trending";
import { handleSearchItems, searchItemsTool } from "./tools/search-items";
import { VintedAPIClient } from "./vinted-core";

const TOOLS = [searchItemsTool, getItemTool, getSellerTool, comparePricesTool, getTrendingTool];
const RESOURCES = [countriesResource, categoriesResource];

export function createServer(): Server {
  const server = new Server(
    {
      name: "vinted-mcp",
      version: "1.0.1"
    },
    {
      capabilities: {
        tools: {},
        resources: {}
      }
    }
  );

  let client: VintedAPIClient | null = null;

  function getClient(): VintedAPIClient {
    if (!client) {
      const runtime = getRuntimeConfig();
      client = new VintedAPIClient({
        authMode: runtime.authMode,
        proxyUrl: runtime.proxyUrl,
        maxConcurrency: runtime.maxConcurrency,
        requestDelayMs: runtime.requestDelayMs,
        maxRetries: runtime.maxRetries
      });
    }

    return client;
  }

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;
    const args = request.params.arguments || {};
    const apiClient = getClient();

    try {
      let result: string;

      switch (name) {
        case "search_items":
          result = await handleSearchItems(apiClient, args);
          break;
        case "get_item":
          result = await handleGetItem(apiClient, args);
          break;
        case "get_seller":
          result = await handleGetSeller(apiClient, args);
          break;
        case "compare_prices":
          result = await handleComparePrices(apiClient, args);
          break;
        case "get_trending":
          result = await handleGetTrending(apiClient, args);
          break;
        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [{ type: "text", text: result }]
      };
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true
      };
    }
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: RESOURCES
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    switch (uri) {
      case "vinted://countries":
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: getCountriesData()
            }
          ]
        };
      case "vinted://categories":
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: getCategoriesData()
            }
          ]
        };
      default:
        throw new Error(`Unknown resource: ${uri}`);
    }
  });

  return server;
}

export async function startServer(): Promise<void> {
  const mode = (process.env.VINTED_MCP_TRANSPORT || "stdio").toLowerCase();

  if (mode === "http" || mode === "tcp") {
    const cleanup = await startHttpTransports();

    process.on?.("SIGINT", async () => {
      await cleanup();
      process.exit?.(0);
    });

    process.on?.("SIGTERM", async () => {
      await cleanup();
      process.exit?.(0);
    });
  } else {
    const server = createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);

    process.on?.("SIGINT", async () => {
      await server.close();
      process.exit?.(0);
    });

    process.on?.("SIGTERM", async () => {
      await server.close();
      process.exit?.(0);
    });
  }
}

async function startHttpTransports(): Promise<() => Promise<void>> {
  const http = require("node:http") as {
    createServer: (handler: (req: any, res: any) => void) => {
      listen: (port: number, host: string, cb: () => void) => void;
      close: (cb: () => void) => void;
    };
  };
  const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js") as {
    StreamableHTTPServerTransport: new (options?: Record<string, unknown>) => any;
  };
  const { SSEServerTransport } = require("@modelcontextprotocol/sdk/server/sse.js") as {
    SSEServerTransport: new (endpoint: string, res: any, options?: Record<string, unknown>) => any;
  };

  const host = process.env.VINTED_MCP_HOST || "127.0.0.1";
  const port = parsePort(process.env.VINTED_MCP_PORT, 3001);
  const path = process.env.VINTED_MCP_PATH || "/mcp";
  const legacyEnabled = parseBoolean(process.env.VINTED_MCP_ENABLE_LEGACY_SSE, true);
  const legacySsePath = process.env.VINTED_MCP_LEGACY_SSE_PATH || "/sse";
  const legacyMessagesPath = process.env.VINTED_MCP_LEGACY_MESSAGES_PATH || "/messages";

  const streamableServer = createServer();

  const transport: any = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });
  await streamableServer.connect(transport);

  const legacySessions = new Map<string, { server: Server; transport: any }>();

  const cleanupLegacySession = async (sessionId: string): Promise<void> => {
    const session = legacySessions.get(sessionId);
    if (!session) {
      return;
    }

    legacySessions.delete(sessionId);
    try {
      await session.transport.close();
    } catch {
      // Ignore session transport close errors.
    }
    try {
      await session.server.close();
    } catch {
      // Ignore session server close errors.
    }
  };

  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${host}:${port}`);

    if (url.pathname === path) {
      transport.handleRequest(req, res).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        writeJsonError(res, 500, message);
      });
      return;
    }

    if (legacyEnabled && url.pathname === legacySsePath && req.method === "GET") {
      const legacyServer = createServer();
      const legacyTransport = new SSEServerTransport(legacyMessagesPath, res);

      try {
        await legacyServer.connect(legacyTransport);
        const sessionId = String(legacyTransport.sessionId);
        legacySessions.set(sessionId, { server: legacyServer, transport: legacyTransport });

        legacyTransport.onclose = () => {
          cleanupLegacySession(sessionId).catch(() => undefined);
        };

        await legacyTransport.start();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        writeJsonError(res, 500, message);
        await legacyServer.close().catch(() => undefined);
      }
      return;
    }

    if (legacyEnabled && url.pathname === legacyMessagesPath && req.method === "POST") {
      const sessionId = url.searchParams.get("sessionId") || "";
      const session = legacySessions.get(sessionId);

      if (!session) {
        writeJsonError(res, 400, "Missing or invalid legacy SSE sessionId");
        return;
      }

      session.transport.handlePostMessage(req, res).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        writeJsonError(res, 500, message);
      });
      return;
    }

    if (legacyEnabled && (url.pathname === legacySsePath || url.pathname === legacyMessagesPath)) {
      writeJsonError(res, 405, "Method not allowed");
      return;
    }

    if (url.pathname === "/") {
      res.statusCode = 200;
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          status: "ok",
          streamableHttp: path,
          legacySse: legacyEnabled ? legacySsePath : null,
          legacyMessages: legacyEnabled ? legacyMessagesPath : null
        })
      );
      return;
    }

    writeJsonError(res, 404, "Not found");
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(port, host, resolve);
  });

  console.error(`[vinted-mcp] Streamable HTTP listening on http://${host}:${port}${path}`);
  if (legacyEnabled) {
    console.error(`[vinted-mcp] Legacy SSE listening on http://${host}:${port}${legacySsePath}`);
    console.error(`[vinted-mcp] Legacy message endpoint http://${host}:${port}${legacyMessagesPath}`);
  }

  return async () => {
    for (const sessionId of Array.from(legacySessions.keys())) {
      await cleanupLegacySession(sessionId);
    }

    await streamableServer.close().catch(() => undefined);

    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  };
}

function writeJsonError(res: any, statusCode: number, message: string): void {
  if (res.headersSent) {
    return;
  }

  try {
    res.statusCode = statusCode;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: message }));
  } catch {
    // Ignore response write failures.
  }
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  const normalised = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalised)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalised)) {
    return false;
  }

  return fallback;
}

function parsePort(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65535) {
    return fallback;
  }

  return parsed;
}
