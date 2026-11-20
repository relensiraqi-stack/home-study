import { Link } from "@tanstack/react-router";

/** Who quiz results are saved for, with the way to change it. */
export function StudyingNote({ learner }: { learner: { name: string } | null }) {
  return (
    <span data-testid="studying">
      {learner ? (
        <>
          Studying: <span className="font-medium text-foreground">{learner.name}</span> ·{" "}
          <Link to="/learners" className="underline-offset-4 hover:underline">
            Change
          </Link>
        </>
      ) : (
        <>
          <Link to="/learners" className="text-primary underline-offset-4 hover:underline">
            Choose who is studying
          </Link>{" "}
          to save quiz results.
        </>
      )}
    </span>
  );
}
