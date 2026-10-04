import Link from 'next/link';
import { Archive, Compass, EyeOff, Users } from 'lucide-react';
import { TrendingTags } from '@/components/social/TrendingTags';

const pillars = [
  {
    icon: Compass,
    title: 'Find your pack',
    body: 'Discover kennels at home and wherever you travel. Visitors are first-class hashers.',
  },
  {
    icon: EyeOff,
    title: 'Keep the trail a secret',
    body: 'Hares decide exactly when a trail is revealed. Nobody sees it early.',
  },
  {
    icon: Archive,
    title: 'Remember every run',
    body: 'Trail reports, photos and the Circle become part of your Hash Passport.',
  },
];

export function RightRail({ kennelCount }: { kennelCount: number }) {
  return (
    <div className="space-y-4" data-testid="right-rail">
      <TrendingTags />
      <section aria-labelledby="rail-kennels">
        <h2 id="rail-kennels" className="px-2 text-[15px] font-semibold text-muted-foreground">Kennels on Shiggy Trails</h2>
        <Link href="/kennels" className="mt-1 flex items-center gap-3 rounded-lg p-2 hover:bg-foreground/5">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary-strong">
            <Users className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-sm">
            <span className="font-semibold">{kennelCount}</span> {kennelCount === 1 ? 'kennel' : 'kennels'} welcoming
            hashers and visitors
          </span>
        </Link>
      </section>

      <hr className="border-border" />

      <section aria-labelledby="rail-about">
        <h2 id="rail-about" className="px-2 text-[15px] font-semibold text-muted-foreground">Built around the Hash</h2>
        <ul className="mt-1 space-y-1">
          {pillars.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3 rounded-lg p-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-card">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="text-sm">
                <span className="block font-semibold">{title}</span>
                <span className="text-muted-foreground">{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
