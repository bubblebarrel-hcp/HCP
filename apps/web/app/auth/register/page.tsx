'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { errorMessage } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BrandMark } from '@/components/brand/HashLogo';

// Mirrors apps/api/src/validators/auth.validator.ts (Joi). Change both together.
// D5: full biodata is required; only the hash handle is ever shown publicly.
const required = (label: string, max = 80) => z.string().trim().min(1, `${label} is required`).max(max);

const schema = z.object({
  firstName: required('First name'),
  middleName: z.string().trim().max(80),
  lastName: required('Last name'),
  hashHandle: z.string().trim().max(80),
  dateOfBirth: z
    .string()
    .min(1, 'Date of birth is required')
    .refine((v) => !Number.isNaN(Date.parse(v)) && new Date(v) < new Date(), 'Enter a valid past date'),
  gender: z.enum(['FEMALE', 'MALE', 'NON_BINARY', 'OTHER', 'PREFER_NOT_TO_SAY'], { message: 'Select an option' }),
  phone: required('Phone', 40),
  nationality: required('Nationality'),
  country: required('Country'),
  stateProvince: required('State / province'),
  city: required('City'),
  addressLine: z.string().trim().max(200),
  occupation: z.string().trim().max(120),
  languages: z.string().trim().max(200),
  emergencyContactName: required('Emergency contact name', 120),
  emergencyContactPhone: required('Emergency contact phone', 40),
  emergencyContactRelationship: required('Relationship', 60),
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email'),
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .max(128)
    .regex(/[A-Za-z]/, 'Include at least one letter')
    .regex(/[0-9]/, 'Include at least one number'),
  acceptTerms: z.boolean().refine((v) => v, 'You must accept the Terms of Service and Privacy Policy'),
});
type Values = z.infer<typeof schema>;

const defaults: Values = {
  firstName: '', middleName: '', lastName: '', hashHandle: '', dateOfBirth: '',
  gender: 'PREFER_NOT_TO_SAY', phone: '', nationality: '', country: '', stateProvince: '', city: '',
  addressLine: '', occupation: '', languages: '', emergencyContactName: '', emergencyContactPhone: '',
  emergencyContactRelationship: '', email: '', password: '', acceptTerms: false,
};

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4 border-t border-border pt-6 first:border-t-0 first:pt-0">
      <legend className="sr-only">{title}</legend>
      <div>
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export default function RegisterPage() {
  const { register: signUp, user, loading } = useAuth();
  const router = useRouter();

  // Already signed in: there is nothing to do on this page, so go to the account.
  useEffect(() => {
    if (!loading && user) router.replace('/account');
  }, [loading, user, router]);
  const { register, handleSubmit, watch, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });
  const e = formState.errors;
  const firstName = watch('firstName');
  const hashHandle = watch('hashHandle');

  const onSubmit = handleSubmit(async (v) => {
    try {
      await signUp({
        ...v,
        languages: v.languages.split(',').map((l) => l.trim()).filter(Boolean),
      });
      // D31: no session yet. Send them to confirm their address rather than
      // welcoming them into an app they cannot use.
      router.push(`/auth/verify?sent=${encodeURIComponent(v.email)}`);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not create your account'));
    }
  });

  const text = (name: keyof Values, label: string, opts: { type?: string; autoComplete?: string; hint?: string; className?: string } = {}) => (
    <div className={opts.className}>
      <Field label={label} htmlFor={name} error={e[name]?.message} hint={opts.hint}>
        <Input
          id={name}
          type={opts.type ?? 'text'}
          autoComplete={opts.autoComplete}
          aria-invalid={!!e[name]}
          data-testid={`register-${name}`}
          {...register(name)}
        />
      </Field>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Card>
        <CardHeader>
          <BrandMark className="mb-2 h-14 w-14" />
          <CardTitle className="text-2xl">Join Shiggy Trails</CardTitle>
          <CardDescription>
            Your details stay private. Other hashers only see your hash handle —
            or <strong>“{hashHandle?.trim() || `Just ${firstName?.trim() || 'your first name'}`}”</strong> until your kennel names you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-6" noValidate>
            <Section title="About you">
              {text('firstName', 'First name', { autoComplete: 'given-name' })}
              {text('lastName', 'Last name', { autoComplete: 'family-name' })}
              {text('middleName', 'Middle name (optional)', { autoComplete: 'additional-name' })}
              {text('hashHandle', 'Hash handle (optional)', { hint: 'Leave blank if you have not been named yet.' })}
              {text('dateOfBirth', 'Date of birth', { type: 'date', autoComplete: 'bday' })}
              <Field label="Gender" htmlFor="gender" error={e.gender?.message}>
                <Select id="gender" data-testid="register-gender" {...register('gender')}>
                  <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                  <option value="FEMALE">Female</option>
                  <option value="MALE">Male</option>
                  <option value="NON_BINARY">Non-binary</option>
                  <option value="OTHER">Other</option>
                </Select>
              </Field>
              {text('nationality', 'Nationality')}
              {text('occupation', 'Occupation (optional)', { autoComplete: 'organization-title' })}
              {text('languages', 'Languages (optional)', { hint: 'Comma separated, e.g. English, Igbo' })}
            </Section>

            <Section title="Contact & location">
              {text('phone', 'Phone', { type: 'tel', autoComplete: 'tel' })}
              {text('country', 'Country', { autoComplete: 'country-name' })}
              {text('stateProvince', 'State / province', { autoComplete: 'address-level1' })}
              {text('city', 'City', { autoComplete: 'address-level2' })}
              {text('addressLine', 'Address (optional)', { autoComplete: 'street-address', className: 'sm:col-span-2' })}
            </Section>

            <Section title="Emergency contact" description="Used only by run organisers in an emergency.">
              {text('emergencyContactName', 'Name')}
              {text('emergencyContactPhone', 'Phone', { type: 'tel' })}
              {text('emergencyContactRelationship', 'Relationship')}
            </Section>

            <Section title="Account">
              {text('email', 'Email', { type: 'email', autoComplete: 'email' })}
              {text('password', 'Password', { type: 'password', autoComplete: 'new-password', hint: '8+ characters with a letter and a number' })}
            </Section>

            <div className="space-y-2">
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--primary)]" data-testid="register-acceptTerms" {...register('acceptTerms')} />
                <span>I accept the Terms of Service and Privacy Policy.</span>
              </label>
              {e.acceptTerms && <p className="text-xs text-destructive" role="alert">{e.acceptTerms.message}</p>}
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={formState.isSubmitting} data-testid="register-submit">
              {formState.isSubmitting ? 'Creating your account…' : 'Create account'}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already hashing with us? <Link href="/auth/login" className="font-medium text-primary-strong hover:underline">Log in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
