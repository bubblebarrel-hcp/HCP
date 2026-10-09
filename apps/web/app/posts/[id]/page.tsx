import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { FeedLayout } from '@/components/layout/FeedLayout';
import { LeftNav } from '@/components/layout/LeftNav';
import { PostDetail } from '@/components/feed/PostDetail';
import { SignedInDetail } from '@/components/feed/SignedInDetail';
import { publicGet } from '@/lib/server-api';
import { shareMetadata } from '@/lib/share-metadata';
import type { HasherPost } from '@/lib/types';

// One post, at its own address (D51) — where a shared link lands and where a
// comment thread has room to be read.
//
// A post is as public as its author's profile (D57). The preview below is read
// anonymously, so a post from a locked profile gets no title or picture here;
// the page itself is opened for a follower by SignedInDetail.

export const revalidate = 60;

async function load(id: string) {
  return publicGet<{ post: HasherPost }>(`/posts/${id}`).catch(() => null);
}

function firstLine(body: string, max = 70) {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await load(id);
  if (!data) return shareMetadata({ title: 'Post', description: 'A post on Shiggy Trails.' });

  const post = data.post;
  return shareMetadata({
    // A post has no title, so the preview leads with who wrote it and lets the
    // words be the description rather than inventing a headline from them.
    title: `A post by ${post.author.name}`,
    description: firstLine(post.body, 200) || 'A post on Shiggy Trails.',
    image: post.photos[0]?.url,
  });
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await load(id);
  // A part of a thread has no page of its own: it is read in its place in the chain.
  if (data?.post.threadRootId) redirect(`/posts/${data.post.threadRootId}#part-${data.post.id}`);
  // The anonymous render cannot open a post from a locked profile, so a signed-in
  // reader gets a second chance from the browser (D57).
  return (
    <FeedLayout left={<LeftNav />}>
      {data ? <PostDetail post={data.post} /> : <SignedInDetail kind="post" id={id} />}
    </FeedLayout>
  );
}
