export type EntryType = 'task' | 'event' | 'crucial';

export interface CalendarEntry {
  id: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:mm or empty for all-day
  endTime?: string;   // HH:mm or empty for all-day
  allDay?: boolean;   // true if untimed / all-day
  type: EntryType;    // 'task' | 'event' | 'crucial'
  windowId?: string;  // Explicitly assigned time window
  createdAt: number;
  updatedAt: number;
}

export interface TimeWindow {
  id: string;
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  color?: string;    // 'indigo' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'purple' or custom hex
  description?: string;
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
  dataDirectory: string; // default "calendar-data"
  autoStartBreak: boolean;
  focusEndSoundPath: string; // Vault relative path to MP3 when focus ends (e.g. "Sounds/bell.mp3")
  breakEndSoundPath: string; // Vault relative path to MP3 when break ends (e.g. "Sounds/chime.mp3")
}

export const DEFAULT_SETTINGS: FocusCalendarSettings = {
  workDurationMinutes: 40,
  breakDurationMinutes: 10,
  dataDirectory: 'calendar-data',
  autoStartBreak: false,
  focusEndSoundPath: '',
  breakEndSoundPath: ''
};

export type ViewMode = 'month' | 'week' | 'timeline';

export interface ImminentEventInfo {
  title: string;
  daysAway: number;
}
