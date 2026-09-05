import { App, Modal, Setting } from 'obsidian';
import { TimeWindow } from '../types';

export class TimeWindowModal extends Modal {
  private windowData: Partial<TimeWindow>;
  private isNew: boolean;
  private onSave: (window: TimeWindow) => Promise<void>;
  private onDelete?: (windowId: string) => Promise<void>;

  constructor(
    app: App,
    windowData: Partial<TimeWindow> | null,
    onSave: (window: TimeWindow) => Promise<void>,
    onDelete?: (windowId: string) => Promise<void>
  ) {
    super(app);
    this.isNew = !windowData || !windowData.id;
    this.windowData = windowData ? { ...windowData } : {};
    this.onSave = onSave;
    this.onDelete = onDelete;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('fcp-window-modal');

    contentEl.createEl('h2', { text: this.isNew ? 'NEW TIME WINDOW' : 'EDIT TIME WINDOW' });

    let titleVal = this.windowData.title || '';
    let startDateVal = this.windowData.startDate || new Date().toISOString().substring(0, 10);
    let endDateVal = this.windowData.endDate || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().substring(0, 10);
    let colorVal = this.windowData.color || 'indigo';
    let descVal = this.windowData.description || '';

    new Setting(contentEl)
      .setName('Title')
      .setDesc('e.g. "Third Year Lessons", "First Exam Session"')
      .addText(text => text
        .setPlaceholder('Window title...')
        .setValue(titleVal)
        .onChange(v => { titleVal = v; }));

    new Setting(contentEl)
      .setName('Start Date')
      .setDesc('Beginning of this time period (YYYY-MM-DD)')
      .addText(text => {
        text.inputEl.type = 'date';
        text.setValue(startDateVal);
        text.onChange(v => { startDateVal = v; });
      });

    new Setting(contentEl)
      .setName('End Date')
      .setDesc('End of this time period (YYYY-MM-DD)')
      .addText(text => {
        text.inputEl.type = 'date';
        text.setValue(endDateVal);
        text.onChange(v => { endDateVal = v; });
      });

    new Setting(contentEl)
      .setName('Color Accent')
      .setDesc('Visual color theme for this window banner.')
      .addDropdown(drop => drop
        .addOption('indigo', 'Indigo')
        .addOption('emerald', 'Emerald')
        .addOption('amber', 'Amber / Gold')
        .addOption('rose', 'Rose')
        .addOption('cyan', 'Cyan')
        .addOption('purple', 'Purple')
        .setValue(colorVal)
        .onChange(v => { colorVal = v; }));

    new Setting(contentEl)
      .setName('Description / Notes')
      .setDesc('Optional notes or syllabus details.')
      .addTextArea(text => {
        text.setPlaceholder('Enter details...')
          .setValue(descVal)
          .onChange(v => { descVal = v; });
        text.inputEl.rows = 3;
        text.inputEl.style.width = '100%';
        text.inputEl.style.resize = 'vertical';
      });

    const buttonRow = contentEl.createDiv('fcp-modal-button-row');

    if (!this.isNew && this.onDelete && this.windowData.id) {
      const deleteBtn = buttonRow.createEl('button', {
        cls: 'mod-warning fcp-modal-delete-btn',
        text: 'DELETE WINDOW'
      });
      deleteBtn.onclick = async () => {
        const id = this.windowData.id!;
        this.close();
        await this.onDelete!(id);
      };
    } else {
      buttonRow.createDiv(); // spacer
    }

    const rightBtns = buttonRow.createDiv('fcp-modal-right-btns');

    const cancelBtn = rightBtns.createEl('button', { text: 'CANCEL' });
    cancelBtn.onclick = () => {
      this.close();
    };

    const saveBtn = rightBtns.createEl('button', {
      cls: 'mod-cta',
      text: 'SAVE WINDOW'
    });
    saveBtn.onclick = async () => {
      if (!titleVal.trim()) {
        titleVal = 'Untitled Window';
      }
      if (startDateVal > endDateVal) {
        // Swap if start is after end
        const temp = startDateVal;
        startDateVal = endDateVal;
        endDateVal = temp;
      }

      const updatedWindow: TimeWindow = {
        id: this.windowData.id || `window-${Date.now()}`,
        title: titleVal.trim(),
        startDate: startDateVal,
        endDate: endDateVal,
        color: colorVal,
        description: descVal.trim() || undefined,
        createdAt: this.windowData.createdAt || Date.now(),
        updatedAt: Date.now()
      };

      this.close();
      await this.onSave(updatedWindow);
    };
  }

  onClose() {
    this.contentEl.empty();
  }
}
