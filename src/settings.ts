import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
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

    containerEl.createEl('h2', { text: 'Calendar & Focus Settings' });

    // --- Pomodoro Durations ---
    containerEl.createEl('h3', { text: 'Pomodoro Timer' });

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
      .setName('Auto-Start Break')
      .setDesc('Automatically start break timer when a work pomodoro session completes.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoStartBreak)
        .onChange(async (value) => {
          this.plugin.settings.autoStartBreak = value;
          await this.plugin.saveSettings();
        }));

    // --- Sound Notifications ---
    containerEl.createEl('h3', { text: 'Audio Notifications' });

    // Focus / Work End Sound
    const focusSoundSetting = new Setting(containerEl)
      .setName('Focus Completed Sound (Vault MP3 Path)')
      .setDesc('Audio file in your vault played when focus/work time ends and break starts (e.g. Sounds/bell.mp3). Leave blank for no sound.')
      .addText(text => text
        .setPlaceholder('Sounds/bell.mp3')
        .setValue(this.plugin.settings.focusEndSoundPath || '')
        .onChange(async (value) => {
          this.plugin.settings.focusEndSoundPath = value.trim();
          await this.plugin.saveSettings();
        }))
      .addButton(button => button
        .setButtonText('🔊 Test')
        .setTooltip('Play preview of the Focus completion sound')
        .onClick(async () => {
          const path = (this.plugin.settings.focusEndSoundPath || '').trim();
          if (!path) {
            new Notice('⚠️ No sound file path specified.');
            return;
          }
          const ok = await this.plugin.playVaultAudio(path, true);
          if (ok) {
            new Notice(`▶️ Playing: ${path}`);
          }
        }));

    // Break End Sound
    const breakSoundSetting = new Setting(containerEl)
      .setName('Break Completed Sound (Vault MP3 Path)')
      .setDesc('Audio file in your vault played when break time ends and focus starts (e.g. Sounds/chime.mp3). Leave blank for no sound.')
      .addText(text => text
        .setPlaceholder('Sounds/chime.mp3')
        .setValue(this.plugin.settings.breakEndSoundPath || '')
        .onChange(async (value) => {
          this.plugin.settings.breakEndSoundPath = value.trim();
          await this.plugin.saveSettings();
        }))
      .addButton(button => button
        .setButtonText('🔊 Test')
        .setTooltip('Play preview of the Break completion sound')
        .onClick(async () => {
          const path = (this.plugin.settings.breakEndSoundPath || '').trim();
          if (!path) {
            new Notice('⚠️ No sound file path specified.');
            return;
          }
          const ok = await this.plugin.playVaultAudio(path, true);
          if (ok) {
            new Notice(`▶️ Playing: ${path}`);
          }
        }));

    // --- Storage ---
    containerEl.createEl('h3', { text: 'Storage' });

    new Setting(containerEl)
      .setName('Data Storage Directory')
      .setDesc('Folder path in your vault where calendar JSON data files are saved.')
      .addText(text => text
        .setPlaceholder('calendar-data')
        .setValue(this.plugin.settings.dataDirectory)
        .onChange(async (value) => {
          this.plugin.settings.dataDirectory = value.trim() || 'calendar-data';
          await this.plugin.saveSettings();
        }));
  }
}
