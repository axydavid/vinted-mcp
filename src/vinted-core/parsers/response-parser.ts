import { getBaseUrl } from "../models/country";

export interface ParsedSeller {
  id: number;
  username: string;
  rating: number | null;
  ratingCount: number;
  itemCount: number;
  followerCount: number;
  lastSeenAt: string | null;
  country: string;
  profileUrl: string;
}

export interface ParsedItem {
  id: number;
  url: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  originalPrice: number | null;
  country: string;
  brand: string | null;
  brandId: number | null;
  category: string | null;
  categoryId: number | null;
  size: string | null;
  condition: string | null;
  color: string | null;
  photos: string[];
  favouriteCount: number;
  viewCount: number;
  isSold: boolean;
  soldAt: string | null;
  createdAt: string;
  updatedAt: string;
  seller: ParsedSeller;
  scrapedAt: string;
}

export function parseItem(raw: any, country: string): ParsedItem {
  const baseUrl = getBaseUrl(country);
  const seller = raw.user || raw.seller || {};

  return {
    id: raw.id,
    url: raw.url || `${baseUrl}/items/${raw.id}`,
    title: raw.title || "",
    description: raw.description || "",
    price: parseFloat(raw.price?.amount || raw.price || raw.total_item_price?.amount || "0"),
    currency: raw.price?.currency_code || raw.currency || "EUR",
    originalPrice: raw.original_price ? parseFloat(raw.original_price.amount || raw.original_price) : null,
    country,
    brand: raw.brand_title || raw.brand || null,
    brandId: raw.brand_id || raw.brand_dto?.id || null,
    category: raw.catalog_title || raw.category || null,
    categoryId: raw.catalog_id || raw.category_id || null,
    size: raw.size_title || raw.size || null,
    condition: raw.status || raw.condition || null,
    color: raw.color1 || raw.color || null,
    photos: (raw.photos || raw.photo_urls || [])
      .map((photo: any) =>
        typeof photo === "string" ? photo : photo.url || photo.full_size_url || photo.thumbnails?.[0]?.url || ""
      )
      .filter(Boolean),
    favouriteCount: raw.favourite_count || raw.favorites_count || 0,
    viewCount: raw.view_count || 0,
    isSold: raw.is_closed || raw.is_sold || raw.status === "sold" || false,
    soldAt: raw.closed_at || raw.sold_at || null,
    createdAt: raw.created_at_ts || raw.created_at || "",
    updatedAt: raw.updated_at_ts || raw.updated_at || raw.created_at_ts || "",
    seller: parseSeller(seller, country),
    scrapedAt: new Date().toISOString()
  };
}

export function parseItemDetail(raw: any, country: string): ParsedItem {
  const item = parseItem(raw, country);
  return {
    ...item,
    description: raw.description || "",
    photos: (raw.photos || [])
      .map((photo: any) => (typeof photo === "string" ? photo : photo.full_size_url || photo.url || ""))
      .filter(Boolean)
  };
}

export function parseSeller(raw: any, country: string): ParsedSeller {
  const baseUrl = getBaseUrl(country);
  return {
    id: raw.id || 0,
    username: raw.login || raw.username || "",
    rating: raw.feedback_reputation !== undefined ? parseFloat(raw.feedback_reputation) : null,
    ratingCount: raw.feedback_count || raw.rating_count || 0,
    itemCount: raw.item_count || raw.items_count || 0,
    followerCount: raw.followers_count || raw.follower_count || 0,
    lastSeenAt: raw.last_loged_on_ts || raw.last_seen_at || null,
    country,
    profileUrl: raw.profile_url || `${baseUrl}/member/${raw.id}-${raw.login || ""}`
  };
}

export function parseSellerProfile(raw: any, country: string) {
  const baseUrl = getBaseUrl(country);
  return {
    id: raw.id,
    username: raw.login || raw.username || "",
    profileUrl: raw.profile_url || `${baseUrl}/member/${raw.id}-${raw.login || ""}`,
    rating: raw.feedback_reputation !== undefined ? parseFloat(raw.feedback_reputation) : null,
    ratingCount: raw.feedback_count || 0,
    itemCount: raw.item_count || raw.items_count || 0,
    soldItemCount: raw.given_item_count || raw.sold_item_count || 0,
    followerCount: raw.followers_count || 0,
    followingCount: raw.following_count || 0,
    country,
    city: raw.city || null,
    lastSeenAt: raw.last_loged_on_ts || null,
    createdAt: raw.created_at || "",
    verifications: {
      email: raw.verification?.email?.valid || false,
      phone: raw.verification?.phone?.valid || false,
      facebook: raw.verification?.facebook?.valid || false,
      google: raw.verification?.google?.valid || false
    }
  };
}

export function parseSearchResponse(raw: any, country: string, page: number, perPage: number) {
  const items = (raw.items || []).map((item: any) => parseItem(item, country));
  return {
    items,
    totalCount: raw.pagination?.total_entries || raw.total_count || items.length,
    page,
    perPage,
    hasMore: items.length >= perPage
  };
}
