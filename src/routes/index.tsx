import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { FormDialog } from "@/client/components/FormDialog";
import { Page } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { ItemControls } from "@/client/components/ReorderButtons";
import { StudyingNote } from "@/client/components/StudyingNote";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { errorMessage } from "@/client/lib/errors";
import { plural } from "@/client/lib/format";
import { createItem, deleteItem, getLibrary, moveItem, updateItem } from "@/serverFunctions/library";

export const Route = createFileRoute("/")({
  loader: () => getLibrary(),
  head: () => ({ meta: [{ title: "Library · Home Study" }] }),
  component: Library,
});

type Editing = { mode: "add" } | { mode: "edit"; id: string; title: string };

function Library() {
  const { grades, admin, learner } = Route.useLoaderData();
  const router = useRouter();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; title: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function run(work: () => Promise<unknown>) {
    try {
      await work();
      await router.invalidate();
    } catch (cause) {
      toast.error(errorMessage(cause));
    }
  }

  return (
    <Page>
      <PageHeader
        title="Library"
        description={<StudyingNote learner={learner} />}
        actions={
          admin ? (
            <Button data-testid="add-grade" onClick={() => setEditing({ mode: "add" })}>
              <Plus /> Add grade
            </Button>
          ) : null
        }
      />
      {grades.length === 0 ? (
        <div data-testid="empty-library">
          <EmptyState
            title="No grades yet"
            description={
              admin
                ? "Add a grade, then its subjects, units and lessons."
                : "An admin hasn't added any lessons yet."
            }
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {grades.map((grade, index) => (
            <Card key={grade.id} data-testid="grade-card" size="sm">
              <CardContent className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <Link
                    to="/grades/$gradeId"
                    params={{ gradeId: grade.id }}
                    className="block truncate font-medium hover:underline"
                  >
                    {grade.title}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {plural(grade.subjects, "subject")} · {plural(grade.lessons, "lesson")}
                  </p>
                </div>
                {admin ? (
                  <ItemControls
                    label={grade.title}
                    first={index === 0}
                    last={index === grades.length - 1}
                    onMove={(direction) => void run(() => moveItem({ data: { level: "grade", id: grade.id, direction } }))}
                    onEdit={() => setEditing({ mode: "edit", id: grade.id, title: grade.title })}
                    onDelete={() => setDeleting(grade)}
                  />
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editing ? (
        <FormDialog
          title={editing.mode === "add" ? "Add grade" : "Rename grade"}
          onClose={() => setEditing(null)}
          onSubmit={async (form) => {
            const title = String(form.get("title") ?? "");
            if (editing.mode === "add") await createItem({ data: { level: "grade", title } });
            else await updateItem({ data: { level: "grade", id: editing.id, title } });
            await router.invalidate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="grade-title">Title</Label>
            <Input id="grade-title" name="title" defaultValue={editing.mode === "edit" ? editing.title : ""} placeholder="Grade 5" autoFocus required />
          </div>
        </FormDialog>
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title={`Delete ${deleting.title}?`}
          confirmLabel="Delete"
          destructive
          pending={pending}
          onClose={() => setDeleting(null)}
          onConfirm={() => {
            setPending(true);
            void run(() => deleteItem({ data: { level: "grade", id: deleting.id } })).finally(() => {
              setPending(false);
              setDeleting(null);
            });
          }}
        >
          Its subjects, lessons, quiz results and schedule slots are deleted too.
        </ConfirmDialog>
      ) : null}
    </Page>
  );
}

