import type { VintedAPIClient } from "../vinted-core";

export const comparePricesTool = {
  name: "compare_prices",
  description:
    "Compare prices for a search query across multiple Vinted countries. Great for finding arbitrage opportunities.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search keywords to compare" },
      countries: {
        type: "array",
        items: { type: "string" },
        description: "Country codes to compare (default: fr, de, it, es, nl, pl)",
        default: ["fr", "de", "it", "es", "nl", "pl"]
      },
      limit: { type: "integer", description: "Items per country to analyse", default: 20 }
    },
    required: ["query"]
  }
};

export async function handleComparePrices(client: VintedAPIClient, args: any): Promise<string> {
  const countries = args.countries || ["fr", "de", "it", "es", "nl", "pl"];
  const comparison = await client.comparePrices(args.query, countries, args.limit || 20);

  return JSON.stringify(
    {
      query: comparison.query,
      summary: {
        bestBuyCountry: comparison.bestBuyCountry,
        bestSellCountry: comparison.bestSellCountry,
        arbitrageSpread: `${comparison.arbitrageSpreadPct}%`
      },
      countries: comparison.comparisons.map((entry) => ({
        country: entry.country,
        avgPrice: `${entry.avgPrice} ${entry.currency}`,
        medianPrice: `${entry.medianPrice} ${entry.currency}`,
        priceRange: `${entry.minPrice} - ${entry.maxPrice} ${entry.currency}`,
        itemCount: entry.itemCount
      }))
    },
    null,
    2
  );
}
