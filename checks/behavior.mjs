// Behavior: every frozen feature's main path (F001-F005).
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { buildLibrary, saveAndClose, pick, recordCalls, replay, PDF } from "./helpers.mjs";

const runtime = await startRuntime();
try {
  await runtime.assertPrivateAccess(["/", "/learners", "/health"]);

  const owner = await (await runtime.context("owner")).newPage();
  const calls = recordCalls(owner);

  // F001: an empty library guides the admin, then grades, subjects, units, lessons.
  await owner.goto("/");
  await runtime.assertBackLink(owner);
  await expect(owner.getByTestId("empty-library")).toBeVisible();
  await owner.getByTestId("add-grade").click();
  await saveAndClose(owner, { title: "Grade 6" });
  const { subjectId } = await buildLibrary(owner, {
    grade: "Grade 5",
    subject: "Mathematics",
    unit: "Fractions",
    lesson: "Adding fractions with the same denominator",
    body: "When the bottom numbers match, add the top numbers and keep the bottom one.",
  });

  // Reorder grades: Grade 5 was added last, move it up.
  await owner.goto("/");
  await expect(owner.getByTestId("grade-card")).toHaveText([/Grade 6/, /Grade 5/]);
  await owner.getByTestId("grade-card").filter({ hasText: "Grade 5" }).getByTestId("move-up").click();
  await expect(owner.getByTestId("grade-card")).toHaveText([/Grade 5/, /Grade 6/]);
  await expect(owner.getByTestId("grade-card").first()).toContainText("1 subject");

  // Edit and delete: rename Grade 6, then remove it.
  const six = owner.getByTestId("grade-card").filter({ hasText: "Grade 6" });
  await six.getByTestId("edit").click();
  await saveAndClose(owner, { title: "Grade 6 (draft)" });
  await expect(owner.getByTestId("grade-card").filter({ hasText: "Grade 6 (draft)" })).toBeVisible();
  await owner.getByTestId("grade-card").filter({ hasText: "Grade 6 (draft)" }).getByTestId("delete").click();
  await owner.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(owner.getByTestId("grade-card")).toHaveCount(1);

  // A second subject in Grade 5; subjects show their lesson counts.
  await owner.getByTestId("grade-card").getByRole("link").first().click();
  await owner.getByTestId("add-subject").click();
  await saveAndClose(owner, { title: "Science" });
  await expect(owner.getByTestId("subject-card").filter({ hasText: "Mathematics" })).toContainText("1 lesson");
  await expect(owner.getByTestId("subject-card").filter({ hasText: "Science" })).toContainText("0 lessons");

  // Textbook PDF: the admin uploads it, members download it.
  await owner.goto(`/subjects/${subjectId}`);
  await owner.getByTestId("textbook-upload").setInputFiles({
    name: "math-grade-5.pdf", mimeType: "application/pdf", buffer: PDF,
  });
  const download = owner.getByTestId("textbook-download");
  await expect(download).toBeVisible();
  const href = await download.getAttribute("href");
  expect(href).toBe(`/files/subjects/${subjectId}/textbook`);
  const pdf = await runtime.fetch(href, { role: "member" });
  expect(pdf.status).toBe(200);
  expect(pdf.headers.get("content-type")).toContain("application/pdf");
  expect(Buffer.from(await pdf.arrayBuffer()).equals(PDF)).toBe(true);

  // A second lesson, then reorder lessons within the unit.
  const unit = owner.getByTestId("unit").filter({ hasText: "Fractions" });
  await unit.getByTestId("add-lesson").click();
  await saveAndClose(owner, { title: "Comparing fractions", body: "Line fractions up on a number line." });
  await expect(unit.getByTestId("lesson-row")).toHaveText([/Adding fractions/, /Comparing fractions/]);
  await unit.getByTestId("lesson-row").filter({ hasText: "Comparing" }).getByTestId("move-up").click();
  await expect(unit.getByTestId("lesson-row")).toHaveText([/Comparing fractions/, /Adding fractions/]);

  // F002: the admin writes practice and quiz questions and adds audio.
  await unit.getByTestId("lesson-row").filter({ hasText: "Adding fractions" }).getByRole("link").first().click();
  const lessonUrl = new URL(owner.url()).pathname;
  await owner.getByTestId("edit-lesson").click();
  await expect(owner).toHaveURL(new RegExp(`${lessonUrl}/edit$`));
  await owner.getByTestId("add-practice").click();
  await saveAndClose(owner, { prompt: "What is 1/4 + 2/4?", choices: "3/4\n3/8\n1/2", answer: "3/4" });
  await owner.getByTestId("add-practice").click();
  await saveAndClose(owner, { prompt: "Write 1/5 + 1/5 as a fraction.", choices: "", answer: "2/5" });
  await owner.getByTestId("add-quiz").click();
  await saveAndClose(owner, { prompt: "What is 2/7 + 3/7?", choices: "5/7\n5/14\n6/7", answer: "5/7" });
  await owner.getByTestId("add-quiz").click();
  await saveAndClose(owner, { prompt: "Write 3/9 + 4/9 as a fraction.", choices: "", answer: "7/9" });
  await expect(owner.getByTestId("question-row")).toHaveCount(4);
  await owner.getByTestId("media-upload").setInputFiles({
    name: "explanation.mp3", mimeType: "audio/mpeg", buffer: Buffer.from("ID3 sample audio bytes"),
  });
  await expect(owner.getByTestId("media-name")).toContainText("explanation.mp3");
  const lessonId = lessonUrl.split("/").pop();
  const media = await runtime.fetch(`/files/lessons/${lessonId}/media`, { role: "member" });
  expect(media.status).toBe(200);
  expect(media.headers.get("content-type")).toContain("audio/mpeg");

  // F003: learner profiles. No learners yet, then two.
  await owner.goto("/learners");
  await runtime.assertBackLink(owner);
  await expect(owner.getByTestId("empty-learners")).toBeVisible();
  await owner.getByTestId("add-learner").click();
  await owner.getByRole("dialog").locator('[name="name"]').fill("Sara");
  await pick(owner, "learner-grade", "Grade 5");
  calls.length = 0;
  await owner.getByRole("dialog").getByTestId("dialog-save").click();
  await expect(owner.getByRole("dialog")).toHaveCount(0);
  const createLearnerCall = calls.at(-1);
  await owner.getByTestId("add-learner").click();
  await saveAndClose(owner, { name: "Omer" });
  await expect(owner.getByTestId("learner-card")).toHaveCount(2);
  await expect(owner.getByTestId("learner-card").filter({ hasText: "Sara" })).toContainText("Grade 5");

  // Edit a learner.
  await owner.getByTestId("learner-card").filter({ hasText: "Omer" }).getByTestId("edit").click();
  await saveAndClose(owner, { name: "Omar" });
  await expect(owner.getByTestId("learner-card").filter({ hasText: "Omar" })).toBeVisible();

  // At most 6 learners per family: four more fit, the seventh is refused.
  for (let i = 0; i < 5; i++) await replay(runtime, createLearnerCall, "owner");
  const db = await runtime.database();
  const { n } = await db.prepare("select count(*) as n from learners").first();
  expect(n).toBe(6);
  await owner.reload();
  await expect(owner.getByTestId("learner-card")).toHaveCount(6);
  await expect(owner.getByTestId("add-learner")).toBeDisabled();
  // Delete the extra copies.
  for (let i = 0; i < 4; i++) {
    await owner.getByTestId("learner-card").filter({ hasText: "Sara" }).last().getByTestId("delete").click();
    await owner.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(owner.getByTestId("learner-card")).toHaveCount(5 - i);
  }

  // Pick who is studying.
  const sara = owner.getByTestId("learner-card").filter({ hasText: "Sara" });
  await sara.getByTestId("study-as").click();
  await expect(sara.getByTestId("active-badge")).toBeVisible();
  const saraReport = await sara.getByTestId("report-link").getAttribute("href");
  const saraId = saraReport.split("/").pop();

  // F002: the lesson. Explanation, practice corrected at once, quiz graded on submit.
  await owner.goto(lessonUrl);
  await expect(owner.getByTestId("lesson-body")).toContainText("add the top numbers");
  await expect(owner.getByTestId("lesson-media")).toBeVisible();
  await expect(owner.getByTestId("studying")).toContainText("Sara");
  const p1 = owner.getByTestId("practice-question").nth(0);
  await p1.getByRole("button", { name: "3/8" }).click();
  await expect(p1.getByTestId("practice-feedback")).toContainText("3/4");
  await expect(p1.getByTestId("practice-feedback")).toContainText("Not quite");
  const p2 = owner.getByTestId("practice-question").nth(1);
  await p2.locator('[name="answer"]').fill("2/5");
  await p2.getByTestId("check").click();
  await expect(p2.getByTestId("practice-feedback")).toHaveText(/Correct/);

  const q1 = owner.getByTestId("quiz-question").nth(0);
  await q1.getByRole("button", { name: "5/7" }).click();
  const q2 = owner.getByTestId("quiz-question").nth(1);
  await q2.locator('[name="answer"]').fill("6/9");
  await owner.getByTestId("quiz-submit").click();
  await expect(owner.getByTestId("quiz-score")).toHaveText("50%");
  await expect(owner.getByTestId("quiz-stars")).toHaveAttribute("aria-label", "1 of 3 stars");
  await expect(q2.getByTestId("quiz-feedback")).toContainText("7/9");
  await owner.getByTestId("quiz-retry").click();
  await q1.getByRole("button", { name: "5/7" }).click();
  await q2.locator('[name="answer"]').fill("7/9");
  await owner.getByTestId("quiz-submit").click();
  await expect(owner.getByTestId("quiz-score")).toHaveText("100%");
  await expect(owner.getByTestId("quiz-stars")).toHaveAttribute("aria-label", "3 of 3 stars");
  const attempts = await db.prepare("select score_pct, stars, seconds from attempts where learner_id = ? order by created_at").bind(saraId).all();
  expect(attempts.results.map((a) => [a.score_pct, a.stars])).toEqual([[50, 1], [100, 3]]);
  expect(attempts.results.every((a) => a.seconds >= 0)).toBe(true);

  // The lesson now counts as completed for Sara.
  await owner.goto(`/subjects/${subjectId}`);
  await expect(owner.getByTestId("lesson-row").filter({ hasText: "Adding fractions" }).getByTestId("lesson-done")).toBeVisible();
  await expect(owner.getByTestId("lesson-row").filter({ hasText: "Comparing" }).getByTestId("lesson-done")).toHaveCount(0);

  // F005: weekly schedule; overlapping slots are refused.
  await owner.goto(`/learners/${saraId}/schedule`);
  await runtime.assertBackLink(owner);
  await expect(owner.getByTestId("week-grid")).toBeVisible();
  const addSlot = async (day, start, minutes, subject) => {
    await owner.getByTestId("add-slot").click();
    const dialog = owner.getByRole("dialog");
    await dialog.getByTestId(`weekday-${day}`).click();
    await dialog.locator('[name="start"]').fill(start);
    await dialog.locator('[name="minutes"]').fill(String(minutes));
    await pick(owner, "slot-subject", subject);
    await dialog.getByTestId("dialog-save").click();
  };
  await addSlot(1, "16:00", 45, /Mathematics/);
  await expect(owner.getByRole("dialog")).toHaveCount(0);
  await addSlot(1, "16:30", 30, /Science/);
  await expect(owner.getByRole("dialog").getByTestId("dialog-error")).toContainText("overlaps");
  await owner.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  await addSlot(1, "16:45", 30, /Science/);
  await expect(owner.getByRole("dialog")).toHaveCount(0);
  await addSlot(3, "17:00", 30, /Science/);
  await expect(owner.getByRole("dialog")).toHaveCount(0);
  await addSlot(6, "10:00", 60, /Mathematics/);
  await expect(owner.getByRole("dialog")).toHaveCount(0);
  const monday = owner.getByTestId("day-1");
  await expect(monday.getByTestId("slot")).toHaveText([/16:00.*45 min.*Mathematics/, /16:45.*30 min.*Science/]);
  await owner.getByTestId("day-6").getByTestId("slot").getByTestId("remove-slot").click();
  await expect(owner.getByTestId("day-6").getByTestId("slot")).toHaveCount(0);
  await expect(owner.getByTestId("slot")).toHaveCount(3);

  // F003: a co-guardian joins with a single-use code and sees the same learners.
  await owner.goto("/learners");
  await owner.getByTestId("create-code").click();
  const code = (await owner.getByTestId("invite-code").textContent()).trim();
  expect(code).toMatch(/^[A-Z0-9]{8}$/);
  const member = await (await runtime.context("member")).newPage();
  await member.goto("/learners");
  await expect(member.getByTestId("empty-learners")).toBeVisible();
  await member.locator('[name="code"]').fill(code);
  await member.getByTestId("join-submit").click();
  await expect(member.getByTestId("learner-card")).toHaveText([/Sara/, /Omar/]);
  await member.goto(`/learners/${saraId}`);
  await expect(member.getByTestId("stat-stars")).toContainText("3");
  // The code is spent.
  await member.goto("/learners");
  await member.locator('[name="code"]').fill(code);
  await member.getByTestId("join-submit").click();
  await expect(member.getByTestId("join-error")).toBeVisible();

  // F004: Omar has no attempts yet; the empty report points to the library.
  const omarHref = await owner.getByTestId("learner-card").filter({ hasText: "Omar" }).getByTestId("report-link").getAttribute("href");
  await owner.goto(omarHref);
  await expect(owner.getByTestId("empty-report")).toBeVisible();
  await expect(owner.getByTestId("empty-report").getByRole("link")).toHaveAttribute("href", "/");

  // F004: Sara's report. Add a science lesson attempt so subjects compare.
  await owner.goto(`/subjects/${subjectId}`);
  await owner.goto("/");
  await owner.getByTestId("grade-card").getByRole("link").first().click();
  await owner.getByTestId("subject-card").filter({ hasText: "Science" }).getByRole("link").first().click();
  await owner.getByTestId("add-unit").click();
  await saveAndClose(owner, { title: "Living things" });
  await owner.getByTestId("unit").getByTestId("add-lesson").click();
  await saveAndClose(owner, { title: "What plants need", body: "Plants need light, water and air to grow." });
  await owner.getByTestId("lesson-row").getByRole("link").first().click();
  await owner.getByTestId("edit-lesson").click();
  await owner.getByTestId("add-quiz").click();
  await saveAndClose(owner, { prompt: "Which part of a plant takes in water?", choices: "Roots\nPetals\nSeeds", answer: "Roots" });
  await owner.getByTestId("add-quiz").click();
  await saveAndClose(owner, { prompt: "What do leaves need to make food?", choices: "Light\nSand\nSalt", answer: "Light" });
  await owner.getByTestId("view-lesson").click();
  await owner.getByTestId("quiz-question").nth(0).getByRole("button", { name: "Roots" }).click();
  await owner.getByTestId("quiz-question").nth(1).getByRole("button", { name: "Salt" }).click();
  await owner.getByTestId("quiz-submit").click();
  await expect(owner.getByTestId("quiz-score")).toHaveText("50%");

  await owner.goto(`/learners/${saraId}`);
  await runtime.assertBackLink(owner);
  await expect(owner.getByRole("heading", { level: 1 })).toContainText("Sara");
  await expect(owner.getByTestId("stat-lessons")).toContainText("2");
  await expect(owner.getByTestId("stat-stars")).toContainText("4");
  await expect(owner.getByTestId("stat-minutes")).toBeVisible();
  await expect(owner.getByTestId("subject-row").filter({ hasText: "Mathematics" })).toContainText("75%");
  await expect(owner.getByTestId("subject-row").filter({ hasText: "Science" })).toContainText("50%");
  await expect(owner.getByTestId("strongest")).toContainText("Mathematics");
  await expect(owner.getByTestId("weakest")).toContainText("Science");
  await expect(owner.getByTestId("attempt-row")).toHaveCount(3);
  await expect(owner.getByTestId("attempt-row").first()).toContainText("What plants need");
  await runtime.screenshot(owner);

  // Phone-sized smoke.
  const phone = await (await runtime.context("member", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  await phone.goto("/");
  await expect(phone.getByTestId("grade-card")).toHaveCount(1);
  await expect(phone.getByTestId("grade-card")).toBeInViewport();
  await phone.goto("/learners");
  await expect(phone.getByTestId("learner-card").first()).toBeInViewport();
  const width = await phone.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(390);
} finally {
  await runtime.close();
}
