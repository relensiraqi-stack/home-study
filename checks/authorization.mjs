// Authorization: private paths, admin-only authoring, family-only learners,
// and no sign-in of the app's own (X001).
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { buildLibrary, saveAndClose, recordCalls, replay, pick, PDF } from "./helpers.mjs";

const runtime = await startRuntime();
try {
  await runtime.assertPrivateAccess(["/", "/learners", "/health"]);

  // Files are private too.
  for (const role of [undefined, "outsider"]) {
    const res = await runtime.fetch("/files/subjects/x/textbook", { role });
    expect([401, 403, 302]).toContain(res.status);
  }

  // No sign-in page of the app's own.
  for (const path of ["/login", "/signin", "/signup", "/register", "/logout"]) {
    const res = await runtime.fetch(path, { role: "member" });
    expect(res.status).toBe(404);
    expect(await res.text()).not.toMatch(/type="password"/i);
  }

  const owner = await (await runtime.context("owner")).newPage();
  const calls = recordCalls(owner);
  const db = await runtime.database();

  calls.length = 0;
  const { subjectId } = await buildLibrary(owner, {
    grade: "Grade 4",
    subject: "Reading",
    unit: "Stories",
    lesson: "Finding the main idea",
    body: "The main idea is what the whole story is mostly about.",
  });
  const createGrade = calls[0];
  const lessonHref = await owner.getByTestId("lesson-row").getByRole("link").first().getAttribute("href");

  // Admin-only authoring: a member sees no authoring controls and is refused.
  const member = await (await runtime.context("member")).newPage();
  await member.goto("/");
  await expect(member.getByTestId("grade-card")).toHaveCount(1);
  await expect(member.getByTestId("add-grade")).toHaveCount(0);
  await expect(member.getByTestId("grade-card").getByTestId("delete")).toHaveCount(0);
  await member.goto(`/subjects/${subjectId}`);
  await expect(member.getByTestId("lesson-row")).toHaveCount(1);
  await expect(member.getByTestId("add-unit")).toHaveCount(0);
  await expect(member.getByTestId("textbook-upload")).toHaveCount(0);
  await member.goto(`${lessonHref}/edit`);
  await expect(member.getByTestId("forbidden")).toBeVisible();
  await expect(member.getByTestId("add-quiz")).toHaveCount(0);

  const before = (await db.prepare("select count(*) as n from grades").first()).n;
  await replay(runtime, createGrade, "member");
  expect((await db.prepare("select count(*) as n from grades").first()).n).toBe(before);
  await replay(runtime, createGrade, "owner");
  expect((await db.prepare("select count(*) as n from grades").first()).n).toBe(before + 1);

  const upload = (role) =>
    runtime.fetch(`/files/subjects/${subjectId}/textbook`, {
      role, method: "PUT",
      headers: { "content-type": "application/pdf", "x-file-name": "reading.pdf" },
      body: PDF,
    });
  expect((await upload("member")).status).toBe(403);
  expect((await runtime.fetch(`/files/subjects/${subjectId}/textbook`, { role: "member" })).status).toBe(404);
  expect((await upload("owner")).status).toBe(200);
  expect((await runtime.fetch(`/files/subjects/${subjectId}/textbook`, { role: "member" })).status).toBe(200);
  const lessonId = lessonHref.split("/").pop();
  const mediaPut = (role) =>
    runtime.fetch(`/files/lessons/${lessonId}/media`, {
      role, method: "PUT",
      headers: { "content-type": "video/mp4", "x-file-name": "clip.mp4" },
      body: Buffer.from("not really a video"),
    });
  expect((await mediaPut("member")).status).toBe(403);
  expect((await runtime.fetch(`/files/subjects/${subjectId}/textbook`, { role: "member", method: "DELETE" })).status).toBe(403);

  // Learners belong to a family: the owner's learner is invisible to the member.
  await owner.goto("/learners");
  await owner.getByTestId("add-learner").click();
  await owner.getByRole("dialog").locator('[name="name"]').fill("Lina");
  await pick(owner, "learner-grade", "Grade 4");
  await owner.getByRole("dialog").getByTestId("dialog-save").click();
  await expect(owner.getByTestId("learner-card")).toHaveCount(1);
  const card = owner.getByTestId("learner-card");
  const linaId = (await card.getByTestId("report-link").getAttribute("href")).split("/").pop();

  calls.length = 0;
  await card.getByTestId("edit").click();
  await saveAndClose(owner, { name: "Lina H." });
  const updateLearner = calls.at(-1);
  await owner.goto(`/learners/${linaId}/schedule`);
  calls.length = 0;
  await owner.getByTestId("add-slot").click();
  await owner.getByRole("dialog").getByTestId("weekday-2").click();
  await owner.getByRole("dialog").locator('[name="start"]').fill("15:00");
  await owner.getByRole("dialog").locator('[name="minutes"]').fill("30");
  await pick(owner, "slot-subject", /Reading/);
  await owner.getByRole("dialog").getByTestId("dialog-save").click();
  await expect(owner.getByTestId("slot")).toHaveCount(1);
  const addSlot = calls.at(-1);
  calls.length = 0;
  await owner.getByTestId("remove-slot").click();
  await expect(owner.getByTestId("slot")).toHaveCount(0);
  const removeSlot = calls.at(-1);
  await owner.getByTestId("add-slot").click();
  await owner.getByRole("dialog").getByTestId("weekday-2").click();
  await owner.getByRole("dialog").locator('[name="start"]').fill("18:00");
  await owner.getByRole("dialog").locator('[name="minutes"]').fill("30");
  await pick(owner, "slot-subject", /Reading/);
  await owner.getByRole("dialog").getByTestId("dialog-save").click();
  await expect(owner.getByTestId("slot")).toHaveCount(1);

  await member.goto("/learners");
  await expect(member.getByTestId("learner-card")).toHaveCount(0);
  await member.goto(`/learners/${linaId}`);
  await expect(member.getByTestId("not-found")).toBeVisible();
  await expect(member.getByText("Lina")).toHaveCount(0);
  await member.goto(`/learners/${linaId}/schedule`);
  await expect(member.getByTestId("not-found")).toBeVisible();
  await expect(member.getByTestId("slot")).toHaveCount(0);

  // Replayed as the member, the owner's changes do nothing.
  await replay(runtime, updateLearner, "member");
  await replay(runtime, addSlot, "member");
  const slotsBefore = (await db.prepare("select count(*) as n from schedule_slots").first()).n;
  expect(slotsBefore).toBe(1);
  const live = await db.prepare("select id from schedule_slots").first();
  const removeBody = removeSlot.postData().replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/, live.id);
  await replay(runtime, { ...removeSlot, url: () => removeSlot.url(), allHeaders: () => removeSlot.allHeaders(), postData: () => removeBody }, "member");
  expect((await db.prepare("select count(*) as n from schedule_slots").first()).n).toBe(1);
  await db.prepare("update learners set name = 'Lina' where id = ?").bind(linaId).run();
  await replay(runtime, updateLearner, "member");
  expect((await db.prepare("select name from learners where id = ?").bind(linaId).first()).name).toBe("Lina");

  // Invite codes: an expired one is refused; a fresh one is single-use.
  const family = (await db.prepare("select family_id from learners where id = ?").bind(linaId).first()).family_id;
  await db.prepare("insert into family_codes (code, family_id, created_by, expires_at) values ('OLDCODE1', ?, 'someone', ?)").bind(family, Date.now() - 1000).run();
  await member.goto("/learners");
  await member.locator('[name="code"]').fill("OLDCODE1");
  await member.getByTestId("join-submit").click();
  await expect(member.getByTestId("join-error")).toBeVisible();
  await expect(member.getByTestId("learner-card")).toHaveCount(0);

  await owner.goto("/learners");
  await owner.getByTestId("create-code").click();
  const code = (await owner.getByTestId("invite-code").textContent()).trim();
  await member.locator('[name="code"]').fill(code);
  await member.getByTestId("join-submit").click();
  await expect(member.getByTestId("learner-card")).toHaveCount(1);
  const row = await db.prepare("select used_by, used_at from family_codes where code = ?").bind(code).first();
  expect(row.used_by).toBeTruthy();
  expect(row.used_at).toBeTruthy();
  await member.goto(`/learners/${linaId}`);
  await expect(member.getByTestId("empty-report")).toBeVisible();
} finally {
  await runtime.close();
}
