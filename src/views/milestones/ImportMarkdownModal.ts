import { App, Modal, Notice } from 'obsidian';

export class ImportMarkdownModal extends Modal {
  private onImport: (content: string) => Promise<void>;

  constructor(app: App, onImport: (content: string) => Promise<void>) {
    super(app);
    this.onImport = onImport;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('fcp-import-modal');

    contentEl.createEl('h2', { text: 'IMPORT CHECKPOINTS MARKDOWN' });
    contentEl.createEl('p', {
      text: 'Paste the markdown contents of your Checkpoint file (e.g. 2026-11-30.md) to generate categories, milestones, and notes automatically.',
      cls: 'fcp-modal-desc'
    });

    const textarea = contentEl.createEl('textarea', {
      cls: 'fcp-import-textarea',
      placeholder: '### Category Name\n- Cap 8 (RISC-V Instructions)\n- 🟣 Cap 13 (Recursion)\n    - 💬 Note under milestone...'
    });
    textarea.rows = 14;

    const btnRow = contentEl.createDiv('fcp-modal-button-row');
    const cancelBtn = btnRow.createEl('button', { text: 'CANCEL' });
    cancelBtn.onclick = () => this.close();

    const importBtn = btnRow.createEl('button', {
      cls: 'fcp-btn-primary',
      text: 'IMPORT'
    });

    importBtn.onclick = async () => {
      const val = textarea.value.trim();
      if (!val) {
        new Notice('Please paste checkpoint markdown content.');
        return;
      }
      await this.onImport(val);
      this.close();
    };
  }

  onClose() {
    this.contentEl.empty();
  }
}

