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
  private callbacks: MonthViewCallbacks;

  constructor(
    containerEl: HTMLElement,
    year: number,
    month: number,
    entries: CalendarEntry[],
    callbacks: MonthViewCallbacks
  ) {
    this.containerEl = containerEl;
    this.currentYear = year;
    this.currentMonth = month;
    this.entries = entries;
    this.callbacks = callbacks;
    this.render();
  }

  public update(year: number, month: number, entries: CalendarEntry[]) {
    this.currentYear = year;
    this.currentMonth = month;
    this.entries = entries;
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
    }
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
