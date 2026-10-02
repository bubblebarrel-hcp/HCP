'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { AudienceSelect } from '@/components/profile/AudienceSelect';
import { useAuth } from '@/context/AuthContext';
import type { Audience } from '@/lib/types';
import api, { errorMessage } from '@/services/api';

// The owner's control for who can read one reel or post (D57), on its own page.
//
// Those pages are served from the cache with no session, so who is looking is
// not known when they render: this shows itself only once the browser has a
// session and it is the author's. The API checks the author again on the write.
export function AudienceControl({
  kind,
  id,
  authorId,
  initial,
}: {
  kind: 'reel' | 'post';
  id: string;
  authorId: string;
  initial: Audience;
}) {
  const { user } = useAuth();
  const [value, setValue] = useState<Audience>(initial);
  const [saving, setSaving] = useState(false);

  if (user?.id !== authorId) return null;

  async function change(next: Audience) {
    const before = value;
    setValue(next);
    setSaving(true);
    try {
      await api.patch(`/${kind}s/${id}`, { visibility: next });
      toast.success(`Who can ${kind === 'reel' ? 'watch' : 'read'} this ${kind} is updated.`);
    } catch (err) {
      setValue(before);
      toast.error(errorMessage(err, 'Could not change who can see it'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2 border-t border-border px-4 py-3 text-sm" data-testid="audience-control">
      <span className="text-muted-foreground">Who can {kind === 'reel' ? 'watch' : 'read'} it</span>
      <AudienceSelect
        value={value}
        onChange={(next) => void change(next)}
        disabled={saving}
        label={`Who can ${kind === 'reel' ? 'watch' : 'read'} this ${kind}`}
      />
    </div>
  );
}
