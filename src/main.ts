import { Plugin, WorkspaceLeaf, TFile } from 'obsidian';
import { FocusCalendarSettings, DEFAULT_SETTINGS, PomodoroLogSession } from './types';
import { StorageManager } from './storage';
import { PomodoroManager } from './pomodoro';
import { FocusCalendarView, VIEW_TYPE_FOCUS_CALENDAR } from './views/CalendarView';
import { FocusCalendarSettingTab } from './settings';

export default class FocusCalendarPlugin extends Plugin {
  settings: FocusCalendarSettings = DEFAULT_SETTINGS;
  storage!: StorageManager;
  pomodoro!: PomodoroManager;
  statusBarItem!: HTMLElement;
  private isAutoStarted: boolean = false;

  async onload() {
    await this.loadSettings();

    this.storage = new StorageManager(this.app, () => this.settings);
    this.statusBarItem = this.addStatusBarItem();
    this.statusBarItem.addClass('focus-calendar-status-bar');
    this.statusBarItem.style.cursor = 'pointer';
    this.statusBarItem.addEventListener('click', () => {
      this.pomodoro.togglePlayPause();
    });

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

    this.addRibbonIcon('calendar-clock', 'Open Focus Calendar & Pomodoro', () => {
      this.activateView();
    });

    this.addCommand({
      id: 'open-focus-calendar-view',
      name: 'Open Focus Calendar & Pomodoro View',
      callback: () => {
        this.activateView();
      }
    });

    this.addSettingTab(new FocusCalendarSettingTab(this.app, this));

    // Register inter-plugin workspace events
    this.registerEvent(
      (this.app.workspace as any).on('omnirecall:drill-complete', async (data: any) => {
        const today = new Date().toISOString().substring(0, 10);
        await this.storage.logPomodoroSession({
          id: 'drill-' + Date.now(),
          taskTitle: `[Drill] ${data.title || 'Exercise'}`,
          type: 'work',
          durationSeconds: data.timeSec || 0,
          completedAt: Date.now(),
          date: today
        });
      })
    );

    this.registerEvent(
      (this.app.workspace as any).on('omnirecall:review-complete', async (data: any) => {
        const today = new Date().toISOString().substring(0, 10);
        await this.storage.logPomodoroSession({
          id: 'review-' + Date.now(),
          taskTitle: `[Flashcards] ${data.title || 'Review Queue'}`,
          type: 'work',
          durationSeconds: data.timeSec || 0,
          completedAt: Date.now(),
          date: today
        });
      })
    );

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
    const taskTitle = state.focusedTask ? state.focusedTask.title : state.mode.toUpperCase();
    const statusIcon = state.isRunning ? '⏱️' : '⏸️';

    this.statusBarItem.setText(`${statusIcon} ${timeFormatted} [${taskTitle}]`);
  }

  public startAutoStudySession(title: string): boolean {
    const state = this.pomodoro.getState();
    if (state.isRunning) {
      return false; // Already running, passively attach
    }

    const today = new Date().toISOString().substring(0, 10);
    this.pomodoro.setFocusedTask({
      id: 'auto-' + Date.now(),
      title,
      date: today,
      time: new Date().toTimeString().substring(0, 5),
      durationMinutes: 40,
      category: 'Study',
      completed: false
    });

    this.isAutoStarted = true;
    this.pomodoro.start();
    return true;
  }

  public endAutoStudySession() {
    if (this.isAutoStarted) {
      this.pomodoro.pause();
      this.isAutoStarted = false;
    }
  }

  async playVaultAudio(filePath: string) {
    try {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (file instanceof TFile) {
        const resourcePath = this.app.vault.getResourcePath(file);
        const audio = new Audio(resourcePath);
        await audio.play();
      } else {
        console.warn(`Focus Calendar: Sound file not found at path: ${filePath}`);
      }
    } catch (err) {
      console.error('Focus Calendar: Failed to play audio file from vault', err);
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
