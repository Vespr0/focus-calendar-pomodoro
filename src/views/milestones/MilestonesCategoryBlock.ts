import { setIcon } from 'obsidian';
import { MilestoneCategory, MilestoneItem } from '../../types';
import { enableInlineEdit } from '../common/InlineEdit';
import { createRadialProgressEl } from '../common/RadialProgress';
import { calculateCategoryProgress } from './MilestonesUtils';
import { MilestonesItemRow } from './MilestonesItemRow';

export interface CategoryBlockCallbacks {
  onSave: () => Promise<void>;
  onRefresh: () => void;
  onToggleCollapse: (catId: string) => void;
  onDeleteCategory: (catId: string) => void;
  isCollapsed: boolean;
  rootContainer: HTMLElement;
}

export class MilestonesCategoryBlock {
  public static render(
    container: HTMLElement,
    cat: MilestoneCategory,
    callbacks: CategoryBlockCallbacks
  ): void {
    const isCollapsed = callbacks.isCollapsed;
    const catBlock = container.createDiv(`fcp-ms-category-block ${isCollapsed ? 'is-collapsed' : ''}`);
    catBlock.dataset.id = cat.id;

    const { total, completed, pct } = calculateCategoryProgress(cat);

    // Category Header Line
    const catHeader = catBlock.createDiv('fcp-ms-cat-header');

    // Toggle Collapse Chevron
    const chevronBtn = catHeader.createSpan('fcp-ms-chevron');
    setIcon(chevronBtn, isCollapsed ? 'chevron-right' : 'chevron-down');
    chevronBtn.onclick = (e) => {
      e.stopPropagation();
      callbacks.onToggleCollapse(cat.id);
    };

    // Mini Radial Progress SVG Ring next to category name
    const radialEl = createRadialProgressEl({
      size: 22,
      strokeWidth: 3,
      progressRatio: total > 0 ? completed / total : 0,
      text: `${pct}%`
    });
    radialEl.title = `${completed}/${total} completed (${pct}%)`;
    catHeader.appendChild(radialEl);

    // Category Name (Click to edit inline)
    const nameEl = catHeader.createSpan('fcp-ms-cat-name');
    nameEl.textContent = cat.name;
    nameEl.title = 'Click to edit category name';
    nameEl.onclick = (e) => {
      e.stopPropagation();
      enableInlineEdit(nameEl, cat.name, async (newName) => {
        cat.name = newName;
        await callbacks.onSave();
        callbacks.onRefresh();
      });
    };

    // Action buttons on category header
    const catActions = catHeader.createDiv('fcp-ms-cat-actions');

    const addMsBtn = catActions.createSpan('fcp-ms-icon-action');
    addMsBtn.title = 'Add milestone to this category';
    setIcon(addMsBtn, 'plus');
    addMsBtn.onclick = (e) => {
      e.stopPropagation();
      if (isCollapsed) callbacks.onToggleCollapse(cat.id);
      const itemsContainer = catBlock.querySelector('.fcp-ms-items-container') as HTMLElement;
      if (itemsContainer) {
        const input = itemsContainer.querySelector('.fcp-ms-add-input') as HTMLInputElement;
        if (input) input.focus();
      }
    };

    const delCatBtn = catActions.createSpan('fcp-ms-icon-action fcp-ms-action-danger');
    delCatBtn.title = 'Delete category';
    setIcon(delCatBtn, 'trash-2');
    delCatBtn.onclick = async (e) => {
      e.stopPropagation();
      if (cat.items.length > 0 && !confirm(`Delete category "${cat.name}" and its ${cat.items.length} milestone(s)?`)) {
        return;
      }
      callbacks.onDeleteCategory(cat.id);
    };

    // Milestones Container (Indented with clever spacing)
    if (!isCollapsed) {
      const itemsContainer = catBlock.createDiv('fcp-ms-items-container');

      cat.items.forEach((item) => {
        MilestonesItemRow.render(itemsContainer, cat, item, {
          onSave: callbacks.onSave,
          onRefresh: callbacks.onRefresh,
          rootContainer: callbacks.rootContainer
        });
      });

      // Add Milestone row under category
      const addRow = itemsContainer.createDiv('fcp-ms-add-row');
      const addIcon = addRow.createSpan('fcp-ms-add-icon');
      setIcon(addIcon, 'plus');
      const addInput = addRow.createEl('input', {
        cls: 'fcp-ms-add-input',
        type: 'text',
        placeholder: 'Add milestone...'
      });

      addInput.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
          const val = addInput.value.trim();
          if (val) {
            const newItem: MilestoneItem = {
              id: 'ms-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
              title: val,
              status: 'todo',
              subItems: [],
              comments: [],
              createdAt: Date.now()
            };
            cat.items.push(newItem);
            await callbacks.onSave();
            callbacks.onRefresh();
            // Automatically focus the input in the refreshed view so user can rapid-type!
            setTimeout(() => {
              const freshBlock = callbacks.rootContainer.querySelector(`.fcp-ms-category-block[data-id="${cat.id}"]`);
              if (freshBlock) {
                const freshInput = freshBlock.querySelector('.fcp-ms-add-row .fcp-ms-add-input') as HTMLInputElement;
                if (freshInput) freshInput.focus();
              }
            }, 0);
          }
        }
      });

      addRow.addEventListener('click', () => {
        addInput.focus();
      });
    }
  }
}
