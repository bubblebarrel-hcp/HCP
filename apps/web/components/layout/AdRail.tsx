import Image from 'next/image';

// Placeholder advert slots for the right column of pages that have no rail of
// their own. Dummy artwork from /public/ads until real ads exist.
const ads = [
  { src: '/ads/ad-1.svg', alt: 'Advert placeholder: your brand here' },
  { src: '/ads/ad-2.svg', alt: 'Advert placeholder: beer check sponsor' },
  { src: '/ads/ad-3.svg', alt: 'Advert placeholder: advertise with us' },
];

export function AdRail() {
  return (
    <div className="space-y-4" data-testid="ad-rail">
      <h2 className="px-2 text-[15px] font-semibold text-muted-foreground">Sponsored</h2>
      <ul className="space-y-4">
        {ads.map((ad) => (
          <li key={ad.src} className="overflow-hidden rounded-xl border border-border">
            <Image src={ad.src} alt={ad.alt} width={320} height={400} unoptimized className="h-auto w-full" />
          </li>
        ))}
      </ul>
    </div>
  );
}
