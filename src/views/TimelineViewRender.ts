import { App } from 'obsidian';
import { CalendarEntry, TimeWindow } from '../types';
import {
  diffDays,
  formatDateIso,
  formatShortDateRange,
  pxToDate,
  getVisibleYearMonths,
  determineHorizon
} from './timeline/TimelineUtils';
import { TimelineRuler } from './timeline/TimelineRuler';
import { TimelineFramesTrack } from './timeline/TimelineFramesTrack';
import { TimelineControls } from './timeline/TimelineControls';

export interface TimelineViewCallbacks {
  initialDayWidthPx?: number;
  initialScrollLeft?: number;
  onStateChange?: (zoom: number, scrollLeft: number) => void;
  onVisibleRangeChange?: (rangeStr: string) => void;
  onRequireMonth?: (yearMonth: string) => Promise<CalendarEntry[]>;
  onWindowClick: (window: TimeWindow) => void;
  onWindowCreate: () => void;
  onEntryClick: (entry: CalendarEntry) => void;
  onEntryUpdate: (entry: CalendarEntry) => Promise<void>;
}

export class TimelineViewRenderComponent {
  private startDate!: Date;
  private monthsSpan!: number;
  private totalDays!: number;
  private rangeEndDate!: Date;

  private dayWidthPx = 16;
  private canvasWidthPx = 2000;
  private scrollContainer!: HTMLElement;
  private canvas!: HTMLElement;
  private framesContainer!: HTMLElement;
  private ruler!: TimelineRuler;

  private scrollRafId: number | null = null;
  private loadedMonths: Set<string> = new Set();

  constructor(
    private app: App,
    private containerEl: HTMLElement,
    refDate: Date,
    private windows: TimeWindow[],
    private entries: CalendarEntry[],
    private callbacks: TimelineViewCallbacks
  ) {
    if (callbacks.initialDayWidthPx) {
      this.dayWidthPx = callbacks.initialDayWidthPx;
    }

    this.initHorizon(refDate);
    this.buildBase();
    this.renderContent();
    this.initScroll(callbacks.initialScrollLeft);
  }

  private initHorizon(refDate: Date) {
    const horizon = determineHorizon(this.windows, this.entries, refDate);
    this.startDate = horizon.startDate;
    this.monthsSpan = horizon.monthsSpan;
    this.totalDays = horizon.totalDays;
    this.rangeEndDate = horizon.rangeEndDate;
    this.canvasWidthPx = Math.max(1200, Math.round(this.totalDays * this.dayWidthPx));
  }

  public updateData(windows: TimeWindow[], entries: CalendarEntry[]) {
    this.windows = windows;
    this.entries = entries;

    // Check if horizon needs expansion
    const currentStartIso = formatDateIso(this.startDate);
    const currentEndIso = formatDateIso(this.rangeEndDate);
    const needsExpansion = windows.some(w => w.startDate < currentStartIso || w.endDate > currentEndIso) ||
                           entries.some(e => e.date < currentStartIso || e.date > currentEndIso);

    if (needsExpansion) {
      const savedScroll = this.scrollContainer.scrollLeft;
      const oldStartDate = new Date(this.startDate);
      this.initHorizon(new Date());
      this.canvasWidthPx = Math.max(1200, Math.round(this.totalDays * this.dayWidthPx));
      this.canvas.style.minWidth = `${this.canvasWidthPx}px`;
      this.ruler.init(this.startDate, this.monthsSpan, this.totalDays, this.rangeEndDate);

      // Compensate scroll if startDate shifted
      const dayShift = diffDays(formatDateIso(oldStartDate), this.startDate);
      if (dayShift !== 0) {
        this.scrollContainer.scrollLeft = savedScroll + (dayShift * this.dayWidthPx);
      }
    }

    // In-place update of frames track
    TimelineFramesTrack.render(
      this.framesContainer,
      this.canvas,
      this.windows,
      this.entries,
      this.startDate,
      this.rangeEndDate,
      this.totalDays,
      this.dayWidthPx,
      {
        onWindowClick: this.callbacks.onWindowClick,
        onEntryClick: this.callbacks.onEntryClick,
        onEntryUpdate: (entry) => this.callbacks.onEntryUpdate(entry)
      }
    );

    this.ruler.updateVisibleDays(this.scrollContainer.scrollLeft, this.scrollContainer.clientWidth, this.dayWidthPx);
  }

  private buildBase() {
    this.containerEl.empty();
    this.containerEl.addClass('fcp-timeline-view-wrapper');

    // Controls bar with zoom buttons and today button
    TimelineControls.render(
      this.containerEl,
      () => this.callbacks.onWindowCreate(),
      () => this.zoomRelative(1.25),
      () => this.zoomRelative(0.80),
      () => this.scrollToToday(true)
    );

    this.scrollContainer = this.containerEl.createDiv('fcp-timeline-scroll-container');
    this.canvas = this.scrollContainer.createDiv('fcp-timeline-canvas');
    this.canvas.style.minWidth = `${this.canvasWidthPx}px`;

    // Ruler
    this.ruler = new TimelineRuler(this.canvas, this.startDate, this.monthsSpan, this.totalDays, this.rangeEndDate);

    // Frames track container
    this.framesContainer = this.canvas.createDiv('fcp-timeline-frames-container');

    // Scroll listener with RAF throttling
    this.scrollContainer.addEventListener('scroll', () => {
      if (this.scrollRafId !== null) cancelAnimationFrame(this.scrollRafId);
      this.scrollRafId = requestAnimationFrame(() => {
        this.onScrollUpdate();
      });
    }, { passive: true });

    // Wheel zoom
    TimelineControls.attachWheelZoom(
      this.scrollContainer,
      () => this.dayWidthPx,
      () => this.canvasWidthPx,
      (newWidth, ratio, mouseX) => {
        this.applyZoom(newWidth, ratio, mouseX);
      }
    );

    // Background drag-to-pan
    TimelineControls.attachPanGestures(this.scrollContainer);
  }

  private onScrollUpdate(): void {
    const scrollLeft = this.scrollContainer.scrollLeft;
    const clientWidth = this.scrollContainer.clientWidth;

    // 1. Update ruler visible days
    this.ruler.updateVisibleDays(scrollLeft, clientWidth, this.dayWidthPx);

    // 2. Update visible range indicator in header
    this.updateVisibleRangeHeader();

    // 3. Lazy-fetch visible month data
    if (this.callbacks.onRequireMonth) {
      const buffer = clientWidth * 1.5;
      const startPx = Math.max(0, scrollLeft - buffer);
      const endPx = scrollLeft + clientWidth + buffer;
      const visibleYMs = getVisibleYearMonths(startPx, endPx, this.startDate, this.dayWidthPx);

      for (const ym of visibleYMs) {
        if (!this.loadedMonths.has(ym)) {
          this.loadedMonths.add(ym);
          this.callbacks.onRequireMonth(ym).catch(err => {
            console.error(`Failed to lazy load month ${ym}:`, err);
          });
        }
      }
    }

    // 4. Report state change
    this.callbacks.onStateChange?.(this.dayWidthPx, scrollLeft);
  }

  private updateVisibleRangeHeader(): void {
    const scrollLeft = this.scrollContainer.scrollLeft;
    const clientWidth = this.scrollContainer.clientWidth;
    const startIso = pxToDate(scrollLeft, this.startDate, this.dayWidthPx);
    const endIso = pxToDate(scrollLeft + clientWidth, this.startDate, this.dayWidthPx);
    const rangeText = `TIMELINE (${formatShortDateRange(startIso, endIso).toUpperCase()})`;
    this.callbacks.onVisibleRangeChange?.(rangeText);
  }

  private applyZoom(newWidth: number, ratio: number, mouseX: number): void {
    this.dayWidthPx = newWidth;
    this.canvasWidthPx = Math.max(1200, Math.round(this.totalDays * this.dayWidthPx));
    this.canvas.style.minWidth = `${this.canvasWidthPx}px`;

    // Anchor the date under mouseX
    const newScrollLeft = Math.max(0, (ratio * this.canvasWidthPx) - mouseX);
    this.scrollContainer.scrollLeft = newScrollLeft;

    this.ruler.updateVisibleDays(newScrollLeft, this.scrollContainer.clientWidth, this.dayWidthPx);
    this.updateVisibleRangeHeader();
    this.callbacks.onStateChange?.(this.dayWidthPx, newScrollLeft);
  }

  private zoomRelative(factor: number): void {
    const currentWidth = this.dayWidthPx;
    const newWidth = Math.max(4, Math.min(80, Math.round(currentWidth * factor * 10) / 10));
    if (Math.abs(newWidth - currentWidth) < 0.1) return;

    const rect = this.scrollContainer.getBoundingClientRect();
    const mouseX = rect.width / 2; // zoom centered in viewport
    const contentX = this.scrollContainer.scrollLeft + mouseX;
    const ratio = contentX / this.canvasWidthPx;

    this.applyZoom(newWidth, ratio, mouseX);
  }

  public scrollToToday(smooth: boolean = true): void {
    const todayIso = formatDateIso(new Date());
    const todayDiff = diffDays(todayIso, this.startDate);
    const todayPx = todayDiff * this.dayWidthPx;
    const targetScroll = Math.max(0, todayPx - (this.scrollContainer.clientWidth / 2));
    
    this.scrollContainer.scrollTo({
      left: targetScroll,
      behavior: smooth ? 'smooth' : 'auto'
    });
  }

  public scrollToDate(dateIso: string, smooth: boolean = true): void {
    const diff = diffDays(dateIso, this.startDate);
    const targetPx = diff * this.dayWidthPx;
    const targetScroll = Math.max(0, targetPx - (this.scrollContainer.clientWidth / 2));

    this.scrollContainer.scrollTo({
      left: targetScroll,
      behavior: smooth ? 'smooth' : 'auto'
    });
  }

  private renderContent() {
    this.canvas.style.minWidth = `${this.canvasWidthPx}px`;

    TimelineFramesTrack.render(
      this.framesContainer,
      this.canvas,
      this.windows,
      this.entries,
      this.startDate,
      this.rangeEndDate,
      this.totalDays,
      this.dayWidthPx,
      {
        onWindowClick: this.callbacks.onWindowClick,
        onEntryClick: this.callbacks.onEntryClick,
        onEntryUpdate: (entry) => this.callbacks.onEntryUpdate(entry)
      }
    );

    // Initial visible days calculation
    const scrollLeft = this.scrollContainer?.scrollLeft ?? 0;
    const clientWidth = this.scrollContainer?.clientWidth ?? 1200;
    this.ruler.updateVisibleDays(scrollLeft, clientWidth, this.dayWidthPx);
  }

  private initScroll(initialScroll?: number) {
    if (initialScroll !== undefined && initialScroll >= 0) {
      this.scrollContainer.scrollLeft = initialScroll;
    } else {
      this.scrollToToday(false);
    }
    this.onScrollUpdate();
  }
}
