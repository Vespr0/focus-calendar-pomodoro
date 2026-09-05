import { App, normalizePath } from 'obsidian';
import { CalendarEntry, PomodoroLogSession, FocusCalendarSettings, TimeWindow } from './types';

export class StorageManager {
  private app: App;
  private settingsGetter: () => FocusCalendarSettings;
  public isLocalSaving: boolean = false;

  constructor(app: App, settingsGetter: () => FocusCalendarSettings) {
    this.app = app;
    this.settingsGetter = settingsGetter;
  }

  private get dataFolder(): string {
    return normalizePath(this.settingsGetter().dataDirectory || 'calendar-data');
  }

  private async ensureDataFolderExists(): Promise<void> {
    const folderPath = this.dataFolder;
    const exists = await this.app.vault.adapter.exists(folderPath);
    if (!exists) {
      await this.app.vault.createFolder(folderPath);
    }
  }

  private getMonthFilePath(yearMonth: string): string {
    return normalizePath(`${this.dataFolder}/entries-${yearMonth}.json`);
  }

  private getPomodoroLogFilePath(yearMonth: string): string {
    return normalizePath(`${this.dataFolder}/focus-logs-${yearMonth}.json`);
  }

  private getWindowsFilePath(): string {
    return normalizePath(`${this.dataFolder}/windows.json`);
  }

  public async loadTimeWindows(): Promise<TimeWindow[]> {
    await this.ensureDataFolderExists();
    const path = this.getWindowsFilePath();
    try {
      const exists = await this.app.vault.adapter.exists(path);
      if (!exists) return [];
      const content = await this.app.vault.adapter.read(path);
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? (parsed as TimeWindow[]) : [];
    } catch (e) {
      console.error('Failed to read time windows:', e);
      return [];
    }
  }

  public async saveTimeWindows(windows: TimeWindow[]): Promise<void> {
    await this.ensureDataFolderExists();
    const path = this.getWindowsFilePath();
    this.isLocalSaving = true;
    await this.app.vault.adapter.write(path, JSON.stringify(windows, null, 2));
    setTimeout(() => { this.isLocalSaving = false; }, 500);
  }

  public async saveTimeWindow(window: TimeWindow): Promise<void> {
    const windows = await this.loadTimeWindows();
    const idx = windows.findIndex(w => w.id === window.id);
    if (idx >= 0) {
      windows[idx] = window;
    } else {
      windows.push(window);
    }
    // Keep sorted by startDate
    windows.sort((a, b) => a.startDate.localeCompare(b.startDate));
    await this.saveTimeWindows(windows);
  }

  public async deleteTimeWindow(windowId: string): Promise<void> {
    const windows = await this.loadTimeWindows();
    const filtered = windows.filter(w => w.id !== windowId);
    await this.saveTimeWindows(filtered);
  }

  public async loadEntriesForRange(yearMonths: string[]): Promise<CalendarEntry[]> {
    const entryMap = new Map<string, CalendarEntry>();
    for (const ym of yearMonths) {
      const entries = await this.loadEntriesForMonth(ym);
      for (const entry of entries) {
        entryMap.set(entry.id, entry);
      }
    }
    return Array.from(entryMap.values());
  }

  public async loadEntriesForMonth(yearMonth: string): Promise<CalendarEntry[]> {
    await this.ensureDataFolderExists();
    const path = this.getMonthFilePath(yearMonth);
    try {
      const exists = await this.app.vault.adapter.exists(path);
      if (!exists) {
        return [];
      }
      const content = await this.app.vault.adapter.read(path);
      return JSON.parse(content) as CalendarEntry[];
    } catch (e) {
      console.error(`Failed to read calendar entries for ${yearMonth}:`, e);
      return [];
    }
  }

  public async saveEntriesForMonth(yearMonth: string, entries: CalendarEntry[]): Promise<void> {
    await this.ensureDataFolderExists();
    const path = this.getMonthFilePath(yearMonth);
    const data = JSON.stringify(entries, null, 2);
    
    this.isLocalSaving = true;
    await this.app.vault.adapter.write(path, data);
    setTimeout(() => { this.isLocalSaving = false; }, 500);
  }

  public async saveEntry(entry: CalendarEntry): Promise<void> {
    const yearMonth = entry.date.substring(0, 7);
    const currentEntries = await this.loadEntriesForMonth(yearMonth);
    const existingIdx = currentEntries.findIndex(e => e.id === entry.id);
    if (existingIdx >= 0) {
      currentEntries[existingIdx] = entry;
    } else {
      currentEntries.push(entry);
    }
    await this.saveEntriesForMonth(yearMonth, currentEntries);
  }

  public async deleteEntry(entryId: string, date?: string): Promise<void> {
    let yearMonth = date && date.length >= 7 ? date.substring(0, 7) : '';
    if (!yearMonth) {
      yearMonth = new Date().toISOString().substring(0, 7);
    }
    const currentEntries = await this.loadEntriesForMonth(yearMonth);
    const filtered = currentEntries.filter(e => e.id !== entryId);
    await this.saveEntriesForMonth(yearMonth, filtered);
  }

  public async logPomodoroSession(session: PomodoroLogSession): Promise<void> {
    await this.ensureDataFolderExists();
    const yearMonth = session.date.substring(0, 7);
    const path = this.getPomodoroLogFilePath(yearMonth);
    let logs: PomodoroLogSession[] = [];
    try {
      if (await this.app.vault.adapter.exists(path)) {
        const content = await this.app.vault.adapter.read(path);
        logs = JSON.parse(content);
      }
    } catch (e) {
      logs = [];
    }

    const rawTitle = (session.taskTitle || '').trim();
    if (!rawTitle) return;
    const titleKey = rawTitle.toLowerCase();
    const existingIdx = logs.findIndex(
      l => l.date === session.date &&
           l.type === session.type &&
           (l.taskTitle || '').trim().toLowerCase() === titleKey
    );

    if (existingIdx >= 0) {
      logs[existingIdx].durationSeconds += session.durationSeconds;
      logs[existingIdx].completedAt = session.completedAt;
      if (session.taskId) logs[existingIdx].taskId = session.taskId;
    } else {
      const cleanId = `${session.date}:${titleKey}`;
      logs.push({
        id: cleanId,
        taskId: session.taskId,
        taskTitle: rawTitle,
        type: session.type,
        durationSeconds: session.durationSeconds,
        completedAt: session.completedAt,
        date: session.date
      });
    }
    
    this.isLocalSaving = true;
    await this.app.vault.adapter.write(path, JSON.stringify(logs, null, 2));
    setTimeout(() => { this.isLocalSaving = false; }, 500);
  }

  public async loadPomodoroLogsForMonth(yearMonth: string): Promise<PomodoroLogSession[]> {
    await this.ensureDataFolderExists();
    const path = this.getPomodoroLogFilePath(yearMonth);
    try {
      if (!(await this.app.vault.adapter.exists(path))) return [];
      const content = await this.app.vault.adapter.read(path);
      return JSON.parse(content) as PomodoroLogSession[];
    } catch (e) {
      return [];
    }
  }
}
