import type { MetadataRoute } from 'next';
import { publicGet } from '@/lib/server-api';
import type { Page, PublicKennel } from '@/lib/types';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3010';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = ['', '/kennels', '/auth/register', '/privacy-policy', '/terms', '/child-safety', '/delete-account'].map((path) => ({
    url: `${SITE}${path}`,
    changeFrequency: 'weekly',
  }));

  try {
    const data = await publicGet<Page<PublicKennel>>('/kennels?limit=100', 3600);
    const kennels = (data?.items ?? []).map((k) => ({
      url: `${SITE}/kennels/${k.slug}`,
      changeFrequency: 'weekly' as const,
    }));
    return [...staticRoutes, ...kennels];
  } catch {
    // The sitemap should still render when the API is down.
    return staticRoutes;
  }
}
