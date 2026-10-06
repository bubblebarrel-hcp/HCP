'use client';

import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from './button';
import { Textarea } from './input';

// A confirm that also needs a written reason: takedowns and setting changes are
// recorded in the AuditLog with it. Same job as ConfirmDialog, plus one field.
export function ReasonDialog({
  trigger,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = false,
  required = true,
  onConfirm,
}: {
  trigger: React.ReactNode;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  required?: boolean;
  onConfirm: (reason: string) => Promise<void> | void;
}) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const valid = !required || reason.trim().length >= 3;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setOpen(next);
        if (!next) setReason('');
      }}
    >
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-xl focus-visible:outline-none">
          <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">{description}</Dialog.Description>
          <label htmlFor="reason-field" className="mt-4 block text-sm font-medium">
            Reason{required ? '' : ' (optional)'}
          </label>
          <Textarea
            id="reason-field"
            className="mt-1"
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            data-testid="reason-field"
          />
          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="outline" disabled={busy}>Cancel</Button>
            </Dialog.Close>
            <Button
              variant={destructive ? 'destructive' : 'default'}
              disabled={busy || !valid}
              data-testid="reason-confirm"
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm(reason.trim());
                  setOpen(false);
                  setReason('');
                } finally {
                  setBusy(false);
                }
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
