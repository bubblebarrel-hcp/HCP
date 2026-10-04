import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FeedLayout } from '@/components/layout/FeedLayout';
import { LeftNav } from '@/components/layout/LeftNav';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { publicGet } from '@/lib/server-api';
import { bleedCard, cn } from '@/lib/utils';

// Where an @mention goes (D59). A mention is typed as a username, a hasher's page
// is addressed by id, so this looks the one up and hands over to the other. Nobody
// holding the name is a plain page rather than a broken link, because a mention is
// words somebody wrote and it may name nobody at all.

export const revalidate = 30;

const USERNAME = /^[a-z0-9][a-z0-9_.]{1,28}[a-z0-9]$/;

export default async function UsernamePage({ params }: { params: Promise<{ username: string }> }) {
  const username = (await params).username.toLowerCase();
  const found = USERNAME.test(username)
    ? await publicGet<{ id: string }>(`/usernames/${encodeURIComponent(username)}`).catch(() => null)
    : null;
  if (found) redirect(`/hashers/${found.id}`);

  return (
    <FeedLayout left={<LeftNav />}>
      <Card className={cn(bleedCard, 'p-8 text-center')} data-testid="username-missing">
        <h1 className="text-xl font-semibold">No hasher goes by @{username}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          They may have changed their username, or it may have been typed wrong.
        </p>
        <Button asChild className="mt-4">
          <Link href="/search">Search for a hasher</Link>
        </Button>
      </Card>
    </FeedLayout>
  );
}
