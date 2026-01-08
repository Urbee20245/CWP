import { differenceInDays, parseISO, isPast, isBefore, differenceInMilliseconds } from 'date-fns';

export type SlaStatus = 'on_track' | 'at_risk' | 'breached';

interface SlaMetrics {
  slaStatus: SlaStatus;
  daysRemaining: number;
  expectedProgress: number;
  totalActiveDays: number;
}

/**
 * Calculates the SLA status and metrics for a project.
 * @param progressPercent Current project completion percentage (0-100).
 * @param slaDays Total days allocated for the SLA.
 * @param slaStartDate The date the SLA officially started.
 * @param slaDueDate The calculated date the SLA is due.
 * @param slaPausedAt Timestamp when SLA was last paused.
 * @param slaResumeOffsetDays Total days paused previously.
 * @returns SlaMetrics object.
 */
export function calculateSlaMetrics(
  progressPercent: number,
  slaDays: number | null,
  slaStartDate: string | null,
  slaDueDate: string | null,
  slaPausedAt: string | null,
  slaResumeOffsetDays: number
): SlaMetrics {
  const now = new Date();
  
  // Default return if SLA is not configured
  if (!slaDays || !slaStartDate || !slaDueDate || slaDays <= 0) {
    return {
      slaStatus: 'on_track',
      daysRemaining: 0,
      expectedProgress: 0,
      totalActiveDays: 0,
    };
  }

  const start = parseISO(slaStartDate);
  const due = parseISO(slaDueDate);

  // 1. Calculate total active duration (excluding current pause)
  let totalPausedDays = slaResumeOffsetDays;
  
  // If currently paused, calculate the duration of the current pause
  if (slaPausedAt) {
      const pausedTime = parseISO(slaPausedAt);
      const currentPauseDurationMs = differenceInMilliseconds(now, pausedTime);
      totalPausedDays += Math.ceil(currentPauseDurationMs / (1000 * 60 * 60 * 24));
  }
  
  // Total duration of the project including pauses
  const totalCalendarDays = differenceInDays(due, start);
  
  // Total active working days elapsed since start
  const totalActiveDays = Math.max(0, differenceInDays(now, start) - totalPausedDays);
  
  // 2. Check for Breached Status
  if (isPast(due) && progressPercent < 100) {
    return {
      slaStatus: 'breached',
      daysRemaining: differenceInDays(due, now), // Will be negative
      expectedProgress: 100,
      totalActiveDays: totalActiveDays,
    };
  }
  
  // 3. Calculate expected progress based on active timeline
  let expectedProgress = 0;
  if (slaDays > 0) {
    expectedProgress = Math.min(100, (totalActiveDays / slaDays) * 100);
  }
  
  // 4. Determine Status
  let slaStatus: SlaStatus = 'on_track';
  
  if (progressPercent < expectedProgress - 10) { // 10% buffer for 'at_risk'
    slaStatus = 'at_risk';
  }
  
  if (progressPercent < expectedProgress - 25) { // Larger gap means higher risk
    slaStatus = 'at_risk';
  }
  
  if (isPast(due) && progressPercent < 100) {
      slaStatus = 'breached';
  }

  return {
    slaStatus,
    daysRemaining: differenceInDays(due, now),
    expectedProgress: Math.round(expectedProgress),
    totalActiveDays: totalActiveDays,
  };
}

/**
 * Calculates the SLA Due Date based on start date and duration.
 */
export function calculateSlaDueDate(startDate: string, slaDays: number): string {
    const start = parseISO(startDate);
    const dueDate = new Date(start.getTime() + slaDays * 24 * 60 * 60 * 1000);
    return dueDate.toISOString();
}

/**
 * Calculates the new SLA Due Date after a pause/resume cycle.
 * @param originalDueDate The original due date (before any offsets).
 * @param totalOffsetDays The total number of days the SLA has been paused.
 * @returns The new, adjusted due date string.
 */
export function adjustSlaDueDate(originalDueDate: string, totalOffsetDays: number): string {
    const originalDue = parseISO(originalDueDate);
    const newDueDate = new Date(originalDue.getTime() + totalOffsetDays * 24 * 60 * 60 * 1000);
    return newDueDate.toISOString();
}