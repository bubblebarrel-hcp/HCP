'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import { TARGET_WORDS, type ReportTargetType } from '@/lib/moderation';
import { formatDate } from '@/lib/utils';
import api from '@/services/api';

// What you have reported, and what we said back (D61). Never who was spoken to or
// what was done to anybody: only whether it was looked at and whether we acted.

interface MyReport {
  id: string;
  targetType: ReportTargetType;
  reasonLabel: string;
  status: 'OPEN' | 'IN_REVIEW' | 'ACTIONED' | 'DISMISSED';
  outcome: string;
  createdAt: string;
}

export default function MyReportsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<MyReport[] | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    api
      .get<{ data: { items: MyReport[] } }>('/me/reports')
      .then((res) => alive && setItems(res.data.data.items))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [user]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-12">
      <Link href="/account/privacy" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to privacy
      </Link>
      <Card data-testid="my-reports">
        <CardHeader>
          <CardTitle className="text-2xl">My reports</CardTitle>
          <CardDescription>
            Only you can see these. The hasher you reported is never told it was you, and you are never told what was done
            to them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items === null ? (
            <div className="h-24 animate-pulse rounded-lg bg-muted" aria-busy />
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="my-reports-empty">
              You have not reported anything.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((r) => (
                <li key={r.id} className="space-y-1 py-3" data-testid="my-report">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {r.reasonLabel} · {TARGET_WORDS[r.targetType]}
                    <Badge>{r.status === 'ACTIONED' ? 'Action taken' : r.status === 'DISMISSED' ? 'Reviewed' : 'With us'}</Badge>
                  </p>
                  <p className="text-sm text-muted-foreground">{r.outcome}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
