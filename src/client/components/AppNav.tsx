import { Link } from "@tanstack/react-router";

const LINK =
  "text-sm text-muted-foreground transition-colors hover:text-foreground data-[status=active]:text-foreground data-[status=active]:font-medium";

/** The app's sections, in the AppShell bar. */
export function AppNav() {
  return (
    <nav className="flex items-center gap-4">
      <Link to="/" className={LINK} activeOptions={{ exact: true }}>
        Library
      </Link>
      <Link to="/learners" className={LINK}>
        Learners
      </Link>
    </nav>
  );
}
