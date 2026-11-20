import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { CalendarDays, ChartColumn, Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { CopyButton } from "@/client/components/CopyButton";
import { EmptyState } from "@/client/components/EmptyState";
import { FormDialog } from "@/client/components/FormDialog";
import { GradeSelect } from "@/client/components/GradeSelect";
import { Page } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { errorMessage } from "@/client/lib/errors";
import {
  createCode,
  createLearner,
  deleteLearner,
  getFamily,
  redeemCode,
  setActiveLearner,
  updateLearner,
} from "@/serverFunctions/family";

export const Route = createFileRoute("/learners/")({
  loader: () => getFamily(),
  head: () => ({ meta: [{ title: "Learners · Home Study" }] }),
  component: LearnersPage,
});

type Learner = { id: string; name: string; gradeId: string | null; gradeTitle: string | null };

function LearnersPage() {
  const { learners, activeLearnerId, guardians, grades, max } = Route.useLoaderData();
  const router = useRouter();
  const [editing, setEditing] = useState<Learner | "new" | null>(null);
  const [gradeId, setGradeId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Learner | null>(null);
  const [pending, setPending] = useState(false);
  const [invite, setInvite] = useState<{ code: string; expiresAt: number } | null>(null);
  const [code, setCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const full = learners.length >= max;

  async function run(work: () => Promise<unknown>) {
    try {
      await work();
      await router.invalidate();
    } catch (cause) {
      toast.error(errorMessage(cause));
    }
  }

  function open(learner: Learner | "new") {
    setGradeId(learner === "new" ? null : learner.gradeId);
    setEditing(learner);
  }

  return (
    <Page>
      <PageHeader
        title="Learners"
        description={guardians > 1 ? `Shared by ${guardians} guardians.` : undefined}
        actions={
          <Button data-testid="add-learner" disabled={full} onClick={() => open("new")}>
            <Plus /> Add learner
          </Button>
        }
      />

      {learners.length === 0 ? (
        <div data-testid="empty-learners">
          <EmptyState
            title="No learners yet"
            description="Add each child who studies here, or join another guardian's family with their code."
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {learners.map((learner) => {
              const active = learner.id === activeLearnerId;
              return (
                <Card key={learner.id} data-testid="learner-card" size="sm">
                  <CardContent className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 font-medium">
                          <span className="truncate">{learner.name}</span>
                          {active ? (
                            <Badge variant="success" data-testid="active-badge">
                              Studying
                            </Badge>
                          ) : null}
                        </p>
                        <p className="text-sm text-muted-foreground">{learner.gradeTitle ?? "No grade"}</p>
                      </div>
                      <div className="flex shrink-0 gap-0.5">
                        <Button size="icon-sm" variant="ghost" data-testid="edit" aria-label={`Edit ${learner.name}`} onClick={() => open(learner)}>
                          <Pencil />
                        </Button>
                        <Button size="icon-sm" variant="ghost" data-testid="delete" aria-label={`Delete ${learner.name}`} onClick={() => setDeleting(learner)}>
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {active ? null : (
                        <Button size="sm" data-testid="study-as" onClick={() => void run(() => setActiveLearner({ data: { id: learner.id } }))}>
                          Study as {learner.name}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid="report-link"
                        render={<Link to="/learners/$learnerId" params={{ learnerId: learner.id }} />}
                      >
                        <ChartColumn /> Progress
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid="schedule-link"
                        render={<Link to="/learners/$learnerId/schedule" params={{ learnerId: learner.id }} />}
                      >
                        <CalendarDays /> Schedule
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {full ? <p className="text-sm text-muted-foreground">A family can have up to {max} learners.</p> : null}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Add a guardian</CardTitle>
            <CardDescription>The code works once, for 24 hours.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {invite ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
                <code data-testid="invite-code" className="font-mono text-lg tracking-widest">
                  {invite.code}
                </code>
                <CopyButton value={invite.code} successMessage="Code copied." size="sm" variant="ghost" />
              </div>
            ) : null}
            <Button
              variant="outline"
              data-testid="create-code"
              onClick={() =>
                void createCode()
                  .then(setInvite)
                  .catch((cause) => toast.error(errorMessage(cause)))
              }
            >
              <UserPlus /> {invite ? "New code" : "Make a code"}
            </Button>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Join a family</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                setJoining(true);
                setJoinError(null);
                redeemCode({ data: { code } })
                  .then(async () => {
                    setCode("");
                    await router.invalidate();
                    toast.success("You joined the family.");
                  })
                  .catch((cause) => setJoinError(errorMessage(cause)))
                  .finally(() => setJoining(false));
              }}
            >
              <div className="flex gap-2">
                <Input name="code" aria-label="Code" value={code} onChange={(event) => setCode(event.target.value)} autoComplete="off" className="font-mono uppercase" />
                <Button type="submit" data-testid="join-submit" pending={joining} disabled={!code.trim()}>
                  Join
                </Button>
              </div>
              {joinError ? (
                <Alert variant="destructive" data-testid="join-error">
                  <AlertDescription>{joinError}</AlertDescription>
                </Alert>
              ) : null}
            </form>
          </CardContent>
        </Card>
      </div>

      {editing ? (
        <FormDialog
          title={editing === "new" ? "Add learner" : `Edit ${editing.name}`}
          onClose={() => setEditing(null)}
          onSubmit={async (form) => {
            const name = String(form.get("name") ?? "");
            if (editing === "new") await createLearner({ data: { name, gradeId } });
            else await updateLearner({ data: { id: editing.id, name, gradeId } });
            await router.invalidate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="learner-name">Name</Label>
            <Input id="learner-name" name="name" defaultValue={editing === "new" ? "" : editing.name} autoFocus required />
          </div>
          <GradeSelect grades={grades} value={gradeId} onChange={setGradeId} />
        </FormDialog>
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          confirmLabel="Delete"
          destructive
          pending={pending}
          onClose={() => setDeleting(null)}
          onConfirm={() => {
            setPending(true);
            void run(() => deleteLearner({ data: { id: deleting.id } })).finally(() => {
              setPending(false);
              setDeleting(null);
            });
          }}
        >
          Their quiz results and schedule are deleted too.
        </ConfirmDialog>
      ) : null}
    </Page>
  );
}
