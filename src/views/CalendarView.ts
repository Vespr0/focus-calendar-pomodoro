import { ItemView, WorkspaceLeaf } from 'obsidian';
import { ViewMode, CalendarEntry, PomodoroLogSession, TimeWindow } from '../types';
import { StorageManager } from '../storage';
import { PomodoroManager } from '../pomodoro';
import { PomodoroHeaderComponent } from './PomodoroHeader';
import { WeekViewRenderComponent, TaskEditModal } from './WeekViewRender';
import { MonthViewRenderComponent } from './MonthViewRender';
import { TimelineViewRenderComponent } from './TimelineViewRender';
import { TimeWindowModal } from './TimeWindowModal';

export const VIEW_TYPE_FOCUS_CALENDAR = 'focus-calendar-pomodoro-view';

export class FocusCalendarView extends ItemView {
  private storage: StorageManager;
  private pomodoro: PomodoroManager;

  private viewMode: ViewMode = 'week';
  private currentDate: Date = new Date();

  private headerComponent: PomodoroHeaderComponent | null = null;
  private weekComponent: WeekViewRenderComponent | null = null;
  private monthComponent: MonthViewRenderComponent | null = null;
  private timelineComponent: TimelineViewRenderComponent | null = null;
  private timelineZoomPx: number = 16;
  private timelineScrollLeft: number = -1;

  private entries: CalendarEntry[] = [];
  private pomoLogs: PomodoroLogSession[] = [];
  private windows: TimeWindow[] = [];

  constructor(leaf: WorkspaceLeaf, storage: StorageManager, pomodoro: PomodoroManager) {
    super(leaf);
    this.storage = storage;
    this.pomodoro = pomodoro;
  }

  public getViewType(): string {
    return VIEW_TYPE_FOCUS_CALENDAR;
  }

  public getDisplayText(): string {
    return 'Calendar & Focus';
  }

  public getIcon(): string {
    return 'calendar-clock';
  }

  public async onOpen(): Promise<void> {
    await this.refreshData();
    this.renderView();
  }

  public async refreshData(): Promise<void> {
    const targetDate = this.currentDate;
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();

    this.windows = await this.storage.loadTimeWindows();

    const monthsToLoad = new Set<string>();

    if (this.viewMode === 'timeline') {
      // In timeline view, load a 9-month window to cover academic planning
      const start = new Date(year, month - 1, 1);
      for (let i = 0; i < 9; i++) {
        const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
        monthsToLoad.add(this.getYearMonthString(d));
      }
    } else {
      const prevMonthDate = new Date(year, month - 1, 1);
      const nextMonthDate = new Date(year, month + 1, 1);
      monthsToLoad.add(this.getYearMonthString(prevMonthDate));
      monthsToLoad.add(this.getYearMonthString(targetDate));
      monthsToLoad.add(this.getYearMonthString(nextMonthDate));
    }

    const entryMap = new Map<string, CalendarEntry>();
    const logMap = new Map<string, PomodoroLogSession>();

    for (const ym of monthsToLoad) {
      const monthEntries = await this.storage.loadEntriesForMonth(ym);
      monthEntries.forEach(e => entryMap.set(e.id, e));

      const monthLogs = await this.storage.loadPomodoroLogsForMonth(ym);
      monthLogs.forEach(l => logMap.set(l.id, l));
    }

    this.entries = Array.from(entryMap.values());
    this.pomoLogs = Array.from(logMap.values());
  }

  public renderView(): void {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass('fcp-main-container');
    container.style.padding = '0';
    container.style.margin = '0';

    const navBar = container.createDiv('fcp-nav-bar');

    const leftNav = navBar.createDiv('fcp-nav-left');
    const todayBtn = leftNav.createEl('button', { cls: 'fcp-btn', text: 'TODAY' });
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
      } else if (this.viewMode === 'month') {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
      } else {
        this.currentDate.setMonth(this.currentDate.getMonth() - 3);
      }
      await this.refreshData();
      this.renderView();
    };

    const nextBtn = leftNav.createEl('button', { cls: 'fcp-icon-btn', ariaLabel: 'Next' });
    nextBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`;
    nextBtn.onclick = async () => {
      if (this.viewMode === 'week') {
        this.currentDate.setDate(this.currentDate.getDate() + 7);
      } else if (this.viewMode === 'month') {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
      } else {
        this.currentDate.setMonth(this.currentDate.getMonth() + 3);
      }
      await this.refreshData();
      this.renderView();
    };

    const dateTitle = leftNav.createDiv('fcp-nav-date-title');
    if (this.viewMode === 'week') {
      const { week, year } = this.getWeekNumberAndYear(this.currentDate);
      dateTitle.textContent = `WEEK ${week}, ${year}`;
    } else if (this.viewMode === 'month') {
      dateTitle.textContent = this.currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
    } else {
      const start = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 5);
      const sM = start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();
      const eM = end.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();
      dateTitle.textContent = `TIMELINE (${sM} – ${eM})`;
    }

    const modeSwitch = navBar.createDiv('fcp-mode-switch');
    const weekBtn = modeSwitch.createEl('button', {
      cls: `fcp-switch-btn ${this.viewMode === 'week' ? 'active' : ''}`,
      text: 'WEEK'
    });
    weekBtn.onclick = async () => {
      if (this.viewMode !== 'week') {
        this.viewMode = 'week';
        await this.refreshData();
        this.renderView();
      }
    };

    const monthBtn = modeSwitch.createEl('button', {
      cls: `fcp-switch-btn ${this.viewMode === 'month' ? 'active' : ''}`,
      text: 'MONTH'
    });
    monthBtn.onclick = async () => {
      if (this.viewMode !== 'month') {
        this.viewMode = 'month';
        await this.refreshData();
        this.renderView();
      }
    };

    const timelineBtn = modeSwitch.createEl('button', {
      cls: `fcp-switch-btn ${this.viewMode === 'timeline' ? 'active' : ''}`,
      text: 'TIMELINE'
    });
    timelineBtn.onclick = async () => {
      if (this.viewMode !== 'timeline') {
        this.viewMode = 'timeline';
        await this.refreshData();
        this.renderView();
      }
    };

    if (this.viewMode !== 'timeline') {
      const pomoHeaderContainer = container.createDiv('fcp-header-slot');
      const totalHours = this.calculateTotalHours();
      this.headerComponent = new PomodoroHeaderComponent(
        pomoHeaderContainer,
        this.pomodoro,
        this.viewMode,
        totalHours
      );
    } else {
      this.headerComponent = null;
    }

    const viewAreaContainer = container.createDiv('fcp-view-area');

    if (this.viewMode === 'week') {
      const weekStart = this.getMondayOfWeek(this.currentDate);
      this.weekComponent = new WeekViewRenderComponent(
        this.app,
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
            this.entries.push(newEntry);
            this.weekComponent?.upsertEntryLocal(newEntry);
            await this.storage.saveEntry(newEntry);
            return newEntry;
          },
          onEntryUpdate: async (entry, oldDate) => {
            entry.updatedAt = Date.now();
            if (oldDate && oldDate !== entry.date) {
              const oldYearMonth = oldDate.substring(0, 7);
              const newYearMonth = entry.date.substring(0, 7);
              if (oldYearMonth !== newYearMonth) {
                await this.storage.deleteEntry(entry.id, oldDate);
              }
            }
            const idx = this.entries.findIndex(e => e.id === entry.id);
            if (idx >= 0) this.entries[idx] = entry;
            else this.entries.push(entry);
            this.weekComponent?.upsertEntryLocal(entry);
            await this.storage.saveEntry(entry);
            this.updateHeaderStats();
          },
          onEntryDelete: async (entry) => {
            await this.storage.deleteEntry(entry.id, entry.date);
            this.entries = this.entries.filter(e => e.id !== entry.id);
            this.weekComponent?.deleteEntryLocal(entry.id);
            if (this.pomodoro.getFocusedTask()?.id === entry.id) {
              this.pomodoro.setFocusedTask(null);
            }
            this.updateHeaderStats();
          },
          onTaskFocus: (entry) => {
            const currentFocused = this.pomodoro.getFocusedTask();
            if (currentFocused?.id === entry.id) {
              this.pomodoro.setFocusedTask(null);
              this.weekComponent?.updateFocusedTask(null);
            } else {
              this.pomodoro.setFocusedTask(entry);
              this.weekComponent?.updateFocusedTask(entry.id);
            }
          },
          getFocusedTaskId: () => this.pomodoro.getFocusedTask()?.id
        },
        this.windows
      );
    } else if (this.viewMode === 'month') {
      this.monthComponent = new MonthViewRenderComponent(
        viewAreaContainer,
        this.currentDate.getFullYear(),
        this.currentDate.getMonth(),
        this.entries,
        this.pomoLogs,
        this.buildDailyHoursMap(),
        {
          onDayClick: async (dateIso) => {
            this.currentDate = new Date(dateIso + 'T12:00:00');
            this.viewMode = 'week';
            await this.refreshData();
            this.renderView();
          },
          onEventClick: (entry) => {
            new TaskEditModal(
              this.app,
              entry,
              async (updated) => {
                await this.storage.saveEntry(updated);
                await this.refreshData();
                this.renderView();
              },
              async (deleted) => {
                await this.storage.deleteEntry(deleted.id, deleted.date);
                await this.refreshData();
                this.renderView();
              },
              this.windows
            ).open();
          }
        }
      );
    } else {
      this.timelineComponent = new TimelineViewRenderComponent(
        this.app,
        viewAreaContainer,
        this.currentDate,
        this.windows,
        this.entries,
        {
          initialDayWidthPx: this.timelineZoomPx,
          initialScrollLeft: this.timelineScrollLeft,
          onStateChange: (zoom, scroll) => {
            this.timelineZoomPx = zoom;
            this.timelineScrollLeft = scroll;
          },
          onWindowClick: (window) => {
            new TimeWindowModal(
              this.app,
              window,
              async (updated) => {
                await this.storage.saveTimeWindow(updated);
                this.windows = await this.storage.loadTimeWindows();
                this.timelineComponent?.updateData(this.windows, this.entries);
              },
              async (windowId) => {
                await this.storage.deleteTimeWindow(windowId);
                this.windows = await this.storage.loadTimeWindows();
                this.timelineComponent?.updateData(this.windows, this.entries);
              }
            ).open();
          },
          onWindowCreate: () => {
            new TimeWindowModal(
              this.app,
              null,
              async (newWin) => {
                await this.storage.saveTimeWindow(newWin);
                this.windows = await this.storage.loadTimeWindows();
                this.timelineComponent?.updateData(this.windows, this.entries);
              }
            ).open();
          },
          onEntryClick: (entry) => {
            new TaskEditModal(
              this.app,
              entry,
              async (updated) => {
                await this.storage.saveEntry(updated);
                const idx = this.entries.findIndex(e => e.id === updated.id);
                if (idx >= 0) this.entries[idx] = updated;
                else this.entries.push(updated);
                this.timelineComponent?.updateData(this.windows, this.entries);
              },
              async (deleted) => {
                await this.storage.deleteEntry(deleted.id, deleted.date);
                this.entries = this.entries.filter(e => e.id !== deleted.id);
                this.timelineComponent?.updateData(this.windows, this.entries);
              },
              this.windows
            ).open();
          },
          onEntryUpdate: async (updated) => {
            await this.storage.saveEntry(updated);
            const idx = this.entries.findIndex(e => e.id === updated.id);
            if (idx >= 0) this.entries[idx] = updated;
            else this.entries.push(updated);
            this.timelineComponent?.updateData(this.windows, this.entries);
          }
        }
      );
    }
  }

  public updateHeaderStats() {
    if (this.headerComponent && this.viewMode !== 'timeline') {
      this.headerComponent.update(
        this.viewMode,
        this.calculateTotalHours()
      );
    }
  }

  private formatDateIso(d: Date): string {
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private buildDailyHoursMap(): Map<string, number> {
    const map = new Map<string, number>();
    this.pomoLogs.forEach(log => {
      if (log.type === 'work' && log.date) {
        const current = map.get(log.date) || 0;
        map.set(log.date, current + (log.durationSeconds / 3600));
      }
    });
    return map;
  }

  private calculateTotalHours(): number {
    let totalSeconds = 0;
    if (this.viewMode === 'week') {
      const weekStart = this.getMondayOfWeek(this.currentDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weekStartIso = this.formatDateIso(weekStart);
      const weekEndIso = this.formatDateIso(weekEnd);

      this.pomoLogs.forEach(log => {
        if (log.type === 'work' && log.date >= weekStartIso && log.date < weekEndIso) {
          totalSeconds += log.durationSeconds;
        }
      });
    } else {
      const currentYearMonth = this.getYearMonthString(this.currentDate);
      this.pomoLogs.forEach(log => {
        if (log.type === 'work' && log.date && log.date.startsWith(currentYearMonth)) {
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

  private getWeekNumberAndYear(d: Date): { week: number; year: number } {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return { week, year: date.getUTCFullYear() };
  }

  private getYearMonthString(d: Date): string {
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    return `${y}-${m}`;
  }
}
