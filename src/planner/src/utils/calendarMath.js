// src/utils/calendarMath.js

function parseISO(d) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDaysISO(iso, days) {
  const dt = parseISO(iso);
  dt.setDate(dt.getDate() + days);
  return toISO(dt);
}

export function diffDaysISO(a, b) {
  const A = parseISO(a);
  const B = parseISO(b);
  const ms = B.getTime() - A.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function isWorkingDayISO(iso, calendar) {
  const wp = calendar?.workingPattern || {
    mon: true,
    tue: true,
    wed: true,
    thu: true,
    fri: true,
    sat: false,
    sun: false
  };

  const dt = parseISO(iso);
  const dow = dt.getDay(); // 0=sön ... 6=lör

  const weekdayOk =
    (dow === 1 && wp.mon) ||
    (dow === 2 && wp.tue) ||
    (dow === 3 && wp.wed) ||
    (dow === 4 && wp.thu) ||
    (dow === 5 && wp.fri) ||
    (dow === 6 && wp.sat) ||
    (dow === 0 && wp.sun);

  if (!weekdayOk) return false;

  if (calendar?.nonWorkingDates?.includes(iso)) return false;

  for (const r of calendar?.vacationRanges || []) {
    if (!r?.start || !r?.end) continue;
    if (iso >= r.start && iso <= r.end) return false;
  }

  return true;
}

// Returnerar dagen EFTER sista arbetsdagen
export function addWorkdaysISO(startISO, workdays, calendar) {
  let d = startISO;
  let remaining = Math.max(1, Number(workdays || 1));

  if (!d) return d;

  while (true) {
    if (isWorkingDayISO(d, calendar)) {
      remaining -= 1;
      if (remaining <= 0) {
        return addDaysISO(d, 1);
      }
    }
    d = addDaysISO(d, 1);
  }
}
