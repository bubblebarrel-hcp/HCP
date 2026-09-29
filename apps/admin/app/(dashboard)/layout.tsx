'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Sidebar } from '@/components/Sidebar';
import { Button } from '@/components/ui/button';

// Role gate, layer 2 (layer 1 is proxy.ts). UX only: the API's
// requireRole('ADMIN') is the actual boundary.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center" aria-busy>
        <div className="h-10 w-40 animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  if (user.role !== 'ADMIN') {
    // A plain screen, not a redirect loop back to a login they already passed.
    return (
      <div className="grid min-h-screen place-items-center px-4" data-testid="no-access">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-bold">No access</h1>
          <p className="mt-2 text-muted-foreground">
            {user.displayName} is signed in, but this area is for platform administrators.
          </p>
          <Button
            className="mt-6"
            variant="outline"
            onClick={async () => {
              await logout();
              router.replace('/login');
            }}
          >
            Log out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 px-4 py-8 md:px-8">{children}</main>
    </div>
  );
}
