import type { MetadataRoute } from "next";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { Shop } from "@/models/Shop";
import { siteUrl } from "@/lib/siteUrl";

// Built from the database, so never prerendered at build time; built on each request.
export const dynamic = "force-dynamic";
const LIMIT = 5000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const entries: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/register`, changeFrequency: "yearly", priority: 0.5 },
  ];
  try {
    await connectToDatabase();
    const [shops, barbers] = await Promise.all([
      Shop.find({ isActive: true }).select("slug updatedAt").sort({ _id: 1 }).limit(LIMIT).lean<{ slug: string; updatedAt?: Date }[]>(),
      User.find({ role: "BARBER", isActive: true }).select("slug updatedAt").sort({ _id: 1 }).limit(LIMIT).lean<{ slug: string; updatedAt?: Date }[]>(),
    ]);
    for (const s of shops) entries.push({ url: `${base}/s/${s.slug}`, lastModified: s.updatedAt, changeFrequency: "weekly", priority: 0.8 });
    for (const b of barbers) entries.push({ url: `${base}/b/${b.slug}`, lastModified: b.updatedAt, changeFrequency: "weekly", priority: 0.8 });
  } catch (error) {
    console.error("Sitemap: could not read shops/barbers", error);
  }
  return entries;
}
