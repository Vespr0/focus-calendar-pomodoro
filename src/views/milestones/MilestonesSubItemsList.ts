import { Menu, setIcon } from 'obsidian';
import { MilestoneCategory, MilestoneItem, MilestoneSubItem, MilestoneStatus } from '../../types';
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
      const status: MilestoneStatus = subItem.status || 'todo';
      const row = subItemsContainer.createDiv(`fcp-ms-subitem-row status-${status}`);
      row.dataset.id = subItem.id;

      // Status check / bullet button
      const checkBtn = row.createSpan(`fcp-ms-subitem-check status-${status}`);
      if (status === 'done') {
        setIcon(checkBtn, 'check');
        checkBtn.title = 'Completed (click to toggle, right-click to skip)';
      } else if (status === 'skipped') {
        checkBtn.innerHTML = `<span class="fcp-ms-skipped-dot">🟣</span>`;
        checkBtn.title = 'Skipped (Counts towards progress. Right-click to change)';
      } else {
        checkBtn.innerHTML = `<span class="fcp-ms-subitem-dot"></span>`;
        checkBtn.title = 'To Do (click to complete, right-click to skip)';
      }

      // Left-click toggle
      checkBtn.onclick = async (e) => {
        e.stopPropagation();
        subItem.status = status === 'done' ? 'todo' : 'done';
        await callbacks.onSave();
        callbacks.onRefresh();
      };

      // Right-click context menu
      const openMenu = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const menu = new Menu();

        menu.addItem((i) =>
          i
            .setTitle('Mark as Done (✓)')
            .setIcon('check')
            .setChecked(status === 'done')
            .onClick(async () => {
              subItem.status = 'done';
              await callbacks.onSave();
              callbacks.onRefresh();
            })
        );

        menu.addItem((i) =>
          i
            .setTitle('Mark as Skipped (🟣 Counts towards progress)')
            .setIcon('circle-slash')
            .setChecked(status === 'skipped')
            .onClick(async () => {
              subItem.status = 'skipped';
              await callbacks.onSave();
              callbacks.onRefresh();
            })
        );

        menu.addItem((i) =>
          i
            .setTitle('Mark as To Do (•)')
            .setIcon('circle')
            .setChecked(status === 'todo')
            .onClick(async () => {
              subItem.status = 'todo';
              await callbacks.onSave();
              callbacks.onRefresh();
            })
        );

        menu.addSeparator();

        menu.addItem((i) =>
          i
            .setTitle('Delete List Item')
            .setIcon('trash-2')
            .onClick(async () => {
              const updated = (item.subItems || item.comments || []).filter((s) => s.id !== subItem.id);
              item.subItems = updated;
              item.comments = updated;
              await callbacks.onSave();
              callbacks.onRefresh();
            })
        );

        menu.showAtMouseEvent(e);
      };

      row.oncontextmenu = openMenu;
      checkBtn.oncontextmenu = openMenu;

      const textEl = row.createSpan('fcp-ms-subitem-text');
      textEl.textContent = subItem.text;
      textEl.title = 'Click to edit (Right-click for options)';

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
      status: 'todo',
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
