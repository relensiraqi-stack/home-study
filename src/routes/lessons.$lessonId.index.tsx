import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Pencil, RotateCcw, X } from "lucide-react";
import { useRef, useState } from "react";
import { BackLink } from "@/client/components/BackLink";
import { NotFoundPage, Page } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { Stars } from "@/client/components/Stars";
import { StudyingNote } from "@/client/components/StudyingNote";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { errorMessage } from "@/client/lib/errors";
import { checkPractice, getLesson, submitQuiz } from "@/serverFunctions/lessons";

export const Route = createFileRoute("/lessons/$lessonId/")({
  loader: ({ params }) => getLesson({ data: { id: params.lessonId } }),
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.lesson.title ?? "Lesson"} · Home Study` }] }),
  component: LessonPage,
});

interface Question {
  id: string;
  prompt: string;
  choices: string[];
}

function LessonPage() {
  const data = Route.useLoaderData();
  if (!data) return <NotFoundPage />;
  const { lesson, practice, quiz, learner, admin } = data;
  return (
    <Page>
      <PageHeader
        backLink={
          <BackLink to="/subjects/$subjectId" params={{ subjectId: lesson.subjectId }}>
            {lesson.gradeTitle} · {lesson.subjectTitle}
          </BackLink>
        }
        title={lesson.title}
        description={<StudyingNote learner={learner} />}
        actions={
          admin ? (
            <Button
              variant="outline"
              data-testid="edit-lesson"
              render={<Link to="/lessons/$lessonId/edit" params={{ lessonId: lesson.id }} />}
            >
              <Pencil /> Edit
            </Button>
          ) : null
        }
      />

      <Card>
        <CardContent className="space-y-4">
          {lesson.body ? (
            <div data-testid="lesson-body" className="leading-relaxed whitespace-pre-wrap">
              {lesson.body}
            </div>
          ) : null}
          {lesson.mediaType ? <LessonMedia lessonId={lesson.id} type={lesson.mediaType} /> : null}
        </CardContent>
      </Card>

      {practice.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Practice</h2>
          {practice.map((question, index) => (
            <PracticeQuestion key={question.id} number={index + 1} question={question} />
          ))}
        </section>
      ) : null}

      {quiz.length > 0 ? <Quiz key={lesson.id} lessonId={lesson.id} questions={quiz} /> : null}
    </Page>
  );
}

function LessonMedia({ lessonId, type }: { lessonId: string; type: string }) {
  const src = `/files/lessons/${lessonId}/media`;
  return type.startsWith("video/") ? (
    <video data-testid="lesson-media" controls preload="metadata" src={src} className="w-full rounded-lg bg-muted" />
  ) : (
    <audio data-testid="lesson-media" controls preload="metadata" src={src} className="w-full" />
  );
}

function PracticeQuestion({ number, question }: { number: number; question: Question }) {
  const [result, setResult] = useState<{ correct: boolean; answer: string; given: string } | null>(null);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check(answer: string) {
    if (!answer.trim()) return;
    setPending(true);
    setError(null);
    try {
      const checked = await checkPractice({ data: { questionId: question.id, answer } });
      setResult({ ...checked, given: answer });
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card data-testid="practice-question" size="sm">
      <CardContent className="space-y-3">
        <p className="font-medium">
          {number}. {question.prompt}
        </p>
        {question.choices.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {question.choices.map((choice) => (
              <Button
                key={choice}
                variant={result?.given === choice ? "secondary" : "outline"}
                disabled={pending || result !== null}
                onClick={() => void check(choice)}
              >
                {choice}
              </Button>
            ))}
          </div>
        ) : (
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void check(text);
            }}
          >
            <Input name="answer" value={text} onChange={(event) => setText(event.target.value)} disabled={result !== null} aria-label="Your answer" autoComplete="off" />
            <Button type="submit" data-testid="check" pending={pending} disabled={result !== null}>
              Check
            </Button>
          </form>
        )}
        {result ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Feedback testId="practice-feedback" correct={result.correct} answer={result.answer} />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setResult(null);
                setText("");
              }}
            >
              <RotateCcw /> Try again
            </Button>
          </div>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}

function Feedback({ testId, correct, answer }: { testId: string; correct: boolean; answer: string }) {
  return (
    <p data-testid={testId} className={`flex items-center gap-1.5 text-sm font-medium ${correct ? "text-success" : "text-destructive"}`}>
      {correct ? <Check className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}
      {correct ? "Correct!" : `Not quite. The answer is ${answer}.`}
    </p>
  );
}

type QuizResult = Awaited<ReturnType<typeof submitQuiz>>;

function Quiz({ lessonId, questions }: { lessonId: string; questions: Question[] }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef(Date.now());

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const seconds = Math.round((Date.now() - startedAt.current) / 1000);
      setResult(await submitQuiz({ data: { lessonId, answers, seconds } }));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  function retry() {
    setAnswers({});
    setResult(null);
    startedAt.current = Date.now();
  }

  const byId = new Map(result?.results.map((r) => [r.id, r]));
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Quiz</h2>
      {questions.map((question, index) => {
        const graded = byId.get(question.id);
        return (
          <Card key={question.id} data-testid="quiz-question" size="sm">
            <CardContent className="space-y-3">
              <p className="font-medium">
                {index + 1}. {question.prompt}
              </p>
              {question.choices.length > 0 ? (
                <div className="flex flex-wrap gap-2" role="group" aria-label={`Question ${index + 1}`}>
                  {question.choices.map((choice) => {
                    const chosen = answers[question.id] === choice;
                    return (
                      <Button
                        key={choice}
                        variant={chosen ? "default" : "outline"}
                        aria-pressed={chosen}
                        disabled={result !== null}
                        onClick={() => setAnswers((current) => ({ ...current, [question.id]: choice }))}
                      >
                        {choice}
                      </Button>
                    );
                  })}
                </div>
              ) : (
                <Input
                  name="answer"
                  aria-label={`Answer to question ${index + 1}`}
                  autoComplete="off"
                  value={answers[question.id] ?? ""}
                  disabled={result !== null}
                  onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                />
              )}
              {graded ? <Feedback testId="quiz-feedback" correct={graded.correct} answer={graded.answer} /> : null}
            </CardContent>
          </Card>
        );
      })}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {result ? (
        <Card data-testid="quiz-result">
          <CardHeader>
            <CardTitle>Your score</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span data-testid="quiz-score" className="text-3xl font-semibold tabular-nums">
                {result.scorePct}%
              </span>
              <Stars count={result.stars} testId="quiz-stars" />
            </div>
            <Button variant="outline" data-testid="quiz-retry" onClick={retry}>
              <RotateCcw /> Take it again
            </Button>
            <p className="w-full text-sm text-muted-foreground">
              {result.savedFor ? `Saved to ${result.savedFor}'s progress.` : "Not saved: nobody is chosen as studying."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Button data-testid="quiz-submit" pending={pending} onClick={() => void submit()}>
          Submit quiz
        </Button>
      )}
    </section>
  );
}
