import { createFileRoute } from "@tanstack/react-router";
import { changeFile, serveFile, textbookSlot } from "@/server/files";

// A subject's textbook PDF: members download it, admins replace or remove it.
export const Route = createFileRoute("/files/subjects/$subjectId/textbook")({
  server: {
    handlers: {
      GET: ({ request, params }) => serveFile(request, textbookSlot, params.subjectId),
      PUT: ({ request, params }) => changeFile(request, textbookSlot, params.subjectId),
      DELETE: ({ request, params }) => changeFile(request, textbookSlot, params.subjectId),
    },
  },
});
