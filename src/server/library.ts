import { env } from "cloudflare:workers";
import { z } from "zod";
import { notFound } from "@/server/errors";

// The library: grades > subjects > units > lessons, each kept in order by
// `position` within its parent. Table and column names below come only from
// this fixed map, never from input.
const LEVELS = {
  grade: { table: "grades", parent: null },
  subject: { table: "subjects", parent: "grade_id" },
  unit: { table: "units", parent: "subject_id" },
  lesson: { table: "lessons", parent: "unit_id" },
} as const;
type Level = keyof typeof LEVELS;

const title = z.string().trim().min(1, "Give it a title.").max(200);
const id = z.string().min(1).max(64);

export const createItemInput = z.discriminatedUnion("level", [
  z.object({ level: z.literal("grade"), title }).strict(),
  z.object({ level: z.literal("subject"), parentId: id, title }).strict(),
  z.object({ level: z.literal("unit"), parentId: id, title }).strict(),
  z
    .object({
      level: z.literal("lesson"),
      parentId: id,
      title,
      body: z.string().max(20000).default(""),
    })
    .strict(),
]);
export const updateItemInput = z
  .object({
    level: z.enum(["grade", "subject", "unit", "lesson"]),
    id,
    title,
    body: z.string().max(20000).optional(),
  })
  .strict();
export const moveItemInput = z
  .object({
    level: z.enum(["grade", "subject", "unit", "lesson"]),
    id,
    direction: z.enum(["up", "down"]),
  })
  .strict();
export const deleteItemInput = z
  .object({ level: z.enum(["grade", "subject", "unit", "lesson"]), id })
  .strict();

const DB = () => env.DB;

export async function createItem(
  input: z.infer<typeof createItemInput>,
): Promise<{ id: string }> {
  const { table, parent } = LEVELS[input.level];
  const newId = crypto.randomUUID();
  if (parent === null) {
    await DB()
      .prepare(
        `insert into ${table} (id, title, position)
         select ?, ?, coalesce(max(position), 0) + 1 from ${table}`,
      )
      .bind(newId, input.title)
      .run();
    return { id: newId };
  }
  const parentId = "parentId" in input ? input.parentId : "";
  const parentLevel = input.level === "subject" ? "grade" : input.level === "unit" ? "subject" : "unit";
  const exists = await DB()
    .prepare(`select 1 from ${LEVELS[parentLevel].table} where id = ?`)
    .bind(parentId)
    .first();
  if (!exists) notFound();
  if (input.level === "lesson") {
    await DB()
      .prepare(
        `insert into lessons (id, unit_id, title, body, position)
         select ?, ?, ?, ?, coalesce(max(position), 0) + 1 from lessons where unit_id = ?`,
      )
      .bind(newId, parentId, input.title, input.body, parentId)
      .run();
  } else {
    await DB()
      .prepare(
        `insert into ${table} (id, ${parent}, title, position)
         select ?, ?, ?, coalesce(max(position), 0) + 1 from ${table} where ${parent} = ?`,
      )
      .bind(newId, parentId, input.title, parentId)
      .run();
  }
  return { id: newId };
}

export async function updateItem(
  input: z.infer<typeof updateItemInput>,
): Promise<void> {
  const { table } = LEVELS[input.level];
  const result =
    input.level === "lesson" && input.body !== undefined
      ? await DB()
          .prepare(`update lessons set title = ?, body = ? where id = ?`)
          .bind(input.title, input.body, input.id)
          .run()
      : await DB()
          .prepare(`update ${table} set title = ? where id = ?`)
          .bind(input.title, input.id)
          .run();
  if (!result.meta.changes) notFound();
}

/** Swaps the item with its neighbour in the same parent. */
export async function moveItem(
  input: z.infer<typeof moveItemInput>,
): Promise<void> {
  const { table, parent } = LEVELS[input.level];
  const parentCol = parent ?? "''";
  const item = await DB()
    .prepare(`select position, ${parentCol} as parent from ${table} where id = ?`)
    .bind(input.id)
    .first<{ position: number; parent: string }>();
  if (!item) notFound();
  const up = input.direction === "up";
  const scope = parent ? `${parent} = ? and` : "? = '' and";
  const neighbour = await DB()
    .prepare(
      `select id, position from ${table}
       where ${scope} position ${up ? "<" : ">"} ?
       order by position ${up ? "desc" : "asc"} limit 1`,
    )
    .bind(item.parent, item.position)
    .first<{ id: string; position: number }>();
  if (!neighbour) return;
  await DB().batch([
    DB()
      .prepare(`update ${table} set position = ? where id = ?`)
      .bind(neighbour.position, input.id),
    DB()
      .prepare(`update ${table} set position = ? where id = ?`)
      .bind(item.position, neighbour.id),
  ]);
}

// Lesson ids and subject ids under an item, as SQL with one `?`.
const LESSONS_UNDER: Record<Level, string> = {
  grade: `select l.id from lessons l join units u on l.unit_id = u.id join subjects s on u.subject_id = s.id where s.grade_id = ?`,
  subject: `select l.id from lessons l join units u on l.unit_id = u.id where u.subject_id = ?`,
  unit: `select id from lessons where unit_id = ?`,
  lesson: `select id from lessons where id = ?`,
};

/** Deletes the item and everything under it in one batch; its files after. */
export async function deleteItem(
  input: z.infer<typeof deleteItemInput>,
): Promise<void> {
  const { level, id: itemId } = input;
  const { table } = LEVELS[level];
  const exists = await DB().prepare(`select 1 from ${table} where id = ?`).bind(itemId).first();
  if (!exists) notFound();
  const lessonIds = LESSONS_UNDER[level];
  const media = await DB()
    .prepare(`select media_key as key from lessons where media_key is not null and id in (${lessonIds})`)
    .bind(itemId)
    .all<{ key: string }>();
  const keys = media.results.map((row) => row.key);
  const statements: D1PreparedStatement[] = [
    DB().prepare(`delete from attempts where lesson_id in (${lessonIds})`).bind(itemId),
    DB().prepare(`delete from questions where lesson_id in (${lessonIds})`).bind(itemId),
    DB().prepare(`delete from lessons where id in (${lessonIds})`).bind(itemId),
  ];
  if (level === "grade" || level === "subject") {
    const subjectIds =
      level === "grade" ? `select id from subjects where grade_id = ?` : `select id from subjects where id = ?`;
    const books = await DB()
      .prepare(`select textbook_key as key from subjects where textbook_key is not null and id in (${subjectIds})`)
      .bind(itemId)
      .all<{ key: string }>();
    keys.push(...books.results.map((row) => row.key));
    statements.push(
      DB().prepare(`delete from schedule_slots where subject_id in (${subjectIds})`).bind(itemId),
      DB().prepare(`delete from units where subject_id in (${subjectIds})`).bind(itemId),
      DB().prepare(`delete from subjects where id in (${subjectIds})`).bind(itemId),
    );
  }
  if (level === "unit") {
    statements.push(DB().prepare(`delete from units where id = ?`).bind(itemId));
  }
  if (level === "grade") {
    statements.push(
      DB().prepare(`update learners set grade_id = null where grade_id = ?`).bind(itemId),
      DB().prepare(`delete from grades where id = ?`).bind(itemId),
    );
  }
  await DB().batch(statements);
  if (keys.length) await env.files.delete(keys);
}

interface GradeCard {
  id: string;
  title: string;
  subjects: number;
  lessons: number;
}

export async function listGrades(): Promise<GradeCard[]> {
  const { results } = await DB()
    .prepare(
      `select g.id, g.title,
         (select count(*) from subjects s where s.grade_id = g.id) as subjects,
         (select count(*) from lessons l join units u on l.unit_id = u.id
            join subjects s on u.subject_id = s.id where s.grade_id = g.id) as lessons
       from grades g order by g.position, g.id`,
    )
    .all<GradeCard>();
  return results;
}

export async function getGrade(gradeId: string) {
  const grade = await DB()
    .prepare(`select id, title from grades where id = ?`)
    .bind(gradeId)
    .first<{ id: string; title: string }>();
  if (!grade) notFound();
  const { results: subjects } = await DB()
    .prepare(
      `select s.id, s.title, s.textbook_key is not null as hasTextbook,
         (select count(*) from lessons l join units u on l.unit_id = u.id where u.subject_id = s.id) as lessons
       from subjects s where s.grade_id = ? order by s.position, s.id`,
    )
    .bind(gradeId)
    .all<{ id: string; title: string; hasTextbook: number; lessons: number }>();
  return {
    grade,
    subjects: subjects.map((s) => ({ ...s, hasTextbook: Boolean(s.hasTextbook) })),
  };
}

export async function getSubject(subjectId: string, learnerId: string | null) {
  const subject = await DB()
    .prepare(
      `select s.id, s.title, s.textbook_name as textbookName, g.id as gradeId, g.title as gradeTitle
       from subjects s join grades g on s.grade_id = g.id where s.id = ?`,
    )
    .bind(subjectId)
    .first<{ id: string; title: string; textbookName: string | null; gradeId: string; gradeTitle: string }>();
  if (!subject) notFound();
  const [unitRows, lessonRows, doneRows] = await DB().batch([
    DB().prepare(`select id, title from units where subject_id = ? order by position, id`).bind(subjectId),
    DB()
      .prepare(
        `select l.id, l.title, l.unit_id as unitId from lessons l join units u on l.unit_id = u.id
         where u.subject_id = ? order by l.position, l.id`,
      )
      .bind(subjectId),
    DB()
      .prepare(
        `select distinct a.lesson_id as id from attempts a join lessons l on a.lesson_id = l.id
         join units u on l.unit_id = u.id where u.subject_id = ? and a.learner_id = ?`,
      )
      .bind(subjectId, learnerId ?? ""),
  ]);
  const done = new Set((doneRows!.results as { id: string }[]).map((r) => r.id));
  const lessons = lessonRows!.results as { id: string; title: string; unitId: string }[];
  const units = (unitRows!.results as { id: string; title: string }[]).map((unit) => ({
    ...unit,
    lessons: lessons
      .filter((lesson) => lesson.unitId === unit.id)
      .map((lesson) => ({ id: lesson.id, title: lesson.title, done: done.has(lesson.id) })),
  }));
  return { subject, units };
}
