'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BrandMark } from '@/components/brand/HashLogo';
import api, { errorMessage } from '@/services/api';

// A held hasher's way to answer back (D75). They cannot sign in, so they prove who
// they are with the password, as they would to sign in, and nothing else is needed.
// What they write goes to the staff who decide it. They are not asked who reported
// them and are not told.

interface HoldState {
  held: boolean;
  level: 'HOLD' | 'REVIEW_HOLD' | null;
  endsAt: string | null;
  reviewed: boolean;
  canAppeal: boolean;
  appeal: { status: 'OPEN' | 'GRANTED' | 'DENIED' | 'MOOT'; message: string; decisionNote: string | null; createdAt: string; decidedAt: string | null } | null;
}

const MIN = 10;
const MAX = 1000;

export default function AppealPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<HoldState | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post<{ data: HoldState }>('/auth/hold', { email: email.trim(), password });
      setState(res.data.data);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not check that. Is the email and password right?'));
    } finally {
      setBusy(false);
    }
  }

  async function appeal(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/auth/appeal', { email: email.trim(), password, message });
      setSent(true);
      setState((s) => (s ? { ...s, canAppeal: false } : s));
    } catch (err) {
      toast.error(errorMessage(err, 'Could not send your appeal'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-lg px-4 py-16">
      <Card className="w-full">
        <CardHeader>
          <BrandMark className="mb-2 h-14 w-14" />
          <CardTitle className="text-2xl">Appeal a hold</CardTitle>
          <CardDescription>
            If your account is on hold, sign in here to tell a moderator your side. A person reads every appeal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!state ? (
            <form onSubmit={check} className="space-y-4" data-testid="appeal-check">
              <Field label="Email" htmlFor="appeal-email">
                <Input id="appeal-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </Field>
              <Field label="Password" htmlFor="appeal-password">
                <Input id="appeal-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </Field>
              <Button type="submit" className="w-full" disabled={busy || !email || !password}>
                {busy ? 'Checking…' : 'Continue'}
              </Button>
            </form>
          ) : !state.held ? (
            <p className="rounded-lg bg-muted p-4 text-sm" data-testid="appeal-nothing">
              There is nothing on this account to appeal. If you cannot sign in for another reason, write to us.
            </p>
          ) : sent || state.appeal ? (
            <div className="space-y-3" data-testid="appeal-status">
              {(() => {
                const a = state.appeal;
                if (sent && !a) {
                  return <p className="font-semibold">Your appeal has been sent. You will be told what a moderator decides, by email.</p>;
                }
                if (a?.status === 'OPEN') return <p className="font-semibold">Your appeal is with a moderator. You will be told what they decide, by email.</p>;
                if (a?.status === 'DENIED') {
                  return (
                    <>
                      <p className="font-semibold">A moderator reviewed your appeal and the hold stands.</p>
                      {a.decisionNote && <p className="whitespace-pre-line text-sm text-muted-foreground">They said: {a.decisionNote}</p>}
                    </>
                  );
                }
                return <p className="font-semibold">Your appeal was decided. Try signing in.</p>;
              })()}
              {state.endsAt && !state.reviewed && (
                <p className="text-sm text-muted-foreground">If nothing changes sooner, the hold lifts on {new Date(state.endsAt).toUTCString()}.</p>
              )}
              <Button asChild variant="outline">
                <Link href="/auth/login">Back to log in</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={appeal} className="space-y-4" data-testid="appeal-form">
              <p className="text-sm text-muted-foreground">
                {state.level === 'HOLD' && state.endsAt
                  ? `Your account is on hold and will be restored on ${new Date(state.endsAt).toUTCString()} unless a moderator decides otherwise. An appeal can bring that forward.`
                  : 'Your account is on hold until a moderator has reviewed the reports about it.'}{' '}
                Say what happened, in your own words. You will not be told who reported you.
              </p>
              <Field label="Your appeal" htmlFor="appeal-message">
                <Textarea
                  id="appeal-message"
                  rows={6}
                  maxLength={MAX}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  data-testid="appeal-message"
                />
              </Field>
              <p className="text-right text-xs text-muted-foreground">
                {message.trim().length}/{MAX}
              </p>
              <Button type="submit" className="w-full" disabled={busy || message.trim().length < MIN} data-testid="appeal-send">
                {busy ? 'Sending…' : 'Send my appeal'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
