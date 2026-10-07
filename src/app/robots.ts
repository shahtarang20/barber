import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/siteUrl";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [{ userAgent: "*", allow: ["/", "/s/", "/b/"], disallow: ["/api/", "/dashboard", "/admin", "/cancel", "/login", "/register"] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
