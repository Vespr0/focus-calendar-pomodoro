import { setIcon } from 'obsidian';
import { MilestoneCategory, MilestoneItem, MilestoneSubItem } from '../../types';
import { enableInlineEdit } from '../common/InlineEdit';

export interface MilestonesSubItemsCallbacks {
  onSave: () => Promise<void>;
  onRefresh: () => void;
}

export class MilestonesSubItemsList {
  public static render(
    container: HTMLElement,
    cat: MilestoneCategory,
    item: MilestoneItem,
    callbacks: MilestonesSubItemsCallbacks
  ): void {
    const subItems = item.subItems || item.comments || [];
    if (subItems.length === 0) return;

    const subItemsContainer = container.createDiv('fcp-ms-subitems-container');

    subItems.forEach((subItem) => {
      const row = subItemsContainer.createDiv('fcp-ms-subitem-row');

      const bullet = row.createSpan('fcp-ms-subitem-bullet');
      bullet.textContent = '•';

      const textEl = row.createSpan('fcp-ms-subitem-text');
      textEl.textContent = subItem.text;
      textEl.title = 'Click to edit';

      textEl.onclick = (e) => {
        e.stopPropagation();
        enableInlineEdit(textEl, subItem.text, async (newText) => {
          subItem.text = newText;
          await callbacks.onSave();
          callbacks.onRefresh();
        });
      };

      const delBtn = row.createSpan('fcp-ms-icon-action fcp-ms-del-subitem');
      delBtn.title = 'Delete';
      setIcon(delBtn, 'x');
      delBtn.onclick = async (e) => {
        e.stopPropagation();
        const updated = (item.subItems || item.comments || []).filter((s) => s.id !== subItem.id);
        item.subItems = updated;
        item.comments = updated;
        await callbacks.onSave();
        callbacks.onRefresh();
      };
    });
  }

  public static addSubItem(
    item: MilestoneItem,
    callbacks: MilestonesSubItemsCallbacks,
    containerEl: HTMLElement
  ): void {
    if (!item.subItems) {
      item.subItems = item.comments ? [...item.comments] : [];
    }
    const newSub: MilestoneSubItem = {
      id: 'sub-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      text: 'New item',
      createdAt: Date.now()
    };
    item.subItems.push(newSub);
    item.comments = item.subItems; // keep sync

    callbacks.onSave().then(() => {
      callbacks.onRefresh();
      setTimeout(() => {
        const itemBlock = containerEl.querySelector(`.fcp-ms-item-block[data-id="${item.id}"]`);
        if (itemBlock) {
          const lastText = itemBlock.querySelector('.fcp-ms-subitem-row:last-child .fcp-ms-subitem-text') as HTMLElement;
          if (lastText) lastText.click();
        }
      }, 0);
    });
  }
}

