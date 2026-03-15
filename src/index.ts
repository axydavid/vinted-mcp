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
      name: "vinted-mcp-server",
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
