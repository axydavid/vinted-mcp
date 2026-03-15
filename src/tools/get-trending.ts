import type { VintedAPIClient } from "../vinted-core";

export const getTrendingTool = {
  name: "get_trending",
  description: "Find trending Vinted items with high engagement growth (favourites, views). Detects rising demand.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search keywords (optional)" },
      country: { type: "string", description: "Country code", default: "fr" },
      categoryId: { type: "integer", description: "Category ID filter" },
      limit: { type: "integer", description: "Max items to return", default: 20 }
    }
  }
};

export async function handleGetTrending(client: VintedAPIClient, args: any): Promise<string> {
  const country = args.country || "fr";
  const limit = Math.min(args.limit || 20, 100);

  const result = await client.searchItems({
    query: args.query,
    country,
    categoryId: args.categoryId,
    sortBy: "newest_first",
    perPage: Math.min(limit * 2, 48),
    page: 1
  });

  const now = Date.now();
  const trending = result.items
    .map((item: any) => {
      const createdAt = new Date(item.createdAt).getTime();
      const hoursListed = Math.max(1, (now - createdAt) / (1000 * 60 * 60));
      const favsGrowthRate = Math.round((item.favouriteCount / hoursListed) * 100) / 100;
      const viewsGrowthRate = Math.round((item.viewCount / hoursListed) * 100) / 100;
      const recencyBonus = Math.max(0, 1 - hoursListed / (7 * 24));
      const engagementScore = favsGrowthRate * 10 + viewsGrowthRate;
      const trendScore = Math.round(engagementScore * (1 + recencyBonus) * 10) / 10;

      return {
        title: item.title,
        price: `${item.price} ${item.currency}`,
        trendScore,
        favourites: item.favouriteCount,
        views: item.viewCount,
        favsPerHour: favsGrowthRate,
        viewsPerHour: viewsGrowthRate,
        listedHoursAgo: Math.round(hoursListed * 10) / 10,
        url: item.url
      };
    })
    .sort((a: any, b: any) => b.trendScore - a.trendScore)
    .slice(0, limit);

  return JSON.stringify(
    {
      country,
      query: args.query || null,
      trendingItems: trending
    },
    null,
    2
  );
}
