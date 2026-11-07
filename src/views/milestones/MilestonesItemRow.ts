import { Menu, setIcon } from 'obsidian';
import { MilestoneCategory, MilestoneItem } from '../../types';
import { enableInlineEdit } from '../common/InlineEdit';
import { MilestonesSubItemsList } from './MilestonesSubItemsList';

export interface MilestonesItemCallbacks {
  onSave: () => Promise<void>;
  onRefresh: () => void;
  rootContainer: HTMLElement;
}

export class MilestonesItemRow {
  public static render(
    container: HTMLElement,
    cat: MilestoneCategory,
    item: MilestoneItem,
    callbacks: MilestonesItemCallbacks
  ): void {
    const itemBlock = container.createDiv(`fcp-ms-item-block status-${item.status}`);
    itemBlock.dataset.id = item.id;

    const itemRow = itemBlock.createDiv('fcp-ms-item-row');

    // Checkbox / Status Icon Button
    const checkBtn = itemRow.createSpan(`fcp-ms-check-btn status-${item.status}`);
    if (item.status === 'done') {
      setIcon(checkBtn, 'check');
      checkBtn.title = 'Completed (click to toggle, right-click to skip)';
    } else if (item.status === 'skipped') {
      checkBtn.innerHTML = `<span class="fcp-ms-skipped-dot">🟣</span>`;
      checkBtn.title = 'Skipped / Low-Yield (Counts towards progress. Right-click to change)';
    } else {
      checkBtn.innerHTML = `<span class="fcp-ms-todo-dot"></span>`;
      checkBtn.title = 'To Do (click to complete, right-click to skip)';
    }

    // Toggle on Left Click
    checkBtn.onclick = async (e) => {
      e.stopPropagation();
      item.status = item.status === 'done' ? 'todo' : 'done';
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
          .setChecked(item.status === 'done')
          .onClick(async () => {
            item.status = 'done';
            await callbacks.onSave();
            callbacks.onRefresh();
          })
      );

      menu.addItem((i) =>
        i
          .setTitle('Mark as Skipped (🟣 Counts towards progress)')
          .setIcon('circle-slash')
          .setChecked(item.status === 'skipped')
          .onClick(async () => {
            item.status = 'skipped';
            await callbacks.onSave();
            callbacks.onRefresh();
          })
      );

      menu.addItem((i) =>
        i
          .setTitle('Mark as To Do (○)')
          .setIcon('circle')
          .setChecked(item.status === 'todo')
          .onClick(async () => {
            item.status = 'todo';
            await callbacks.onSave();
            callbacks.onRefresh();
          })
      );

      menu.addSeparator();

      menu.addItem((i) =>
        i
          .setTitle('Add list item')
          .setIcon('plus')
          .onClick(() => {
            MilestonesSubItemsList.addSubItem(item, callbacks, callbacks.rootContainer);
          })
      );

      menu.addItem((i) =>
        i
          .setTitle('Delete Milestone')
          .setIcon('trash-2')
          .onClick(async () => {
            cat.items = cat.items.filter((i) => i.id !== item.id);
            await callbacks.onSave();
            callbacks.onRefresh();
          })
      );

      menu.showAtMouseEvent(e);
    };

    itemRow.oncontextmenu = openMenu;
    checkBtn.oncontextmenu = openMenu;

    // Milestone Title (Click to edit inline)
    const titleEl = itemRow.createSpan('fcp-ms-item-title');
    titleEl.textContent = item.title;
    titleEl.title = 'Click to edit title (Right-click for options)';
    titleEl.onclick = (e) => {
      e.stopPropagation();
      enableInlineEdit(titleEl, item.title, async (newTitle) => {
        item.title = newTitle;
        await callbacks.onSave();
        callbacks.onRefresh();
      });
    };

    // Hover action buttons
    const itemActions = itemRow.createDiv('fcp-ms-item-actions');

    const addSubBtn = itemActions.createSpan('fcp-ms-icon-action');
    addSubBtn.title = 'Add list item';
    setIcon(addSubBtn, 'plus');
    addSubBtn.onclick = (e) => {
      e.stopPropagation();
      MilestonesSubItemsList.addSubItem(item, callbacks, callbacks.rootContainer);
    };

    const delItemBtn = itemActions.createSpan('fcp-ms-icon-action fcp-ms-action-danger');
    delItemBtn.title = 'Delete milestone';
    setIcon(delItemBtn, 'trash-2');
    delItemBtn.onclick = async (e) => {
      e.stopPropagation();
      cat.items = cat.items.filter((i) => i.id !== item.id);
      await callbacks.onSave();
      callbacks.onRefresh();
    };

    // Render list items deeper in the indentation tree
    MilestonesSubItemsList.render(itemBlock, cat, item, callbacks);
  }
}
