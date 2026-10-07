import type { Metadata } from 'next';
import { LegalDocPage } from '@/components/legal/LegalPage';
import { TERMS } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The rules for using Shiggy Trails.',
};

export default function TermsPage() {
  return <LegalDocPage doc={TERMS} />;
}
