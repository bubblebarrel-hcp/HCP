import type { LinkPreview } from '@/lib/types';

// What a pasted link looks like (D60). The server read the page once; this only
// draws it. The link leaves Shiggy Trails, so it is marked as one somebody typed
// (`ugc`, `nofollow`) and the picture is fetched without telling the other site
// which page it was shown on.
export function LinkPreviewCard({ preview }: { preview: LinkPreview }) {
  let host = preview.siteName ?? '';
  try {
    host = host || new URL(preview.url).hostname.replace(/^www\./, '');
  } catch {
    // Keep what we have.
  }
  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer nofollow ugc"
      className="mt-3 block overflow-hidden rounded-lg border border-border hover:bg-muted/50"
      data-testid="link-preview"
    >
      {preview.imageUrl && (
        // The image is on somebody else's server, so next/image would need every
        // host configured up front.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview.imageUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="max-h-56 w-full bg-muted object-cover"
        />
      )}
      <span className="block p-3">
        <span className="block truncate text-xs uppercase tracking-wide text-muted-foreground">{host}</span>
        {preview.title && <span className="mt-0.5 block font-medium leading-snug">{preview.title}</span>}
        {preview.description && (
          <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">{preview.description}</span>
        )}
      </span>
    </a>
  );
}
