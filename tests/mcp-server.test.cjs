const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");

const runLiveTests = process.env.RUN_LIVE_MCP_TESTS === "1";

let client;

before(async () => {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/bundle.js"],
    cwd: process.cwd(),
    env: { ...process.env }
  });

  client = new Client(
    {
      name: "mcp-server-test-client",
      version: "1.0.0"
    },
    {
      capabilities: {}
    }
  );

  await client.connect(transport);
});

after(async () => {
  if (client) {
    await client.close();
  }
});

test("lists tools", async () => {
  const response = await client.listTools();
  const names = (response.tools || []).map((tool) => tool.name);

  assert.deepEqual(names.sort(), [
    "compare_prices",
    "get_item",
    "get_seller",
    "get_trending",
    "search_items"
  ]);
});

test("lists resources", async () => {
  const response = await client.listResources();
  const uris = (response.resources || []).map((resource) => resource.uri).sort();

  assert.deepEqual(uris, ["vinted://categories", "vinted://countries"]);
});

test("reads countries and categories resources", async () => {
  const countriesRes = await client.readResource({ uri: "vinted://countries" });
  const countries = JSON.parse(getText(countriesRes));
  assert.ok(Array.isArray(countries));
  assert.ok(countries.length >= 19);

  const categoriesRes = await client.readResource({ uri: "vinted://categories" });
  const categories = JSON.parse(getText(categoriesRes));
  assert.ok(Array.isArray(categories));
  assert.ok(categories.length > 0);
});

test(
  "runs live tool flow",
  {
    skip: !runLiveTests
  },
  async () => {
    const searchResult = await client.callTool({
      name: "search_items",
      arguments: { query: "nike", country: "fr", limit: 2 }
    });
    assert.equal(searchResult.isError, undefined);

    const search = JSON.parse(getText(searchResult));
    assert.ok(Array.isArray(search.items));
    assert.ok(search.items.length > 0);

    const itemId = search.items[0].id;
    assert.equal(typeof itemId, "number");

    const itemResult = await client.callTool({
      name: "get_item",
      arguments: { itemId, country: "fr" }
    });
    assert.equal(itemResult.isError, undefined);
    const item = JSON.parse(getText(itemResult));
    assert.equal(item.id, itemId);

    const sellerId = item?.seller?.id && item.seller.id > 0 ? item.seller.id : 1;
    const sellerResult = await client.callTool({
      name: "get_seller",
      arguments: { sellerId, country: "fr", includeItems: true, itemLimit: 2 }
    });
    assert.equal(sellerResult.isError, undefined);
    const seller = JSON.parse(getText(sellerResult));
    assert.equal(typeof seller.id, "number");

    const compareResult = await client.callTool({
      name: "compare_prices",
      arguments: { query: "nike", countries: ["fr", "de"], limit: 5 }
    });
    assert.equal(compareResult.isError, undefined);
    const compare = JSON.parse(getText(compareResult));
    assert.ok(Array.isArray(compare.countries));

    const trendingResult = await client.callTool({
      name: "get_trending",
      arguments: { country: "fr", limit: 3 }
    });
    assert.equal(trendingResult.isError, undefined);
    const trending = JSON.parse(getText(trendingResult));
    assert.ok(Array.isArray(trending.trendingItems));
  }
);

function getText(response) {
  const toolText = response?.content?.find((entry) => entry.type === "text")?.text;
  if (typeof toolText === "string") {
    return toolText;
  }

  const resourceText = response?.contents?.find((entry) => typeof entry?.text === "string")?.text;
  if (typeof resourceText === "string") {
    return resourceText;
  }

  assert.fail("Expected text content in MCP response");
}
