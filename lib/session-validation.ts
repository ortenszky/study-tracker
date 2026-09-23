export const MAX_SESSION_SECONDS = 16 * 60 * 60;

export function parseSessionTimes(startValue: unknown, endValue: unknown) {
  const startTime = typeof startValue === "string" ? new Date(startValue) : null;
  const endTime = typeof endValue === "string" ? new Date(endValue) : null;

  if (!startTime || !endTime || Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
    return { error: "Valid start and end times are required." } as const;
  }

  const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
  if (durationSeconds <= 0) return { error: "The end time must be after the start time." } as const;
  if (durationSeconds > MAX_SESSION_SECONDS) return { error: "A study session cannot be longer than 16 hours." } as const;
  if (endTime.getTime() > Date.now() + 5 * 60 * 1000) return { error: "A session cannot end in the future." } as const;

  return { startTime, endTime, durationSeconds } as const;
}
