// src/utils/calendarMath.ts

export function addDaysISO(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function weekdayKey(date: Date) {
  const d = date.getUTCDay();
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][d];
}

export function isWorkingDay(iso: string, cal: any) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const key = weekdayKey(dt);

  if (!cal.workingPattern?.[key]) return false;
  if (cal.nonWorkingDates?.includes(iso)) return false;
  if (cal.vacationRanges?.some((r: any) => iso >= r.start && iso <= r.end)) return false;

  return true;
}

// Returnerar dagen EFTER sista arbetsdagen (samma beteende som du hade)
export function addWorkdaysISO(startISO: string, workdays: number, cal: any) {
  let cur = startISO;
  let remaining = Math.max(1, Number(workdays || 1));

  while (!isWorkingDay(cur, cal)) {
    cur = addDaysISO(cur, 1);
  }

  remaining--;
  while (remaining > 0) {
    cur = addDaysISO(cur, 1);
    if (isWorkingDay(cur, cal)) remaining--;
  }

  return addDaysISO(cur, 1);
}