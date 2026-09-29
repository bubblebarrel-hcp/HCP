import { cn } from '@/lib/utils';

const sizes = {
  sm: 'h-9 w-9 text-sm',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
  xl: 'h-32 w-32 text-4xl ring-4 ring-card',
};

function initials(name: string) {
  const words = name.replace(/^Just\s+/i, '').split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)).toUpperCase();
}

// Initials, or the uploaded picture when there is one (a kennel logo, D37).
export function Avatar({
  name,
  size = 'md',
  color,
  src,
  className,
}: {
  name: string;
  size?: keyof typeof sizes;
  // Kennel brand colour when set; falls back to the primary token.
  color?: string | null;
  // Logo or avatar image. Initials show until it exists.
  src?: string | null;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary font-semibold text-primary-foreground',
        sizes[size],
        className,
      )}
      style={color && !src ? { backgroundColor: color, color: '#fff' } : undefined}
    >
      {src ? (
        // Storage is an arbitrary host (R2 or the dev API), so next/image would
        // need every deployment's domain configured up front.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
