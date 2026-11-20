import { env } from "cloudflare:workers";
import { z } from "zod";
import { notFound, UserError } from "@/server/errors";
import { overlaps, parseTime } from "@/server/grading";
import type { Caller } from "@/server/members";
import { requireLearner } from "@/server/family";

const DB = () => env.DB;
const id = z.string().min(1).max(64);

interface Slot {
  id: string;
  weekday: number;
  startMinute: number;
  minutes: number;
  subjectId: string;
  subjectTitle: string;
}

async function slotsOf(learnerId: string): Promise<Slot[]> {
  const { results } = await DB()
    .prepare(
      `select sl.id, sl.weekday, sl.start_minute as startMinute, sl.minutes, sl.subject_id as subjectId,
         s.title as subjectTitle
       from schedule_slots sl join subjects s on sl.subject_id = s.id
       where sl.learner_id = ? order by sl.weekday, sl.start_minute`,
    )
    .bind(learnerId)
    .all<Slot>();
  return results;
}

export async function getSchedule(caller: Caller, learnerId: string) {
  const learner = await requireLearner(caller, learnerId);
  const { results: subjects } = await DB()
    .prepare(
      `select s.id, s.title, g.title as gradeTitle, g.id as gradeId from subjects s join grades g on s.grade_id = g.id
       order by g.id = ? desc, g.position, s.position`,
    )
    .bind(learner.gradeId ?? "")
    .all<{ id: string; title: string; gradeTitle: string; gradeId: string }>();
  return { learner, slots: await slotsOf(learnerId), subjects };
}

export const addSlotInput = z
  .object({
    learnerId: id,
    weekday: z.number().int().min(1).max(7),
    start: z.string().max(5),
    minutes: z.number().int().min(5, "At least 5 minutes.").max(240, "At most 240 minutes."),
    subjectId: id,
  })
  .strict();

export async function addSlot(caller: Caller, input: z.infer<typeof addSlotInput>) {
  await requireLearner(caller, input.learnerId);
  const startMinute = parseTime(input.start);
  if (startMinute === null) throw new UserError("Pick a start time.");
  if (startMinute + input.minutes > 24 * 60) throw new UserError("A slot has to end by midnight.");
  const subject = await DB().prepare(`select 1 from subjects where id = ?`).bind(input.subjectId).first();
  if (!subject) throw new UserError("Pick a subject.");
  const slot = { weekday: input.weekday, startMinute, minutes: input.minutes };
  const clash = (await slotsOf(input.learnerId)).find((other) => overlaps(slot, other));
  if (clash) throw new UserError(`This overlaps ${clash.subjectTitle} at the same time.`);
  try {
    await DB()
      .prepare(
        `insert into schedule_slots (id, learner_id, weekday, start_minute, minutes, subject_id) values (?, ?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), input.learnerId, input.weekday, startMinute, input.minutes, input.subjectId)
      .run();
  } catch {
    throw new UserError("This overlaps another slot.");
  }
}

export const removeSlotInput = z.object({ id }).strict();

export async function removeSlot(caller: Caller, { id: slotId }: z.infer<typeof removeSlotInput>) {
  if (!caller.familyId) notFound();
  const result = await DB()
    .prepare(
      `delete from schedule_slots where id = ? and learner_id in (select id from learners where family_id = ?)`,
    )
    .bind(slotId, caller.familyId)
    .run();
  if (!result.meta.changes) notFound();
}
