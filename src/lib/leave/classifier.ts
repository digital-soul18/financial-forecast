/**
 * Reason → LeaveType classifier. Spec section 4.
 *
 * Order of precedence:
 *   1. Reason contains a Maternity keyword → MATERNITY
 *   2. Reason contains a Paternity keyword → PATERNITY
 *   3. The leave date itself is an AU NSW public holiday → PUBLIC_HOLIDAY
 *      (so even if reason says "sick", it's still a holiday — no balance hit)
 *   4. Reason contains a Sick keyword → SL
 *   5. Reason contains a Vacation keyword → VL
 *   6. Otherwise → null (needs admin review)
 */

import type { ClassificationResult, LeaveType } from './types';
import { isAuPublicHoliday } from './holidays';

const MATERNITY = /\b(maternity)\b/i;
const PATERNITY = /\b(paternity)\b/i;
const SICK      = /\b(sick|medical|ill(?:ness)?|doctor|hospital|fever|covid|migraine|injury)\b/i;
const VACATION  = /\b(vacation|personal|birthday|family|travel|wedding|funeral|bereavement|holiday|leave)\b/i;

export function classifyLeave(
  reason: string,
  leaveDate: Date,
  auHolidayDates: Set<string>,
): ClassificationResult {
  const r = reason.trim();

  if (MATERNITY.test(r)) {
    return { type: 'MATERNITY', reason: 'Reason mentions maternity', needsReview: false };
  }
  if (PATERNITY.test(r)) {
    return { type: 'PATERNITY', reason: 'Reason mentions paternity', needsReview: false };
  }
  if (isAuPublicHoliday(leaveDate, auHolidayDates)) {
    return {
      type: 'PUBLIC_HOLIDAY',
      reason: 'Date falls on an AU NSW public holiday',
      needsReview: false,
    };
  }
  if (SICK.test(r)) {
    return { type: 'SL', reason: 'Reason matches sick keywords', needsReview: false };
  }
  if (VACATION.test(r)) {
    return { type: 'VL', reason: 'Reason matches vacation keywords', needsReview: false };
  }

  return {
    type: null,
    reason: 'No keyword match — admin should classify manually',
    needsReview: true,
  };
}

/** Type-only labels for UI badges. */
export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  VL:             'Vacation',
  SL:             'Sick',
  MATERNITY:      'Maternity',
  PATERNITY:      'Paternity',
  PUBLIC_HOLIDAY: 'Public holiday',
  UNPAID:         'Unpaid',
};

/** Which pool, if any, this type draws down. */
export const LEAVE_TYPE_POOL: Record<LeaveType, 'VL' | 'SL' | null> = {
  VL:             'VL',
  SL:             'SL',
  MATERNITY:      null,
  PATERNITY:      null,
  PUBLIC_HOLIDAY: null,
  UNPAID:         null,
};

/** Whether this type is paid (relevant for payslip simulator). */
export const LEAVE_TYPE_PAID: Record<LeaveType, boolean> = {
  VL:             true,
  SL:             true,
  MATERNITY:      true,
  PATERNITY:      true,
  PUBLIC_HOLIDAY: true,
  UNPAID:         false,
};
