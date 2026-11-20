import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { z } from "zod";
import * as family from "@/server/family";
import { loadCaller } from "@/server/members";
import { getReport as readReport } from "@/server/report";
import * as schedule from "@/server/schedule";
import { orNull } from "@/serverFunctions/library";

const idInput = (data: unknown) => z.object({ id: z.string().min(1).max(64) }).parse(data);

export const getFamily = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context }) => family.getFamily(await loadCaller(context.user)));

export const createLearner = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => family.createLearnerInput.parse(data))
  .handler(async ({ data, context }) => family.createLearner(await loadCaller(context.user), data));

export const updateLearner = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => family.updateLearnerInput.parse(data))
  .handler(async ({ data, context }) => family.updateLearner(await loadCaller(context.user), data));

export const deleteLearner = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => family.learnerIdInput.parse(data))
  .handler(async ({ data, context }) => family.deleteLearner(await loadCaller(context.user), data));

export const setActiveLearner = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => family.learnerIdInput.parse(data))
  .handler(async ({ data, context }) => family.setActiveLearner(await loadCaller(context.user), data));

export const createCode = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .handler(async ({ context }) => family.createCode(await loadCaller(context.user)));

export const redeemCode = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => family.redeemCodeInput.parse(data))
  .handler(async ({ data, context }) => family.redeemCode(await loadCaller(context.user), data));

export const getReport = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator(idInput)
  .handler(async ({ data, context }) => {
    const caller = await loadCaller(context.user);
    return orNull(() => readReport(caller, data.id));
  });

export const getSchedule = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator(idInput)
  .handler(async ({ data, context }) => {
    const caller = await loadCaller(context.user);
    return orNull(() => schedule.getSchedule(caller, data.id));
  });

export const addSlot = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => schedule.addSlotInput.parse(data))
  .handler(async ({ data, context }) => schedule.addSlot(await loadCaller(context.user), data));

export const removeSlot = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => schedule.removeSlotInput.parse(data))
  .handler(async ({ data, context }) => schedule.removeSlot(await loadCaller(context.user), data));
