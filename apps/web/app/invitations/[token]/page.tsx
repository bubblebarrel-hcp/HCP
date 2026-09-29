'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Mail, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { typeLabel } from '@/lib/membership';
import type { InvitationPreview } from '@/lib/types';
import api, { errorMessage } from '@/services/api';

// FR-MEMBER-005 / D53. The one join path that reaches a hidden kennel.
// Preview is anonymous (the API allows it); accepting needs a session, the
// same shape as the password reset and email verification links.

export default function AcceptInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ data: InvitationPreview }>(`/invitations/token/${token}`)
      .then((res) => {
        if (!cancelled) setPreview(res.data.data);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'That invitation link is no longer valid.'));
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function accept() {
    setAccepting(true);
    try {
      const res = await api.post<{ data: { kennel: { slug: string; name: string } } }>(`/invitations/token/${token}/accept`);
      setAccepted(true);
      toast.success(`Welcome to ${res.data.data.kennel.name}.`);
      router.push(`/kennels/${res.data.data.kennel.slug}`);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not accept that invitation'));
    } finally {
      setAccepting(false);
    }
  }

  if (error) {
    return (
      <div className="mx-auto flex max-w-md px-4 py-16">
        <Card className="w-full" data-testid="invitation-invalid">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <XCircle className="h-6 w-6 text-destructive" aria-hidden />
              That link did not work
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/kennels">Find a kennel</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!preview || authLoading) {
    return (
      <div className="mx-auto flex max-w-md px-4 py-16">
        <div className="h-64 w-full animate-pulse rounded-xl bg-card" aria-busy />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md px-4 py-16">
      <Card className="w-full" data-testid="invitation-preview">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Mail className="h-6 w-6 text-primary-strong" aria-hidden />
            You&rsquo;re invited to {preview.kennel.name}
          </CardTitle>
          <CardDescription>
            As a {typeLabel[preview.membershipType]}. This invitation is good until{' '}
            {new Date(preview.expiresAt).toLocaleDateString()}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {accepted ? (
            <p className="flex items-center gap-2 text-sm font-medium text-primary-strong">
              <CheckCircle2 className="h-5 w-5" aria-hidden />
              Accepted. Taking you to the kennel…
            </p>
          ) : user ? (
            <Button onClick={() => void accept()} disabled={accepting} className="w-full" data-testid="accept-invitation">
              {accepting ? 'Joining…' : `Join ${preview.kennel.shortName}`}
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Log in or create an account, then come back to this link to accept.</p>
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link href="/auth/login">Log in</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/auth/register">Create an account</Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
