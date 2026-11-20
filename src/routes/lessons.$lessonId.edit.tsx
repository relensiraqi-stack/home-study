import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Eye, Plus, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { BackLink } from "@/client/components/BackLink";
import { EmptyState } from "@/client/components/EmptyState";
import { FormDialog } from "@/client/components/FormDialog";
import { NotFoundPage, Page } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import { errorMessage } from "@/client/lib/errors";
import { removeFile, uploadFile } from "@/client/lib/format";
import { updateItem } from "@/serverFunctions/library";
import { addQuestion, deleteQuestion, getLessonForEditing } from "@/serverFunctions/lessons";

export const Route = createFileRoute("/lessons/$lessonId/edit")({
  loader: ({ params }) => getLessonForEditing({ data: { id: params.lessonId } }),
  head: () => ({ meta: [{ title: "Edit lesson · Home Study" }] }),
  component: EditLessonPage,
});

type Stage = "practice" | "quiz";

function EditLessonPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [adding, setAdding] = useState<Stage | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  if (!data) return <NotFoundPage />;
  if (data.forbidden) {
    return (
      <Page>
        <PageHeader title="Edit lesson" />
        <div data-testid="forbidden">
          <EmptyState kind="error" title="Only admins can edit lessons" />
        </div>
      </Page>
    );
  }
  const { lesson, questions } = data;
  const mediaUrl = `/files/lessons/${lesson.id}/media`;

  async function run(work: () => Promise<unknown>, done?: string) {
    try {
      await work();
      await router.invalidate();
      if (done) toast.success(done);
    } catch (cause) {
      toast.error(errorMessage(cause));
    }
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    await run(() => uploadFile(mediaUrl, file));
    setUploading(false);
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <Page>
      <PageHeader
        backLink={
          <BackLink to="/subjects/$subjectId" params={{ subjectId: lesson.subjectId }}>
            {lesson.gradeTitle} · {lesson.subjectTitle}
          </BackLink>
        }
        title={lesson.title}
        actions={
          <Button variant="outline" data-testid="view-lesson" render={<Link to="/lessons/$lessonId" params={{ lessonId: lesson.id }} />}>
            <Eye /> View lesson
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Explanation</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            key={`${lesson.title}\n${lesson.body}`}
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              setSaving(true);
              void run(
                () =>
                  updateItem({
                    data: { level: "lesson", id: lesson.id, title: String(form.get("title") ?? ""), body: String(form.get("body") ?? "") },
                  }),
                "Lesson saved.",
              ).finally(() => setSaving(false));
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="lesson-title">Title</Label>
              <Input id="lesson-title" name="title" defaultValue={lesson.title} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lesson-body">Explanation</Label>
              <Textarea id="lesson-body" name="body" rows={8} defaultValue={lesson.body} />
            </div>
            <Button type="submit" data-testid="save-lesson" pending={saving}>
              Save
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audio or video</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 truncate text-sm" data-testid="media-name">
            {lesson.mediaName ?? <span className="text-muted-foreground">None</span>}
          </p>
          <div className="flex gap-2">
            <input
              ref={fileInput}
              type="file"
              accept="audio/*,video/*"
              className="sr-only"
              data-testid="media-upload"
              aria-label="Audio or video file"
              onChange={(event) => void upload(event.target.files?.[0])}
            />
            <Button variant="outline" pending={uploading} onClick={() => fileInput.current?.click()}>
              <Upload /> {lesson.mediaName ? "Replace" : "Upload"}
            </Button>
            {lesson.mediaName ? (
              <Button variant="ghost" size="icon" aria-label="Remove audio or video" onClick={() => void run(() => removeFile(mediaUrl))}>
                <Trash2 />
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {(["practice", "quiz"] as const).map((stage) => {
        const list = questions.filter((q) => q.stage === stage);
        return (
          <Card key={stage}>
            <CardHeader>
              <CardTitle>{stage === "practice" ? "Practice questions" : "Quiz questions"}</CardTitle>
              <CardAction>
                <Button size="sm" variant="outline" data-testid={`add-${stage}`} onClick={() => setAdding(stage)}>
                  <Plus /> Add
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {list.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {stage === "practice" ? "No practice questions." : "No quiz questions."}
                </p>
              ) : (
                <ol className="divide-y divide-border">
                  {list.map((question, index) => (
                    <li key={question.id} data-testid="question-row" className="flex items-start justify-between gap-3 py-2">
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-medium">
                          {index + 1}. {question.prompt}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                          {question.choices.length > 0 ? (
                            question.choices.map((choice) => (
                              <Badge key={choice} variant={choice === question.answer ? "success" : "outline"}>
                                {choice}
                              </Badge>
                            ))
                          ) : (
                            <>
                              Typed answer: <Badge variant="success">{question.answer}</Badge>
                            </>
                          )}
                        </div>
                      </div>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        data-testid="delete-question"
                        aria-label="Delete question"
                        onClick={() => void run(() => deleteQuestion({ data: { id: question.id } }))}
                      >
                        <Trash2 />
                      </Button>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        );
      })}

      {adding ? (
        <FormDialog
          title={adding === "practice" ? "Add practice question" : "Add quiz question"}
          onClose={() => setAdding(null)}
          onSubmit={async (form) => {
            const choices = String(form.get("choices") ?? "")
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean);
            await addQuestion({
              data: {
                lessonId: lesson.id,
                stage: adding,
                prompt: String(form.get("prompt") ?? ""),
                choices,
                answer: String(form.get("answer") ?? ""),
              },
            });
            await router.invalidate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="q-prompt">Question</Label>
            <Textarea id="q-prompt" name="prompt" rows={2} autoFocus required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="q-choices">Choices, one per line</Label>
            <Textarea id="q-choices" name="choices" rows={4} />
            <p className="text-sm text-muted-foreground">Leave empty for a typed answer.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="q-answer">Right answer</Label>
            <Input id="q-answer" name="answer" required />
          </div>
        </FormDialog>
      ) : null}
    </Page>
  );
}
