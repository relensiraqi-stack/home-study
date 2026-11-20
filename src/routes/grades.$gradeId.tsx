import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { FileText, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BackLink } from "@/client/components/BackLink";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { FormDialog } from "@/client/components/FormDialog";
import { NotFoundPage, Page } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { ItemControls } from "@/client/components/ReorderButtons";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { errorMessage } from "@/client/lib/errors";
import { plural } from "@/client/lib/format";
import { createItem, deleteItem, getGrade, moveItem, updateItem } from "@/serverFunctions/library";

export const Route = createFileRoute("/grades/$gradeId")({
  loader: ({ params }) => getGrade({ data: { id: params.gradeId } }),
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.grade.title ?? "Grade"} · Home Study` }] }),
  component: GradePage,
});

type Editing = { mode: "add" } | { mode: "edit"; id: string; title: string };

function GradePage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; title: string } | null>(null);
  const [pending, setPending] = useState(false);
  if (!data) return <NotFoundPage />;
  const { grade, subjects, admin } = data;

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
        backLink={<BackLink to="/">Library</BackLink>}
        title={grade.title}
        actions={
          admin ? (
            <Button data-testid="add-subject" onClick={() => setEditing({ mode: "add" })}>
              <Plus /> Add subject
            </Button>
          ) : null
        }
      />
      {subjects.length === 0 ? (
        <EmptyState
          title="No subjects yet"
          description={admin ? "Add a subject such as Mathematics or Science." : "Nothing to study here yet."}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {subjects.map((subject, index) => (
            <Card key={subject.id} data-testid="subject-card" size="sm">
              <CardContent className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <Link
                    to="/subjects/$subjectId"
                    params={{ subjectId: subject.id }}
                    className="block truncate font-medium hover:underline"
                  >
                    {subject.title}
                  </Link>
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    {plural(subject.lessons, "lesson")}
                    {subject.hasTextbook ? (
                      <>
                        {" · "}
                        <FileText className="size-3.5" aria-hidden /> Textbook
                      </>
                    ) : null}
                  </p>
                </div>
                {admin ? (
                  <ItemControls
                    label={subject.title}
                    first={index === 0}
                    last={index === subjects.length - 1}
                    onMove={(direction) => void run(() => moveItem({ data: { level: "subject", id: subject.id, direction } }))}
                    onEdit={() => setEditing({ mode: "edit", id: subject.id, title: subject.title })}
                    onDelete={() => setDeleting(subject)}
                  />
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editing ? (
        <FormDialog
          title={editing.mode === "add" ? "Add subject" : "Rename subject"}
          onClose={() => setEditing(null)}
          onSubmit={async (form) => {
            const title = String(form.get("title") ?? "");
            if (editing.mode === "add") await createItem({ data: { level: "subject", parentId: grade.id, title } });
            else await updateItem({ data: { level: "subject", id: editing.id, title } });
            await router.invalidate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="subject-title">Title</Label>
            <Input id="subject-title" name="title" defaultValue={editing.mode === "edit" ? editing.title : ""} placeholder="Mathematics" autoFocus required />
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
            void run(() => deleteItem({ data: { level: "subject", id: deleting.id } })).finally(() => {
              setPending(false);
              setDeleting(null);
            });
          }}
        >
          Its units, lessons, textbook, quiz results and schedule slots are deleted too.
        </ConfirmDialog>
      ) : null}
    </Page>
  );
}
