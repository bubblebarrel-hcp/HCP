import { Award, Footprints, Globe2, MapPin, Ruler, Users } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatKm, placeLabel } from '@/lib/passport';
import type { HashPassport } from '@/lib/types';
import { bleedCard, cn, formatDate } from '@/lib/utils';

// The passport itself, shown the same way to its owner and to anyone holding a
// share link. Memories and the share token are only ever populated for the owner.
export function PassportView({ passport }: { passport: HashPassport }) {
  const stats = [
    { label: 'Runs attended', value: String(passport.runsAttended), icon: Footprints },
    { label: 'Trails laid', value: String(passport.trailsLaid), icon: Award },
    { label: 'Countries hashed', value: String(passport.countriesHashed), icon: Globe2 },
    { label: 'Kennels', value: String(passport.kennelsJoined), icon: Users },
    { label: 'Distance', value: formatKm(passport.distanceMeters), icon: Ruler },
  ];

  const byCountry = passport.places.reduce<Record<string, typeof passport.places>>((acc, place) => {
    (acc[place.country] ??= []).push(place);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <Card className={cn(bleedCard, 'p-5')} data-testid="passport-header">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={passport.hasher.displayName} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary-strong">Hash Passport</p>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="passport-name">
              {passport.hasher.displayName}
            </h1>
            <p className="text-sm text-muted-foreground">
              Hashing since {formatDate(passport.hasher.hashingSince)}
            </p>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5" data-testid="passport-stats">
          {stats.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-lg bg-muted p-3 text-center">
              <Icon className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden />
              <dd className="mt-1 text-xl font-bold">{value}</dd>
              <dt className="text-xs text-muted-foreground">{label}</dt>
            </div>
          ))}
        </dl>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className={bleedCard} data-testid="passport-stamps">
          <CardHeader className="pb-3">
            <CardTitle>Stamps</CardTitle>
          </CardHeader>
          <CardContent>
            {passport.stamps.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Your first stamp arrives when you check in to a run.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {passport.stamps.map((stamp) => (
                  <li
                    key={stamp.id}
                    className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-sm"
                    title={formatDate(stamp.awardedAt)}
                  >
                    <span className="font-semibold text-accent-strong">{stamp.label}</span>
                    <span className="block text-xs text-muted-foreground">{formatDate(stamp.awardedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className={bleedCard} data-testid="passport-milestones">
          <CardHeader className="pb-3">
            <CardTitle>Milestones</CardTitle>
          </CardHeader>
          <CardContent>
            {passport.milestones.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                The first milestone is 10 runs. {passport.runsAttended} so far.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {passport.milestones.map((milestone) => (
                  <li key={milestone.id} className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{milestone.threshold} runs</span>
                    <span className="text-muted-foreground">{formatDate(milestone.reachedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className={bleedCard} data-testid="passport-places">
        <CardHeader className="pb-3">
          <CardTitle>Where you have hashed</CardTitle>
        </CardHeader>
        <CardContent>
          {passport.places.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nowhere yet. That changes on your first run.</p>
          ) : (
            <ul className="space-y-3">
              {Object.entries(byCountry).map(([country, places]) => (
                <li key={country}>
                  <p className="flex items-center gap-2 font-semibold">
                    <Globe2 className="h-4 w-4 text-primary-strong" aria-hidden />
                    {country}
                    <Badge>{places.length}</Badge>
                  </p>
                  <ul className="mt-1 space-y-1 pl-6 text-sm text-muted-foreground">
                    {places.map((place) => (
                      <li key={place.id} className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5" aria-hidden />
                        {placeLabel(place)} · first visit {formatDate(place.firstVisitedAt)}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
