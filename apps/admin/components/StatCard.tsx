import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// `attention` marks a count that means somebody has something to do. It is a
// state, not decoration, so the hint text says so as well as changing colour.
export function StatCard({
  label,
  value,
  hint,
  href,
  attention,
  testId,
}: {
  label: string;
  value: number | null;
  hint: string;
  href?: string;
  attention?: boolean;
  testId: string;
}) {
  const body = (
    <Card data-testid={testId} className={cn(href && 'transition-colors hover:bg-muted/40')}>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums" data-testid={`${testId}-value`}>
          {value === null ? (
            <span className="inline-block h-8 w-12 animate-pulse rounded bg-muted" aria-label="Loading" />
          ) : (
            value
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className={cn('text-xs', attention && value ? 'font-medium text-accent-strong' : 'text-muted-foreground')}>
        {attention && value ? `Needs attention · ${hint}` : hint}
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {body}
    </Link>
  ) : (
    body
  );
}
