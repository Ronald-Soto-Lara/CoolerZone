import type { MetadataRoute } from "next";
import { getPublishedProducts } from "@/lib/products";
import { siteConfig } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getPublishedProducts();
  return [
    { url: siteConfig.url, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    ...products.map((product) => ({
      url: `${siteConfig.url}/productos/${product.slug}`,
      lastModified: new Date(product.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}