'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

// A password input with the eye button inside it. `Input` renders this whenever
// `type="password"`, so every password field gets the toggle without a call-site change.
// The ref and every other prop still land on the <input>, so react-hook-form's `register`
// and the existing data-testid / id / aria-* attributes keep working.
export const PasswordField = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { fieldClassName: string }
>(({ className, fieldClassName, ...props }, ref) => {
  const [shown, setShown] = React.useState(false);
  const Icon = shown ? EyeOff : Eye;
  return (
    <div className="relative w-full">
      <input type={shown ? 'text' : 'password'} className={cn(fieldClassName, 'pr-10', className)} ref={ref} {...props} />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        aria-label={shown ? 'Hide password' : 'Show password'}
        aria-pressed={shown}
        data-testid={props['data-testid' as keyof typeof props] ? `${String(props['data-testid' as keyof typeof props])}-toggle` : undefined}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        disabled={props.disabled}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
});
PasswordField.displayName = 'PasswordField';
