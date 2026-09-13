export function calculateTotalDays(startDate: Date, monthsSpan: number): number {
  let days = 0;
  const current = new Date(startDate);
  for (let m = 0; m < monthsSpan; m++) {
    days += new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
    current.setMonth(current.getMonth() + 1);
  }
  return days;
}

export function calculateEndDate(startDate: Date, monthsSpan: number): Date {
  const end = new Date(startDate);
  end.setMonth(end.getMonth() + monthsSpan);
  end.setDate(0);
  return end;
}

export function diffDays(dateStr: string, startDate: Date): number {
  const d = new Date(dateStr + 'T00:00:00');
  const s = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  return Math.round((d.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
}

export function dateToPercent(dateStr: string, startDate: Date, totalDays: number): number {
  return Math.max(0, Math.min(100, (diffDays(dateStr, startDate) / totalDays) * 100));
}

export function eventToPercent(dateStr: string, startDate: Date, totalDays: number): number {
  return Math.max(0, Math.min(100, ((diffDays(dateStr, startDate) + 0.5) / totalDays) * 100));
}

export function windowRangeToPercent(start: string, end: string, startDate: Date, totalDays: number) {
  const left = Math.max(0, Math.min(100, (diffDays(start, startDate) / totalDays) * 100));
  const right = Math.max(0, Math.min(100, ((diffDays(end, startDate) + 1) / totalDays) * 100));
  return { leftPct: left, widthPct: Math.max(1, right - left) };
}

export function formatShortDateRange(startStr: string, endStr: string): string {
  const s = new Date(startStr + 'T00:00:00');
  const e = new Date(endStr + 'T00:00:00');
  const sMonth = s.toLocaleDateString('en-US', { month: 'short' });
  const eMonth = e.toLocaleDateString('en-US', { month: 'short' });
  if (s.getFullYear() !== e.getFullYear()) {
    return `${sMonth} ${s.getDate()}, ${s.getFullYear()} – ${eMonth} ${e.getDate()}, ${e.getFullYear()}`;
  }
  if (sMonth === eMonth) return `${sMonth} ${s.getDate()}–${e.getDate()}`;
  return `${sMonth} ${s.getDate()} – ${eMonth} ${e.getDate()}`;
}

export function formatDateIso(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function percentToDate(pct: number, startDate: Date, totalDays: number): string {
  const dayOffset = Math.max(0, Math.min(totalDays - 1, Math.floor((pct / 100) * totalDays)));
  const d = new Date(startDate.getFullYear(), startDate.getMonth(), 1 + dayOffset);
  return formatDateIso(d);
}

export function pxToDate(px: number, startDate: Date, dayWidthPx: number): string {
  const dayOffset = Math.max(0, Math.floor(px / dayWidthPx));
  const d = new Date(startDate.getFullYear(), startDate.getMonth(), 1 + dayOffset);
  return formatDateIso(d);
}

export function dateToPx(dateStr: string, startDate: Date, dayWidthPx: number): number {
  return diffDays(dateStr, startDate) * dayWidthPx;
}

export function getVisibleYearMonths(startPx: number, endPx: number, startDate: Date, dayWidthPx: number): string[] {
  const startDayOffset = Math.max(0, Math.floor(startPx / dayWidthPx));
  const endDayOffset = Math.max(0, Math.ceil(endPx / dayWidthPx));

  const startD = new Date(startDate.getFullYear(), startDate.getMonth(), 1 + startDayOffset);
  const endD = new Date(startDate.getFullYear(), startDate.getMonth(), 1 + endDayOffset);

  const months: string[] = [];
  const cur = new Date(startD.getFullYear(), startD.getMonth(), 1);
  const end = new Date(endD.getFullYear(), endD.getMonth(), 1);

  while (cur <= end) {
    const y = cur.getFullYear();
    const m = (cur.getMonth() + 1).toString().padStart(2, '0');
    months.push(`${y}-${m}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

export interface TimelineHorizon {
  startDate: Date;
  monthsSpan: number;
  totalDays: number;
  rangeEndDate: Date;
}

export function determineHorizon(
  windows: { startDate: string; endDate: string }[] = [],
  entries: { date: string }[] = [],
  refDate: Date = new Date()
): TimelineHorizon {
  // Base range: 12 months before refDate, 36 months after refDate
  let startYear = refDate.getFullYear();
  let startMonth = refDate.getMonth() - 12; // 1 year prior

  let endYear = refDate.getFullYear();
  let endMonth = refDate.getMonth() + 36; // 3 years forward

  // Check windows to expand horizon if user has earlier/later dates
  for (const w of windows) {
    if (w.startDate) {
      const parts = w.startDate.split('-').map(Number);
      if (parts.length >= 2) {
        const wStartMonthIndex = (parts[0] * 12) + (parts[1] - 1);
        const currentStartMonthIndex = (startYear * 12) + startMonth;
        if (wStartMonthIndex < currentStartMonthIndex) {
          startYear = parts[0];
          startMonth = parts[1] - 2; // 1 month buffer
        }
      }
    }
    if (w.endDate) {
      const parts = w.endDate.split('-').map(Number);
      if (parts.length >= 2) {
        const wEndMonthIndex = (parts[0] * 12) + (parts[1] - 1);
        const currentEndMonthIndex = (endYear * 12) + endMonth;
        if (wEndMonthIndex > currentEndMonthIndex) {
          endYear = parts[0];
          endMonth = parts[1] + 2; // 2 months buffer
        }
      }
    }
  }

  // Check entries
  for (const e of entries) {
    if (e.date) {
      const parts = e.date.split('-').map(Number);
      if (parts.length >= 2) {
        const eMonthIndex = (parts[0] * 12) + (parts[1] - 1);
        const currentStartMonthIndex = (startYear * 12) + startMonth;
        if (eMonthIndex < currentStartMonthIndex) {
          startYear = parts[0];
          startMonth = parts[1] - 2;
        }
        const currentEndMonthIndex = (endYear * 12) + endMonth;
        if (eMonthIndex > currentEndMonthIndex) {
          endYear = parts[0];
          endMonth = parts[1] + 2;
        }
      }
    }
  }

  const startDate = new Date(startYear, startMonth, 1);
  const endTargetDate = new Date(endYear, endMonth, 1);

  // Calculate total months span
  let monthsSpan = (endTargetDate.getFullYear() - startDate.getFullYear()) * 12 + (endTargetDate.getMonth() - startDate.getMonth()) + 1;
  if (monthsSpan < 48) monthsSpan = 48; // minimum 4 years for continuous stability

  const totalDays = calculateTotalDays(startDate, monthsSpan);
  const rangeEndDate = calculateEndDate(startDate, monthsSpan);

  return { startDate, monthsSpan, totalDays, rangeEndDate };
}

