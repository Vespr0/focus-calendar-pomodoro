import { App, normalizePath } from 'obsidian';
import { CalendarEntry, PomodoroLogSession, FocusCalendarSettings } from './types';

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

  public async deleteEntry(entryId: string, date: string): Promise<void> {
    const yearMonth = date.substring(0, 7);
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

    if (session.taskId && session.type === 'work') {
      const entries = await this.loadEntriesForMonth(yearMonth);
      const entry = entries.find(e => e.id === session.taskId);
      if (entry) {
        entry.actualSecondsSpent = (entry.actualSecondsSpent || 0) + session.durationSeconds;
        entry.updatedAt = Date.now();
        await this.saveEntriesForMonth(yearMonth, entries);
      }
    }
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
