import type { VintedAPIClient } from "../vinted-core";

export const searchItemsTool = {
  name: "search_items",
  description:
    "Search Vinted items with filters. Returns items with price, photos, seller info. Supports 19 countries.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search keywords" },
      country: {
        type: "string",
        description: "Country code (fr, de, uk, it, es, nl, pl, pt, be, at, lt, cz, sk, hu, ro, hr, fi, dk, se)",
        default: "fr"
      },
      priceMin: { type: "number", description: "Minimum price filter" },
      priceMax: { type: "number", description: "Maximum price filter" },
      brandIds: { type: "array", items: { type: "integer" }, description: "Filter by brand IDs" },
      categoryId: { type: "integer", description: "Vinted category ID filter" },
      condition: {
        type: "array",
        items: { type: "string" },
        description: "Condition filter (new_with_tags, new_without_tags, very_good, good, satisfactory)"
      },
      sortBy: {
        type: "string",
        enum: ["relevance", "price_low_to_high", "price_high_to_low", "newest_first"],
        description: "Sort order"
      },
      limit: { type: "integer", description: "Items per page (max 100)", default: 20 },
      page: {
        type: "integer",
        description: "Page number (1-based). Omit or use 1 for first page. Same as scrolling on vinted.com.",
        default: 1,
        minimum: 1
      }
    },
    required: ["query"]
  }
};

export async function handleSearchItems(client: VintedAPIClient, args: any): Promise<string> {
  const perPage = Math.min(Math.max(args.limit || 20, 1), 100);
  const page = Math.max(Number(args.page) || 1, 1);

  const params = {
    query: args.query,
    country: args.country || "fr",
    categoryId: args.categoryId,
    brandIds: args.brandIds,
    priceMin: args.priceMin,
    priceMax: args.priceMax,
    condition: args.condition,
    sortBy: args.sortBy || "relevance",
    perPage,
    page
  };

  const result = await client.searchItems(params);
  const totalFound = result.totalCount;
  const totalPages = Math.max(1, Math.ceil(totalFound / perPage));
  const hasMore = page < totalPages;

  const summary = result.items.map((item: any) => ({
    id: item.id,
    title: item.title,
    price: `${item.price} ${item.currency}`,
    brand: item.brand,
    condition: item.condition,
    size: item.size,
    favourites: item.favouriteCount,
    url: item.url,
    seller: item.seller.username
  }));

  return JSON.stringify(
    {
      totalFound,
      page,
      perPage,
      totalPages,
      hasMore,
      returned: summary.length,
      country: params.country,
      items: summary
    },
    null,
    2
  );
}
