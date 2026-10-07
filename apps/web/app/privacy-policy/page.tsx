import type { Metadata } from 'next';
import { LegalDocPage } from '@/components/legal/LegalPage';
import { PRIVACY } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'What Shiggy Trails collects, why, who sees it, and how to delete it.',
};

export default function PrivacyPolicyPage() {
  return <LegalDocPage doc={PRIVACY} />;
}
