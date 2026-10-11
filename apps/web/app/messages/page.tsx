'use client';

import { Send } from 'lucide-react';
import { NewMessageDialog } from '@/components/messages/NewMessageDialog';
import { Button } from '@/components/ui/button';

// The right-hand pane when no conversation is open (D71). On a phone this page
// is never shown: the layout shows the list instead.
export default function MessagesHome() {
  return (
    <div className="grid h-full place-items-center p-8" data-testid="messages-page">
      <div className="flex max-w-sm flex-col items-center text-center">
        <span className="grid h-28 w-28 place-items-center rounded-full border-2 border-foreground">
          <Send className="h-12 w-12 -rotate-12" strokeWidth={1.5} aria-hidden />
        </span>
        <h2 className="mt-5 text-xl font-semibold">Your messages</h2>
        <p className="mt-1 text-sm text-muted-foreground">Send a message to start a chat.</p>
        <NewMessageDialog
          trigger={
            <Button type="button" className="mt-5" data-testid="send-message-cta">
              Send message
            </Button>
          }
        />
      </div>
    </div>
  );
}
