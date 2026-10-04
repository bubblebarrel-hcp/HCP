import Image from 'next/image';

// Placeholder advert slots for the right column of pages that have no rail of
// their own. Dummy artwork from /public/ads and example.com links until real
// ads exist; each opens the advertiser's site in a new tab.
const ads = [
  { src: '/ads/ad-1.svg', href: 'https://example.com/?ad=brand', alt: 'Advert placeholder: your brand here' },
  { src: '/ads/ad-2.svg', href: 'https://example.com/?ad=beer-check', alt: 'Advert placeholder: beer check sponsor' },
  { src: '/ads/ad-3.svg', href: 'https://example.com/?ad=advertise', alt: 'Advert placeholder: advertise with us' },
];

export function AdRail() {
  return (
    <div className="space-y-4" data-testid="ad-rail">
      <h2 className="px-2 text-[15px] font-semibold text-muted-foreground">Sponsored</h2>
      <ul className="space-y-4">
        {ads.map((ad) => (
          <li key={ad.src} className="overflow-hidden rounded-xl border border-border">
            <a
              href={ad.href}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="ad-link"
            >
              <Image src={ad.src} alt={ad.alt} width={320} height={400} unoptimized className="h-auto w-full" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
