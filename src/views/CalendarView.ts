import { ItemView, WorkspaceLeaf, Notice } from 'obsidian';
import { ViewMode, CalendarEntry, PomodoroLogSession } from '../types';
import { StorageManager } from '../storage';
import { PomodoroManager } from '../pomodoro';
import { PomodoroHeaderComponent } from './PomodoroHeader';
import { WeekViewRenderComponent } from './WeekViewRender';
import { MonthViewRenderComponent } from './MonthViewRender';

export const VIEW_TYPE_FOCUS_CALENDAR = 'focus-calendar-pomodoro-view';

export class FocusCalendarView extends ItemView {
  private storage: StorageManager;
  private pomodoro: PomodoroManager;

  private viewMode: ViewMode = 'week';
  private currentDate: Date = new Date();

  private headerComponent: PomodoroHeaderComponent | null = null;
  private weekComponent: WeekViewRenderComponent | null = null;
  private monthComponent: MonthViewRenderComponent | null = null;

  private entries: CalendarEntry[] = [];
  private pomoLogs: PomodoroLogSession[] = [];

  constructor(leaf: WorkspaceLeaf, storage: StorageManager, pomodoro: PomodoroManager) {
    super(leaf);
    this.storage = storage;
    this.pomodoro = pomodoro;
  }

  public getViewType(): string {
    return VIEW_TYPE_FOCUS_CALENDAR;
  }

  public getDisplayText(): string {
    return 'Focus Calendar & Pomodoro';
  }

  public getIcon(): string {
    return 'calendar-clock';
  }

  public async onOpen(): Promise<void> {
    await this.refreshData();
    this.renderView();
  }

  public async refreshData(): Promise<void> {
    const yearMonth = this.getYearMonthString(this.currentDate);
    this.entries = await this.storage.loadEntriesForMonth(yearMonth);
    this.pomoLogs = await this.storage.loadPomodoroLogsForMonth(yearMonth);
  }

  public renderView(): void {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass('fcp-main-container');

    const navBar = container.createDiv('fcp-nav-bar');

    const leftNav = navBar.createDiv('fcp-nav-left');
    const todayBtn = leftNav.createEl('button', { cls: 'fcp-btn', text: 'Today' });
    todayBtn.onclick = async () => {
      this.currentDate = new Date();
      await this.refreshData();
      this.renderView();
    };

    const prevBtn = leftNav.createEl('button', { cls: 'fcp-icon-btn', ariaLabel: 'Previous' });
    prevBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>`;
    prevBtn.onclick = async () => {
      if (this.viewMode === 'week') {
        this.currentDate.setDate(this.currentDate.getDate() - 7);
      } else {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
      }
      await this.refreshData();
      this.renderView();
    };

    const nextBtn = leftNav.createEl('button', { cls: 'fcp-icon-btn', ariaLabel: 'Next' });
    nextBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`;
    nextBtn.onclick = async () => {
      if (this.viewMode === 'week') {
        this.currentDate.setDate(this.currentDate.getDate() + 7);
      } else {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
      }
      await this.refreshData();
      this.renderView();
    };

    const dateTitle = leftNav.createDiv('fcp-nav-date-title');
    dateTitle.textContent = this.currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const modeSwitch = navBar.createDiv('fcp-mode-switch');
    const weekBtn = modeSwitch.createEl('button', {
      cls: `fcp-switch-btn ${this.viewMode === 'week' ? 'active' : ''}`,
      text: 'Week'
    });
    weekBtn.onclick = () => {
      if (this.viewMode !== 'week') {
        this.viewMode = 'week';
        this.renderView();
      }
    };

    const monthBtn = modeSwitch.createEl('button', {
      cls: `fcp-switch-btn ${this.viewMode === 'month' ? 'active' : ''}`,
      text: 'Month'
    });
    monthBtn.onclick = () => {
      if (this.viewMode !== 'month') {
        this.viewMode = 'month';
        this.renderView();
      }
    };

    const pomoHeaderContainer = container.createDiv('fcp-header-slot');
    const totalHours = this.calculateTotalHours();
    this.headerComponent = new PomodoroHeaderComponent(
      pomoHeaderContainer,
      this.pomodoro,
      this.viewMode,
      totalHours
    );

    const viewAreaContainer = container.createDiv('fcp-view-area');

    if (this.viewMode === 'week') {
      const weekStart = this.getMondayOfWeek(this.currentDate);
      this.weekComponent = new WeekViewRenderComponent(
        viewAreaContainer,
        weekStart,
        this.entries,
        {
          onEntryCreate: async (date, startTime, endTime) => {
            const newEntry: CalendarEntry = {
              id: 'entry-' + Date.now(),
              title: '',
              date,
              startTime,
              endTime,
              type: 'task',
              createdAt: Date.now(),
              updatedAt: Date.now()
            };
            await this.storage.saveEntry(newEntry);
            await this.refreshData();
            return newEntry;
          },
          onEntryUpdate: async (entry) => {
            entry.updatedAt = Date.now();
            await this.storage.saveEntry(entry);
            await this.refreshData();
            this.updateHeaderStats();
          },
          onEntryDelete: async (entry) => {
            await this.storage.deleteEntry(entry.id, entry.date);
            if (this.pomodoro.getFocusedTask()?.id === entry.id) {
              this.pomodoro.setFocusedTask(null);
            }
            await this.refreshData();
            this.updateHeaderStats();
          },
          onTaskFocus: (entry) => {
            this.pomodoro.setFocusedTask(entry);
            new Notice(`Focused on task: ${entry.title || 'Untitled'}`);
          },
          getFocusedTaskId: () => this.pomodoro.getFocusedTask()?.id
        }
      );
    } else {
      this.monthComponent = new MonthViewRenderComponent(
        viewAreaContainer,
        this.currentDate.getFullYear(),
        this.currentDate.getMonth(),
        this.entries,
        {
          onDayClick: async (dateIso) => {
            this.currentDate = new Date(dateIso + 'T12:00:00');
            this.viewMode = 'week';
            await this.refreshData();
            this.renderView();
          },
          onEventClick: (entry) => {
            new Notice(`Event: ${entry.title || 'Untitled'}`);
          }
        }
      );
    }
  }

  public updateHeaderStats() {
    if (this.headerComponent) {
      this.headerComponent.update(this.viewMode, this.calculateTotalHours());
    }
  }

  private calculateTotalHours(): number {
    let totalSeconds = 0;
    if (this.viewMode === 'week') {
      const weekStart = this.getMondayOfWeek(this.currentDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weekStartIso = weekStart.toISOString().substring(0, 10);
      const weekEndIso = weekEnd.toISOString().substring(0, 10);

      this.pomoLogs.forEach(log => {
        if (log.type === 'work' && log.date >= weekStartIso && log.date < weekEndIso) {
          totalSeconds += log.durationSeconds;
        }
      });
    } else {
      this.pomoLogs.forEach(log => {
        if (log.type === 'work') {
          totalSeconds += log.durationSeconds;
        }
      });
    }
    return totalSeconds / 3600;
  }

  private getMondayOfWeek(d: Date): Date {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
  }

  private getYearMonthString(d: Date): string {
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    return `${y}-${m}`;
  }
}
