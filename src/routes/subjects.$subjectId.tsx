import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { CircleCheck, Download, Plus, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { BackLink } from "@/client/components/BackLink";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { FormDialog } from "@/client/components/FormDialog";
import { NotFoundPage, Page } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { ItemControls } from "@/client/components/ReorderButtons";
import { StudyingNote } from "@/client/components/StudyingNote";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import { errorMessage } from "@/client/lib/errors";
import { removeFile, uploadFile } from "@/client/lib/format";
import { createItem, deleteItem, getSubject, moveItem, updateItem } from "@/serverFunctions/library";

export const Route = createFileRoute("/subjects/$subjectId")({
  loader: ({ params }) => getSubject({ data: { id: params.subjectId } }),
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.subject.title ?? "Subject"} · Home Study` }] }),
  component: SubjectPage,
});

type Editing =
  | { level: "unit"; mode: "add" }
  | { level: "unit"; mode: "edit"; id: string; title: string }
  | { level: "lesson"; mode: "add"; unitId: string };

function SubjectPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<{ level: "unit" | "lesson" | "textbook"; id: string; title: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  if (!data) return <NotFoundPage />;
  const { subject, units, admin, learner } = data;
  const textbookUrl = `/files/subjects/${subject.id}/textbook`;

  async function run(work: () => Promise<unknown>) {
    try {
      await work();
      await router.invalidate();
    } catch (cause) {
      toast.error(errorMessage(cause));
    }
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    await run(() => uploadFile(textbookUrl, file));
    setUploading(false);
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <Page>
      <PageHeader
        backLink={
          <BackLink to="/grades/$gradeId" params={{ gradeId: subject.gradeId }}>
            {subject.gradeTitle}
          </BackLink>
        }
        title={subject.title}
        description={<StudyingNote learner={learner} />}
        actions={
          <>
            {subject.textbookName ? (
              <Button variant="outline" data-testid="textbook-download" render={<a href={textbookUrl} download />}>
                <Download /> Textbook
              </Button>
            ) : null}
            {admin ? (
              <>
                <input
                  ref={fileInput}
                  type="file"
                  accept="application/pdf"
                  className="sr-only"
                  data-testid="textbook-upload"
                  aria-label="Textbook PDF"
                  onChange={(event) => void upload(event.target.files?.[0])}
                />
                <Button variant="outline" pending={uploading} onClick={() => fileInput.current?.click()}>
                  <Upload /> {subject.textbookName ? "Replace textbook" : "Upload textbook"}
                </Button>
                {subject.textbookName ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove textbook"
                    onClick={() => setDeleting({ level: "textbook", id: subject.id, title: subject.textbookName ?? "the textbook" })}
                  >
                    <Trash2 />
                  </Button>
                ) : null}
                <Button data-testid="add-unit" onClick={() => setEditing({ level: "unit", mode: "add" })}>
                  <Plus /> Add unit
                </Button>
              </>
            ) : null}
          </>
        }
      />

      {units.length === 0 ? (
        <EmptyState
          title="No units yet"
          description={admin ? "Add a unit, then add its lessons." : "Nothing to study here yet."}
        />
      ) : (
        <div className="space-y-4">
          {units.map((unit, unitIndex) => (
            <Card key={unit.id} data-testid="unit">
              <CardHeader>
                <CardTitle>{unit.title}</CardTitle>
                {admin ? (
                  <CardAction>
                    <ItemControls
                      label={unit.title}
                      first={unitIndex === 0}
                      last={unitIndex === units.length - 1}
                      onMove={(direction) => void run(() => moveItem({ data: { level: "unit", id: unit.id, direction } }))}
                      onEdit={() => setEditing({ level: "unit", mode: "edit", id: unit.id, title: unit.title })}
                      onDelete={() => setDeleting({ level: "unit", id: unit.id, title: unit.title })}
                    />
                  </CardAction>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-3">
                {unit.lessons.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No lessons yet.</p>
                ) : (
                  <ol className="divide-y divide-border">
                    {unit.lessons.map((lesson, index) => (
                      <li key={lesson.id} data-testid="lesson-row" className="flex items-center justify-between gap-2 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="w-5 shrink-0 text-sm text-muted-foreground tabular-nums">{index + 1}</span>
                          <Link to="/lessons/$lessonId" params={{ lessonId: lesson.id }} className="truncate hover:underline">
                            {lesson.title}
                          </Link>
                          {lesson.done ? (
                            <Badge variant="success" data-testid="lesson-done">
                              <CircleCheck /> Done
                            </Badge>
                          ) : null}
                        </div>
                        {admin ? (
                          <ItemControls
                            label={lesson.title}
                            first={index === 0}
                            last={index === unit.lessons.length - 1}
                            onMove={(direction) => void run(() => moveItem({ data: { level: "lesson", id: lesson.id, direction } }))}
                            onEdit={() => void router.navigate({ to: "/lessons/$lessonId/edit", params: { lessonId: lesson.id } })}
                            onDelete={() => setDeleting({ level: "lesson", id: lesson.id, title: lesson.title })}
                          />
                        ) : null}
                      </li>
                    ))}
                  </ol>
                )}
                {admin ? (
                  <Button size="sm" variant="outline" data-testid="add-lesson" onClick={() => setEditing({ level: "lesson", mode: "add", unitId: unit.id })}>
                    <Plus /> Add lesson
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editing ? (
        <FormDialog
          title={editing.level === "lesson" ? "Add lesson" : editing.mode === "add" ? "Add unit" : "Rename unit"}
          onClose={() => setEditing(null)}
          onSubmit={async (form) => {
            const title = String(form.get("title") ?? "");
            if (editing.level === "lesson") {
              await createItem({
                data: { level: "lesson", parentId: editing.unitId, title, body: String(form.get("body") ?? "") },
              });
            } else if (editing.mode === "add") {
              await createItem({ data: { level: "unit", parentId: subject.id, title } });
            } else {
              await updateItem({ data: { level: "unit", id: editing.id, title } });
            }
            await router.invalidate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="item-title">Title</Label>
            <Input
              id="item-title"
              name="title"
              defaultValue={editing.level === "unit" && editing.mode === "edit" ? editing.title : ""}
              autoFocus
              required
            />
          </div>
          {editing.level === "lesson" ? (
            <div className="space-y-2">
              <Label htmlFor="item-body">Explanation</Label>
              <Textarea id="item-body" name="body" rows={6} />
            </div>
          ) : null}
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
            const work =
              deleting.level === "textbook"
                ? () => removeFile(textbookUrl)
                : () => deleteItem({ data: { level: deleting.level as "unit" | "lesson", id: deleting.id } });
            void run(work).finally(() => {
              setPending(false);
              setDeleting(null);
            });
          }}
        >
          {deleting.level === "unit"
            ? "Its lessons and their quiz results are deleted too."
            : deleting.level === "lesson"
              ? "Its questions and quiz results are deleted too."
              : null}
        </ConfirmDialog>
      ) : null}
    </Page>
  );
}
