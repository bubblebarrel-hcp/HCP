'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Avatar } from '@/components/Avatar';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RunCapsule } from '@/lib/types';
import { bleedCard, cn } from '@/lib/utils';

// FR-EXPLORER-006. Hares and the scribe come off the hero; visitors and
// members come off `participants`, which is null unless the viewer is in the
// hosting kennel (D23) — the tabs that need it simply do not render then.

type Tab = 'hares' | 'scribe' | 'visitors' | 'members';

function Person({ name, userId }: { name: string; userId: string | null }) {
  const inner = (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
      <Avatar name={name} size="sm" />
      <span className={userId ? 'font-medium hover:underline' : undefined}>{name}</span>
    </div>
  );
  return userId ? <Link href={`/hashers/${userId}`}>{inner}</Link> : inner;
}

export function ParticipantExplorer({ capsule }: { capsule: RunCapsule }) {
  const hasParticipants = capsule.participants !== null;
  const visitors = capsule.participants?.filter((p) => p.isVisitor) ?? [];
  const members = capsule.participants?.filter((p) => !p.isVisitor) ?? [];

  const tabs: { value: Tab; label: string; count: number }[] = [
    { value: 'hares', label: 'Hares', count: capsule.hero.hares.length },
    { value: 'scribe', label: 'Scribe', count: capsule.hero.scribe ? 1 : 0 },
    ...(hasParticipants
      ? ([
          { value: 'visitors', label: 'Visitors', count: visitors.length },
          { value: 'members', label: 'Members', count: members.length },
        ] as const)
      : []),
  ];

  const [tab, setTab] = useState<Tab>('hares');

  return (
    <Card className={bleedCard} data-testid="capsule-participant-explorer">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Who was there</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex flex-wrap gap-1 rounded-md bg-muted p-1" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                tab === t.value ? 'bg-card font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
              data-testid={`participant-tab-${t.value}`}
            >
              {t.label}
              {t.count > 0 && <Badge className="px-1.5 py-0 text-[10px]">{t.count}</Badge>}
            </button>
          ))}
        </div>

        {tab === 'hares' && (
          <div className="space-y-1">
            {capsule.hero.hares.map((h) => (
              <Person key={h.userId} name={h.isLead ? `${h.name} (lead)` : h.name} userId={h.userId} />
            ))}
            {capsule.hero.hares.length === 0 && <p className="text-sm text-muted-foreground">No hare recorded.</p>}
          </div>
        )}
        {tab === 'scribe' && (
          <div className="space-y-1">
            {capsule.hero.scribe ? (
              <Person name={capsule.hero.scribe} userId={capsule.hero.scribeId} />
            ) : (
              <p className="text-sm text-muted-foreground">No scribe recorded.</p>
            )}
          </div>
        )}
        {tab === 'visitors' && (
          <div className="space-y-1">
            {visitors.map((p) => (
              <Person key={p.id} name={p.name} userId={p.userId} />
            ))}
            {visitors.length === 0 && <p className="text-sm text-muted-foreground">No visitors checked in.</p>}
          </div>
        )}
        {tab === 'members' && (
          <div className="space-y-1">
            {members.map((p) => (
              <Person key={p.id} name={p.name} userId={p.userId} />
            ))}
            {members.length === 0 && <p className="text-sm text-muted-foreground">No members checked in.</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
