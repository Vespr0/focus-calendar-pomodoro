import { dateToPercent, formatDateIso } from './TimelineUtils';

export class TimelineRuler {
  private headerEl!: HTMLElement;
  private monthsRow!: HTMLElement;
  private daysRow!: HTMLElement;
  private overlay!: HTMLElement;
  private monthGridContainer!: HTMLElement;
  private dayGridContainer!: HTMLElement;
  private todayMarker: HTMLElement | null = null;

  private startDate!: Date;
  private monthsSpan!: number;
  private totalDays!: number;
  private rangeEndDate!: Date;
  private monthBoundaryOffsets: Set<number> = new Set();
  private lastRenderedDayKey: string = '';

  constructor(
    private canvas: HTMLElement,
    startDate: Date,
    monthsSpan: number,
    totalDays: number,
    rangeEndDate: Date
  ) {
    this.init(startDate, monthsSpan, totalDays, rangeEndDate);
  }

  public init(
    startDate: Date,
    monthsSpan: number,
    totalDays: number,
    rangeEndDate: Date
  ): void {
    this.startDate = startDate;
    this.monthsSpan = monthsSpan;
    this.totalDays = totalDays;
    this.rangeEndDate = rangeEndDate;
    this.lastRenderedDayKey = '';

    this.buildStaticElements();
  }

  private buildStaticElements(): void {
    // Remove previous ruler elements if any
    this.canvas.querySelectorAll('.fcp-timeline-header-ruler, .fcp-timeline-grid-overlay, .fcp-timeline-today-marker').forEach(el => el.remove());

    // 1. Header ruler
    this.headerEl = this.canvas.createDiv('fcp-timeline-header-ruler');
    this.monthsRow = this.headerEl.createDiv('fcp-timeline-months-row');
    this.daysRow = this.headerEl.createDiv('fcp-timeline-days-row');

    // 2. Grid overlay
    this.overlay = this.canvas.createDiv('fcp-timeline-grid-overlay');
    this.monthGridContainer = this.overlay.createDiv('fcp-month-grid-container');
    this.dayGridContainer = this.overlay.createDiv('fcp-day-grid-container');

    // 3. Render months row & month grid lines
    const cur = new Date(this.startDate);
    this.monthBoundaryOffsets.clear();
    let accDays = 0;

    for (let m = 0; m < this.monthsSpan; m++) {
      const days = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate();
      
      const col = this.monthsRow.createDiv('fcp-timeline-month-col');
      col.style.width = `${(days / this.totalDays) * 100}%`;
      const name = cur.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();
      col.innerHTML = `<span class="fcp-ruler-month-label">${name}</span><span class="fcp-ruler-month-days">${days}d</span>`;

      accDays += days;
      this.monthBoundaryOffsets.add(accDays);

      // Month separator grid line
      const monthLine = this.monthGridContainer.createDiv('fcp-timeline-grid-line is-month');
      monthLine.style.left = `${(accDays / this.totalDays) * 100}%`;

      cur.setMonth(cur.getMonth() + 1);
    }

    // 4. Today Marker
    this.renderTodayMarker();
  }

  private renderTodayMarker(): void {
    const todayIso = new Date().toISOString().substring(0, 10);
    const startIso = formatDateIso(this.startDate);
    const endIso = formatDateIso(this.rangeEndDate);

    if (todayIso >= startIso && todayIso <= endIso) {
      const pct = dateToPercent(todayIso, this.startDate, this.totalDays);
      this.todayMarker = this.canvas.createDiv('fcp-timeline-today-marker');
      this.todayMarker.style.left = `${pct}%`;
      this.todayMarker.createDiv('fcp-timeline-today-badge').textContent = 'TODAY';
    }
  }

  public updateVisibleDays(scrollLeft: number, clientWidth: number, dayWidthPx: number): void {
    const showDays = dayWidthPx >= 18;

    if (!showDays) {
      if (this.lastRenderedDayKey !== 'hidden') {
        this.daysRow.empty();
        this.daysRow.style.display = 'none';
        this.dayGridContainer.empty();
        this.lastRenderedDayKey = 'hidden';
      }
      return;
    }

    this.daysRow.style.display = 'block';

    // Calculate visible range with buffer
    const bufferPx = Math.max(300, clientWidth * 0.5);
    const startPx = Math.max(0, scrollLeft - bufferPx);
    const endPx = scrollLeft + clientWidth + bufferPx;

    const startDay = Math.max(0, Math.floor(startPx / dayWidthPx));
    const endDay = Math.min(this.totalDays, Math.ceil(endPx / dayWidthPx));

    const key = `${startDay}_${endDay}_${dayWidthPx >= 28 ? 'large' : 'small'}`;
    if (key === this.lastRenderedDayKey) {
      return; // Already rendered this window
    }
    this.lastRenderedDayKey = key;

    this.daysRow.empty();
    this.dayGridContainer.empty();

    const daysFragment = document.createDocumentFragment();
    const gridFragment = document.createDocumentFragment();

    for (let d = startDay; d < endDay; d++) {
      const dDate = new Date(this.startDate.getFullYear(), this.startDate.getMonth(), 1 + d);
      const dayNum = dDate.getDate();

      const cell = document.createElement('div');
      cell.className = 'fcp-ruler-day-col';
      cell.style.left = `${(d / this.totalDays) * 100}%`;
      cell.style.width = `${(1 / this.totalDays) * 100}%`;
      cell.textContent = dayNum.toString();
      daysFragment.appendChild(cell);

      // Grid line at end of day (skip if it coincides with month end line)
      if (!this.monthBoundaryOffsets.has(d + 1)) {
        const line = document.createElement('div');
        line.className = 'fcp-timeline-grid-line is-day';
        line.style.left = `${((d + 1) / this.totalDays) * 100}%`;
        gridFragment.appendChild(line);
      }
    }

    this.daysRow.appendChild(daysFragment);
    this.dayGridContainer.appendChild(gridFragment);
  }
}
