// Persistence: library, files, learners, attempts and schedule survive a restart.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { buildLibrary, saveAndClose, pick, PDF } from "./helpers.mjs";

const runtime = await startRuntime();
try {
  let owner = await (await runtime.context("owner")).newPage();
  const { subjectId } = await buildLibrary(owner, {
    grade: "Grade 3",
    subject: "Geography",
    unit: "Maps",
    lesson: "Reading a compass",
    body: "North is at the top of most maps.",
  });
  await owner.getByTestId("textbook-upload").setInputFiles({ name: "maps.pdf", mimeType: "application/pdf", buffer: PDF });
  await expect(owner.getByTestId("textbook-download")).toBeVisible();
  await owner.getByTestId("lesson-row").getByRole("link").first().click();
  const lessonUrl = new URL(owner.url()).pathname;
  await owner.getByTestId("edit-lesson").click();
  await owner.getByTestId("add-quiz").click();
  await saveAndClose(owner, { prompt: "Where is north on most maps?", choices: "Top\nBottom\nLeft", answer: "Top" });

  await owner.goto("/learners");
  await owner.getByTestId("add-learner").click();
  await owner.getByRole("dialog").locator('[name="name"]').fill("Yusuf");
  await pick(owner, "learner-grade", "Grade 3");
  await owner.getByRole("dialog").getByTestId("dialog-save").click();
  const card = owner.getByTestId("learner-card").filter({ hasText: "Yusuf" });
  await card.getByTestId("study-as").click();
  await expect(card.getByTestId("active-badge")).toBeVisible();
  const learnerId = (await card.getByTestId("report-link").getAttribute("href")).split("/").pop();

  await owner.goto(lessonUrl);
  await owner.getByTestId("quiz-question").getByRole("button", { name: "Top" }).click();
  await owner.getByTestId("quiz-submit").click();
  await expect(owner.getByTestId("quiz-score")).toHaveText("100%");

  await owner.goto(`/learners/${learnerId}/schedule`);
  await owner.getByTestId("add-slot").click();
  await owner.getByRole("dialog").getByTestId("weekday-4").click();
  await owner.getByRole("dialog").locator('[name="start"]').fill("17:30");
  await owner.getByRole("dialog").locator('[name="minutes"]').fill("40");
  await pick(owner, "slot-subject", /Geography/);
  await owner.getByRole("dialog").getByTestId("dialog-save").click();
  await expect(owner.getByTestId("slot")).toHaveCount(1);

  await runtime.restart();

  owner = await (await runtime.context("owner")).newPage();
  await owner.goto("/");
  await expect(owner.getByTestId("grade-card").filter({ hasText: "Grade 3" })).toContainText("1 subject");
  await owner.goto(`/subjects/${subjectId}`);
  await expect(owner.getByTestId("lesson-row").filter({ hasText: "Reading a compass" }).getByTestId("lesson-done")).toBeVisible();
  const pdf = await runtime.fetch(`/files/subjects/${subjectId}/textbook`, { role: "member" });
  expect(pdf.status).toBe(200);
  expect(Buffer.from(await pdf.arrayBuffer()).equals(PDF)).toBe(true);
  await owner.goto(`/learners/${learnerId}`);
  await expect(owner.getByTestId("stat-stars")).toContainText("3");
  await expect(owner.getByTestId("attempt-row")).toHaveCount(1);
  await owner.goto(`/learners/${learnerId}/schedule`);
  await expect(owner.getByTestId("day-4").getByTestId("slot")).toContainText("17:30");
} finally {
  await runtime.close();
}
