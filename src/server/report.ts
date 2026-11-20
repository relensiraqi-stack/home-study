import { env } from "cloudflare:workers";
import type { Caller } from "@/server/members";
import { requireLearner } from "@/server/family";

const DB = () => env.DB;

export async function getReport(caller: Caller, learnerId: string) {
  const learner = await requireLearner(caller, learnerId);
  const [totals, stars, subjects, recent] = await DB().batch([
    DB()
      .prepare(
        `select coalesce(sum(seconds), 0) as seconds, count(distinct lesson_id) as lessons, count(*) as attempts
         from attempts where learner_id = ?`,
      )
      .bind(learnerId),
    // Each lesson counts its best result once.
    DB()
      .prepare(
        `select coalesce(sum(best), 0) as stars from
           (select max(stars) as best from attempts where learner_id = ? group by lesson_id)`,
      )
      .bind(learnerId),
    DB()
      .prepare(
        `select s.id, s.title, g.title as gradeTitle, round(avg(a.score_pct)) as average, count(*) as attempts
         from attempts a join lessons l on a.lesson_id = l.id join units u on l.unit_id = u.id
         join subjects s on u.subject_id = s.id join grades g on s.grade_id = g.id
         where a.learner_id = ? group by s.id order by average desc, s.title`,
      )
      .bind(learnerId),
    DB()
      .prepare(
        `select a.id, a.score_pct as scorePct, a.stars, a.seconds, a.created_at as createdAt,
           l.id as lessonId, l.title as lessonTitle, s.title as subjectTitle
         from attempts a join lessons l on a.lesson_id = l.id join units u on l.unit_id = u.id
         join subjects s on u.subject_id = s.id
         where a.learner_id = ? order by a.created_at desc, a.id desc limit 20`,
      )
      .bind(learnerId),
  ]);
  const total = totals!.results[0] as { seconds: number; lessons: number; attempts: number };
  const bySubject = subjects!.results as {
    id: string;
    title: string;
    gradeTitle: string;
    average: number;
    attempts: number;
  }[];
  return {
    learner,
    minutes: Math.ceil(total.seconds / 60),
    lessons: total.lessons,
    attempts: total.attempts,
    stars: (stars!.results[0] as { stars: number }).stars,
    subjects: bySubject,
    strongest: bySubject[0] ?? null,
    weakest: bySubject.length > 1 ? bySubject[bySubject.length - 1]! : null,
    recent: recent!.results as {
      id: string;
      scorePct: number;
      stars: number;
      seconds: number;
      createdAt: string;
      lessonId: string;
      lessonTitle: string;
      subjectTitle: string;
    }[],
  };
}
