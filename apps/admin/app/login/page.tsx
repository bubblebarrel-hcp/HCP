'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { BrandMark } from '@/components/brand/HashLogo';
import { errorMessage } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const schema = z.object({
  email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});
type Values = z.infer<typeof schema>;

export default function AdminLoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!loading && user) router.replace('/');
  }, [loading, user, router]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login(values.email, values.password);
      // The dashboard layout decides whether this account may see anything.
      router.replace('/');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not log in'));
    }
  });

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <BrandMark className="mb-2 h-14 w-14" />
          <CardTitle className="text-2xl">Shiggy Trails Admin</CardTitle>
          <CardDescription>Platform administrators only.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
              <Input id="email" type="email" autoComplete="email" data-testid="login-email" aria-invalid={!!formState.errors.email} {...register('email')} />
            </Field>
            <Field label="Password" htmlFor="password" error={formState.errors.password?.message}>
              <Input id="password" type="password" autoComplete="current-password" data-testid="login-password" aria-invalid={!!formState.errors.password} {...register('password')} />
            </Field>
            <Button type="submit" className="w-full" disabled={formState.isSubmitting} data-testid="login-submit">
              {formState.isSubmitting ? 'Logging in…' : 'Log in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
