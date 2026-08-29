import { CalendarEntry, PomodoroLogSession } from '../types';

export interface MonthViewCallbacks {
  onDayClick: (dateIso: string) => void;
  onEventClick: (entry: CalendarEntry) => void;
}

export class MonthViewRenderComponent {
  private containerEl: HTMLElement;
  private currentYear: number;
  private currentMonth: number; // 0-indexed (0 = Jan, 11 = Dec)
  private entries: CalendarEntry[];
  private pomoLogs: PomodoroLogSession[];
  private dailyHoursMap: Map<string, number>;
  private callbacks: MonthViewCallbacks;

  constructor(
    containerEl: HTMLElement,
    year: number,
    month: number,
    entries: CalendarEntry[],
    pomoLogs: PomodoroLogSession[],
    dailyHoursMap: Map<string, number>,
    callbacks: MonthViewCallbacks
  ) {
    this.containerEl = containerEl;
    this.currentYear = year;
    this.currentMonth = month;
    this.entries = entries;
    this.pomoLogs = pomoLogs;
    this.dailyHoursMap = dailyHoursMap;
    this.callbacks = callbacks;
    this.render();
  }

  public update(
    year: number,
    month: number,
    entries: CalendarEntry[],
    pomoLogs: PomodoroLogSession[],
    dailyHoursMap: Map<string, number>
  ) {
    this.currentYear = year;
    this.currentMonth = month;
    this.entries = entries;
    this.pomoLogs = pomoLogs;
    this.dailyHoursMap = dailyHoursMap;
    this.render();
  }

  private getTaskColor(title: string): string {
    const normalized = title.toLowerCase().trim();
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      hash = normalized.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 68%, 52%)`;
  }

  private render() {
    this.containerEl.empty();
    this.containerEl.addClass('fcp-month-view-wrapper');

    const layoutContainer = this.containerEl.createDiv('fcp-month-layout-container');

    // --- Left Panel: Calendar Grid ---
    const gridPanel = layoutContainer.createDiv('fcp-month-grid-panel');

    const weekdaysHeader = gridPanel.createDiv('fcp-month-weekdays-header');
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    dayNames.forEach(d => {
      const col = weekdaysHeader.createDiv('fcp-month-weekday-col');
      col.textContent = d;
    });

    const monthGrid = gridPanel.createDiv('fcp-month-grid');

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

    // --- Right Panel: Monthly Actual Focus Time Breakdown ---
    this.renderBreakdownPanel(layoutContainer);

    setTimeout(() => {
      const scrollbarWidth = monthGrid.offsetWidth - monthGrid.clientWidth;
      if (scrollbarWidth > 0) {
        weekdaysHeader.style.paddingRight = `${scrollbarWidth}px`;
      } else {
        weekdaysHeader.style.paddingRight = '0px';
      }
    }, 0);
  }

  private renderBreakdownPanel(parentEl: HTMLElement) {
    const monthPrefix = `${this.currentYear}-${(this.currentMonth + 1).toString().padStart(2, '0')}`;

    // Group all actual focus time logs for current month case-insensitively
    const activityMap: Map<string, { displayTitle: string; totalSeconds: number; color: string }> = new Map();
    let grandTotalSeconds = 0;

    this.pomoLogs.forEach(log => {
      if (log.type !== 'work' || !log.date || !log.date.startsWith(monthPrefix)) return;
      let rawTitle = (log.taskTitle || '').trim();
      if (!rawTitle || rawTitle.toLowerCase() === 'general focus') return;

      const lower = rawTitle.toLowerCase();
      let displayTitle = rawTitle;
      let normKey = lower;

      if (log.taskId === 'focus-drills' || lower === 'drills' || lower.startsWith('[drill]') || lower.endsWith('drills') || lower.includes('drill:')) {
        displayTitle = 'Drills';
        normKey = 'drills';
      } else if (log.taskId === 'focus-flashcards' || lower === 'flashcards' || lower.startsWith('[flashcard]') || lower.includes('flashcard')) {
        displayTitle = 'Flashcards';
        normKey = 'flashcards';
      }

      const secs = log.durationSeconds || 0;
      if (secs <= 0) return;

      grandTotalSeconds += secs;

      if (activityMap.has(normKey)) {
        activityMap.get(normKey)!.totalSeconds += secs;
      } else {
        activityMap.set(normKey, {
          displayTitle: displayTitle,
          totalSeconds: secs,
          color: this.getTaskColor(displayTitle)
        });
      }
    });

    const grandTotalHours = grandTotalSeconds / 3600;
    const activities = Array.from(activityMap.values())
      .map(act => ({
        displayTitle: act.displayTitle,
        totalHours: act.totalSeconds / 3600,
        color: act.color
      }))
      .sort((a, b) => b.totalHours - a.totalHours);

    const breakdownPanel = parentEl.createDiv('fcp-month-breakdown-panel');
    const header = breakdownPanel.createDiv('fcp-breakdown-header');
    header.innerHTML = `
      <div class="fcp-breakdown-title">Statistics</div>
      <div class="fcp-breakdown-subtitle">${grandTotalHours.toFixed(1)} Focus Hrs</div>
    `;

    if (activities.length === 0 || grandTotalSeconds === 0) {
      const emptyMsg = breakdownPanel.createDiv('fcp-breakdown-empty');
      emptyMsg.textContent = 'No focus time recorded this month.';
      return;
    }

    // Stacked Bar Container
    const barContainer = breakdownPanel.createDiv('fcp-stacked-bar');

    activities.forEach(act => {
      const pct = (act.totalHours / (grandTotalHours || 1)) * 100;
      const segment = barContainer.createDiv('fcp-stacked-segment');
      segment.style.backgroundColor = act.color;
      segment.style.flex = `${pct}`;
      segment.title = `${act.displayTitle}: ${act.totalHours.toFixed(1)}h (${pct.toFixed(0)}%)`;
    });

    // Legend List
    const legend = breakdownPanel.createDiv('fcp-breakdown-legend');
    activities.forEach(act => {
      const pct = (act.totalHours / (grandTotalHours || 1)) * 100;
      const item = legend.createDiv('fcp-legend-item');
      item.innerHTML = `
        <div class="fcp-legend-left">
          <span class="fcp-legend-dot" style="background-color: ${act.color};"></span>
          <span class="fcp-legend-name" title="${this.escapeHtml(act.displayTitle)}">${this.escapeHtml(act.displayTitle)}</span>
        </div>
        <div class="fcp-legend-right">
          <span class="fcp-legend-hours">${act.totalHours.toFixed(1)}h</span>
          <span class="fcp-legend-pct">${pct.toFixed(0)}%</span>
        </div>
      `;
    });
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
