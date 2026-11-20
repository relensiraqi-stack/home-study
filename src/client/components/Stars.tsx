import { Star } from "lucide-react";

/** 0 to 3 stars. */
export function Stars({ count, small = false, testId }: { count: number; small?: boolean; testId?: string }) {
  return (
    <span data-testid={testId} role="img" aria-label={`${count} of 3 stars`} className="flex gap-0.5">
      {[0, 1, 2].map((i) => (
        <Star key={i} className={`${small ? "size-4" : "size-6"} ${i < count ? "fill-warning text-warning" : "text-muted-foreground/40"}`} aria-hidden />
      ))}
    </span>
  );
}
