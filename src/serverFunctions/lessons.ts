import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { z } from "zod";
import * as lessons from "@/server/lessons";
import { loadCaller, requireAdmin } from "@/server/members";
import { orNull } from "@/serverFunctions/library";

const idInput = (data: unknown) => z.object({ id: z.string().min(1).max(64) }).parse(data);

export const getLesson = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator(idInput)
  .handler(async ({ data, context }) => {
    const caller = await loadCaller(context.user);
    return orNull(() => lessons.getLesson(caller, data.id));
  });

/** Null for a member who isn't an admin; the page says so. */
export const getLessonForEditing = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator(idInput)
  .handler(async ({ data, context }) => {
    const caller = await loadCaller(context.user);
    if (!caller.admin) return { forbidden: true as const };
    const lesson = await orNull(() => lessons.getLessonForEditing(data.id));
    return lesson ? { forbidden: false as const, ...lesson } : null;
  });

export const checkPractice = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => lessons.checkPracticeInput.parse(data))
  .handler(({ data }) => lessons.checkPractice(data));

export const submitQuiz = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => lessons.submitQuizInput.parse(data))
  .handler(async ({ data, context }) => lessons.submitQuiz(await loadCaller(context.user), data));

export const addQuestion = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => lessons.addQuestionInput.parse(data))
  .handler(async ({ data, context }) => {
    requireAdmin(await loadCaller(context.user));
    await lessons.addQuestion(data);
  });

export const deleteQuestion = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => lessons.deleteQuestionInput.parse(data))
  .handler(async ({ data, context }) => {
    requireAdmin(await loadCaller(context.user));
    await lessons.deleteQuestion(data);
  });
