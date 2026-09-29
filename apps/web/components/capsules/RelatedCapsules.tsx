import Link from 'next/link';
import { Avatar } from '@/components/Avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RelatedCapsule } from '@/lib/types';
import { bleedCard, brandColor, formatDate } from '@/lib/utils';

// FR-EXPLORER-008. Ranked same-hare first, then same-kennel by date
// proximity (apps/api/src/services/capsule.service.ts#relatedCapsules) —
// "similar trail", "anniversary" and "shared visitors" are not built; the
// corpus is too thin right now for any of them to mean much.
export function RelatedCapsules({ items }: { items: RelatedCapsule[] }) {
  if (items.length === 0) return null;
  return (
    <Card className={bleedCard} data-testid="capsule-related">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">More from this kennel</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {items.map((c) => (
            <li key={c.id}>
              <Link
                href={`/capsules/${c.id}`}
                className="flex items-center gap-3 rounded-md p-2 hover:bg-muted/50"
                data-testid="capsule-related-item"
              >
                <Avatar name={c.kennel.shortName} size="sm" color={brandColor(c.kennel.primaryColor)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    #{c.runNumber} · {c.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.kennel.shortName} · <time dateTime={c.startsAt}>{formatDate(c.startsAt)}</time>
                    {c.reason === 'SAME_HARE' && ' · same hare'}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
