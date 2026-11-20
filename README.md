# Home Study

A home-study app for families: admins build a library of lessons by grade and subject, children work through explanations, practice and quizzes, and guardians follow each child's progress and weekly plan.

Inspired by https://mujtahid.ly

Built with [oss.new](https://oss.new) for [EveryApp](https://github.com/every-app/every-app).

## Features

- Browse grades, subjects, units and lessons in order, and download each subject's textbook PDF; admins add, edit, reorder and delete them.
- Study a lesson's explanation and audio or video, answer practice questions checked on the spot, and take a quiz scored with 0 to 3 stars.
- Add up to 6 learners to your family, choose who is studying, and share them with another guardian through a one-time code.
- See each learner's study minutes, completed lessons, stars, average per subject, strongest and weakest subjects and recent quizzes.
- Plan each learner's week with study times by day, start, length and subject, without overlaps.

Left out: accounts and sign-in, which your Gateway handles; subscriptions and payments; a teacher course marketplace; placement tests; ready-made curriculum content; support tickets and notifications; installing to the home screen.

## Setup

- Install: `pnpm install`
- Run locally: `pnpm dev`
- Test: `pnpm test` for the unit tests; `checks/` holds the release checks.
- Deploy: `pnpm run deploy`. The app uses a D1 database and an R2 bucket (`files`) for textbooks and lesson media; R2 must be enabled on the Cloudflare account once.

There are no secrets or settings to fill in. Members who are admins of your organization in the Gateway can edit the library; every member can study and manage their own family's learners.

## Limitations

- The library starts empty: an admin adds the grades, subjects, lessons and questions.
- Uploaded files can be up to 50 MB each.
- Time spent counts from opening the lesson, or from retaking the quiz, until the quiz is submitted.
