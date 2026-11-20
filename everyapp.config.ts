import { defineEveryApp } from "@every-app/sdk";

export default defineEveryApp({
  id: "home-study",
  name: "Home Study",
  description:
    "Lessons by grade and subject with practice, quizzes, progress reports and weekly study plans for each child.",
  resources: {
    d1: ["DB"],
    r2: ["files"],
  },
});
