import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`);

// The library, shared by every member. Only admins change it.
export const grades = sqliteTable("grades", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  position: integer("position").notNull(),
  createdAt: createdAt(),
});

export const subjects = sqliteTable(
  "subjects",
  {
    id: text("id").primaryKey(),
    gradeId: text("grade_id")
      .notNull()
      .references(() => grades.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    position: integer("position").notNull(),
    textbookKey: text("textbook_key"),
    textbookName: text("textbook_name"),
    createdAt: createdAt(),
  },
  (t) => [index("subjects_grade_idx").on(t.gradeId)],
);

export const units = sqliteTable(
  "units",
  {
    id: text("id").primaryKey(),
    subjectId: text("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    position: integer("position").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("units_subject_idx").on(t.subjectId)],
);

export const lessons = sqliteTable(
  "lessons",
  {
    id: text("id").primaryKey(),
    unitId: text("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    position: integer("position").notNull(),
    mediaKey: text("media_key"),
    mediaName: text("media_name"),
    mediaType: text("media_type"),
    createdAt: createdAt(),
  },
  (t) => [index("lessons_unit_idx").on(t.unitId)],
);

export const questions = sqliteTable(
  "questions",
  {
    id: text("id").primaryKey(),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    stage: text("stage", { enum: ["practice", "quiz"] }).notNull(),
    prompt: text("prompt").notNull(),
    // JSON array of strings; empty for a typed answer.
    choices: text("choices").notNull().default("[]"),
    answer: text("answer").notNull(),
    position: integer("position").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("questions_lesson_idx").on(t.lessonId)],
);

// Families: the guardians (users) who share a set of learners.
export const families = sqliteTable("families", {
  id: text("id").primaryKey(),
  createdAt: createdAt(),
});

// One row per Gateway user, keyed by user.id, created on first sight.
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  familyId: text("family_id").references(() => families.id, {
    onDelete: "set null",
  }),
  activeLearnerId: text("active_learner_id"),
  createdAt: createdAt(),
});

export const learners = sqliteTable(
  "learners",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    gradeId: text("grade_id").references(() => grades.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => [index("learners_family_idx").on(t.familyId)],
);

export const familyCodes = sqliteTable("family_codes", {
  code: text("code").primaryKey(),
  familyId: text("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  createdBy: text("created_by").notNull(),
  // Milliseconds since the epoch.
  expiresAt: integer("expires_at").notNull(),
  usedAt: integer("used_at"),
  usedBy: text("used_by"),
});

export const attempts = sqliteTable(
  "attempts",
  {
    id: text("id").primaryKey(),
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    scorePct: integer("score_pct").notNull(),
    stars: integer("stars").notNull(),
    seconds: integer("seconds").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("attempts_learner_idx").on(t.learnerId, t.createdAt),
    index("attempts_lesson_idx").on(t.lessonId),
  ],
);

export const scheduleSlots = sqliteTable(
  "schedule_slots",
  {
    id: text("id").primaryKey(),
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(),
    // Minutes after midnight.
    startMinute: integer("start_minute").notNull(),
    minutes: integer("minutes").notNull(),
    subjectId: text("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("slots_learner_idx").on(t.learnerId, t.weekday),
    uniqueIndex("slots_learner_start_idx").on(
      t.learnerId,
      t.weekday,
      t.startMinute,
    ),
  ],
);
