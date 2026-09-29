'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Archive, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { capsuleStatusLabel, capsuleStatusTone } from '@/lib/capsules';
import type { RunCapsule } from '@/lib/types';
import { bleedCard, cn } from '@/lib/utils';
import api from '@/services/api';

// The capsule as it appears on the run: a quiet line while it is still
// gathering, a way in once there is something to read (D30).
export function CapsulePanel({ runId }: { runId: string }) {
  const [capsule, setCapsule] = useState<RunCapsule | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ data: { capsule: RunCapsule | null } }>(`/runs/${runId}/capsule`)
      .then((res) => {
        if (cancelled) return;
        setCapsule(res.data.data.capsule);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [runId]);

  if (!loaded || !capsule) return null;

  const worthOpening = capsule.timeline.length > 0 || capsule.status === 'PUBLISHED' || capsule.status === 'ARCHIVED';

  return (
    <Card className={bleedCard} data-testid="capsule-panel">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Archive className="h-4 w-4" aria-hidden />
          Run Capsule
        </CardTitle>
        <CardDescription>
          {capsule.summary ?? 'The archive builds itself while the run happens.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={cn(capsuleStatusTone(capsule.status))} data-testid="capsule-status">
            {capsuleStatusLabel[capsule.status]}
          </Badge>
          {capsule.viewer.awaitingReport && (
            <span className="text-sm text-muted-foreground">Waiting on the Trail Report.</span>
          )}
        </div>
        {worthOpening && (
          <Button asChild variant="outline" data-testid="capsule-open">
            <Link href={`/capsules/${capsule.id}`}>
              Open the Run Capsule
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
