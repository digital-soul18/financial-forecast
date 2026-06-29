/**
 * NSW (Australia) public holiday calendar generator.
 *
 * Voice AI Solutions Pty Ltd is registered in NSW, so the AU calendar applies.
 * Fixed-date holidays are observed on the following Monday when they fall on a
 * weekend (NSW convention).
 *
 * Computed dates (Easter, King's Birthday, Bank Holiday, Labour Day) are
 * derived from algorithmic rules — no external data source needed.
 */

export interface PublicHoliday {
  /** ISO date string in YYYY-MM-DD form, in the observed date if substituted. */
  date: string;
  name: string;
  region: 'NSW';
}

// ── Date helpers ────────────────────────────────────────────────────────────

function iso(y: number, m: number, d: number): string {
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

function toIso(date: Date): string {
  return iso(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function dayOfWeek(y: number, m: number, d: number): number {
  // 0 = Sunday, 6 = Saturday
  return new Date(y, m - 1, d).getDay();
}

/** Monday-substitute a date if it falls on a weekend. */
function observedMondaySub(y: number, m: number, d: number): string {
  const dow = dayOfWeek(y, m, d);
  if (dow === 6) return iso(y, m, d + 2); // Sat → Mon
  if (dow === 0) return iso(y, m, d + 1); // Sun → Mon
  return iso(y, m, d);
}

/**
 * Anonymous Gregorian Computus — returns the Sunday of Easter in the given year.
 * Reliable for any year in the Gregorian calendar.
 */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/** Nth occurrence of a given weekday in a month — e.g. 2nd Monday of June. */
function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  // Find the first occurrence of `weekday` in the month
  const firstOfMonth = new Date(year, month - 1, 1);
  const firstDow = firstOfMonth.getDay();
  const offset = (weekday - firstDow + 7) % 7;
  const day = 1 + offset + (n - 1) * 7;
  return new Date(year, month - 1, day);
}

// ── NSW calendar for one year ───────────────────────────────────────────────

export function nswPublicHolidays(year: number): PublicHoliday[] {
  const easter = easterSunday(year);
  const goodFriday = new Date(easter); goodFriday.setDate(easter.getDate() - 2);
  const easterSat  = new Date(easter); easterSat.setDate(easter.getDate() - 1);
  const easterMon  = new Date(easter); easterMon.setDate(easter.getDate() + 1);
  const kingsBday  = nthWeekdayOfMonth(year, 6, 1, 2);  // 2nd Mon of June
  const bankHol    = nthWeekdayOfMonth(year, 8, 1, 1);  // 1st Mon of August (NSW)
  const labourDay  = nthWeekdayOfMonth(year, 10, 1, 1); // 1st Mon of October (NSW)

  return [
    { date: observedMondaySub(year, 1, 1),   name: "New Year's Day",   region: 'NSW' as const },
    { date: observedMondaySub(year, 1, 26),  name: 'Australia Day',    region: 'NSW' as const },
    { date: toIso(goodFriday),               name: 'Good Friday',      region: 'NSW' as const },
    { date: toIso(easterSat),                name: 'Easter Saturday',  region: 'NSW' as const },
    { date: toIso(easter),                   name: 'Easter Sunday',    region: 'NSW' as const },
    { date: toIso(easterMon),                name: 'Easter Monday',    region: 'NSW' as const },
    { date: observedMondaySub(year, 4, 25),  name: 'Anzac Day',        region: 'NSW' as const },
    { date: toIso(kingsBday),                name: "King's Birthday",  region: 'NSW' as const },
    { date: toIso(bankHol),                  name: 'Bank Holiday',     region: 'NSW' as const },
    { date: toIso(labourDay),                name: 'Labour Day',       region: 'NSW' as const },
    { date: observedMondaySub(year, 12, 25), name: 'Christmas Day',    region: 'NSW' as const },
    { date: observedMondaySub(year, 12, 26), name: 'Boxing Day',       region: 'NSW' as const },
  ].sort((a, b) => a.date.localeCompare(b.date));
}

/** Generate holidays for a range of years (inclusive). */
export function nswPublicHolidaysRange(startYear: number, endYear: number): PublicHoliday[] {
  const out: PublicHoliday[] = [];
  for (let y = startYear; y <= endYear; y++) out.push(...nswPublicHolidays(y));
  return out;
}

/** Build a fast lookup set keyed by 'YYYY-MM-DD'. */
export function publicHolidayDateSet(holidays: PublicHoliday[]): Set<string> {
  return new Set(holidays.map((h) => h.date));
}

/** Convenience: is a Date on an AU NSW public holiday? */
export function isAuPublicHoliday(date: Date, holidayDates: Set<string>): boolean {
  return holidayDates.has(toIso(date));
}
