import { getEveryAppUser } from "@every-app/sdk/server";
import { env } from "cloudflare:workers";
import { loadCaller } from "@/server/members";

// Textbooks (PDF) and lesson audio or video, kept in R2. Members read them;
// only admins upload or remove them.
const MAX_BYTES = 50 * 1024 * 1024;

interface FileSlot {
  /** Reads the row's key, name and type; null when the row doesn't exist. */
  read(rowId: string): Promise<{ key: string | null; name: string | null; type: string | null } | null>;
  write(rowId: string, file: { key: string | null; name: string | null; type: string | null }): Promise<void>;
  prefix: string;
  accepts(type: string): boolean;
  disposition: "attachment" | "inline";
}

function text(status: number, message: string): Response {
  return new Response(message, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}

function safeName(value: string | null, fallback: string): string {
  let decoded = fallback;
  try {
    decoded = value ? decodeURIComponent(value) : fallback;
  } catch {
    // A malformed name: keep the fallback.
  }
  const name = decoded.replace(/[\\/\r\n"]/g, "").trim();
  return name.slice(0, 120) || fallback;
}

export async function serveFile(request: Request, slot: FileSlot, rowId: string): Promise<Response> {
  const user = await getEveryAppUser(request, env);
  if (!user) return text(401, "Sign in through your Gateway.");
  await loadCaller(user);
  const row = await slot.read(rowId);
  if (!row?.key) return text(404, "No file.");
  const object = await env.files.get(row.key);
  if (!object) return text(404, "No file.");
  const name = row.name ?? "file";
  return new Response(object.body, {
    headers: {
      "content-type": row.type ?? "application/octet-stream",
      "content-length": String(object.size),
      "content-disposition": `${slot.disposition}; filename="${name.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "cache-control": "private, max-age=60",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function changeFile(request: Request, slot: FileSlot, rowId: string): Promise<Response> {
  const user = await getEveryAppUser(request, env);
  if (!user) return text(401, "Sign in through your Gateway.");
  const caller = await loadCaller(user);
  if (!caller.admin) return text(403, "Only admins can change the library.");
  const row = await slot.read(rowId);
  if (!row) return text(404, "Not found.");

  if (request.method === "DELETE") {
    await slot.write(rowId, { key: null, name: null, type: null });
    if (row.key) await env.files.delete(row.key);
    return Response.json({ ok: true });
  }

  const type = (request.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  if (!slot.accepts(type)) return text(415, "This file type isn't accepted here.");
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_BYTES) return text(413, "Files can be up to 50 MB.");
  const body = await request.arrayBuffer();
  if (body.byteLength === 0) return text(400, "The file is empty.");
  if (body.byteLength > MAX_BYTES) return text(413, "Files can be up to 50 MB.");
  const name = safeName(request.headers.get("x-file-name"), "file");
  const key = `${slot.prefix}/${rowId}/${crypto.randomUUID()}`;
  await env.files.put(key, body, { httpMetadata: { contentType: type } });
  await slot.write(rowId, { key, name, type });
  if (row.key) await env.files.delete(row.key);
  return Response.json({ ok: true, name });
}

export const textbookSlot: FileSlot = {
  prefix: "textbooks",
  disposition: "attachment",
  accepts: (type) => type === "application/pdf",
  read: (subjectId) =>
    env.DB.prepare(
      `select textbook_key as key, textbook_name as name, 'application/pdf' as type from subjects where id = ?`,
    )
      .bind(subjectId)
      .first(),
  write: async (subjectId, file) => {
    await env.DB.prepare(`update subjects set textbook_key = ?, textbook_name = ? where id = ?`)
      .bind(file.key, file.name, subjectId)
      .run();
  },
};

export const mediaSlot: FileSlot = {
  prefix: "lessons",
  disposition: "inline",
  accepts: (type) => type.startsWith("audio/") || type.startsWith("video/"),
  read: (lessonId) =>
    env.DB.prepare(
      `select media_key as key, media_name as name, media_type as type from lessons where id = ?`,
    )
      .bind(lessonId)
      .first(),
  write: async (lessonId, file) => {
    await env.DB.prepare(`update lessons set media_key = ?, media_name = ?, media_type = ? where id = ?`)
      .bind(file.key, file.name, file.type, lessonId)
      .run();
  },
};
