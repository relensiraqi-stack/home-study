import { env } from "cloudflare:workers";
import { z } from "zod";
import { notFound, UserError } from "@/server/errors";
import type { Caller } from "@/server/members";

// Learners belong to a family; every guardian (user) in it may see and
// manage them, and nobody else. Every query here filters by the caller's
// family id.
const DB = () => env.DB;
const MAX_LEARNERS = 6;
const CODE_LIFETIME_MS = 24 * 60 * 60 * 1000;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const id = z.string().min(1).max(64);
const name = z.string().trim().min(1, "Give a name.").max(80);
const gradeId = z.string().max(64).nullable();

interface Learner {
  id: string;
  name: string;
  gradeId: string | null;
  gradeTitle: string | null;
}

/** The learner the caller picked, when it is still in their family. */
export async function activeLearner(caller: Caller): Promise<Learner | null> {
  if (!caller.familyId || !caller.activeLearnerId) return null;
  return findLearner(caller, caller.activeLearnerId);
}

async function findLearner(caller: Caller, learnerId: string): Promise<Learner | null> {
  if (!caller.familyId) return null;
  return DB()
    .prepare(
      `select l.id, l.name, l.grade_id as gradeId, g.title as gradeTitle
       from learners l left join grades g on l.grade_id = g.id
       where l.id = ? and l.family_id = ?`,
    )
    .bind(learnerId, caller.familyId)
    .first<Learner>();
}

/** The caller's learner, or a not-found refusal. */
export async function requireLearner(caller: Caller, learnerId: string): Promise<Learner> {
  return (await findLearner(caller, learnerId)) ?? notFound();
}

export async function getFamily(caller: Caller) {
  const learners = caller.familyId
    ? (
        await DB()
          .prepare(
            `select l.id, l.name, l.grade_id as gradeId, g.title as gradeTitle
             from learners l left join grades g on l.grade_id = g.id
             where l.family_id = ? order by l.created_at, l.id`,
          )
          .bind(caller.familyId)
          .all<Learner>()
      ).results
    : [];
  const guardians = caller.familyId
    ? ((await DB().prepare(`select count(*) as n from users where family_id = ?`).bind(caller.familyId).first<{ n: number }>())?.n ?? 1)
    : 1;
  const { results: grades } = await DB()
    .prepare(`select id, title from grades order by position, id`)
    .all<{ id: string; title: string }>();
  const active = learners.some((l) => l.id === caller.activeLearnerId) ? caller.activeLearnerId : null;
  return { learners, activeLearnerId: active, guardians, grades, max: MAX_LEARNERS };
}

async function ensureFamily(caller: Caller): Promise<string> {
  if (caller.familyId) return caller.familyId;
  const familyId = crypto.randomUUID();
  await DB().batch([
    DB().prepare(`insert into families (id) values (?)`).bind(familyId),
    DB().prepare(`update users set family_id = ? where id = ? and family_id is null`).bind(familyId, caller.id),
  ]);
  const row = await DB().prepare(`select family_id as familyId from users where id = ?`).bind(caller.id).first<{ familyId: string }>();
  caller.familyId = row!.familyId;
  return caller.familyId;
}

async function checkGrade(value: string | null): Promise<string | null> {
  if (!value) return null;
  const exists = await DB().prepare(`select 1 from grades where id = ?`).bind(value).first();
  if (!exists) throw new UserError("That grade no longer exists.");
  return value;
}

export const createLearnerInput = z.object({ name, gradeId }).strict();

export async function createLearner(caller: Caller, input: z.infer<typeof createLearnerInput>) {
  const familyId = await ensureFamily(caller);
  const grade = await checkGrade(input.gradeId);
  const learnerId = crypto.randomUUID();
  const result = await DB()
    .prepare(
      `insert into learners (id, family_id, name, grade_id)
       select ?, ?, ?, ? where (select count(*) from learners where family_id = ?) < ?`,
    )
    .bind(learnerId, familyId, input.name, grade, familyId, MAX_LEARNERS)
    .run();
  if (!result.meta.changes) throw new UserError(`A family can have up to ${MAX_LEARNERS} learners.`);
  return { id: learnerId };
}

export const updateLearnerInput = z.object({ id, name, gradeId }).strict();

export async function updateLearner(caller: Caller, input: z.infer<typeof updateLearnerInput>) {
  await requireLearner(caller, input.id);
  const grade = await checkGrade(input.gradeId);
  await DB()
    .prepare(`update learners set name = ?, grade_id = ? where id = ? and family_id = ?`)
    .bind(input.name, grade, input.id, caller.familyId)
    .run();
}

export const learnerIdInput = z.object({ id }).strict();

export async function deleteLearner(caller: Caller, { id: learnerId }: z.infer<typeof learnerIdInput>) {
  await requireLearner(caller, learnerId);
  await DB().batch([
    DB().prepare(`delete from attempts where learner_id = ?`).bind(learnerId),
    DB().prepare(`delete from schedule_slots where learner_id = ?`).bind(learnerId),
    DB().prepare(`update users set active_learner_id = null where active_learner_id = ?`).bind(learnerId),
    DB().prepare(`delete from learners where id = ? and family_id = ?`).bind(learnerId, caller.familyId),
  ]);
}

export async function setActiveLearner(caller: Caller, { id: learnerId }: z.infer<typeof learnerIdInput>) {
  await requireLearner(caller, learnerId);
  await DB().prepare(`update users set active_learner_id = ? where id = ?`).bind(learnerId, caller.id).run();
}

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

export async function createCode(caller: Caller) {
  const familyId = await ensureFamily(caller);
  const code = randomCode();
  const expiresAt = Date.now() + CODE_LIFETIME_MS;
  await DB()
    .prepare(`insert into family_codes (code, family_id, created_by, expires_at) values (?, ?, ?, ?)`)
    .bind(code, familyId, caller.id, expiresAt)
    .run();
  return { code, expiresAt };
}

export const redeemCodeInput = z
  .object({ code: z.string().trim().min(1, "Enter a code.").max(32) })
  .strict();

export async function redeemCode(caller: Caller, input: z.infer<typeof redeemCodeInput>) {
  const code = input.code.toUpperCase().replace(/\s+/g, "");
  const row = await DB()
    .prepare(`select family_id as familyId from family_codes where code = ?`)
    .bind(code)
    .first<{ familyId: string }>();
  if (row && row.familyId === caller.familyId) throw new UserError("You're already in this family.");
  if (caller.familyId) {
    const own = await DB()
      .prepare(
        `select (select count(*) from learners where family_id = ?) as learners,
                (select count(*) from users where family_id = ?) as guardians`,
      )
      .bind(caller.familyId, caller.familyId)
      .first<{ learners: number; guardians: number }>();
    if (own && own.learners > 0 && own.guardians <= 1) {
      throw new UserError("Delete your own learners before joining another family.");
    }
  }
  const claimed = await DB()
    .prepare(
      `update family_codes set used_at = ?, used_by = ?
       where code = ? and used_at is null and expires_at > ? returning family_id as familyId`,
    )
    .bind(Date.now(), caller.id, code, Date.now())
    .first<{ familyId: string }>();
  if (!claimed) throw new UserError("This code is wrong, used or expired.");
  await DB()
    .prepare(`update users set family_id = ?, active_learner_id = null where id = ?`)
    .bind(claimed.familyId, caller.id)
    .run();
}
