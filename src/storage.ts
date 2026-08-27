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
    return normalizePath(this.settingsGetter().dataDirectory || 'CalendarData');
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
    return normalizePath(`${this.dataFolder}/pomodoro-logs-${yearMonth}.json`);
  }

  public async loadEntriesForMonth(yearMonth: string): Promise<CalendarEntry[]> {
    await this.ensureDataFolderExists();
    const path = this.getMonthFilePath(yearMonth);
    try {
      const exists = await this.app.vault.adapter.exists(path);
      if (!exists) {
        const seedEntries = this.generateSeedEntries(yearMonth);
        await this.saveEntriesForMonth(yearMonth, seedEntries);
        await this.generateSeedPomodoroLogs(yearMonth, seedEntries);
        return seedEntries;
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
    logs.push(session);
    
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

  private generateSeedEntries(yearMonth: string): CalendarEntry[] {
    const now = new Date();
    const currentDay = now.getDate().toString().padStart(2, '0');
    
    return [
      {
        id: 'seed-event-1',
        title: 'Computer Systems Exam',
        date: `${yearMonth}-15`,
        startTime: '09:00',
        endTime: '11:00',
        type: 'event',
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'seed-event-2',
        title: 'Algorithms & Data Structures Exam',
        date: `${yearMonth}-22`,
        startTime: '14:00',
        endTime: '16:00',
        type: 'event',
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'seed-event-3',
        title: 'Project Milestone Release',
        date: `${yearMonth}-28`,
        startTime: '10:00',
        endTime: '12:00',
        type: 'event',
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'seed-task-1',
        title: 'Review Chapter 4 Practice Problems',
        date: `${yearMonth}-${currentDay}`,
        startTime: '08:00',
        endTime: '09:30',
        type: 'task',
        actualSecondsSpent: 4800,
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'seed-task-2',
        title: 'Lab Assignment Draft',
        date: `${yearMonth}-${currentDay}`,
        startTime: '11:00',
        endTime: '13:00',
        type: 'task',
        actualSecondsSpent: 7200,
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'seed-task-3',
        title: 'System Architecture Diagram',
        date: `${yearMonth}-${currentDay}`,
        startTime: '14:00',
        endTime: '16:00',
        type: 'task',
        actualSecondsSpent: 4800,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ];
  }

  private async generateSeedPomodoroLogs(yearMonth: string, seedEntries: CalendarEntry[]): Promise<void> {
    const path = this.getPomodoroLogFilePath(yearMonth);
    const now = new Date();
    const todayStr = now.toISOString().substring(0, 10);
    
    const logs: PomodoroLogSession[] = [
      {
        id: 'log-1',
        taskId: seedEntries[3].id,
        taskTitle: seedEntries[3].title,
        type: 'work',
        durationSeconds: 2400,
        completedAt: Date.now() - 86400000,
        date: todayStr
      },
      {
        id: 'log-2',
        taskId: seedEntries[3].id,
        taskTitle: seedEntries[3].title,
        type: 'work',
        durationSeconds: 2400,
        completedAt: Date.now() - 82800000,
        date: todayStr
      },
      {
        id: 'log-3',
        taskId: seedEntries[4].id,
        taskTitle: seedEntries[4].title,
        type: 'work',
        durationSeconds: 2400,
        completedAt: Date.now() - 43200000,
        date: todayStr
      },
      {
        id: 'log-4',
        taskId: seedEntries[4].id,
        taskTitle: seedEntries[4].title,
        type: 'work',
        durationSeconds: 2400,
        completedAt: Date.now() - 39600000,
        date: todayStr
      },
      {
        id: 'log-5',
        taskId: seedEntries[4].id,
        taskTitle: seedEntries[4].title,
        type: 'work',
        durationSeconds: 2400,
        completedAt: Date.now() - 36000000,
        date: todayStr
      }
    ];

    this.isLocalSaving = true;
    await this.app.vault.adapter.write(path, JSON.stringify(logs, null, 2));
    setTimeout(() => { this.isLocalSaving = false; }, 500);
  }
}
