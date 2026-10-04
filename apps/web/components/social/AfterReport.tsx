'use client';

import { useState } from 'react';
import { BellOff, ShieldBan } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api, { errorMessage } from '@/services/api';

// After a report, the person behind it can be muted or blocked straight away
// (D60). Telling us and not wanting to see them are different things, and the
// second is often wanted at once.
export function AfterReport({ userId }: { userId: string }) {
  const [done, setDone] = useState<'MUTE' | 'BLOCK' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function set(kind: 'MUTE' | 'BLOCK') {
    setError(null);
    try {
      await api.put(`/hashers/${userId}/${kind === 'BLOCK' ? 'block' : 'mute'}`);
      setDone(kind);
    } catch (err) {
      setError(errorMessage(err, 'That did not work'));
    }
  }

  if (done) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="after-report-done">
        {done === 'BLOCK' ? 'Blocked. You can undo it under Privacy.' : 'Muted. You can undo it under Privacy.'}
      </p>
    );
  }
  return (
    <div className="space-y-2" data-testid="after-report">
      <p className="text-sm text-muted-foreground">Do you want to stop seeing them as well?</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => void set('MUTE')}>
          <BellOff className="h-4 w-4" aria-hidden /> Mute
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => void set('BLOCK')}>
          <ShieldBan className="h-4 w-4" aria-hidden /> Block
        </Button>
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
