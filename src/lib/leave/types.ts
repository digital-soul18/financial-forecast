/**
 * Types for the leave balance engine. Kept separate from the DB models so the
 * engine stays a pure-function library — drop a contractor + their leave history
 * + the as-of date in, get balances out. No I/O.
 */

export type LeaveType =
  | 'VL'              // vacation / personal — accrued bucket
  | 'SL'              // sick — accrued bucket
  | 'MATERNITY'       // separate bucket (out of scope for v1)
  | 'PATERNITY'       // separate bucket (out of scope for v1)
  | 'PUBLIC_HOLIDAY'  // AU NSW public holiday — paid, no deduction from any pool
  | 'UNPAID';         // explicit unpaid leave (pre-regularisation, or overflow)

export interface LeavePolicy {
  /** First day of employment. */
  startDate: Date;
  /** Months until regularisation. 6 for PH (Steph), 3 for IN (Taresh). */
  probationMonths: number;
  /**
   * Whether accrued credits can be drawn down during probation.
   * Steph: false (contract Section 4.2 — "can be used upon regularisation").
   * Taresh: true (contract silent on this; accrual usable from day one).
   */
  accrualUsableDuringProbation: boolean;
  /** Days accrued per completed month. Default 10/12 ≈ 0.83. */
  vlAccrualPerMonth: number;
  /** Default 5/12 ≈ 0.42. */
  slAccrualPerMonth: number;
}

export interface LeaveEvent {
  /** The day the leave is taken. */
  date: Date;
  /** Classified type. Drives which pool (if any) gets deducted. */
  type: LeaveType;
  /** 1.0 typical, 0.5 half-day. */
  days: number;
}

export interface ForfeitureEvent {
  /** The anniversary at which the forfeit was applied. */
  anniversaryDate: Date;
  vlForfeited: number;
  slForfeited: number;
}

export interface PoolBalance {
  /** Lifetime days accrued from start_date to as_of, before forfeitures. */
  accrued: number;
  /** Sum of approved-and-taken days against this pool, up to as_of. */
  used: number;
  /** Sum of past forfeiture events. */
  forfeited: number;
  /** accrued − used − forfeited, gated by usability rules. */
  available: number;
}

export interface LeaveBalance {
  asOf: Date;
  /** Completed months of service as_of date. */
  completedMonths: number;
  regularisationDate: Date;
  /** The next anniversary at or after as_of. */
  nextAnniversaryDate: Date;
  /** Months from as_of to the next anniversary. */
  monthsUntilNextAnniversary: number;
  /** True if as_of < regularisationDate AND accrualUsableDuringProbation === false. */
  isLockedByProbation: boolean;
  vl: PoolBalance;
  sl: PoolBalance;
}

export interface ClassificationResult {
  type: LeaveType | null;
  /** Why we picked it — useful for showing to admin / for audit. */
  reason: string;
  /** True when we couldn't classify and want admin attention. */
  needsReview: boolean;
}
