import Link from 'next/link';
import { LEGAL_ENTITY } from '@/lib/legal';

// Bottom padding clears the phone tab bar, which the layout's <main> used to do.
export function Footer() {
  return (
    <footer
      className="border-t border-border bg-card px-4 py-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] text-center text-xs text-muted-foreground md:pb-6"
      data-testid="site-footer"
    >
      <p>
        &copy; {new Date().getFullYear()} Shiggy Trails &middot; {LEGAL_ENTITY}. All rights reserved.
      </p>
      <p className="mt-2 flex justify-center gap-4">
        <Link href="/privacy-policy" className="underline-offset-2 hover:underline">
          Privacy
        </Link>
        <Link href="/terms" className="underline-offset-2 hover:underline">
          Terms of Service
        </Link>
      </p>
    </footer>
  );
}
