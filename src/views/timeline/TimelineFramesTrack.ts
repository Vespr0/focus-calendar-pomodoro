import { CalendarEntry, TimeWindow } from '../../types';
import { windowRangeToPercent, eventToPercent, formatDateIso, escapeHtml } from './TimelineUtils';
import { TimelineLanePacker } from './TimelineLanePacker';
import { TimelineMarkerDrag } from './TimelineMarkerDrag';

export interface TimelineFrameCallbacks {
  onWindowClick: (w: TimeWindow) => void;
  onEntryClick: (entry: CalendarEntry) => void;
  onEntryUpdate: (entry: CalendarEntry) => Promise<void>;
}

export class TimelineFramesTrack {
  public static render(
    canvas: HTMLElement, windows: TimeWindow[], entries: CalendarEntry[],
    startDate: Date, rangeEndDate: Date, totalDays: number, dayWidthPx: number,
    cb: TimelineFrameCallbacks
  ): void {
    const container = canvas.createDiv('fcp-timeline-frames-container');
    const startIso = formatDateIso(startDate), endIso = formatDateIso(rangeEndDate);
    const visWins = windows.filter(w => w.startDate <= endIso && w.endDate >= startIso);
    const crucial = entries.filter(e => e.type === 'crucial' && e.date >= startIso && e.date <= endIso);

    if (visWins.length === 0 && crucial.length === 0) {
      container.createDiv('fcp-timeline-empty-notice').textContent = 'No time windows or crucial events.';
      return;
    }

    const assigned = TimelineLanePacker.mapEventsToWindows(crucial, visWins);
    const lanes = TimelineLanePacker.pack(visWins);

    lanes.forEach(lane => {
      const laneEl = container.createDiv('fcp-timeline-frame-lane');
      lane.forEach(w => {
        this.renderFrame(laneEl, w, startDate, totalDays, cb);
        (assigned.get(w.id) || []).forEach(e => {
          this.renderMarker(laneEl, e, eventToPercent(e.date, startDate, totalDays), windows, canvas, cb);
        });
      });
    });

    const unassigned = crucial.filter(e => !e.windowId || e.windowId === 'none' || !windows.some(w => w.id === e.windowId));
    if (unassigned.length > 0) {
      const lane = container.createDiv('fcp-timeline-frame-lane fcp-unassigned-lane');
      lane.createDiv('fcp-frame-baseline');
      unassigned.forEach(e => {
        this.renderMarker(lane, e, eventToPercent(e.date, startDate, totalDays), windows, canvas, cb);
      });
    }
  }

  private static renderFrame(
    laneEl: HTMLElement, w: TimeWindow, startDate: Date, totalDays: number,
    cb: TimelineFrameCallbacks
  ): void {
    const { leftPct, widthPct } = windowRangeToPercent(w.startDate, w.endDate, startDate, totalDays);
    const frame = laneEl.createDiv(`fcp-timeline-window-frame color-${w.color || 'indigo'}`);
    frame.dataset.windowId = w.id;
    frame.style.left = `${leftPct}%`;
    frame.style.width = `${widthPct}%`;

    const header = frame.createDiv('fcp-frame-header');
    header.innerHTML = `<span class="fcp-frame-title">${escapeHtml(w.title)}</span>`;
    header.title = `${w.title}\n${w.startDate} to ${w.endDate}\n(Click to edit window)`;
    header.onclick = (e) => { e.stopPropagation(); cb.onWindowClick(w); };

    frame.createDiv('fcp-frame-baseline');
  }

  private static renderMarker(
    parent: HTMLElement, e: CalendarEntry, left: number,
    windows: TimeWindow[], canvas: HTMLElement,
    cb: TimelineFrameCallbacks
  ): void {
    const el = parent.createDiv('fcp-timeline-rhombus');
    el.style.left = `${left}%`;
    el.title = `${e.title}\n${e.date}${e.startTime ? ' ' + e.startTime : ''}`;
    TimelineMarkerDrag.setup(el, e, windows, canvas, cb.onEntryUpdate, cb.onEntryClick);
  }
}
