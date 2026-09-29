// Server Components only. Public, unauthenticated reads skip the proxy and hit
// the backend directly — the fast path for SEO pages.
const BACKEND = process.env.BACKEND_API_URL ?? 'http://localhost:5010/api/v1';

export async function publicGet<T>(path: string, revalidate = 60): Promise<T | null> {
  const res = await fetch(`${BACKEND}${path}`, { next: { revalidate } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${res.status} for ${path}`);
  const json = (await res.json()) as { data: T };
  return json.data;
}
