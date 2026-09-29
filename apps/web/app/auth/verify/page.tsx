'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, MailCheck, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import api, { errorMessage } from '@/services/api';

// One page, two jobs (D31): "we have sent you a link" straight after
// registering, and "here is my link" when they come back from the inbox.

function ResendButton({ email }: { email: string }) {
  const [sending, setSending] = useState(false);

  async function resend() {
    setSending(true);
    try {
      await api.post('/auth/verification/resend', { email });
      // The API answers the same way whether or not the address is registered,
      // so this message must not claim more than it knows.
      toast.success('If that address needs confirming, a new link is on its way.');
    } catch {
      toast.error('Could not send it just now. Try again in a minute.');
    } finally {
      setSending(false);
    }
  }

  return (
    <Button type="button" variant="outline" onClick={resend} disabled={sending} data-testid="verify-resend">
      {sending ? 'Sending…' : 'Send it again'}
    </Button>
  );
}

function VerifyInner() {
  const params = useSearchParams();
  const token = params.get('token');
  const sentTo = params.get('sent');
  const [state, setState] = useState<'checking' | 'done' | 'failed'>(token ? 'checking' : 'done');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api
      .post<{ data: { alreadyVerified: boolean } }>('/auth/verify-email', { token })
      .then((res) => {
        if (cancelled) return;
        setMessage(
          res.data.data.alreadyVerified
            ? 'That address was already confirmed. You can log in.'
            : 'Your email is confirmed. Welcome to the Hash Community Platform.',
        );
        setState('done');
      })
      .catch((err) => {
        if (cancelled) return;
        setMessage(errorMessage(err, 'That confirmation link is no longer valid.'));
        setState('failed');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (token && state === 'checking') {
    return <div className="h-40 animate-pulse rounded-xl bg-card" aria-busy />;
  }

  // Came back from the inbox.
  if (token) {
    const ok = state === 'done';
    return (
      <Card className="w-full" data-testid="verify-result">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            {ok ? (
              <CheckCircle2 className="h-6 w-6 text-primary-strong" aria-hidden />
            ) : (
              <XCircle className="h-6 w-6 text-destructive" aria-hidden />
            )}
            {ok ? 'You are confirmed' : 'That link did not work'}
          </CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {ok ? (
            <Button asChild data-testid="verify-login">
              <Link href="/auth/login">Log in</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="outline">
                <Link href="/auth/login">Back to sign in</Link>
              </Button>
              <p className="w-full text-sm text-muted-foreground">
                Links last 24 hours and can only be used once. Ask for a fresh one from the sign-in page.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  // Just registered.
  return (
    <Card className="w-full" data-testid="verify-sent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <MailCheck className="h-6 w-6 text-primary-strong" aria-hidden />
          Check your email
        </CardTitle>
        <CardDescription>
          {sentTo
            ? `We sent a confirmation link to ${sentTo}. Click it and you are in.`
            : 'We sent you a confirmation link. Click it and you are in.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          The link lasts 24 hours. Nothing else to do until you have clicked it: your account is not usable yet.
        </p>
        <div className="flex flex-wrap gap-2">
          {sentTo && <ResendButton email={sentTo} />}
          <Button asChild variant="outline">
            <Link href="/auth/login">Back to sign in</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function VerifyPage() {
  return (
    <div className="mx-auto flex max-w-md px-4 py-16">
      <Suspense fallback={<div className="h-40 w-full animate-pulse rounded-xl bg-card" aria-busy />}>
        <VerifyInner />
      </Suspense>
    </div>
  );
}
