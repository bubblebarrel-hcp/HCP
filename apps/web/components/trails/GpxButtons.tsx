'use client';

import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { Trail } from '@/lib/types';
import api, { errorMessage } from '@/services/api';

// FR-TRAIL-002: bring a route in from a GPX file, and take the trail out as one.
//
// Export is offered to whoever may see the route (the API refuses anyone else,
// so a hidden trail cannot be taken before it is released). Import is planning
// work and is only offered while the trail can still be edited.

// The API's request limit is 2 MB; a hash trail is far smaller once a watch's
// every-second points are thinned, but the file has to fit to be sent.
const MAX_BYTES = 1_800_000;

interface ImportSummary {
  route: { points: number; distanceM: number | null; source: string | null } | null;
  waypoints: number;
  beerChecks: number;
  skipped: { badPoints: number; overCap: number; chalk: number };
}

function filenameFor(trail: Trail) {
  const slug = trail.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'trail';
  return `${slug}.gpx`;
}

export function GpxButtons({
  trail,
  canImport,
  onTrail,
}: {
  trail: Trail;
  canImport: boolean;
  onTrail: (trail: Trail) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);

  const hasPlaces = (trail.secret?.waypoints.length ?? 0) + (trail.secret?.beerChecks.length ?? 0) > 0;

  async function download() {
    setBusy(true);
    try {
      // Text, untouched: the proxy hands a GPX file through as it arrived.
      const res = await api.get<string>(`/trails/${trail.id}/gpx`, {
        responseType: 'text',
        transformResponse: (data) => data,
      });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/gpx+xml' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = filenameFor(trail);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not export that trail'));
    } finally {
      setBusy(false);
    }
  }

  async function pick(chosen: File | undefined) {
    if (!chosen) return;
    if (chosen.size > MAX_BYTES) {
      toast.error('That file is too big to import (the limit is about 1.8 MB). Trim the track in your GPS app first.');
      return;
    }
    setReplace(false);
    setFile({ name: chosen.name, text: await chosen.text() });
  }

  async function runImport() {
    if (!file) return;
    setBusy(true);
    try {
      const res = await api.post<{ data: { import: ImportSummary; trail: Trail } }>(`/trails/${trail.id}/import/gpx`, {
        gpx: file.text,
        replace,
      });
      const summary = res.data.data.import;
      onTrail(res.data.data.trail);
      const parts = [
        summary.route ? `a route of ${summary.route.points} points` : null,
        summary.waypoints ? `${summary.waypoints} waypoint${summary.waypoints === 1 ? '' : 's'}` : null,
        summary.beerChecks ? `${summary.beerChecks} beer check${summary.beerChecks === 1 ? '' : 's'}` : null,
      ].filter(Boolean);
      const left = summary.skipped.badPoints + summary.skipped.overCap;
      toast.success(`Imported ${parts.join(', ')}.${left ? ` ${left} point${left === 1 ? ' was' : 's were'} left out.` : ''}`);
      setFile(null);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not read that GPX file'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2" data-testid="gpx-buttons">
        {canImport && (
          <>
            <input
              ref={input}
              type="file"
              accept=".gpx,application/gpx+xml,text/xml,application/xml"
              className="sr-only"
              data-testid="gpx-file"
              aria-label="Choose a GPX file to import"
              onChange={(e) => {
                void pick(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <Button type="button" size="sm" variant="outline" onClick={() => input.current?.click()} data-testid="gpx-import">
              <Upload className="h-4 w-4" aria-hidden />
              Import GPX
            </Button>
          </>
        )}
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void download()} data-testid="gpx-export">
          <Download className="h-4 w-4" aria-hidden />
          Export GPX
        </Button>
      </div>

      <Dialog open={Boolean(file)} onOpenChange={(open) => !open && setFile(null)}>
        <DialogContent
          title="Import a GPX file"
          description="The route replaces the one on the map. Waypoints and beer checks are added to the trail."
        >
          <p className="text-sm">
            <span className="font-medium">{file?.name}</span>
          </p>
          {hasPlaces && (
            <label className="flex min-h-11 items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-5 w-5 accent-primary"
                checked={replace}
                onChange={(e) => setReplace(e.target.checked)}
                data-testid="gpx-replace"
              />
              <span>Put away the waypoints and beer checks already on this trail first. They stay in its history.</span>
            </label>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setFile(null)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => void runImport()} data-testid="gpx-import-confirm">
              {busy ? 'Importing…' : 'Import'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
