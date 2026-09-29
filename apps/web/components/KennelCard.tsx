import Link from 'next/link';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { PublicKennel } from '@/lib/types';
import { verificationLabel } from '@/lib/utils';

export function KennelCard({ kennel }: { kennel: PublicKennel }) {
  const verified = kennel.verificationLevel !== 'PENDING';
  return (
    <Link href={`/kennels/${kennel.slug}`} className="group block focus-visible:outline-none" data-testid="kennel-card">
      <Card className="h-full rounded-none border-x-0 transition-shadow sm:rounded-xl sm:border-x group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-ring">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <CardTitle>{kennel.shortName}</CardTitle>
            {verified && <Badge className="border-primary/30 bg-primary/10 text-primary-strong">{verificationLabel(kennel.verificationLevel)}</Badge>}
          </div>
          <CardDescription>
            {kennel.city}, {kennel.country}
            {kennel.meetingDay ? ` · ${kennel.meetingDay}s` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {kennel.motto && <p className="text-sm italic">“{kennel.motto}”</p>}
          <p className="line-clamp-3 text-sm text-muted-foreground">{kennel.description}</p>
          <p className="text-xs text-muted-foreground">
            {kennel.activeMemberCount} active {kennel.activeMemberCount === 1 ? 'member' : 'members'}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
