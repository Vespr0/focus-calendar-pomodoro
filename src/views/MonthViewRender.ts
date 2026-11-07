import { App, Platform, setIcon } from 'obsidian';
import { CalendarEntry, PomodoroLogSession, MilestoneCategory, MonthSubView } from '../types';
import { formatHoursAndMinutes } from '../utils';
import { MilestonesViewRenderComponent } from './MilestonesViewRender';
import { StatisticsViewRenderComponent } from './StatisticsViewRender';

export interface MonthViewCallbacks {
  onDayClick: (dateIso: string) => void;
  onEventClick: (entry: CalendarEntry) => void;
  onSaveMilestones: (categories: MilestoneCategory[]) => Promise<void>;
  onSubViewChange?: (subView: MonthSubView) => void;
}

export class MonthViewRenderComponent {
  private app: App;
  private containerEl: HTMLElement;
  private currentYear: number;
  private currentMonth: number; // 0-indexed (0 = Jan, 11 = Dec)
  private entries: CalendarEntry[];
  private pomoLogs: PomodoroLogSession[];
  private dailyHoursMap: Map<string, number>;
  private milestones: MilestoneCategory[];
  private callbacks: MonthViewCallbacks;
  private subView: MonthSubView;

  private milestonesComponent: MilestonesViewRenderComponent | null = null;
  private statsComponent: StatisticsViewRenderComponent | null = null;

  constructor(
    app: App,
    containerEl: HTMLElement,
    year: number,
    month: number,
    entries: CalendarEntry[],
    pomoLogs: PomodoroLogSession[],
    dailyHoursMap: Map<string, number>,
    milestones: MilestoneCategory[],
    callbacks: MonthViewCallbacks,
    initialSubView: MonthSubView = 'calendar'
  ) {
    this.app = app;
    this.containerEl = containerEl;
    this.currentYear = year;
    this.currentMonth = month;
    this.entries = entries;
    this.pomoLogs = pomoLogs;
    this.dailyHoursMap = dailyHoursMap;
    this.milestones = milestones;
    this.callbacks = callbacks;
    this.subView = initialSubView === 'calendar' ? 'calendar' : 'milestones';
    this.render();
  }

  public update(
    year: number,
    month: number,
    entries: CalendarEntry[],
    pomoLogs: PomodoroLogSession[],
    dailyHoursMap: Map<string, number>,
    milestones: MilestoneCategory[]
  ) {
    this.currentYear = year;
    this.currentMonth = month;
    this.entries = entries;
    this.pomoLogs = pomoLogs;
    this.dailyHoursMap = dailyHoursMap;
    this.milestones = milestones;
    this.render();
  }

  public render() {
    this.containerEl.empty();
    this.containerEl.addClass('fcp-month-view-wrapper');

    // 1. Minimalist Sub-Nav Bar inside Monthly View
    const subNav = this.containerEl.createDiv('fcp-month-subnav');

    const leftGroup = subNav.createDiv('fcp-subnav-group');

    const addSubBtn = (mode: MonthSubView, iconId: string, title: string) => {
      const btn = leftGroup.createEl('button', {
        cls: `fcp-subnav-btn ${this.subView === mode ? 'active' : ''}`,
        ariaLabel: title
      });
      setIcon(btn, iconId);
      btn.title = title;
      btn.onclick = () => {
        if (this.subView !== mode) {
          this.subView = mode;
          this.callbacks.onSubViewChange?.(mode);
          this.render();
        }
      };
      return btn;
    };

    addSubBtn('calendar', 'calendar', 'Month Days');
    addSubBtn('milestones', 'milestone', 'Statistics & Milestones');

    const rightGroup = subNav.createDiv('fcp-subnav-right');
    let totalHours = 0;
    for (const h of this.dailyHoursMap.values()) totalHours += h;
    if (totalHours > 0) {
      const metaEl = rightGroup.createSpan('fcp-subnav-meta');
      metaEl.textContent = formatHoursAndMinutes(totalHours);
      metaEl.title = 'Total focus hours this month';
    }

    // 2. View Body Area
    const contentArea = this.containerEl.createDiv('fcp-month-content-area');

    if (this.subView === 'calendar') {
      this.renderCalendarGrid(contentArea);
    } else {
      this.renderFusedPanel(contentArea);
    }
  }

  private renderFusedPanel(container: HTMLElement) {
    const splitLayout = container.createDiv('fcp-month-fused-panel');

    // Left: Statistics
    const leftPane = splitLayout.createDiv('fcp-month-stats-pane');
    this.statsComponent = new StatisticsViewRenderComponent(
      leftPane,
      this.currentYear,
      this.currentMonth,
      this.pomoLogs
    );

    // Right: Milestones
    const rightPane = splitLayout.createDiv('fcp-month-milestones-pane');
    this.milestonesComponent = new MilestonesViewRenderComponent(
      this.app,
      rightPane,
      this.currentYear,
      this.currentMonth,
      this.milestones,
      {
        onSave: async (cats) => {
          this.milestones = cats;
          await this.callbacks.onSaveMilestones(cats);
        }
      }
    );
  }

  private renderCalendarGrid(container: HTMLElement) {
    const layoutContainer = container.createDiv('fcp-month-layout-container');
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
    const numRows = totalCells / 7;
    if (Platform.isMobile) {
      monthGrid.style.gridTemplateRows = `repeat(${numRows}, minmax(90px, auto))`;
    } else {
      monthGrid.style.gridTemplateRows = `repeat(${numRows}, minmax(0, 1fr))`;
    }
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
        const alpha = 0.10 + (intensity * 0.40);
        cellEl.style.backgroundColor = `color-mix(in srgb, var(--interactive-accent) ${(alpha * 100).toFixed(0)}%, transparent)`;
        cellEl.style.borderColor = `color-mix(in srgb, var(--interactive-accent) ${((alpha + 0.15) * 100).toFixed(0)}%, transparent)`;
      }

      const cellHeader = cellEl.createDiv('fcp-month-cell-header');
      cellHeader.textContent = dayNumber.toString();

      cellEl.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.fcp-month-event-item')) return;
        this.callbacks.onDayClick(cellIso);
      });

      const dayEvents = this.entries.filter(e => e.date === cellIso && (e.type === 'event' || e.type === 'crucial'));

      if (dayEvents.length > 0) {
        dayEvents.sort((a, b) => {
          if (a.type === 'crucial' && b.type !== 'crucial') return -1;
          if (a.type !== 'crucial' && b.type === 'crucial') return 1;
          return (a.startTime || '').localeCompare(b.startTime || '');
        });

        const eventsContainer = cellEl.createDiv('fcp-month-events-container');

        dayEvents.forEach(evt => {
          const isCrucial = evt.type === 'crucial';
          const evtEl = eventsContainer.createDiv(`fcp-month-event-item type-${evt.type || 'event'}`);
          const timeSuffix = evt.startTime && evt.endTime ? ` (${evt.startTime} - ${evt.endTime})` : '';
          evtEl.title = `${evt.title || 'Untitled'}${timeSuffix}`;
          evtEl.innerHTML = `
            ${isCrucial ? '<span class="fcp-evt-diamond">◆</span>' : '<span class="fcp-evt-dot"></span>'}
            <span class="fcp-evt-title">${this.escapeHtml(evt.title || 'Untitled')}</span>
          `;
          evtEl.addEventListener('click', (e) => {
            e.stopPropagation();
            this.callbacks.onEventClick(evt);
          });
        });
      }

      if (dailyHours > 0) {
        const hoursTag = cellEl.createDiv('fcp-month-day-hours');
        hoursTag.textContent = formatHoursAndMinutes(dailyHours);
      }
    }

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
