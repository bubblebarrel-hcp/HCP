'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BrandMark } from '@/components/brand/HashLogo';
import api, { errorMessage } from '@/services/api';

const schema = z.object({
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .max(128)
    .regex(/[A-Za-z]/, 'Include at least one letter')
    .regex(/[0-9]/, 'Include at least one number'),
});
type Values = z.infer<typeof schema>;

function ResetInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token');
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    if (!token) return;
    try {
      await api.post('/auth/password/reset', { token, password: values.password });
      toast.success('Password reset. You can log in with your new password.');
      router.push('/auth/login');
    } catch (err) {
      toast.error(errorMessage(err, 'That reset link is no longer valid.'));
    }
  });

  if (!token) {
    return (
      <Card className="w-full" data-testid="reset-invalid">
        <CardHeader>
          <CardTitle className="text-2xl">That link is missing a token</CardTitle>
          <CardDescription>Ask for a fresh reset link from the sign-in page.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/auth/forgot-password">Reset my password</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <BrandMark className="mb-2 h-14 w-14" />
        <CardTitle className="flex items-center gap-2 text-2xl">
          <CheckCircle2 className="h-6 w-6 text-primary-strong" aria-hidden />
          Set a new password
        </CardTitle>
        <CardDescription>This link works once and lasts 1 hour.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="New password" htmlFor="password" error={formState.errors.password?.message} hint="8+ characters with a letter and a number">
            <Input id="password" type="password" autoComplete="new-password" data-testid="reset-password" aria-invalid={!!formState.errors.password} {...register('password')} />
          </Field>
          <Button type="submit" className="w-full" disabled={formState.isSubmitting} data-testid="reset-submit">
            {formState.isSubmitting ? 'Resetting…' : 'Reset password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto flex max-w-md px-4 py-16">
      <Suspense fallback={<div className="h-40 w-full animate-pulse rounded-xl bg-card" aria-busy />}>
        <ResetInner />
      </Suspense>
    </div>
  );
}
