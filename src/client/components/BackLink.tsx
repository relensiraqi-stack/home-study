import { Link, type LinkProps } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

/** The way up one level, above a page's title. */
export function BackLink({ children, ...props }: LinkProps & { children: ReactNode }) {
  return (
    <Link
      {...props}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ChevronLeft className="size-4" aria-hidden />
      {children}
    </Link>
  );
}
