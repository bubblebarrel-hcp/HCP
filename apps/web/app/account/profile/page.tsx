'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import api, { errorMessage } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProfileImages } from '@/components/profile/ProfileImages';

// D5/FR-ID-005: the same biodata shape as registration (apps/web/app/auth/register/page.tsx),
// editable after the fact. Mirrors apps/api/src/validators/profile.validator.ts — change both together.
const required = (label: string, max = 80) => z.string().trim().min(1, `${label} is required`).max(max);

const schema = z.object({
  firstName: required('First name'),
  middleName: z.string().trim().max(80),
  lastName: required('Last name'),
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
  medicalNotes: z.string().trim().max(2000),
});
type Values = z.infer<typeof schema>;

interface ProfileResponse {
  firstName: string;
  middleName: string | null;
  lastName: string;
  dateOfBirth: string;
  gender: Values['gender'];
  phone: string;
  nationality: string;
  country: string;
  stateProvince: string;
  city: string;
  addressLine: string | null;
  occupation: string | null;
  languages: string[];
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
  medicalNotes: string | null;
}

function toValues(p: ProfileResponse): Values {
  return {
    firstName: p.firstName,
    middleName: p.middleName ?? '',
    lastName: p.lastName,
    dateOfBirth: p.dateOfBirth,
    gender: p.gender,
    phone: p.phone,
    nationality: p.nationality,
    country: p.country,
    stateProvince: p.stateProvince,
    city: p.city,
    addressLine: p.addressLine ?? '',
    occupation: p.occupation ?? '',
    languages: p.languages.join(', '),
    emergencyContactName: p.emergencyContactName,
    emergencyContactPhone: p.emergencyContactPhone,
    emergencyContactRelationship: p.emergencyContactRelationship,
    medicalNotes: p.medicalNotes ?? '',
  };
}

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

export default function EditProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const { register, handleSubmit, formState, reset } = useForm<Values>({ resolver: zodResolver(schema) });
  const e = formState.errors;

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth/login');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api
      .get<{ data: ProfileResponse }>('/me/profile')
      .then((res) => {
        if (cancelled) return;
        reset(toValues(res.data.data));
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(errorMessage(err, 'Could not load your profile'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, reset]);

  const onSubmit = handleSubmit(async (v) => {
    try {
      const res = await api.patch<{ data: ProfileResponse }>('/me/profile', {
        ...v,
        languages: v.languages.split(',').map((l) => l.trim()).filter(Boolean),
      });
      reset(toValues(res.data.data));
      toast.success('Profile updated.');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save your changes'));
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
          data-testid={`profile-${name}`}
          {...register(name)}
        />
      </Field>
    </div>
  );

  if (authLoading || !user || loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12" aria-busy>
        <div className="h-96 animate-pulse rounded-xl bg-card" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/account" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to account
      </Link>
      <div className="mb-6">
        <ProfileImages />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Your profile</CardTitle>
          <CardDescription>
            Private biodata. Other hashers only ever see your hash handle — this stays between you and HCP (D5).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-6" noValidate>
            <Section title="About you">
              {text('firstName', 'First name', { autoComplete: 'given-name' })}
              {text('lastName', 'Last name', { autoComplete: 'family-name' })}
              {text('middleName', 'Middle name (optional)', { autoComplete: 'additional-name' })}
              {text('dateOfBirth', 'Date of birth', { type: 'date', autoComplete: 'bday' })}
              <Field label="Gender" htmlFor="gender" error={e.gender?.message}>
                <Select id="gender" data-testid="profile-gender" {...register('gender')}>
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

            <fieldset className="space-y-4 border-t border-border pt-6">
              <legend className="sr-only">Medical notes</legend>
              <div>
                <h2 className="font-semibold">Medical notes</h2>
                <p className="text-sm text-muted-foreground">Private to you. No one else on HCP can see this yet.</p>
              </div>
              <Field label="Medical notes (optional)" htmlFor="medicalNotes" error={e.medicalNotes?.message}>
                <Textarea id="medicalNotes" data-testid="profile-medicalNotes" aria-invalid={!!e.medicalNotes} {...register('medicalNotes')} />
              </Field>
            </fieldset>

            <Button type="submit" size="lg" className="w-full" disabled={formState.isSubmitting} data-testid="profile-submit">
              {formState.isSubmitting ? 'Saving…' : 'Save changes'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
