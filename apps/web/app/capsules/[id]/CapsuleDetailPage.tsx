'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Archive, BookOpen, Camera, Footprints, Music, Trophy, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { Avatar } from '@/components/Avatar';
import { CapsuleExplorer } from '@/components/capsules/CapsuleExplorer';
import { ParticipantExplorer } from '@/components/capsules/ParticipantExplorer';
import { RelatedCapsules } from '@/components/capsules/RelatedCapsules';
import { RunReels } from '@/components/runs/RunReels';
import { FeedLayout } from '@/components/layout/FeedLayout';
import { LeftNav } from '@/components/layout/LeftNav';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { capsuleStatusLabel, capsuleStatusTone, supplementTypeLabel } from '@/lib/capsules';
import { formatRunDate } from '@/lib/runs';
import type { RunCapsule, SupplementalType } from '@/lib/types';
import { bleedCard, brandColor, cn, formatDate } from '@/lib/utils';
import api, { errorMessage } from '@/services/api';

// The Run Capsule: the record of one run, assembled automatically and frozen
// once published. This is the record, not yet the Explorer of 08H-02.

const SUPPLEMENT_TYPES: SupplementalType[] = ['REFLECTION', 'PHOTO', 'SCANNED_NEWSLETTER', 'INTERVIEW', 'DOCUMENT', 'OTHER'];

function Stat({ icon: Icon, value, label }: { icon: typeof Users; value: number; label: string }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span>
        <span className="font-semibold">{value}</span> {label}
      </span>
    </div>
  );
}

export function CapsuleDetailPage({ id }: { id: string }) {
  const { loading } = useAuth();
  const [capsule, setCapsule] = useState<RunCapsule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [supplement, setSupplement] = useState<{ type: SupplementalType; title: string; description: string }>({
    type: 'REFLECTION',
    title: '',
    description: '',
  });

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    api
      .get<{ data: { capsule: RunCapsule } }>(`/capsules/${id}`)
      .then((res) => {
        if (cancelled) return;
        setCapsule(res.data.data.capsule);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'Run Capsule not found'));
      });
    return () => {
      cancelled = true;
    };
  }, [id, loading]);

  async function act(action: string, payload: Record<string, unknown> = {}) {
    setBusy(true);
    try {
      const res = await api.post<{ data: { capsule: RunCapsule } }>(`/capsules/${id}/actions/${action}`, payload);
      setCapsule(res.data.data.capsule);
      setReason('');
      toast.success(action === 'publish' ? 'Capsule published' : 'Capsule archived');
    } catch (err) {
      toast.error(errorMessage(err, 'That did not work'));
    } finally {
      setBusy(false);
    }
  }

  async function contribute() {
    setBusy(true);
    try {
      const res = await api.post<{ data: { capsule: RunCapsule } }>(`/capsules/${id}/supplements`, {
        type: supplement.type,
        title: supplement.title,
        description: supplement.description || null,
      });
      setCapsule(res.data.data.capsule);
      setSupplement({ type: 'REFLECTION', title: '', description: '' });
      toast.success('Added to the archive');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not add it'));
    } finally {
      setBusy(false);
    }
  }

  const shell = (children: React.ReactNode) => (
    <FeedLayout left={<LeftNav />} wide>
      {children}
    </FeedLayout>
  );

  if (error) {
    return shell(
      <Card className={cn(bleedCard, 'p-8 text-center')} data-testid="capsule-not-found">
        <p className="font-semibold">{error}</p>
        <p className="mt-1 text-sm text-muted-foreground">A capsule is as visible as the run it preserves.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/runs">Back to runs</Link>
        </Button>
      </Card>,
    );
  }
  if (!capsule) return shell(<div className="h-96 animate-pulse bg-card sm:rounded-xl" aria-busy />);

  const { hero } = capsule;

  return shell(
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-4">
        <Card className={cn(bleedCard, 'overflow-hidden')} data-testid="capsule-page">
          <div className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cn(capsuleStatusTone(capsule.status))} data-testid="capsule-status">
                {capsuleStatusLabel[capsule.status]}
              </Badge>
              {capsule.isLegacyImport && <Badge>Legacy</Badge>}
              <Link href={`/kennels/${hero.kennel.slug}`} className="inline-flex items-center gap-2 text-sm font-medium hover:underline">
                <Avatar name={hero.kennel.shortName} size="sm" color={brandColor(hero.kennel.primaryColor)} />
                {hero.kennel.name}
              </Link>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl" data-testid="capsule-title">
              #{hero.runNumber} · {hero.title}
            </h1>
            {hero.theme && <p className="mt-1 italic">{hero.theme}</p>}
            <p className="mt-2 text-sm text-muted-foreground">
              {formatRunDate(hero.startsAt, hero.timeZone)}
              {hero.place && ` · ${hero.place}`}
              {hero.leadHare && ` · Hare: ${hero.leadHare}`}
              {hero.scribe && ` · Scribe: ${hero.scribe}`}
            </p>
            {capsule.summary && <p className="mt-3 text-[15px] font-medium" data-testid="capsule-summary">{capsule.summary}</p>}

            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
              <Stat icon={Users} value={capsule.stats.attended} label="on the run" />
              <Stat icon={Footprints} value={capsule.stats.hares} label="hares" />
              <Stat icon={Camera} value={capsule.stats.photos} label="photos" />
              <Stat icon={Trophy} value={capsule.stats.awards} label="down-downs" />
              <Stat icon={Music} value={capsule.stats.songs} label="songs" />
            </div>

            {capsule.report && (
              <Button asChild variant="outline" className="mt-4" data-testid="capsule-report-link">
                <Link href={`/reports/${capsule.report.id}`}>
                  <BookOpen className="h-4 w-4" aria-hidden />
                  Read the Trail Report
                </Link>
              </Button>
            )}
          </div>
        </Card>

        <CapsuleExplorer capsule={capsule} />
        <RunReels runId={capsule.runId} />

        {capsule.circle && (
          <Card className={bleedCard} data-testid="capsule-circle">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Circle</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {capsule.circle.awards.length > 0 && (
                <ul className="space-y-2">
                  {capsule.circle.awards.map((a) => (
                    <li key={a.id}>
                      <span className="font-medium">{a.title}</span>
                      {a.recipientName && <span> — {a.recipientName}</span>}
                      {a.isDownDown && <Badge className="ml-2">Down-down</Badge>}
                      {a.reason && <p className="text-muted-foreground">{a.reason}</p>}
                    </li>
                  ))}
                </ul>
              )}
              {capsule.circle.songs.length > 0 && <p>Songs: {capsule.circle.songs.join(', ')}</p>}
              {capsule.circle.announcements && <p className="whitespace-pre-line">{capsule.circle.announcements}</p>}
              {capsule.circle.awards.length === 0 && capsule.circle.songs.length === 0 && !capsule.circle.announcements && (
                <p className="text-muted-foreground">No Circle record was kept.</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        {(capsule.viewer.canPublish || capsule.viewer.canArchive || capsule.viewer.awaitingReport) && (
          <Card className={bleedCard} data-testid="capsule-actions">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Publication</CardTitle>
              <CardDescription>
                {capsule.viewer.awaitingReport
                  ? 'The capsule is built around the Trail Report. Publish that first.'
                  : 'Publishing makes this the kennel’s permanent record of the run.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {capsule.viewer.canPublish && (
                <Button type="button" disabled={busy} onClick={() => act('publish')} data-testid="capsule-publish">
                  Publish the capsule
                </Button>
              )}
              {capsule.viewer.canArchive && (
                <div className="space-y-2">
                  <Field label="Why archive it" htmlFor="capsule-archive-reason">
                    <Input
                      id="capsule-archive-reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Replaced by the anniversary edition"
                      data-testid="capsule-archive-reason"
                    />
                  </Field>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy || reason.trim().length < 3}
                    onClick={() => act('archive', { reason })}
                    data-testid="capsule-archive"
                  >
                    <Archive className="h-4 w-4" aria-hidden />
                    Archive
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {capsule.health && (
          <Card className={bleedCard} data-testid="capsule-health">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Completeness</CardTitle>
              <CardDescription>Advisory only. None of it blocks publication.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {capsule.health.missingReport && <li>No Trail Report yet.</li>}
                {capsule.health.missingCircle && <li>No Circle record.</li>}
                {capsule.health.noPhotos && <li>No photographs.</li>}
                {capsule.health.uncaptionedMedia > 0 && <li>{capsule.health.uncaptionedMedia} photos without captions.</li>}
                {!capsule.health.missingReport &&
                  !capsule.health.missingCircle &&
                  !capsule.health.noPhotos &&
                  capsule.health.uncaptionedMedia === 0 && <li className="text-muted-foreground">Nothing missing.</li>}
              </ul>
            </CardContent>
          </Card>
        )}

        <ParticipantExplorer capsule={capsule} />

        <Card className={bleedCard} data-testid="capsule-supplements">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Added later</CardTitle>
            <CardDescription>Kept apart from the record, always attributed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {capsule.supplements.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing has been added since.</p>
            )}
            <ul className="space-y-3">
              {capsule.supplements.map((s) => (
                <li key={s.id} className="rounded-lg border border-border p-3 text-sm">
                  <Badge>{supplementTypeLabel[s.type]}</Badge>
                  <p className="mt-1 font-medium">{s.title}</p>
                  {s.description && <p className="text-muted-foreground">{s.description}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.contributedBy} · {formatDate(s.addedAt)}
                  </p>
                </li>
              ))}
            </ul>

            {capsule.viewer.canContribute && (
              <div className="space-y-2 border-t border-border pt-3">
                <Field label="What are you adding" htmlFor="supplement-type">
                  <Select
                    id="supplement-type"
                    value={supplement.type}
                    onChange={(e) => setSupplement((s) => ({ ...s, type: e.target.value as SupplementalType }))}
                    data-testid="supplement-type"
                  >
                    {SUPPLEMENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {supplementTypeLabel[t]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Title" htmlFor="supplement-title">
                  <Input
                    id="supplement-title"
                    value={supplement.title}
                    onChange={(e) => setSupplement((s) => ({ ...s, title: e.target.value }))}
                    placeholder="Ten years on"
                    data-testid="supplement-title"
                  />
                </Field>
                <Textarea
                  value={supplement.description}
                  onChange={(e) => setSupplement((s) => ({ ...s, description: e.target.value }))}
                  rows={3}
                  placeholder="I still remember the shiggy."
                  aria-label="Description"
                  data-testid="supplement-description"
                />
                <Button
                  type="button"
                  disabled={busy || supplement.title.trim().length === 0}
                  onClick={contribute}
                  data-testid="supplement-add"
                >
                  Add to the archive
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <RelatedCapsules items={capsule.related} />
      </div>
    </div>,
  );
}
