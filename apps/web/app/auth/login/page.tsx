'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import api, { errorCode, errorMessage } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BrandMark } from '@/components/brand/HashLogo';

const schema = z.object({
  email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});
type Values = z.infer<typeof schema>;

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema) });
  // D31: an unconfirmed address is a specific, fixable state, not a failure to
  // shrug at. Hold the address so we can offer to send the link again.
  const [unverified, setUnverified] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const onSubmit = handleSubmit(async (values) => {
    try {
      setUnverified(null);
      await login(values.email, values.password);
      router.push('/account');
    } catch (err) {
      if (errorCode(err) === 'EMAIL_NOT_VERIFIED') {
        setUnverified(values.email);
        return;
      }
      toast.error(errorMessage(err, 'Could not log in'));
    }
  });

  async function resend() {
    if (!unverified) return;
    setResending(true);
    try {
      await api.post('/auth/verification/resend', { email: unverified });
      toast.success('A fresh confirmation link is on its way.');
    } catch {
      toast.error('Could not send it just now. Try again in a minute.');
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md px-4 py-16">
      <Card className="w-full">
        <CardHeader>
          <BrandMark className="mb-2 h-14 w-14" />
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>Log in to follow your kennels and runs.</CardDescription>
        </CardHeader>
        <CardContent>
          {unverified && (
            <div
              role="status"
              className="mb-4 rounded-lg border border-accent/40 bg-accent/10 p-4 text-sm"
              data-testid="login-unverified"
            >
              <p className="font-semibold">Confirm your email first</p>
              <p className="mt-1 text-muted-foreground">
                We sent a link to {unverified} when you registered. Click it and you are in.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={resend}
                disabled={resending}
                data-testid="login-resend"
              >
                {resending ? 'Sending…' : 'Send the link again'}
              </Button>
            </div>
          )}
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
              <Input id="email" type="email" autoComplete="email" data-testid="login-email" aria-invalid={!!formState.errors.email} {...register('email')} />
            </Field>
            <Field label="Password" htmlFor="password" error={formState.errors.password?.message}>
              <Input id="password" type="password" autoComplete="current-password" data-testid="login-password" aria-invalid={!!formState.errors.password} {...register('password')} />
            </Field>
            <div className="text-right">
              <Link href="/auth/forgot-password" className="text-sm font-medium text-primary-strong hover:underline" data-testid="login-forgot">
                Forgot password?
              </Link>
            </div>
            <Button type="submit" className="w-full" disabled={formState.isSubmitting} data-testid="login-submit">
              {formState.isSubmitting ? 'Logging in…' : 'Log in'}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            New to HCP? <Link href="/auth/register" className="font-medium text-primary-strong hover:underline">Create an account</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
