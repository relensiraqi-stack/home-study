import { useState, type FormEvent, type ReactNode } from "react";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { errorMessage } from "@/client/lib/errors";

/**
 * A dialog around a form. Render it only while it is open. `onSubmit` gets
 * the form's fields; it closes when the promise resolves and shows the
 * refusal when it rejects.
 */
export function FormDialog({
  title,
  submitLabel = "Save",
  onSubmit,
  onClose,
  children,
}: {
  title: string;
  submitLabel?: string;
  onSubmit: (form: FormData) => Promise<unknown>;
  onClose: () => void;
  children: ReactNode;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await onSubmit(new FormData(event.currentTarget));
      onClose();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">{children}</div>
          {error ? (
            <Alert variant="destructive" data-testid="dialog-error">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" pending={pending} data-testid="dialog-save">
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
