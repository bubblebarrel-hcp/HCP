import type { Metadata } from 'next';
import { CapsuleDetailPage } from './CapsuleDetailPage';
import { publicGet } from '@/lib/server-api';
import { shareMetadata } from '@/lib/share-metadata';
import type { RunCapsule } from '@/lib/types';

// A server shell around the Run Capsule, so a shared link carries a title and
// an Open Graph card (same fix as runs and reports). The capsule itself stays
// a Client Component — it publishes, archives and takes supplements.
//
// Unauthenticated, like every other preview: a capsule is as visible as the
// run it preserves, so asking as nobody is what keeps a members-only run's
// capsule from leaking its theme and photo into a link preview.

async function load(id: string) {
  return publicGet<{ capsule: RunCapsule }>(`/capsules/${id}`).catch(() => null);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await load(id);
  if (!data) {
    return shareMetadata({ title: 'Run Capsule', description: 'A Run Capsule on the Hash Community Platform.' });
  }

  const { capsule } = data;
  const { hero } = capsule;
  return shareMetadata({
    title: `#${hero.runNumber} · ${hero.title} — ${hero.kennel.shortName}`,
    description:
      capsule.summary ??
      `${hero.place ? `${hero.place}. ` : ''}${hero.leadHare ? `Hare: ${hero.leadHare}. ` : ''}The Hash Community Platform's record of this run.`,
    image: hero.photo,
  });
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CapsuleDetailPage id={id} />;
}
