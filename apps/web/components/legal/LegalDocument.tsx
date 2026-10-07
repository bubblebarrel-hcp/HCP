import type { LegalDoc } from '@/lib/legal';
import { LEGAL_EFFECTIVE_DATE } from '@/lib/legal';

// The body of a legal document. No hooks, so a Server Component page and the
// client-side sign-up reader can both render it.
export function LegalDocument({ doc, showTitle = false }: { doc: LegalDoc; showTitle?: boolean }) {
  return (
    <div className="space-y-4 text-[15px] leading-relaxed" data-testid={`legal-doc-${doc.slug}`}>
      {showTitle && <h1 className="text-3xl font-bold tracking-tight">{doc.title}</h1>}
      <p className="text-sm text-muted-foreground">Effective {LEGAL_EFFECTIVE_DATE}</p>
      <p className="font-medium">{doc.summary}</p>
      {doc.sections.map((section, i) => (
        <section key={section.id} className="space-y-3 pt-4">
          <h2 className="text-lg font-semibold">
            {i + 1}. {section.heading}
          </h2>
          {section.body.map((block, j) =>
            typeof block === 'string' ? (
              <p key={j}>{block}</p>
            ) : (
              <ul key={j} className="list-disc space-y-1.5 pl-5">
                {block.list.map((item, k) => (
                  <li key={k}>{item}</li>
                ))}
              </ul>
            ),
          )}
        </section>
      ))}
    </div>
  );
}
