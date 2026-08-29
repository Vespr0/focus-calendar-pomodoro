import { Plugin, WorkspaceLeaf, TFile, Notice } from 'obsidian';
import { FocusCalendarView, VIEW_TYPE_FOCUS_CALENDAR } from './views/CalendarView';
import { StorageManager } from './storage';
import { PomodoroManager } from './pomodoro';
import { FocusCalendarSettingTab } from './settings';
import { CalendarEntry, FocusCalendarSettings, PomodoroLogSession } from './types';

const DEFAULT_SETTINGS: FocusCalendarSettings = {
  workDurationMinutes: 40,
  breakDurationMinutes: 10,
  dataDirectory: 'calendar-data',
  autoStartBreak: true,
  focusEndSoundPath: '',
  breakEndSoundPath: ''
};

export default class FocusCalendarPlugin extends Plugin {
  settings: FocusCalendarSettings = DEFAULT_SETTINGS;
  storage!: StorageManager;
  pomodoro!: PomodoroManager;
  private statusBarItem: HTMLElement | null = null;
  private isAutoStarted: boolean = false;

  async onload() {
    await this.loadSettings();

    this.storage = new StorageManager(this.app, () => this.settings);

    this.statusBarItem = this.addStatusBarItem();

    this.pomodoro = new PomodoroManager(
      () => this.settings,
      (state) => {
        this.updateStatusBar(state);
        this.app.workspace.getLeavesOfType(VIEW_TYPE_FOCUS_CALENDAR).forEach(leaf => {
          if (leaf.view instanceof FocusCalendarView) {
            leaf.view.updateHeaderStats();
          }
        });
      },
      async (session: PomodoroLogSession) => {
        await this.storage.logPomodoroSession(session);
        this.app.workspace.getLeavesOfType(VIEW_TYPE_FOCUS_CALENDAR).forEach(leaf => {
          if (leaf.view instanceof FocusCalendarView) {
            leaf.view.refreshData().then(() => leaf.view.renderView());
          }
        });
      },
      (filePath: string) => this.playVaultAudio(filePath),
      () => (this.app.workspace as any).trigger('focus-calendar:break-start')
    );

    this.updateStatusBar(this.pomodoro.getState());

    this.registerView(
      VIEW_TYPE_FOCUS_CALENDAR,
      (leaf) => new FocusCalendarView(leaf, this.storage, this.pomodoro)
    );

    this.addRibbonIcon('calendar-clock', 'Calendar & Focus', () => {
      this.activateView();
    });

    this.addCommand({
      id: 'open-focus-calendar-view',
      name: 'Open Calendar & Focus View',
      callback: () => {
        this.activateView();
      }
    });

    this.addSettingTab(new FocusCalendarSettingTab(this.app, this));

    // Register inter-plugin workspace events
    const handleDrillComplete = async (data: any) => {
      // If Pomodoro auto-study session was running, it already logged elapsed time on pause
      if (this.isAutoStarted) {
        this.endAutoStudySession();
        return;
      }
      const today = new Date().toISOString().substring(0, 10);
      await this.storage.logPomodoroSession({
        id: 'drill-' + Date.now(),
        taskId: 'focus-drills',
        taskTitle: 'Drills',
        type: 'work',
        durationSeconds: data.timeSec || 0,
        completedAt: Date.now(),
        date: today
      });
    };

    const handleReviewComplete = async (data: any) => {
      if (this.isAutoStarted) {
        this.endAutoStudySession();
        return;
      }
      const today = new Date().toISOString().substring(0, 10);
      await this.storage.logPomodoroSession({
        id: 'review-' + Date.now(),
        taskId: 'focus-flashcards',
        taskTitle: 'Flashcards',
        type: 'work',
        durationSeconds: data.timeSec || 0,
        completedAt: Date.now(),
        date: today
      });
    };

    this.registerEvent((this.app.workspace as any).on('spaced-repetition:drill-complete', handleDrillComplete));
    this.registerEvent((this.app.workspace as any).on('spaced-repetition:review-complete', handleReviewComplete));

    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (this.storage && this.storage.isLocalSaving) return;
        if (file.path.startsWith(this.settings.dataDirectory) && file.path.endsWith('.json')) {
          this.app.workspace.getLeavesOfType(VIEW_TYPE_FOCUS_CALENDAR).forEach(leaf => {
            if (leaf.view instanceof FocusCalendarView) {
              leaf.view.refreshData().then(() => leaf.view.renderView());
            }
          });
        }
      })
    );
  }

  private updateStatusBar(state: any) {
    if (!this.statusBarItem) return;
    const mins = Math.floor(state.timeLeftSeconds / 60);
    const secs = state.timeLeftSeconds % 60;
    const timeFormatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    const taskTitle = state.focusedTask ? state.focusedTask.title : (state.mode === 'work' ? 'WORK' : 'BREAK');
    const statusIcon = state.isRunning ? '⏱️' : '⏸️';

    this.statusBarItem.setText(`${statusIcon} ${timeFormatted} [${taskTitle}]`);
  }

  public startAutoFlashcardSession(): boolean {
    const today = new Date().toISOString().substring(0, 10);
    this.pomodoro.setFocusedTask({
      id: 'focus-flashcards',
      title: 'Flashcards',
      startTime: '00:00',
      endTime: '00:00',
      date: today,
      type: 'task',
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    this.isAutoStarted = true;
    if (!this.pomodoro.getIsRunning()) {
      this.pomodoro.start();
    }
    return true;
  }

  public startAutoDrillSession(): boolean {
    const today = new Date().toISOString().substring(0, 10);
    // If there is already a focused task, keep it so pomodoro drains into it without changing name!
    if (!this.pomodoro.getFocusedTask()) {
      this.pomodoro.setFocusedTask({
        id: 'focus-drills',
        title: 'Drills',
        startTime: '00:00',
        endTime: '00:00',
        date: today,
        type: 'task',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }

    this.isAutoStarted = true;
    if (!this.pomodoro.getIsRunning()) {
      this.pomodoro.start();
    }
    return true;
  }

  public startAutoStudySession(title: string): boolean {
    const lower = (title || '').toLowerCase();
    if (lower.includes('flashcard')) {
      return this.startAutoFlashcardSession();
    }
    if (lower.includes('drill')) {
      return this.startAutoDrillSession();
    }

    const today = new Date().toISOString().substring(0, 10);
    this.pomodoro.setFocusedTask({
      id: 'auto-' + Date.now(),
      title,
      startTime: '00:00',
      endTime: '00:00',
      date: today,
      type: 'task',
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    this.isAutoStarted = true;
    if (!this.pomodoro.getIsRunning()) {
      this.pomodoro.start();
    }
    return true;
  }

  public endAutoStudySession() {
    if (this.isAutoStarted) {
      this.pomodoro.pause();
      this.isAutoStarted = false;
    }
  }

  async playVaultAudio(filePath: string, showNoticeOnFail: boolean = false): Promise<boolean> {
    try {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (file instanceof TFile) {
        const resourcePath = this.app.vault.getResourcePath(file);
        const audio = new Audio(resourcePath);
        audio.volume = 0.5;
        await audio.play();
        return true;
      } else {
        const msg = `Focus Calendar: Sound file not found at path: "${filePath}"`;
        console.warn(msg);
        if (showNoticeOnFail) {
          new Notice(`⚠️ ${msg}`, 4000);
        }
        return false;
      }
    } catch (err) {
      console.error('Focus Calendar: Failed to play audio file from vault', err);
      if (showNoticeOnFail) {
        new Notice(`❌ Failed to play audio file: ${filePath}`, 4000);
      }
      return false;
    }
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_FOCUS_CALENDAR);

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getLeaf('tab');
      await leaf.setViewState({
        type: VIEW_TYPE_FOCUS_CALENDAR,
        active: true
      });
    }

    workspace.revealLeaf(leaf);
  }

  onunload() {
    this.pomodoro.pause();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
