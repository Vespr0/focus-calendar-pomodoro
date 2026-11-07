import { PomodoroLogSession } from '../../types';
import { getTonalColor } from '../../utils';

export interface ProcessedActivity {
  displayTitle: string;
  totalHours: number;
  totalSeconds: number;
  activeDays: number;
  color: string;
}

export interface MonthlyStatsData {
  monthPrefix: string;
  monthName: string;
  grandTotalSeconds: number;
  grandTotalHours: number;
  activeDaysCount: number;
  activities: ProcessedActivity[];
}

/**
 * Aggregates and normalizes pomodoro log sessions for a given year/month.
 * Applies the monochromatic tonal color palette.
 */
export function aggregateMonthlyActivities(
  logs: PomodoroLogSession[],
  year: number,
  month: number
): MonthlyStatsData {
  const monthPrefix = `${year}-${(month + 1).toString().padStart(2, '0')}`;
  const monthName = new Date(year, month, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });

  const activityMap: Map<string, { displayTitle: string; totalSeconds: number; daysSet: Set<string> }> = new Map();
  let grandTotalSeconds = 0;
  const allDaysSet = new Set<string>();

  logs.forEach((log) => {
    if (log.type !== 'work' || !log.date || !log.date.startsWith(monthPrefix)) return;
    const rawTitle = (log.taskTitle || '').trim();
    let displayTitle = rawTitle || 'General Focus';
    const lower = displayTitle.toLowerCase();
    let normKey = lower;

    if (
      log.taskId === 'focus-drills' ||
      lower === 'drills' ||
      lower.startsWith('[drill]') ||
      lower.endsWith('drills') ||
      lower.includes('drill:')
    ) {
      displayTitle = 'Drills';
      normKey = 'drills';
    } else if (
      log.taskId === 'focus-flashcards' ||
      lower === 'flashcards' ||
      lower.startsWith('[flashcard]') ||
      lower.includes('flashcard')
    ) {
      displayTitle = 'Flashcards';
      normKey = 'flashcards';
    }

    const secs = log.durationSeconds || 0;
    if (secs <= 0) return;

    grandTotalSeconds += secs;
    allDaysSet.add(log.date);

    if (activityMap.has(normKey)) {
      const item = activityMap.get(normKey)!;
      item.totalSeconds += secs;
      item.daysSet.add(log.date);
    } else {
      const set = new Set<string>();
      set.add(log.date);
      activityMap.set(normKey, {
        displayTitle: displayTitle,
        totalSeconds: secs,
        daysSet: set
      });
    }
  });

  const grandTotalHours = grandTotalSeconds / 3600;
  const rawActivities = Array.from(activityMap.values())
    .map((act) => ({
      displayTitle: act.displayTitle,
      totalHours: act.totalSeconds / 3600,
      totalSeconds: act.totalSeconds,
      activeDays: act.daysSet.size
    }))
    .sort((a, b) => b.totalHours - a.totalHours);

  // Assign cohesive tonal palette (alternating lightness/saturation levels of the theme accent hue)
  const activities: ProcessedActivity[] = rawActivities.map((act, index) => ({
    ...act,
    color: getTonalColor(index, rawActivities.length)
  }));

  return {
    monthPrefix,
    monthName,
    grandTotalSeconds,
    grandTotalHours,
    activeDaysCount: allDaysSet.size,
    activities
  };
}

