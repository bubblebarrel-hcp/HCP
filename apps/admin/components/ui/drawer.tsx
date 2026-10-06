'use client';

import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

// A side panel for one row's detail. Radix Dialog gives the focus trap, Escape
// and aria wiring; the table behind it keeps its place.
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col overflow-y-auto border-l border-border bg-card p-6 shadow-xl focus-visible:outline-none"
          data-testid="drawer"
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
              <Dialog.Description className={description ? 'text-sm text-muted-foreground' : 'sr-only'}>
                {description ?? title}
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="rounded-md p-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Close"
            >
              <X className="h-5 w-5" aria-hidden />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
