import { createFileRoute } from "@tanstack/react-router";
import { changeFile, mediaSlot, serveFile } from "@/server/files";

// A lesson's audio or video: members play it, admins replace or remove it.
export const Route = createFileRoute("/files/lessons/$lessonId/media")({
  server: {
    handlers: {
      GET: ({ request, params }) => serveFile(request, mediaSlot, params.lessonId),
      PUT: ({ request, params }) => changeFile(request, mediaSlot, params.lessonId),
      DELETE: ({ request, params }) => changeFile(request, mediaSlot, params.lessonId),
    },
  },
});
