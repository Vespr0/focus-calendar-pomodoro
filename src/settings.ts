import { App, PluginSettingTab, Setting } from 'obsidian';
import FocusCalendarPlugin from './main';

export class FocusCalendarSettingTab extends PluginSettingTab {
  plugin: FocusCalendarPlugin;

  constructor(app: App, plugin: FocusCalendarPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Focus Calendar & Pomodoro Settings' });

    new Setting(containerEl)
      .setName('Work Duration (minutes)')
      .setDesc('Length of work pomodoro sessions in minutes.')
      .addText(text => text
        .setPlaceholder('40')
        .setValue(this.plugin.settings.workDurationMinutes.toString())
        .onChange(async (value) => {
          const val = parseInt(value, 10);
          if (!isNaN(val) && val > 0) {
            this.plugin.settings.workDurationMinutes = val;
            await this.plugin.saveSettings();
            this.plugin.pomodoro.notifySettingsUpdated();
          }
        }));

    new Setting(containerEl)
      .setName('Break Duration (minutes)')
      .setDesc('Length of break pomodoro sessions in minutes.')
      .addText(text => text
        .setPlaceholder('10')
        .setValue(this.plugin.settings.breakDurationMinutes.toString())
        .onChange(async (value) => {
          const val = parseInt(value, 10);
          if (!isNaN(val) && val > 0) {
            this.plugin.settings.breakDurationMinutes = val;
            await this.plugin.saveSettings();
            this.plugin.pomodoro.notifySettingsUpdated();
          }
        }));

    new Setting(containerEl)
      .setName('Completion Alarm Sound (Vault MP3 Path)')
      .setDesc('Path to an MP3 file in your vault (e.g. Sounds/bell.mp3). Leave blank for no sound.')
      .addText(text => text
        .setPlaceholder('Sounds/bell.mp3')
        .setValue(this.plugin.settings.soundFilePath || '')
        .onChange(async (value) => {
          this.plugin.settings.soundFilePath = value.trim();
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Data Storage Directory')
      .setDesc('Folder path in your vault where calendar JSON data files are saved.')
      .addText(text => text
        .setPlaceholder('CalendarData')
        .setValue(this.plugin.settings.dataDirectory)
        .onChange(async (value) => {
          this.plugin.settings.dataDirectory = value.trim() || 'CalendarData';
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Auto-Start Break')
      .setDesc('Automatically start break timer when a work pomodoro session completes.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoStartBreak)
        .onChange(async (value) => {
          this.plugin.settings.autoStartBreak = value;
          await this.plugin.saveSettings();
        }));
  }
}
