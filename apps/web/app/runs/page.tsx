'use client';

import { FeedLayout } from '@/components/layout/FeedLayout';
import { LeftNav } from '@/components/layout/LeftNav';
import { HareWanted } from '@/components/runs/HareWanted';
import { RunList } from '@/components/runs/RunList';
import { Card } from '@/components/ui/card';
import { bleedCard, cn } from '@/lib/utils';

export default function RunsPage() {
  return (
    <FeedLayout left={<LeftNav />} wide>
      <Card className={cn(bleedCard, 'mb-4 p-5')}>
        <h1 className="text-2xl font-bold tracking-tight">Runs</h1>
        <p className="mt-1 text-muted-foreground">
          Runs you can join, from every kennel you can see. Visitors welcome where the kennel allows it.
        </p>
      </Card>
      <div className="mb-4">
        <HareWanted title="Runs looking for a hare" />
      </div>
      <RunList path="/runs" />
    </FeedLayout>
  );
}
