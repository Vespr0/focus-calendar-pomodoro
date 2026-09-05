import { dateToPercent, formatDateIso } from './TimelineUtils';

export class TimelineRuler {
  public static render(
    canvas: HTMLElement,
    startDate: Date,
    monthsSpan: number,
    totalDays: number,
    rangeEndDate: Date,
    dayWidthPx: number = 14
  ): void {
    const showDays = dayWidthPx >= 18;
    this.renderHeader(canvas, startDate, monthsSpan, totalDays, showDays);
    this.renderGrid(canvas, startDate, monthsSpan, totalDays, showDays);
    this.renderTodayMarker(canvas, startDate, rangeEndDate, totalDays);
  }

  private static renderHeader(canvas: HTMLElement, startDate: Date, monthsSpan: number, totalDays: number, showDays: boolean): void {
    const headerEl = canvas.createDiv('fcp-timeline-header-ruler');
    const monthsRow = headerEl.createDiv('fcp-timeline-months-row');
    const cur = new Date(startDate);

    for (let m = 0; m < monthsSpan; m++) {
      const days = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate();
      const col = monthsRow.createDiv('fcp-timeline-month-col');
      col.style.width = `${(days / totalDays) * 100}%`;
      const name = cur.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();
      col.innerHTML = `<span class="fcp-ruler-month-label">${name}</span><span class="fcp-ruler-month-days">${days}d</span>`;
      cur.setMonth(cur.getMonth() + 1);
    }

    if (showDays) {
      const daysRow = headerEl.createDiv('fcp-timeline-days-row');
      const dCur = new Date(startDate);
      for (let m = 0; m < monthsSpan; m++) {
        const days = new Date(dCur.getFullYear(), dCur.getMonth() + 1, 0).getDate();
        for (let d = 1; d <= days; d++) {
          const cell = daysRow.createDiv('fcp-ruler-day-col');
          cell.style.width = `${(1 / totalDays) * 100}%`;
          cell.textContent = d.toString();
        }
        dCur.setMonth(dCur.getMonth() + 1);
      }
    }
  }

  private static renderGrid(canvas: HTMLElement, startDate: Date, monthsSpan: number, totalDays: number, showDays: boolean): void {
    const overlay = canvas.createDiv('fcp-timeline-grid-overlay');
    const cur = new Date(startDate);
    const monthEnds = new Set<number>();
    let acc = 0;
    for (let m = 0; m < monthsSpan; m++) {
      acc += new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate();
      monthEnds.add(acc);
      cur.setMonth(cur.getMonth() + 1);
    }

    if (!showDays) {
      monthEnds.forEach(d => {
        overlay.createDiv('fcp-timeline-grid-line').style.left = `${(d / totalDays) * 100}%`;
      });
      return;
    }

    for (let d = 1; d <= totalDays; d++) {
      const cls = monthEnds.has(d) ? 'fcp-timeline-grid-line is-month' : 'fcp-timeline-grid-line is-day';
      overlay.createDiv(cls).style.left = `${(d / totalDays) * 100}%`;
    }
  }

  private static renderTodayMarker(canvas: HTMLElement, startDate: Date, rangeEndDate: Date, totalDays: number): void {
    const todayIso = new Date().toISOString().substring(0, 10);
    if (todayIso >= formatDateIso(startDate) && todayIso <= formatDateIso(rangeEndDate)) {
      const marker = canvas.createDiv('fcp-timeline-today-marker');
      marker.style.left = `${dateToPercent(todayIso, startDate, totalDays)}%`;
      marker.createDiv('fcp-timeline-today-badge').textContent = 'TODAY';
    }
  }
}
