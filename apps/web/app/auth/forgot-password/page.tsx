'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BrandMark } from '@/components/brand/HashLogo';
import api from '@/services/api';

const schema = z.object({
  email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email'),
});
type Values = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema) });
  const [sent, setSent] = useState<string | null>(null);

  const onSubmit = handleSubmit(async (values) => {
    // The API always answers the same way, registered or not — nothing to
    // branch on here, just show the same confirmation either way.
    await api.post('/auth/password/forgot', { email: values.email });
    setSent(values.email);
  });

  return (
    <div className="mx-auto flex max-w-md px-4 py-16">
      <Card className="w-full">
        <CardHeader>
          <BrandMark className="mb-2 h-14 w-14" />
          <CardTitle className="text-2xl">Reset your password</CardTitle>
          <CardDescription>We will email you a link to set a new one.</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4" data-testid="forgot-sent">
              <div className="flex items-center gap-2 text-primary-strong">
                <MailCheck className="h-6 w-6" aria-hidden />
                <p className="font-semibold text-foreground">Check your email</p>
              </div>
              <p className="text-sm text-muted-foreground">
                If {sent} has an account, a reset link is on its way. It lasts 1 hour and works once.
              </p>
              <Button asChild variant="outline">
                <Link href="/auth/login">Back to sign in</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
                <Input id="email" type="email" autoComplete="email" data-testid="forgot-email" aria-invalid={!!formState.errors.email} {...register('email')} />
              </Field>
              <Button type="submit" className="w-full" disabled={formState.isSubmitting} data-testid="forgot-submit">
                {formState.isSubmitting ? 'Sending…' : 'Send reset link'}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                <Link href="/auth/login" className="font-medium text-primary-strong hover:underline">Back to sign in</Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
