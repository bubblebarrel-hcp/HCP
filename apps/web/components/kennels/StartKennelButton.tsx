'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';

// A client island on an otherwise server-rendered page: only signed-in hashers
// are offered the front door, but the page itself still renders without JS.
export function StartKennelButton() {
  const { user, loading } = useAuth();
  if (loading || !user) return null;

  return (
    <Button asChild variant="outline" data-testid="start-kennel">
      <Link href="/kennels/new">
        <Plus className="h-4 w-4" aria-hidden />
        Start a kennel
      </Link>
    </Button>
  );
}
