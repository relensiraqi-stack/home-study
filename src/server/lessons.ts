import { env } from "cloudflare:workers";
import { z } from "zod";
import { notFound, UserError } from "@/server/errors";
import { sameAnswer, scorePercent, starsFor } from "@/server/grading";
import type { Caller } from "@/server/members";
import { activeLearner } from "@/server/family";

const DB = () => env.DB;
const id = z.string().min(1).max(64);

interface QuestionRow {
  id: string;
  stage: "practice" | "quiz";
  prompt: string;
  choices: string;
  answer: string;
}

async function lessonHeader(lessonId: string) {
  const lesson = await DB()
    .prepare(
      `select l.id, l.title, l.body, l.media_name as mediaName, l.media_type as mediaType,
         s.id as subjectId, s.title as subjectTitle, g.title as gradeTitle
       from lessons l join units u on l.unit_id = u.id join subjects s on u.subject_id = s.id
       join grades g on s.grade_id = g.id where l.id = ?`,
    )
    .bind(lessonId)
    .first<{
      id: string;
      title: string;
      body: string;
      mediaName: string | null;
      mediaType: string | null;
      subjectId: string;
      subjectTitle: string;
      gradeTitle: string;
    }>();
  if (!lesson) notFound();
  return lesson;
}

async function questionsOf(lessonId: string): Promise<QuestionRow[]> {
  const { results } = await DB()
    .prepare(
      `select id, stage, prompt, choices, answer from questions where lesson_id = ? order by position, id`,
    )
    .bind(lessonId)
    .all<QuestionRow>();
  return results;
}

/** The lesson as a learner sees it: no answers. */
export async function getLesson(caller: Caller, lessonId: string) {
  const lesson = await lessonHeader(lessonId);
  const rows = await questionsOf(lessonId);
  const shown = (stage: QuestionRow["stage"]) =>
    rows
      .filter((q) => q.stage === stage)
      .map((q) => ({ id: q.id, prompt: q.prompt, choices: JSON.parse(q.choices) as string[] }));
  const learner = await activeLearner(caller);
  return { lesson, practice: shown("practice"), quiz: shown("quiz"), learner, admin: caller.admin };
}

/** The lesson with its answers, for the editor. */
export async function getLessonForEditing(lessonId: string) {
  const lesson = await lessonHeader(lessonId);
  const rows = await questionsOf(lessonId);
  return {
    lesson,
    questions: rows.map((q) => ({ ...q, choices: JSON.parse(q.choices) as string[] })),
  };
}

export const checkPracticeInput = z
  .object({ questionId: id, answer: z.string().max(500) })
  .strict();

export async function checkPractice({ questionId, answer }: z.infer<typeof checkPracticeInput>) {
  const question = await DB()
    .prepare(`select answer from questions where id = ? and stage = 'practice'`)
    .bind(questionId)
    .first<{ answer: string }>();
  if (!question) notFound();
  return { correct: sameAnswer(answer, question.answer), answer: question.answer };
}

export const submitQuizInput = z
  .object({
    lessonId: id,
    answers: z.record(z.string().max(64), z.string().max(500)),
    seconds: z.number().int().min(0),
  })
  .strict();

export async function submitQuiz(caller: Caller, input: z.infer<typeof submitQuizInput>) {
  const quiz = (await questionsOf(input.lessonId)).filter((q) => q.stage === "quiz");
  if (quiz.length === 0) throw new UserError("This lesson has no quiz yet.");
  const results = quiz.map((q) => ({
    id: q.id,
    correct: sameAnswer(input.answers[q.id] ?? "", q.answer),
    answer: q.answer,
  }));
  const scorePct = scorePercent(results.filter((r) => r.correct).length, quiz.length);
  const stars = starsFor(scorePct);
  const learner = await activeLearner(caller);
  if (learner) {
    await DB()
      .prepare(
        `insert into attempts (id, learner_id, lesson_id, score_pct, stars, seconds) values (?, ?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), learner.id, input.lessonId, scorePct, stars, Math.min(input.seconds, 4 * 3600))
      .run();
  }
  return { scorePct, stars, results, savedFor: learner?.name ?? null };
}

export const addQuestionInput = z
  .object({
    lessonId: id,
    stage: z.enum(["practice", "quiz"]),
    prompt: z.string().trim().min(1, "Write the question.").max(1000),
    choices: z.array(z.string().trim().min(1).max(200)).max(8),
    answer: z.string().trim().min(1, "Give the right answer.").max(500),
  })
  .strict()
  .refine((q) => q.choices.length !== 1, "Give at least two choices, or none for a typed answer.")
  .refine(
    (q) => q.choices.length === 0 || q.choices.some((c) => sameAnswer(c, q.answer)),
    "The right answer must be one of the choices.",
  );

export async function addQuestion(input: z.infer<typeof addQuestionInput>) {
  await lessonHeader(input.lessonId);
  await DB()
    .prepare(
      `insert into questions (id, lesson_id, stage, prompt, choices, answer, position)
       select ?, ?, ?, ?, ?, ?, coalesce(max(position), 0) + 1 from questions where lesson_id = ?`,
    )
    .bind(
      crypto.randomUUID(),
      input.lessonId,
      input.stage,
      input.prompt,
      JSON.stringify(input.choices),
      input.answer,
      input.lessonId,
    )
    .run();
}

export const deleteQuestionInput = z.object({ id }).strict();

export async function deleteQuestion({ id: questionId }: z.infer<typeof deleteQuestionInput>) {
  const result = await DB().prepare(`delete from questions where id = ?`).bind(questionId).run();
  if (!result.meta.changes) notFound();
}
