import { cn } from '@/lib/utils';
import { AdRail } from './AdRail';

// Facebook-style three columns stretched to the viewport: shortcuts on the left,
// rail on the right (both inset from the screen edge on desktop). Side columns
// only appear once there is room (left from lg, right from xl) and stick under
// the top bar. A single feed column sits against the left nav, and the right
// column carries adverts unless the page brings its own rail.
export function FeedLayout({
  left,
  right: rightProp,
  children,
  wide = false,
}: {
  left?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  // Centre column fills its track (for grids) instead of a single feed width.
  wide?: boolean;
}) {
  const right = rightProp ?? (wide ? undefined : <AdRail />);
  return (
    <div
      className={cn(
        'grid gap-4 py-4 lg:gap-6 lg:px-6 xl:px-12',
        left && 'lg:grid-cols-[18rem_minmax(0,1fr)]',
        left && right && 'xl:grid-cols-[18rem_minmax(0,1fr)_20rem]',
      )}
    >
      {left && (
        <aside className="hidden lg:block lg:pl-2">
          <div className="sticky top-[4.5rem] max-h-[calc(100dvh-5.5rem)] overflow-y-auto">{left}</div>
        </aside>
      )}
      <div className={cn('w-full min-w-0', wide ? 'mx-auto sm:px-4 lg:pl-0' : 'max-w-[42rem]')}>{children}</div>
      {right && (
        <aside className="hidden xl:block xl:pr-2">
          <div className="sticky top-[4.5rem]">{right}</div>
        </aside>
      )}
    </div>
  );
}
