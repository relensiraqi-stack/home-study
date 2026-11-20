import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { z } from "zod";
import { UserError } from "@/server/errors";
import * as library from "@/server/library";
import { loadCaller, requireAdmin } from "@/server/members";
import { activeLearner } from "@/server/family";

const idInput = (data: unknown) => z.object({ id: z.string().min(1).max(64) }).parse(data);

/** Null when the row doesn't exist, so the page can say so. */
export async function orNull<T>(work: () => Promise<T>): Promise<T | null> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof UserError) return null;
    throw error;
  }
}

export const getLibrary = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context }) => {
    const caller = await loadCaller(context.user);
    const [grades, learner] = await Promise.all([library.listGrades(), activeLearner(caller)]);
    return { grades, admin: caller.admin, learner };
  });

export const getGrade = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator(idInput)
  .handler(async ({ data, context }) => {
    const caller = await loadCaller(context.user);
    const grade = await orNull(() => library.getGrade(data.id));
    return grade && { ...grade, admin: caller.admin };
  });

export const getSubject = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator(idInput)
  .handler(async ({ data, context }) => {
    const caller = await loadCaller(context.user);
    const learner = await activeLearner(caller);
    const subject = await orNull(() => library.getSubject(data.id, learner?.id ?? null));
    return subject && { ...subject, admin: caller.admin, learner };
  });

export const createItem = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => library.createItemInput.parse(data))
  .handler(async ({ data, context }) => {
    requireAdmin(await loadCaller(context.user));
    return library.createItem(data);
  });

export const updateItem = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => library.updateItemInput.parse(data))
  .handler(async ({ data, context }) => {
    requireAdmin(await loadCaller(context.user));
    await library.updateItem(data);
  });

export const moveItem = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => library.moveItemInput.parse(data))
  .handler(async ({ data, context }) => {
    requireAdmin(await loadCaller(context.user));
    await library.moveItem(data);
  });

export const deleteItem = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => library.deleteItemInput.parse(data))
  .handler(async ({ data, context }) => {
    requireAdmin(await loadCaller(context.user));
    await library.deleteItem(data);
  });
