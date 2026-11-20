// Pure rules: answer matching, stars and schedule overlaps.

/** Answers match ignoring case, surrounding space and repeated spaces. */
export function sameAnswer(given: string, expected: string): boolean {
  return normalize(given) === normalize(expected) && normalize(given) !== "";
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function scorePercent(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 100);
}

/** 3 stars at 90% or more, 2 at 70%, 1 at 50%. */
export function starsFor(percent: number): number {
  if (percent >= 90) return 3;
  if (percent >= 70) return 2;
  if (percent >= 50) return 1;
  return 0;
}

interface SlotTime {
  weekday: number;
  startMinute: number;
  minutes: number;
}

export function overlaps(a: SlotTime, b: SlotTime): boolean {
  return (
    a.weekday === b.weekday &&
    a.startMinute < b.startMinute + b.minutes &&
    b.startMinute < a.startMinute + a.minutes
  );
}

/** "16:05" as 965; null when it isn't a time of day. */
export function parseTime(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function formatTime(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
