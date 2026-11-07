import { App, setIcon } from 'obsidian';
import { MilestoneCategory } from '../types';
import { MilestonesCategoryBlock } from './milestones/MilestonesCategoryBlock';

export interface MilestonesViewCallbacks {
  onSave: (categories: MilestoneCategory[]) => Promise<void>;
}

export class MilestonesViewRenderComponent {
  private app: App;
  private containerEl: HTMLElement;
  private currentYear: number;
  private currentMonth: number;
  private categories: MilestoneCategory[];
  private callbacks: MilestonesViewCallbacks;
  private collapsedCategories: Set<string> = new Set();

  constructor(
    app: App,
    containerEl: HTMLElement,
    year: number,
    month: number,
    categories: MilestoneCategory[],
    callbacks: MilestonesViewCallbacks
  ) {
    this.app = app;
    this.containerEl = containerEl;
    this.currentYear = year;
    this.currentMonth = month;
    this.categories = categories || [];
    this.callbacks = callbacks;
    this.render();
  }

  public update(year: number, month: number, categories: MilestoneCategory[]) {
    this.currentYear = year;
    this.currentMonth = month;
    this.categories = categories || [];
    this.render();
  }

  public render() {
    this.containerEl.empty();
    this.containerEl.addClass('fcp-milestones-full-wrapper');

    const catList = this.containerEl.createDiv('fcp-ms-categories-list');

    this.categories.forEach((cat) => {
      MilestonesCategoryBlock.render(catList, cat, {
        onSave: () => this.callbacks.onSave(this.categories),
        onRefresh: () => this.render(),
        onToggleCollapse: (catId) => {
          if (this.collapsedCategories.has(catId)) {
            this.collapsedCategories.delete(catId);
          } else {
            this.collapsedCategories.add(catId);
          }
          this.render();
        },
        onDeleteCategory: async (catId) => {
          this.categories = this.categories.filter((c) => c.id !== catId);
          await this.callbacks.onSave(this.categories);
          this.render();
        },
        isCollapsed: this.collapsedCategories.has(cat.id),
        rootContainer: this.containerEl
      });
    });

    // Add Category placeholder row on an empty line (+ icon)
    this.renderAddCategoryRow(catList);
  }

  private renderAddCategoryRow(parentEl: HTMLElement) {
    const addCatRow = parentEl.createDiv('fcp-ms-add-category-row');
    const addCatIcon = addCatRow.createSpan('fcp-ms-add-icon');
    setIcon(addCatIcon, 'plus');
    const addCatInput = addCatRow.createEl('input', {
      cls: 'fcp-ms-add-input',
      type: 'text',
      placeholder: 'Add category...'
    });

    addCatInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        const val = addCatInput.value.trim();
        if (val) {
          const newCat: MilestoneCategory = {
            id: 'cat-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
            name: val,
            items: []
          };
          this.categories.push(newCat);
          await this.callbacks.onSave(this.categories);
          this.render();
        }
      }
    });

    addCatRow.addEventListener('click', () => {
      addCatInput.focus();
    });
  }
}
