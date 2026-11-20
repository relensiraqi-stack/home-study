import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { BackLink } from "@/client/components/BackLink";
import { EmptyState } from "@/client/components/EmptyState";
import { NotFoundPage, Page } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { Stars } from "@/client/components/Stars";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Progress } from "@/client/components/ui/progress";
import { Table, TableBody, TableCard, TableCell, TableHead, TableHeader, TableRow } from "@/client/components/ui/table";
import { getReport } from "@/serverFunctions/family";

export const Route = createFileRoute("/learners/$learnerId/")({
  loader: ({ params }) => getReport({ data: { id: params.learnerId } }),
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.learner.name ?? "Progress"} · Home Study` }] }),
  component: ReportPage,
});

const dateFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function ReportPage() {
  const report = Route.useLoaderData();
  if (!report) return <NotFoundPage />;
  const { learner } = report;
  return (
    <Page>
      <PageHeader
        backLink={<BackLink to="/learners">Learners</BackLink>}
        title={`${learner.name}'s progress`}
        description={learner.gradeTitle ?? undefined}
        actions={
          <Button
            variant="outline"
            render={<Link to="/learners/$learnerId/schedule" params={{ learnerId: learner.id }} />}
          >
            <CalendarDays /> Schedule
          </Button>
        }
      />
      {report.attempts === 0 ? (
        <div data-testid="empty-report">
          <EmptyState
            title="No quizzes taken yet"
            description={`Choose ${learner.name} as studying, then finish a lesson's quiz.`}
            action={
              <Button variant="outline" render={<Link to="/" />}>
                Open the library
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat testId="stat-minutes" label="Minutes studied" value={report.minutes} />
            <Stat testId="stat-lessons" label="Lessons completed" value={report.lessons} />
            <Stat testId="stat-stars" label="Stars" value={report.stars} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>By subject</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {report.strongest || report.weakest ? (
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  {report.strongest ? (
                    <p data-testid="strongest" className="flex items-center gap-1.5">
                      <TrendingUp className="size-4 text-success" aria-hidden />
                      Strongest: <span className="font-medium">{report.strongest.title}</span>
                    </p>
                  ) : null}
                  {report.weakest ? (
                    <p data-testid="weakest" className="flex items-center gap-1.5">
                      <TrendingDown className="size-4 text-destructive" aria-hidden />
                      Needs work: <span className="font-medium">{report.weakest.title}</span>
                    </p>
                  ) : null}
                </div>
              ) : null}
              <ul className="space-y-3">
                {report.subjects.map((subject) => (
                  <li key={subject.id} data-testid="subject-row" className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span>
                        <span className="font-medium">{subject.title}</span>{" "}
                        <span className="text-muted-foreground">· {subject.gradeTitle}</span>
                      </span>
                      <span className="tabular-nums">
                        {subject.average}% <span className="text-muted-foreground">average</span>
                      </span>
                    </div>
                    <Progress value={subject.average} aria-label={`${subject.title} average`} />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Recent quizzes</h2>
            <TableCard>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lesson</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead>Stars</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.recent.map((attempt) => (
                    <TableRow key={attempt.id} data-testid="attempt-row">
                      <TableCell className="max-w-56 whitespace-normal">
                        <Link to="/lessons/$lessonId" params={{ lessonId: attempt.lessonId }} className="font-medium hover:underline">
                          {attempt.lessonTitle}
                        </Link>
                        <div className="text-xs text-muted-foreground">{attempt.subjectTitle}</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{attempt.scorePct}%</TableCell>
                      <TableCell>
                        <Stars count={attempt.stars} small />
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {dateFormat.format(new Date(attempt.createdAt))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableCard>
          </section>
        </>
      )}
    </Page>
  );
}

function Stat({ testId, label, value }: { testId: string; label: string; value: ReactNode }) {
  return (
    <Card size="sm" data-testid={testId}>
      <CardContent className="space-y-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
