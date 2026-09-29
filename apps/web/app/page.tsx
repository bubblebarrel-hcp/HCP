import { cookies } from "next/headers";
import Link from "next/link";
import { Composer } from "@/components/feed/Composer";
import { FeedTabs } from "@/components/feed/FeedTabs";
import { PullToRefresh } from "@/components/feed/PullToRefresh";
import { ReelStrip } from "@/components/feed/ReelStrip";
import { WelcomeCard } from "@/components/feed/WelcomeCard";
import { FeedLayout } from "@/components/layout/FeedLayout";
import { LeftNav } from "@/components/layout/LeftNav";
import { RightRail } from "@/components/layout/RightRail";
import { publicGet } from "@/lib/server-api";
import type { FeedPage, Page, PublicKennel, Reel } from "@/lib/types";

export const revalidate = 60;

// Home is the community feed (Ch.9 Part 4, D42): reels across the top, then
// what hashers have made — trail reports and photos from everywhere. Kennels
// have their own directory and no longer fill this page.
//
// Server-rendered, so it reads without JavaScript. What is rendered here is the
// public view; ReelStrip asks again once the browser has a session, because a
// member can see reels a visitor cannot.
export default async function Home() {
  // Composer or welcome card is decided on the server, so it renders without JS and
  // never flashes. Only cookie presence is read; the proxy still owns the session.
  const signedIn = (await cookies()).has("hcp_refresh");

  const [feed, reels, kennels] = await Promise.all([
    publicGet<FeedPage>("/feed?limit=12").catch(() => null),
    publicGet<Page<Reel>>("/reels?limit=15").catch(() => null),
    publicGet<Page<PublicKennel>>("/kennels?limit=1").catch(() => null),
  ]);

  const items = feed?.items ?? [];

  return (
    <FeedLayout left={<LeftNav />} right={<RightRail kennelCount={kennels?.total ?? 0} />}>
      <h1 className="sr-only">Home</h1>
      <PullToRefresh>
        <div className="space-y-4">
          {signedIn ? <Composer /> : <WelcomeCard />}
          <ReelStrip initial={reels?.items ?? []} />

          {/* The cards are server-rendered above; FeedTabs only takes over when
              a signed-in reader switches to what they follow (D50). */}
          <FeedTabs initial={items} hasMore={feed?.hasMore ?? false} />
        </div>
      </PullToRefresh>
    </FeedLayout>
  );
}
