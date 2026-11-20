import type { ReactNode } from "react";
import { AppShell } from "@/client/components/AppShell";
import { AppNav } from "@/client/components/AppNav";
import { EmptyState } from "@/client/components/EmptyState";
import { Button } from "@/client/components/ui/button";
import { Link } from "@tanstack/react-router";

/** Every page: the shell with the app's sections. */
export function Page({ children }: { children: ReactNode }) {
  return <AppShell nav={<AppNav />}>{children}</AppShell>;
}

export function NotFoundPage() {
  return (
    <Page>
      <div data-testid="not-found">
        <EmptyState
          title="Not found"
          description="It was deleted, or it isn't shared with you."
          action={
            <Button variant="outline" render={<Link to="/" />}>
              Back to the library
            </Button>
          }
        />
      </div>
    </Page>
  );
}
