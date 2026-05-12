import type { TomaStatus } from "../types";

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function parseYMD(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function iso(d: Date): string {
  return d.toISOString();
}

export function jsDayToISOdow(jsDay: number): number {
  return ((jsDay + 6) % 7) + 1;
}

export function buildDedupeKey(scheduleId: string, plannedAtISO: string): string {
  return `${scheduleId}__${plannedAtISO}`;
}

export function buildWindow(
  plannedAt: Date,
  toleranceMinutes: number
): { windowStart: string; windowEnd: string } {
  return {
    windowStart: iso(new Date(plannedAt.getTime() - toleranceMinutes * 60000)),
    windowEnd: iso(new Date(plannedAt.getTime() + toleranceMinutes * 60000)),
  };
}

export function computeTomaStatus(
  now: string,
  windowStart: string,
  windowEnd: string,
  currentStatus: TomaStatus
): TomaStatus {
  if (currentStatus === "CONFIRMED") return "CONFIRMED";

  if (now >= windowStart && now <= windowEnd) return "DUE";
  if (now > windowEnd) return "EXPIRED";
  return "PLANNED";
}

export function shouldSendExpiryWarning(
  now: string,
  windowEnd: string,
  warningMinutes: number,
  alreadyNotified: boolean,
  currentStatus: TomaStatus
): boolean {
  if (alreadyNotified || currentStatus === "CONFIRMED") return false;

  const warnAt = new Date(new Date(windowEnd).getTime() - warningMinutes * 60000);
  return new Date(now) >= warnAt && new Date(now) < new Date(windowEnd);
}
