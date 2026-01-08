import { differenceInDays, parseISO, isPast, isBefore } from 'date-fns';

export type SlaStatus = 'on_track' | 'at_risk' | 'breached';

interface SlaMetrics {
  slaStatus: SlaStatus;
  daysRemaining: number;
  expectedProgress: number;
}

/**
 * Calculates the SLA status and metrics for a project.
 * @param progressPercent Current project completion percentage (0-100).
 * @param slaDays Total days allocated for the SLA.
 * @param slaStartDate The date the SLA officially started.
 * @param slaDueDate The calculated date the SLA is due.
 * @returns SlaMetrics object.
 */
export function calculateSlaMetrics(
  progressPercent: number,
  slaDays: number | null,
  slaStartDate: string | null,
  slaDueDate: string | null
): SlaMetrics {
  const now = new Date();
  
  // Default return if SLA is not configured
  if (!slaDays || !slaStartDate || !slaDueDate || slaDays <= 0) {
    return {
      slaStatus: 'on_track',
      daysRemaining: 0,
      expectedProgress: 0,
    };
  }

  const start = parseISO(slaStartDate);
  const due = parseISO(slaDueDate);

  // 1. Check for Breached Status
  if (isPast(due) && progressPercent < 100) {
    return {
      slaStatus: 'breached',
      daysRemaining: differenceInDays(due, now), // Will be negative
      expectedProgress: 100,
    };
  }
  
  // 2. Calculate time elapsed and expected progress
  const totalDurationDays = differenceInDays(due, start);
  const elapsedDays = differenceInDays(now, start);
  
  // If elapsed time is negative (started in future), treat as 0 elapsed
  const actualElapsedDays = Math.max(0, elapsedDays);

  // Calculate expected progress based on linear timeline
  let expectedProgress = 0;
  if (totalDurationDays > 0) {
    expectedProgress = Math.min(100, (actualElapsedDays / totalDurationDays) * 100);
  }
  
  // 3. Determine Status
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