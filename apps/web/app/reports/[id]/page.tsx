import type { Metadata } from 'next';
import { ReportDetailPage } from './ReportDetailPage';
import { publicGet } from '@/lib/server-api';
import { shareMetadata } from '@/lib/share-metadata';
import type { TrailReport } from '@/lib/types';

// A server shell around Scribe Studio, so a shared trail report link carries a
// title and an Open Graph card (D50). The studio has to stay a Client
// Component — it writes, autosaves, reviews and publishes.
//
// Unauthenticated, like every other preview: a draft is private to the
// editorial circle (BR-SCRIBE-004), so asking as nobody is what guarantees an
// unpublished report cannot be previewed out of the kennel by pasting its URL.

async function load(id: string) {
  return publicGet<{ report: TrailReport }>(`/reports/${id}`).catch(() => null);
}

// A preview wants the opening lines, not the trail report.
function excerpt(body: string | null, max = 200) {
  if (!body) return null;
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await load(id);
  // Covers a report that does not exist, one on a members-only run, and a
  // draft. None of them say which, and none of them say "not found" — the
  // Scribe opening their own draft would see that lie in the tab.
  if (!data) {
    return shareMetadata({ title: 'Trail report', description: 'A trail report on the Hash Community Platform.' });
  }

  const report = data.report;
  const run = report.run;
  return shareMetadata({
    title: `${report.title} — ${run.kennel.shortName}`,
    description:
      excerpt(report.body) ??
      `Run #${run.runNumber}${run.title ? ` · ${run.title}` : ''}, written up by ${report.scribe}.`,
    // A report has no photo of its own yet; the run's own flyer is the same
    // "visual attraction" fallback the feed card and reshare preview use.
    image: run.posterUrl,
  });
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReportDetailPage id={id} />;
}
