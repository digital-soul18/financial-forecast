/**
 * Shared classification + persistence helper for the two routes that create
 * leave requests: contractor self-service (/api/leave POST) and admin-added
 * (/api/contractors/[id]/leave POST).
 */

import { classifyLeave } from './classifier';
import { auHolidayDateSet } from './server';
import type { LeaveType } from './types';

export interface ClassifyInput {
  leaveDate: Date;
  reason: string;
  /** Optional explicit type from the form (admin override). */
  explicitType?: LeaveType | null;
  /** 1.0 default, 0.5 for half-day. */
  days?: number;
}

export interface ClassifiedFields {
  leaveType: LeaveType | null;
  classificationNote: string;
  days: number;
}

/**
 * Decide leaveType + classificationNote for a new request. If the form provides
 * an explicit type, honour it (and record that the type came from the form).
 * Otherwise auto-classify via reason + holiday calendar.
 */
export function classifyForCreate(input: ClassifyInput): ClassifiedFields {
  const days = input.days != null && input.days > 0 ? input.days : 1;

  if (input.explicitType) {
    return {
      leaveType: input.explicitType,
      classificationNote: 'Set explicitly on submission',
      days,
    };
  }

  const result = classifyLeave(input.reason, input.leaveDate, auHolidayDateSet());
  return {
    leaveType: result.type,
    classificationNote: result.reason,
    days,
  };
}
