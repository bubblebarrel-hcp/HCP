'use client';

import { useRef, useState } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ActionDialog } from '@/components/membership/ActionDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ACCEPTED_IMAGES, MAX_UPLOAD_BYTES, fileSize, uploadPhoto } from '@/lib/media';
import { bleedCard, cn } from '@/lib/utils';
import api, { errorMessage } from '@/services/api';

// The flyer for a run (D43). Kennels already make one for WhatsApp; this is
// where it lives so the feed can carry it, and so it sits beside the run's own
// details rather than instead of them.
//
// The picture is an ordinary run photo (D28) whose URL is written to
// `Run.posterUrl`, the same shape kennel branding uses (D37).
export function RunPoster({
  runId,
  posterUrl,
  canManage,
  onChanged,
}: {
  runId: string;
  posterUrl: string | null;
  canManage: boolean;
  onChanged: () => Promise<void> | void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(`${file.name} is ${fileSize(file.size)}. Flyers must be 25MB or smaller.`);
      return;
    }

    setBusy(true);
    try {
      const media = await uploadPhoto(file, { type: 'RUN', id: runId }, 'Run flyer');
      if (!media.url) throw new Error('Storage did not return an address for that picture');
      await api.patch(`/runs/${runId}`, { posterUrl: media.url });
      toast.success('Flyer added. It will show on the feed.');
      await onChanged();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not add that flyer'));
    } finally {
      setBusy(false);
    }
  }

  if (!posterUrl && !canManage) return null;

  return (
    <Card className={cn(bleedCard, 'overflow-hidden')} data-testid="run-poster">
      {posterUrl && (
        <>
          {/* Storage is an arbitrary host, so next/image would need every
              deployment's domain configured up front. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={posterUrl} alt="Flyer for this run" className="max-h-[40rem] w-full bg-muted object-contain" />
        </>
      )}
      {canManage && (
        <div className="flex flex-wrap items-center gap-2 p-4">
          <input
            ref={input}
            type="file"
            accept={ACCEPTED_IMAGES}
            onChange={(event) => void onFile(event)}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            data-testid="run-poster-input"
          />
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => input.current?.click()}
            data-testid="run-poster-edit"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Camera className="h-4 w-4" aria-hidden />}
            {posterUrl ? 'Change the flyer' : 'Add the flyer'}
          </Button>
          {posterUrl && (
            <ActionDialog
              trigger={
                <Button variant="ghost" className="text-destructive" data-testid="run-poster-remove">
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Remove
                </Button>
              }
              title="Remove the flyer?"
              description="The run keeps its details and still appears on the feed — just without the picture."
              confirmLabel="Remove it"
              destructive
              onConfirm={async () => {
                try {
                  await api.patch(`/runs/${runId}`, { posterUrl: null });
                  toast.success('Flyer removed.');
                  await onChanged();
                } catch (err) {
                  toast.error(errorMessage(err, 'Could not remove the flyer'));
                  throw err;
                }
              }}
            />
          )}
          {!posterUrl && (
            <p className="text-sm text-muted-foreground">
              The picture your kennel posts to WhatsApp. The run&rsquo;s own details do the talking without it.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
