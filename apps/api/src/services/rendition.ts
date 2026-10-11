// D69. The other sizes of a clip, as every surface that lists a post's media
// serializes them: the asset's own url is the 720p default, these are the 360p and
// 1080p a viewer's quality setting may pick instead. Empty for a photo, and for a
// clip that has not been (or cannot be) re-encoded: it simply plays at its default.
export interface VideoRendition {
  label: string;
  url: string;
  width: number | null;
  height: number | null;
}

export const renditionSelect = {
  select: { label: true, url: true, width: true, height: true },
} as const;

export function serializeRenditions(
  rows: { label: string; url: string | null; width: number | null; height: number | null }[] | undefined,
): VideoRendition[] {
  return (rows ?? [])
    .filter((row): row is typeof row & { url: string } => Boolean(row.url))
    .map((row) => ({ label: row.label, url: row.url, width: row.width, height: row.height }))
    .sort((a, b) => Math.min(a.width ?? 0, a.height ?? 0) - Math.min(b.width ?? 0, b.height ?? 0));
}
