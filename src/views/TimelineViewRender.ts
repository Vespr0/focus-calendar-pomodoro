import { App } from 'obsidian';
import { CalendarEntry, TimeWindow } from '../types';
import { calculateTotalDays, calculateEndDate, diffDays, formatDateIso } from './timeline/TimelineUtils';
import { TimelineRuler } from './timeline/TimelineRuler';
import { TimelineFramesTrack } from './timeline/TimelineFramesTrack';
import { TimelineControls } from './timeline/TimelineControls';

export interface TimelineViewCallbacks {
  initialDayWidthPx?: number;
  initialScrollLeft?: number;
  onStateChange?: (zoom: number, scrollLeft: number) => void;
  onWindowClick: (window: TimeWindow) => void;
  onWindowCreate: () => void;
  onEntryClick: (entry: CalendarEntry) => void;
  onEntryUpdate: (entry: CalendarEntry) => Promise<void>;
}

export class TimelineViewRenderComponent {
  private startDate: Date;
  private monthsSpan = 9;
  private dayWidthPx = 16;
  private canvasWidthPx = 1400;
  private scrollContainer!: HTMLElement;
  private canvas!: HTMLElement;

  constructor(
    private app: App, private containerEl: HTMLElement,
    startDate: Date, private windows: TimeWindow[],
    private entries: CalendarEntry[], private callbacks: TimelineViewCallbacks
  ) {
    this.startDate = new Date(startDate.getFullYear(), startDate.getMonth() - 1, 1);
    if (callbacks.initialDayWidthPx) this.dayWidthPx = callbacks.initialDayWidthPx;
    this.buildBase();
    this.renderContent();
    this.initScroll(callbacks.initialScrollLeft);
  }

  public updateData(windows: TimeWindow[], entries: CalendarEntry[]) {
    this.windows = windows;
    this.entries = entries;
    this.renderContent();
  }

  private buildBase() {
    this.containerEl.empty();
    this.containerEl.addClass('fcp-timeline-view-wrapper');
    TimelineControls.render(this.containerEl, () => this.callbacks.onWindowCreate());
    this.scrollContainer = this.containerEl.createDiv('fcp-timeline-scroll-container');
    this.canvas = this.scrollContainer.createDiv('fcp-timeline-canvas');
    this.scrollContainer.addEventListener('scroll', () => {
      this.callbacks.onStateChange?.(this.dayWidthPx, this.scrollContainer.scrollLeft);
    });
    TimelineControls.attachWheelZoom(
      this.scrollContainer, () => this.dayWidthPx, () => this.canvasWidthPx,
      (newWidth, ratio, mouseX) => {
        this.dayWidthPx = newWidth;
        this.renderContent();
        this.scrollContainer.scrollLeft = (ratio * this.canvasWidthPx) - mouseX;
        this.callbacks.onStateChange?.(this.dayWidthPx, this.scrollContainer.scrollLeft);
      }
    );
  }

  private renderContent() {
    const savedScroll = this.scrollContainer?.scrollLeft ?? 0;
    const totalDays = calculateTotalDays(this.startDate, this.monthsSpan);
    const rangeEndDate = calculateEndDate(this.startDate, this.monthsSpan);
    this.canvasWidthPx = Math.max(1000, Math.round(totalDays * this.dayWidthPx));
    this.canvas.style.minWidth = `${this.canvasWidthPx}px`;
    this.canvas.empty();

    TimelineRuler.render(this.canvas, this.startDate, this.monthsSpan, totalDays, rangeEndDate, this.dayWidthPx);
    TimelineFramesTrack.render(this.canvas, this.windows, this.entries, this.startDate, rangeEndDate, totalDays, this.dayWidthPx, {
      onWindowClick: this.callbacks.onWindowClick,
      onEntryClick: this.callbacks.onEntryClick,
      onEntryUpdate: (entry) => this.callbacks.onEntryUpdate(entry)
    });

    if (savedScroll > 0) this.scrollContainer.scrollLeft = savedScroll;
  }

  private initScroll(initialScroll?: number) {
    if (initialScroll !== undefined && initialScroll >= 0) {
      this.scrollContainer.scrollLeft = initialScroll;
      return;
    }
    const totalDays = calculateTotalDays(this.startDate, this.monthsSpan);
    const todayDiff = diffDays(formatDateIso(new Date()), this.startDate);
    const todayPx = (todayDiff / totalDays) * this.canvasWidthPx;
    this.scrollContainer.scrollLeft = Math.max(0, todayPx - (this.scrollContainer.clientWidth / 2));
  }
}
