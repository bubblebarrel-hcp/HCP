import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BrandMark } from '@/components/brand/HashLogo';
import { bleedCard, cn } from '@/lib/utils';

// Shown in place of the composer to signed-out visitors.
export function WelcomeCard() {
  return (
    <Card className={cn(bleedCard, 'p-5')}data-testid="welcome-card">
      <div className="flex items-center gap-3">
        <BrandMark className="h-12 w-12" />
        <p className="text-sm font-semibold uppercase tracking-widest text-primary-strong">On On</p>
      </div>
      <h2 className="mt-3 text-2xl font-bold tracking-tight">A digital home for the worldwide Hash House Harriers.</h2>
      <p className="mt-2 text-muted-foreground">
        Find a kennel, join a run, follow the trail, and keep every story.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/auth/register">Create your account</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/auth/login">Log in</Link>
        </Button>
      </div>
    </Card>
  );
}
