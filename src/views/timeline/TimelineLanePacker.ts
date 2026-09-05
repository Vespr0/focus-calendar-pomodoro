import { CalendarEntry, TimeWindow } from '../../types';

export class TimelineLanePacker {
  public static pack(windows: TimeWindow[]): TimeWindow[][] {
    const lanes: TimeWindow[][] = [];
    const sorted = [...windows].sort((a, b) => a.startDate.localeCompare(b.startDate));
    sorted.forEach(w => {
      let placed = false;
      for (const lane of lanes) {
        if (lane[lane.length - 1].endDate < w.startDate) {
          lane.push(w);
          placed = true;
          break;
        }
      }
      if (!placed) lanes.push([w]);
    });
    return lanes;
  }

  public static mapEventsToWindows(entries: CalendarEntry[], windows: TimeWindow[]): Map<string, CalendarEntry[]> {
    const map = new Map<string, CalendarEntry[]>();
    entries.forEach(e => {
      if (e.type !== 'crucial') return;
      if (e.windowId && e.windowId !== 'none' && windows.some(w => w.id === e.windowId)) {
        const list = map.get(e.windowId) || [];
        list.push(e);
        map.set(e.windowId, list);
      }
    });
    return map;
  }
}
