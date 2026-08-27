export type EntryType = 'task' | 'event';

export interface CalendarEntry {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm (24h format, e.g. "09:30")
  endTime: string;   // HH:mm (24h format, e.g. "10:30")
  type: EntryType;   // 'task' (pastel blue) or 'event' (green)
  actualSecondsSpent?: number; // Accumulated actual pomodoro focus time in seconds
  createdAt: number;
  updatedAt: number;
}

export interface DayData {
  date: string; // YYYY-MM-DD
  entries: CalendarEntry[];
}

export interface PomodoroLogSession {
  id: string;
  taskId?: string;
  taskTitle?: string;
  type: 'work' | 'break';
  durationSeconds: number; // e.g. 2400 for 40 min work
  completedAt: number; // timestamp
  date: string; // YYYY-MM-DD
}

export interface FocusCalendarSettings {
  workDurationMinutes: number; // default 40
  breakDurationMinutes: number; // default 10
  dataDirectory: string; // default "CalendarData"
  autoStartBreak: boolean;
  soundFilePath: string; // Vault relative path to MP3, e.g. "" (disabled by default)
}

export const DEFAULT_SETTINGS: FocusCalendarSettings = {
  workDurationMinutes: 40,
  breakDurationMinutes: 10,
  dataDirectory: 'CalendarData',
  autoStartBreak: false,
  soundFilePath: ''
};

export type ViewMode = 'month' | 'week';

export interface ImminentEventInfo {
  title: string;
  daysAway: number;
}
