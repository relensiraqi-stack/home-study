import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ChartColumn, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BackLink } from "@/client/components/BackLink";
import { FormDialog } from "@/client/components/FormDialog";
import { NotFoundPage, Page } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/client/components/ui/select";
import { errorMessage } from "@/client/lib/errors";
import { addSlot, getSchedule, removeSlot } from "@/serverFunctions/family";

export const Route = createFileRoute("/learners/$learnerId/schedule")({
  loader: ({ params }) => getSchedule({ data: { id: params.learnerId } }),
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.learner.name ?? "Schedule"} · Home Study` }] }),
  component: SchedulePage,
});

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function time(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

function SchedulePage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [weekday, setWeekday] = useState(1);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  if (!data) return <NotFoundPage />;
  const { learner, slots, subjects } = data;
  const items = subjects.map((s) => ({ value: s.id, label: `${s.title} · ${s.gradeTitle}` }));
  const total = slots.reduce((sum, slot) => sum + slot.minutes, 0);

  return (
    <Page>
      <PageHeader
        backLink={<BackLink to="/learners">Learners</BackLink>}
        title={`${learner.name}'s week`}
        description={slots.length ? `${total} minutes planned each week` : undefined}
        actions={
          <>
            <Button variant="outline" render={<Link to="/learners/$learnerId" params={{ learnerId: learner.id }} />}>
              <ChartColumn /> Progress
            </Button>
            <Button
              data-testid="add-slot"
              disabled={subjects.length === 0}
              onClick={() => {
                setSubjectId(subjectId ?? subjects[0]?.id ?? null);
                setAdding(true);
              }}
            >
              <Plus /> Add study time
            </Button>
          </>
        }
      />
      {subjects.length === 0 ? (
        <p className="text-sm text-muted-foreground">The library has no subjects to plan yet.</p>
      ) : null}

      <div data-testid="week-grid" className="grid gap-2 md:grid-cols-7">
        {DAYS.map((day, index) => {
          const number = index + 1;
          const daySlots = slots.filter((slot) => slot.weekday === number);
          return (
            <div key={day} data-testid={`day-${number}`} className="min-h-24 rounded-lg border border-border bg-card p-2">
              <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{day}</p>
              <ul className="space-y-1.5">
                {daySlots.map((slot) => (
                  <li key={slot.id} data-testid="slot" className="group relative rounded-md bg-primary/10 px-2 py-1.5 text-xs">
                    <p className="font-medium tabular-nums">{time(slot.startMinute)}</p>
                    <p className="text-muted-foreground">{slot.minutes} min</p>
                    <p className="truncate">{slot.subjectTitle}</p>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      data-testid="remove-slot"
                      aria-label={`Remove ${slot.subjectTitle} on ${day} at ${time(slot.startMinute)}`}
                      className="absolute top-1 right-1"
                      onClick={() =>
                        void removeSlot({ data: { id: slot.id } })
                          .then(() => router.invalidate())
                          .catch((cause) => toast.error(errorMessage(cause)))
                      }
                    >
                      <X />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {adding ? (
        <FormDialog
          title="Add study time"
          submitLabel="Add"
          onClose={() => setAdding(false)}
          onSubmit={async (form) => {
            await addSlot({
              data: {
                learnerId: learner.id,
                weekday,
                start: String(form.get("start") ?? ""),
                minutes: Number(form.get("minutes") ?? 0),
                subjectId: subjectId ?? "",
              },
            });
            await router.invalidate();
          }}
        >
          <div className="space-y-2">
            <Label>Day</Label>
            <div className="flex flex-wrap gap-1" role="group" aria-label="Day">
              {DAYS.map((day, index) => (
                <Button
                  key={day}
                  type="button"
                  size="sm"
                  variant={weekday === index + 1 ? "default" : "outline"}
                  aria-pressed={weekday === index + 1}
                  data-testid={`weekday-${index + 1}`}
                  onClick={() => setWeekday(index + 1)}
                >
                  {day}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="slot-start">Starts at</Label>
              <Input id="slot-start" name="start" type="time" defaultValue="16:00" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slot-minutes">Minutes</Label>
              <Input id="slot-minutes" name="minutes" type="number" min={5} max={240} step={5} defaultValue={30} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label id="slot-subject-label">Subject</Label>
            <Select items={items} value={subjectId} onValueChange={(next) => setSubjectId(next ? String(next) : null)}>
              <SelectTrigger data-testid="slot-subject" aria-labelledby="slot-subject-label" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </FormDialog>
      ) : null}
    </Page>
  );
}
