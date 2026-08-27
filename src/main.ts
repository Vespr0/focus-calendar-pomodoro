import { Plugin, WorkspaceLeaf } from 'obsidian';
import { FocusCalendarSettings, DEFAULT_SETTINGS, PomodoroLogSession } from './types';
import { StorageManager } from './storage';
import { PomodoroManager } from './pomodoro';
import { FocusCalendarView, VIEW_TYPE_FOCUS_CALENDAR } from './views/CalendarView';
import { FocusCalendarSettingTab } from './settings';

export default class FocusCalendarPlugin extends Plugin {
  settings: FocusCalendarSettings = DEFAULT_SETTINGS;
  storage!: StorageManager;
  pomodoro!: PomodoroManager;

  async onload() {
    await this.loadSettings();

    this.storage = new StorageManager(this.app, () => this.settings);

    this.pomodoro = new PomodoroManager(
      () => this.settings,
      (state) => {
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
      }
    );

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

    this.registerEvent(
      this.app.vault.on('modify', (file) => {
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
