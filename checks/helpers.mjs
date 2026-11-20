// Shared steps for the suites. Selectors are the app's test IDs and field names.
import { expect } from "/home/user/oss-new/control/runtime/index.mjs";

/** Fills the open dialog's fields by name and saves it. */
export async function fillDialog(page, fields) {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  for (const [name, value] of Object.entries(fields)) {
    await dialog.locator(`[name="${name}"]`).fill(value);
  }
  await dialog.getByTestId("dialog-save").click();
}

export async function saveAndClose(page, fields) {
  await fillDialog(page, fields);
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

/** Picks an option in a Select by its test ID. */
export async function pick(page, testId, option) {
  await page.getByTestId(testId).click();
  await page.getByRole("option", { name: option }).first().click();
}

/** Records the POST server-function calls a page makes. */
export function recordCalls(page) {
  const calls = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/_serverFn/")) {
      calls.push(request);
    }
  });
  return calls;
}

/** Sends a recorded call again as another role, through the perimeter. */
export async function replay(runtime, request, role) {
  const sent = await request.allHeaders();
  const headers = {};
  for (const [key, value] of Object.entries(sent)) {
    if (/^(host|cookie|content-length|authorization|x-every|cf-)/i.test(key)) continue;
    if (key.startsWith(":")) continue;
    headers[key] = value;
  }
  const url = new URL(request.url());
  return runtime.fetch(url.pathname + url.search, {
    role,
    method: "POST",
    headers,
    body: request.postData() ?? undefined,
  });
}

/** Builds the library: a grade, a subject, a unit and a lesson. Returns ids. */
export async function buildLibrary(page, { grade, subject, unit, lesson, body }) {
  await page.goto("/");
  await page.getByTestId("add-grade").click();
  await saveAndClose(page, { title: grade });
  await page.getByTestId("grade-card").filter({ hasText: grade }).getByRole("link").first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(grade);
  await page.getByTestId("add-subject").click();
  await saveAndClose(page, { title: subject });
  await page.getByTestId("subject-card").filter({ hasText: subject }).getByRole("link").first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(subject);
  const subjectId = new URL(page.url()).pathname.split("/").pop();
  await page.getByTestId("add-unit").click();
  await saveAndClose(page, { title: unit });
  const unitBox = page.getByTestId("unit").filter({ hasText: unit });
  await unitBox.getByTestId("add-lesson").click();
  await saveAndClose(page, { title: lesson, body });
  await expect(unitBox.getByTestId("lesson-row").filter({ hasText: lesson })).toBeVisible();
  return { subjectId };
}

export const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);
