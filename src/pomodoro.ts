import { Notice } from 'obsidian';
import { CalendarEntry, PomodoroLogSession, FocusCalendarSettings } from './types';

export type PomodoroMode = 'work' | 'break';

export interface PomodoroState {
  mode: PomodoroMode;
  isRunning: boolean;
  timeLeftSeconds: number;
  totalDurationSeconds: number;
  focusedTask: CalendarEntry | null;
}

export class PomodoroManager {
  private mode: PomodoroMode = 'work';
  private isRunning: boolean = false;
  private timeLeftSeconds: number = 40 * 60;
  private totalDurationSeconds: number = 40 * 60;
  private timerId: number | null = null;
  private focusedTask: CalendarEntry | null = null;
  private settingsGetter: () => FocusCalendarSettings;
  private onStateChange: (state: PomodoroState) => void;
  private onSessionComplete: (session: PomodoroLogSession) => void;
  private playAudioCallback?: (filePath: string) => void;
  private onBreakStartCallback?: () => void;

  constructor(
    settingsGetter: () => FocusCalendarSettings,
    onStateChange: (state: PomodoroState) => void,
    onSessionComplete: (session: PomodoroLogSession) => void,
    playAudioCallback?: (filePath: string) => void,
    onBreakStartCallback?: () => void
  ) {
    this.settingsGetter = settingsGetter;
    this.onStateChange = onStateChange;
    this.onSessionComplete = onSessionComplete;
    this.playAudioCallback = playAudioCallback;
    this.onBreakStartCallback = onBreakStartCallback;
    this.resetTimer();
  }

  public getSettings() {
    return this.settingsGetter();
  }

  public getState(): PomodoroState {
    return {
      mode: this.mode,
      isRunning: this.isRunning,
      timeLeftSeconds: this.timeLeftSeconds,
      totalDurationSeconds: this.totalDurationSeconds,
      focusedTask: this.focusedTask
    };
  }

  public setFocusedTask(task: CalendarEntry | null) {
    this.focusedTask = task;
    this.notifyState();
  }

  public getFocusedTask(): CalendarEntry | null {
    return this.focusedTask;
  }

  public start(): boolean {
    if (this.isRunning) return true;
    if (this.mode === 'work' && !this.focusedTask) {
      new Notice('⚠️ Select a task from the calendar before starting the Pomodoro timer!', 4000);
      return false;
    }
    this.isRunning = true;
    this.timerId = window.setInterval(() => this.tick(), 1000);
    this.notifyState();
    return true;
  }

  public pause() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.notifyState();
  }

  public togglePlayPause() {
    if (this.isRunning) {
      this.pause();
    } else {
      this.start();
    }
  }

  public resetTimer() {
    this.pause();
    const settings = this.settingsGetter();
    if (this.mode === 'work') {
      this.totalDurationSeconds = (settings.workDurationMinutes || 40) * 60;
    } else {
      this.totalDurationSeconds = (settings.breakDurationMinutes || 10) * 60;
    }
    this.timeLeftSeconds = this.totalDurationSeconds;
    this.notifyState();
  }

  public switchMode(newMode?: PomodoroMode) {
    this.pause();
    this.mode = newMode || (this.mode === 'work' ? 'break' : 'work');
    if (this.mode === 'break' && this.onBreakStartCallback) {
      this.onBreakStartCallback();
    }
    this.resetTimer();
  }

  private tick() {
    if (this.timeLeftSeconds > 0) {
      this.timeLeftSeconds--;
      this.notifyState();
    } else {
      this.onCompleted();
    }
  }

  private onCompleted() {
    this.pause();
    const settings = this.settingsGetter();
    const today = new Date().toISOString().substring(0, 10);
    
    const session: PomodoroLogSession = {
      id: 'session-' + Date.now(),
      taskId: this.focusedTask ? this.focusedTask.id : undefined,
      taskTitle: this.focusedTask ? this.focusedTask.title : undefined,
      type: this.mode,
      durationSeconds: this.totalDurationSeconds,
      completedAt: Date.now(),
      date: today
    };

    this.onSessionComplete(session);

    // Play vault MP3 audio ONLY if explicitly specified in plugin settings
    if (settings.soundFilePath && settings.soundFilePath.trim() !== '') {
      if (this.playAudioCallback) {
        this.playAudioCallback(settings.soundFilePath.trim());
      }
    }

    this.mode = this.mode === 'work' ? 'break' : 'work';
    if (this.mode === 'break' && this.onBreakStartCallback) {
      this.onBreakStartCallback();
    }
    this.resetTimer();
    if (settings.autoStartBreak && this.mode === 'break') {
      this.start();
    }
  }

  public notifySettingsUpdated() {
    if (!this.isRunning) {
      this.resetTimer();
    }
  }

  private notifyState() {
    this.onStateChange(this.getState());
  }
}
