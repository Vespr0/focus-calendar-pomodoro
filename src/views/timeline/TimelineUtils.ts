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

