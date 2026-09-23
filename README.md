# Study Tracker

A private study command center for completing the final 90 ECTS of the IU Data Science curriculum by July 2027. It combines a server-backed focus timer, editable session history, weekly goals, curriculum deadlines, ECTS progress, and corrected calendar analytics.

## Finish plan

- Semester 4 modules: September 2026–January 10, 2027
- Time Series, Neural Nets, and Elective A: January–March 2027
- Model Engineering, Elective B, and Data Protection: March–May 2027
- Elective C: June 2027
- Bachelor Thesis: February–July 15, 2027
- Retake/correction buffer: July 16–31, 2027

The plan is deliberately editable in the app. Mark modules active when you begin and finished when the assessment is complete.

## Local setup

1. Install dependencies with `npm ci`.
2. Copy the database environment variables into `.env` (`DATABASE_URL` and `DIRECT_URL`).
3. Generate the client with `npx prisma generate`.
4. Start the app with `npm run dev`.

## Existing database migration

This repository previously had no committed migration history. For the existing database, baseline the original schema once, then deploy the study-plan migration:

```text
npx prisma migrate resolve --applied 20260923000000_baseline
npx prisma migrate deploy
npm run db:seed
```

For a completely empty database, `npx prisma migrate deploy` applies both migrations before seeding.

The dashboard also offers a **Load my 90 ECTS plan** button, which is safe to use repeatedly because curriculum entries are upserted by a stable key.

## Quality checks

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

## Analytics notes

Sessions are split across calendar days and time-of-day buckets using the browser timezone. Course percentages share one all-time denominator, and heatmap weeks are aligned Sunday through Saturday. The former “burnout predictor” is now labelled as a workload trend because time alone cannot diagnose burnout.
