'use client';

import { useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

const options = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
] as const;

const noSubscribe = () => () => {};

// The server renders no theme, so the control only shows its state once mounted.
// useSyncExternalStore does that without setting state inside an effect.
function useMounted() {
  return useSyncExternalStore(noSubscribe, () => true, () => false);
}

// System / Light / Dark, for menus and settings.
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const current = mounted ? (theme ?? 'system') : null;

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className={cn('grid grid-cols-3 gap-1 rounded-lg bg-muted p-1', className)}
      data-testid="theme-toggle"
    >
      {options.map(({ value, label, icon: Icon }) => {
        const active = current === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={mounted ? active : undefined}
            onClick={() => setTheme(value)}
            data-testid={`theme-${value}`}
            className={cn(
              'flex min-h-9 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium transition-colors',
              active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}

// One-tap light/dark swap for the top bar. Always visible, including for guests.
export function ThemeToggleButton({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted && resolvedTheme === 'dark';
  const next = isDark ? 'light' : 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      data-testid="theme-toggle-button"
      className={cn(
        'grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      {isDark ? <Sun className="h-5 w-5" aria-hidden /> : <Moon className="h-5 w-5" aria-hidden />}
    </button>
  );
}
