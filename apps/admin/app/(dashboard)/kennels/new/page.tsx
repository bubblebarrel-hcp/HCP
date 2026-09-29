import Link from 'next/link';
import { KennelForm } from '@/components/KennelForm';

export default function NewKennelPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/kennels" className="text-sm text-muted-foreground hover:text-foreground">← Kennels</Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">New kennel</h1>
      </div>
      <KennelForm />
    </div>
  );
}
