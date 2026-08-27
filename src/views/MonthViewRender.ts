import { CalendarEntry } from '../types';

export interface MonthViewCallbacks {
  onDayClick: (dateIso: string) => void;
  onEventClick: (entry: CalendarEntry) => void;
}

export class MonthViewRenderComponent {
  private containerEl: HTMLElement;
  private currentYear: number;
  private currentMonth: number; // 0-indexed (0 = Jan, 11 = Dec)
  private entries: CalendarEntry[];
  private dailyHoursMap: Map<string, number>;
  private callbacks: MonthViewCallbacks;

  constructor(
    containerEl: HTMLElement,
    year: number,
    month: number,
    entries: CalendarEntry[],
    dailyHoursMap: Map<string, number>,
    callbacks: MonthViewCallbacks
  ) {
    this.containerEl = containerEl;
    this.currentYear = year;
    this.currentMonth = month;
    this.entries = entries;
    this.dailyHoursMap = dailyHoursMap;
    this.callbacks = callbacks;
    this.render();
  }

  public update(year: number, month: number, entries: CalendarEntry[], dailyHoursMap: Map<string, number>) {
    this.currentYear = year;
    this.currentMonth = month;
    this.entries = entries;
    this.dailyHoursMap = dailyHoursMap;
    this.render();
  }

  private render() {
    this.containerEl.empty();
    this.containerEl.addClass('fcp-month-view-wrapper');

    const weekdaysHeader = this.containerEl.createDiv('fcp-month-weekdays-header');
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    dayNames.forEach(d => {
      const col = weekdaysHeader.createDiv('fcp-month-weekday-col');
      col.textContent = d;
    });

    const monthGrid = this.containerEl.createDiv('fcp-month-grid');

    const firstDayDate = new Date(this.currentYear, this.currentMonth, 1);
    let startDayOfWeek = firstDayDate.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(this.currentYear, this.currentMonth, 0).getDate();

    const totalCells = Math.ceil((startDayOfWeek + daysInMonth) / 7) * 7;
    const todayIso = new Date().toISOString().substring(0, 10);

    for (let i = 0; i < totalCells; i++) {
      let dayNumber: number;
      let monthOffset = 0;
      
      if (i < startDayOfWeek) {
        dayNumber = daysInPrevMonth - startDayOfWeek + i + 1;
        monthOffset = -1;
      } else if (i >= startDayOfWeek + daysInMonth) {
        dayNumber = i - (startDayOfWeek + daysInMonth) + 1;
        monthOffset = 1;
      } else {
        dayNumber = i - startDayOfWeek + 1;
        monthOffset = 0;
      }

      const cellYear = this.currentYear + (this.currentMonth + monthOffset < 0 ? -1 : this.currentMonth + monthOffset > 11 ? 1 : 0);
      const cellMonth = (this.currentMonth + monthOffset + 12) % 12;
      const cellIso = `${cellYear}-${(cellMonth + 1).toString().padStart(2, '0')}-${dayNumber.toString().padStart(2, '0')}`;

      const isToday = cellIso === todayIso;
      const isOtherMonth = monthOffset !== 0;

      const cellEl = monthGrid.createDiv(`fcp-month-cell ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'is-today' : ''}`);

      const dailyHours = this.dailyHoursMap.get(cellIso) || 0;
      if (dailyHours > 0) {
        const intensity = Math.min(1, dailyHours / 8);
        const alpha = 0.12 + (intensity * 0.58);
        cellEl.style.backgroundColor = `rgba(59, 130, 246, ${alpha.toFixed(2)})`;
        cellEl.style.borderColor = `rgba(59, 130, 246, ${(alpha + 0.2).toFixed(2)})`;
      }

      const cellHeader = cellEl.createDiv('fcp-month-cell-header');
      cellHeader.textContent = dayNumber.toString();

      cellEl.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.fcp-month-event-item')) return;
        this.callbacks.onDayClick(cellIso);
      });

      const dayEvents = this.entries.filter(e => e.date === cellIso && e.type === 'event');

      if (dayEvents.length > 0) {
        const eventsContainer = cellEl.createDiv('fcp-month-events-container');
        
        dayEvents.forEach(evt => {
          const evtEl = eventsContainer.createDiv('fcp-month-event-item');
          evtEl.innerHTML = `
            <span class="fcp-evt-dot"></span>
            <span class="fcp-evt-title">${this.escapeHtml(evt.title || 'Event')}</span>
          `;
          evtEl.addEventListener('click', (e) => {
            e.stopPropagation();
            this.callbacks.onEventClick(evt);
          });
        });
      }

      if (dailyHours > 0) {
        const hoursTag = cellEl.createDiv('fcp-month-day-hours');
        const formattedHours = dailyHours % 1 === 0 ? `${dailyHours} Hrs` : `${dailyHours.toFixed(1)} Hrs`;
        hoursTag.textContent = formattedHours;
      }
    }

    // Align month header columns with body grid columns accounting for scrollbar width
    setTimeout(() => {
      const scrollbarWidth = monthGrid.offsetWidth - monthGrid.clientWidth;
      if (scrollbarWidth > 0) {
        weekdaysHeader.style.paddingRight = `${scrollbarWidth}px`;
      } else {
        weekdaysHeader.style.paddingRight = '0px';
      }
    }, 0);
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
