import Link from 'next/link';
import { LegalDocument } from '@/components/legal/LegalDocument';
import type { LegalDoc } from '@/lib/legal';

export { LEGAL_ENTITY, SUPPORT_EMAIL, PRIVACY_EMAIL } from '@/lib/legal';

const LINKS = 'flex flex-wrap gap-4 border-t pt-6 text-sm [&_a]:text-primary-strong [&_a]:underline';

// Plain, static legal pages: Server Components that render without JavaScript, so
// the store listing's privacy and deletion URLs open for a signed-out reviewer.
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-8 sm:py-12" data-testid="legal-page">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated {updated}</p>
      <div className="mt-8 space-y-4 text-[15px] leading-relaxed [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_a]:font-medium [&_a]:text-primary-strong [&_a]:underline">
        {children}
      </div>
      <LegalLinks className="mt-12" />
    </article>
  );
}

// A whole document (Terms, Privacy) as its own public page.
export function LegalDocPage({ doc }: { doc: LegalDoc }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-8 sm:py-12" data-testid="legal-page">
      <LegalDocument doc={doc} showTitle />
      <LegalLinks className="mt-12" />
    </article>
  );
}

function LegalLinks({ className }: { className?: string }) {
  return (
    <nav className={`${LINKS} ${className ?? ''}`} aria-label="Legal">
      <Link href="/privacy-policy">Privacy Policy</Link>
      <Link href="/terms">Terms of Service</Link>
      <Link href="/delete-account">Delete your account</Link>
    </nav>
  );
}
