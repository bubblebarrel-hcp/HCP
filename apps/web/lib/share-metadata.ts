import type { Metadata } from 'next';

// One shape for every shareable page's link preview (D50).
//
// A link pasted into WhatsApp is read by a crawler, not by a browser with a
// session, so everything here comes from an unauthenticated fetch. That is
// deliberate: it is the same thing the crawler would see, and it means a
// members-only run cannot leak its theme and meeting point into a group chat
// through a preview card.
//
// Twitter's card type is set alongside Open Graph because X does not read OG
// alone for the large-image layout, and the two disagreeing is how a preview
// ends up with a title but no picture.

export function shareMetadata({
  title,
  description,
  image,
}: {
  title: string;
  description: string;
  // Absolute only. A relative path would need `metadataBase`, and a preview
  // crawler that cannot resolve it silently shows no image at all — so a
  // relative one is dropped rather than half-set.
  image?: string | null;
}): Metadata {
  const absolute = image && /^https?:\/\//i.test(image) ? image : undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Hash Community Platform',
      ...(absolute ? { images: [absolute] } : {}),
    },
    twitter: {
      card: absolute ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(absolute ? { images: [absolute] } : {}),
    },
  };
}
