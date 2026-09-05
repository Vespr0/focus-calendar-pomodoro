import { App, Menu, Modal, Setting } from 'obsidian';
import { CalendarEntry, TimeWindow } from '../types';

export interface WeekViewCallbacks {
  onEntryCreate: (date: string, startTime: string, endTime: string) => Promise<CalendarEntry>;
  onEntryUpdate: (entry: CalendarEntry, oldDate?: string) => Promise<void>;
  onEntryDelete: (entry: CalendarEntry) => Promise<void>;
  onTaskFocus: (entry: CalendarEntry) => void;
  getFocusedTaskId: () => string | undefined;
}

export class TaskEditModal extends Modal {
  private entry: CalendarEntry;
  private onSave: (entry: CalendarEntry) => Promise<void>;
  private onDelete: (entry: CalendarEntry) => Promise<void>;
  private windows: TimeWindow[];
  private isActionTaken = false;
  private isNew = false;
  private currentTitleVal = '';

  constructor(
    app: App,
    entry: CalendarEntry,
    onSave: (entry: CalendarEntry) => Promise<void>,
    onDelete: (entry: CalendarEntry) => Promise<void>,
    windows: TimeWindow[] = []
  ) {
    super(app);
    this.entry = entry;
    this.onSave = onSave;
    this.onDelete = onDelete;
    this.windows = windows;
    this.isNew = !entry.title;
    this.currentTitleVal = entry.title || '';
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('fcp-edit-modal');

    contentEl.createEl('h2', { text: this.entry.title ? 'EDIT ENTRY' : 'NEW ENTRY' });

    let titleVal = this.entry.title || '';
    let descVal = this.entry.description || '';
    let typeVal = this.entry.type || 'task';
    let windowIdVal = this.entry.windowId || '';

    new Setting(contentEl)
      .setName('Title')
      .addText(text => text
        .setPlaceholder('Title')
        .setValue(titleVal)
        .onChange(v => {
          titleVal = v;
          this.currentTitleVal = v;
        }));

    new Setting(contentEl)
      .setName('Description')
      .addTextArea(text => {
        text.setPlaceholder('Notes...')
          .setValue(descVal)
          .onChange(v => { descVal = v; });
        text.inputEl.rows = 3;
        text.inputEl.style.width = '100%';
        text.inputEl.style.resize = 'vertical';
      });

    new Setting(contentEl)
      .setName('Type')
      .addDropdown(drop => drop
        .addOption('task', 'Task')
        .addOption('event', 'Event')
        .addOption('crucial', 'Crucial')
        .setValue(typeVal)
        .onChange(v => { typeVal = v as 'task' | 'event' | 'crucial'; }));

    const eligibleWindows = this.windows.filter(w => !this.entry.date || (this.entry.date >= w.startDate && this.entry.date <= w.endDate));
    if (eligibleWindows.length > 0) {
      new Setting(contentEl)
        .setName('Time Window')
        .setDesc('Assign to an aligned window, or leave unassigned.')
        .addDropdown(drop => {
          drop.addOption('none', 'None (Unassigned)');
          eligibleWindows.forEach(w => drop.addOption(w.id, w.title));
          drop.setValue(windowIdVal || 'none');
          drop.onChange(v => { windowIdVal = v; });
        });
    }

    const buttonRow = contentEl.createDiv('fcp-modal-button-row');

    const deleteBtn = buttonRow.createEl('button', {
      cls: 'mod-warning fcp-modal-delete-btn',
      text: 'DELETE'
    });
    deleteBtn.onclick = async () => {
      this.isActionTaken = true;
      this.close();
      await this.onDelete(this.entry);
    };

    const rightBtns = buttonRow.createDiv('fcp-modal-right-btns');

    const cancelBtn = rightBtns.createEl('button', { text: 'CANCEL' });
    cancelBtn.onclick = async () => {
      this.isActionTaken = true;
      this.close();
      if (this.isNew && !this.currentTitleVal.trim()) {
        await this.onDelete(this.entry);
      }
    };

    const saveBtn = rightBtns.createEl('button', {
      cls: 'mod-cta',
      text: 'SAVE'
    });
    saveBtn.onclick = async () => {
      this.isActionTaken = true;
      this.entry.title = titleVal.trim() || 'Untitled';
      this.entry.description = descVal.trim() || undefined;
      this.entry.type = typeVal;
      const targetWin = (windowIdVal && windowIdVal !== 'none') ? this.windows.find(w => w.id === windowIdVal) : undefined;
      this.entry.windowId = (targetWin && this.entry.date >= targetWin.startDate && this.entry.date <= targetWin.endDate) ? targetWin.id : undefined;
      this.close();
      await this.onSave(this.entry);
    };
  }

  onClose() {
    if (this.isNew && !this.isActionTaken && !this.currentTitleVal.trim()) {
      this.onDelete(this.entry);
    }
    this.contentEl.empty();
  }
}

export class WeekViewRenderComponent {
  private app: App;
  private containerEl: HTMLElement;
  private weekStart: Date;
  private entries: CalendarEntry[];
  private callbacks: WeekViewCallbacks;
  private windows: TimeWindow[];

  // Constants for 30-minute precision snapping
  private readonly startHour = 5; // 05:00
  private readonly endHour = 24;  // 24:00
  private readonly totalHours = 19; // 5..24
  private readonly hourHeight = 52; // pixels per hour
  private readonly slotHeight = 26; // pixels per 30 minutes (52 / 2)

  constructor(
    app: App,
    containerEl: HTMLElement,
    weekStart: Date,
    entries: CalendarEntry[],
    callbacks: WeekViewCallbacks,
    windows: TimeWindow[] = []
  ) {
    this.app = app;
    this.containerEl = containerEl;
    this.weekStart = weekStart;
    this.entries = entries;
    this.callbacks = callbacks;
    this.windows = windows;
    this.render();
  }

  public update(weekStart: Date, entries: CalendarEntry[], windows?: TimeWindow[]) {
    this.weekStart = weekStart;
    this.entries = entries;
    if (windows) this.windows = windows;
    this.render();
  }

  public deleteEntryLocal(entryId: string) {
    this.entries = this.entries.filter(e => e.id !== entryId);
  }

  public upsertEntryLocal(entry: CalendarEntry) {
    const idx = this.entries.findIndex(e => e.id === entry.id);
    if (idx >= 0) {
      this.entries[idx] = entry;
    } else {
      this.entries.push(entry);
    }
  }

  private openAllDayEditModal(entry: CalendarEntry) {
    new TaskEditModal(
      this.app,
      entry,
      async (updated) => {
        this.upsertEntryLocal(updated);
        await this.callbacks.onEntryUpdate(updated);
        this.render();
      },
      async (deleted) => {
        this.deleteEntryLocal(deleted.id);
        await this.callbacks.onEntryDelete(deleted);
        this.render();
      },
      this.windows
    ).open();
  }

  private render() {
    this.containerEl.empty();
    this.containerEl.addClass('fcp-week-view-wrapper');

    const weekDates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(this.weekStart);
      d.setDate(d.getDate() + i);
      weekDates.push(d);
    }

    const todayStr = new Date().toISOString().substring(0, 10);

    // Week Header Row
    const headerRow = this.containerEl.createDiv('fcp-week-header');
    headerRow.createDiv('fcp-time-gutter-header');

    const daysHeaderGrid = headerRow.createDiv('fcp-week-days-header-grid');
    weekDates.forEach((date) => {
      const dateStr = this.formatDateIso(date);
      const isToday = dateStr === todayStr;
      const dayColHeader = daysHeaderGrid.createDiv(`fcp-day-header-cell ${isToday ? 'is-today' : ''}`);
      
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = date.getDate();

      dayColHeader.innerHTML = `
        <div class="fcp-day-name">${dayName}</div>
        <div class="fcp-day-num">${dayNum}</div>
      `;
    });

    // All-Day Row (for untimed tasks, events, and crucial items)
    const allDayRow = this.containerEl.createDiv('fcp-week-all-day-row');
    allDayRow.createDiv('fcp-all-day-gutter-label').textContent = 'ALL-DAY';
    const allDayGrid = allDayRow.createDiv('fcp-week-all-day-grid');

    weekDates.forEach((date) => {
      const dateStr = this.formatDateIso(date);
      const cell = allDayGrid.createDiv('fcp-all-day-cell');
      cell.dataset.date = dateStr;

      const dayAllDay = this.entries.filter(e => e.date === dateStr && (e.allDay || !e.startTime));
      dayAllDay.forEach(entry => {
        const isCrucial = entry.type === 'crucial';
        const isFocused = this.callbacks.getFocusedTaskId() === entry.id;
        const badge = cell.createDiv(`fcp-all-day-badge type-${entry.type} ${isFocused ? 'is-focused' : ''}`);
        badge.dataset.id = entry.id;
        badge.title = `${entry.title}${entry.description ? '\n' + entry.description : ''}`;
        badge.innerHTML = `
          ${isCrucial ? '<span class="fcp-all-day-diamond">◆</span>' : ''}
          <span class="fcp-all-day-title">${this.escapeHtml(entry.title)}</span>
        `;
        badge.onclick = (e) => {
          e.stopPropagation();
          this.callbacks.onTaskFocus(entry);
          this.openAllDayEditModal(entry);
        };
        badge.ondblclick = (e) => {
          e.stopPropagation();
          this.openAllDayEditModal(entry);
        };
        badge.oncontextmenu = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.openAllDayEditModal(entry);
        };
      });

      cell.onclick = async (e) => {
        if ((e.target as HTMLElement).closest('.fcp-all-day-badge')) return;
        const newEntry = await this.callbacks.onEntryCreate(dateStr, '', '');
        newEntry.allDay = true;
        this.upsertEntryLocal(newEntry);
        const isCrucial = newEntry.type === 'crucial';
        const isFocused = this.callbacks.getFocusedTaskId() === newEntry.id;
        const badge = cell.createDiv(`fcp-all-day-badge type-${newEntry.type} ${isFocused ? 'is-focused' : ''}`);
        badge.dataset.id = newEntry.id;
        badge.title = '';
        badge.innerHTML = `
          ${isCrucial ? '<span class="fcp-all-day-diamond">◆</span>' : ''}
          <span class="fcp-all-day-title"></span>
        `;
        badge.onclick = (ev) => {
          ev.stopPropagation();
          this.callbacks.onTaskFocus(newEntry);
          this.openAllDayEditModal(newEntry);
        };
        badge.ondblclick = (ev) => {
          ev.stopPropagation();
          this.openAllDayEditModal(newEntry);
        };
        badge.oncontextmenu = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          this.openAllDayEditModal(newEntry);
        };
        this.enableBadgeInlineEdit(badge, newEntry);
      };
    });

    // Main Scrollable Grid Body
    const gridBody = this.containerEl.createDiv('fcp-week-grid-body');

    // Time Labels Gutter
    const timeGutter = gridBody.createDiv('fcp-time-gutter');
    timeGutter.style.height = `${this.totalHours * this.hourHeight}px`;

    for (let h = 0; h <= this.totalHours; h++) {
      const hourNum = this.startHour + h;
      const timeLabel = timeGutter.createDiv('fcp-time-label');
      timeLabel.style.top = `${h * this.hourHeight}px`;
      const hourStr = hourNum < 24 ? `${hourNum.toString().padStart(2, '0')}:00` : '24:00';
      timeLabel.textContent = hourStr;

      if (h === 0) {
        timeLabel.addClass('is-first');
      } else if (h === this.totalHours) {
        timeLabel.addClass('is-last');
      }
    }

    // Grid Columns Container
    const columnsContainer = gridBody.createDiv('fcp-columns-container');
    columnsContainer.style.height = `${this.totalHours * this.hourHeight}px`;

    // Hour and Half-Hour lines (30-minute visual slots)
    const gridLines = columnsContainer.createDiv('fcp-grid-lines');
    for (let h = 0; h < this.totalHours; h++) {
      const hourLine = gridLines.createDiv('fcp-grid-line-hour');
      hourLine.style.top = `${h * this.hourHeight}px`;

      const halfLine = gridLines.createDiv('fcp-grid-line-half');
      halfLine.style.top = `${(h + 0.5) * this.hourHeight}px`;
    }
    // Bottom boundary line for the final hour (24:00)
    const bottomLine = gridLines.createDiv('fcp-grid-line-hour');
    bottomLine.style.top = `${this.totalHours * this.hourHeight}px`;

    // 7 Day Columns
    weekDates.forEach((date, colIndex) => {
      const dateStr = this.formatDateIso(date);
      const colEl = columnsContainer.createDiv('fcp-day-column');
      colEl.dataset.date = dateStr;
      colEl.dataset.colIndex = colIndex.toString();

      // Click on empty space to create new entry snapped to 30-min minimum block
      colEl.addEventListener('click', async (e) => {
        if ((e.target as HTMLElement).closest('.fcp-entry-card')) return;

        const rect = colEl.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        
        // 30-minute slot calculation
        const slotIndex = Math.floor(offsetY / this.slotHeight);
        const maxSlots = this.totalHours * 2;
        const clampedSlot = Math.max(0, Math.min(slotIndex, maxSlots - 1));

        const startMinutes = (this.startHour * 60) + (clampedSlot * 30);
        const endMinutes = Math.min(startMinutes + 30, this.endHour * 60);

        const startTime = this.minutesToTimeStr(startMinutes);
        const endTime = this.minutesToTimeStr(endMinutes);

        const newEntry = await this.callbacks.onEntryCreate(dateStr, startTime, endTime);
        const newCard = this.renderEntryCard(colEl, newEntry);
        this.layoutDayColumn(dateStr);
        this.enableCardInlineEdit(newCard, newEntry);
      });

      const timedDayEntries = this.entries.filter(e => e.date === dateStr && !e.allDay && Boolean(e.startTime));
      timedDayEntries.forEach(entry => {
        this.renderEntryCard(colEl, entry);
      });
      this.layoutDayColumn(dateStr);
    });

    // Align header grid columns with body grid columns accounting for scrollbar width
    const syncHeaderScrollbar = () => {
      const scrollbarWidth = gridBody.offsetWidth - gridBody.clientWidth;
      const pad = scrollbarWidth > 0 ? `${scrollbarWidth}px` : '0px';
      headerRow.style.paddingRight = pad;
      allDayRow.style.paddingRight = pad;
    };
    setTimeout(syncHeaderScrollbar, 0);
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => syncHeaderScrollbar());
      ro.observe(gridBody);
    }
  }

  /**
   * Notion Calendar-style Overlap Clustering & Multi-Column Layout Algorithm
   */
  private calculateDayOverlapLayout(entries: CalendarEntry[]): Map<string, { colIndex: number; totalCols: number }> {
    const layoutMap = new Map<string, { colIndex: number; totalCols: number }>();
    const timed = entries.filter(e => !e.allDay && Boolean(e.startTime));
    if (timed.length === 0) return layoutMap;

    interface EntryInterval {
      entry: CalendarEntry;
      startMins: number;
      endMins: number;
    }

    const intervals: EntryInterval[] = timed.map(e => {
      const startMins = this.snapTo30Min(this.timeStrToMinutes(e.startTime || '09:00'));
      let endMins = this.snapTo30Min(this.timeStrToMinutes(e.endTime || '10:00'));
      if (endMins <= startMins) endMins = startMins + 30;
      return { entry: e, startMins, endMins };
    });

    // Sort intervals by start time ascending, then by duration descending (longer events first)
    intervals.sort((a, b) => {
      if (a.startMins !== b.startMins) return a.startMins - b.startMins;
      return (b.endMins - b.startMins) - (a.endMins - a.startMins);
    });

    // Cluster into connected components of overlapping intervals
    const clusters: EntryInterval[][] = [];
    let currentCluster: EntryInterval[] = [];
    let clusterMaxEnd = -1;

    for (const item of intervals) {
      if (currentCluster.length === 0) {
        currentCluster.push(item);
        clusterMaxEnd = item.endMins;
      } else if (item.startMins < clusterMaxEnd) {
        currentCluster.push(item);
        clusterMaxEnd = Math.max(clusterMaxEnd, item.endMins);
      } else {
        clusters.push(currentCluster);
        currentCluster = [item];
        clusterMaxEnd = item.endMins;
      }
    }
    if (currentCluster.length > 0) {
      clusters.push(currentCluster);
    }

    // For each cluster, greedily assign columns
    for (const cluster of clusters) {
      const columnEndTimes: number[] = [];
      const itemCols: { entryId: string; colIndex: number }[] = [];

      for (const item of cluster) {
        let placedCol = -1;
        for (let c = 0; c < columnEndTimes.length; c++) {
          if (columnEndTimes[c] <= item.startMins) {
            placedCol = c;
            columnEndTimes[c] = item.endMins;
            break;
          }
        }
        if (placedCol === -1) {
          placedCol = columnEndTimes.length;
          columnEndTimes.push(item.endMins);
        }
        itemCols.push({ entryId: item.entry.id, colIndex: placedCol });
      }

      const totalCols = Math.max(1, columnEndTimes.length);
      for (const ic of itemCols) {
        layoutMap.set(ic.entryId, { colIndex: ic.colIndex, totalCols });
      }
    }

    return layoutMap;
  }

  public layoutDayColumn(dateStr: string) {
    const colEl = this.containerEl.querySelector(`.fcp-day-column[data-date="${dateStr}"]`) as HTMLElement;
    if (!colEl) return;

    const dayEntries = this.entries.filter(e => e.date === dateStr && !e.allDay && Boolean(e.startTime));
    const layoutMap = this.calculateDayOverlapLayout(dayEntries);

    const cards = colEl.querySelectorAll('.fcp-entry-card') as NodeListOf<HTMLElement>;
    cards.forEach(card => {
      const id = card.dataset.id;
      if (!id) return;
      const layout = layoutMap.get(id);
      if (layout) {
        const { colIndex, totalCols } = layout;
        if (totalCols <= 1) {
          card.style.left = '4px';
          card.style.width = 'calc(100% - 8px)';
          card.style.right = 'auto';
        } else {
          const widthPct = 100 / totalCols;
          const leftPct = colIndex * widthPct;
          card.style.left = `calc(${leftPct}% + 2px)`;
          card.style.width = `calc(${widthPct}% - 4px)`;
          card.style.right = 'auto';
        }
      }
    });
  }

  private renderCardContent(card: HTMLElement, entry: CalendarEntry) {
    let content = card.querySelector('.fcp-entry-content') as HTMLElement;
    if (!content) {
      content = card.createDiv('fcp-entry-content');
    } else {
      content.empty();
    }

    const titleEl = content.createDiv('fcp-entry-title');
    if (entry.type === 'crucial') {
      titleEl.innerHTML = `<span class="fcp-crucial-icon">◆</span> ${this.escapeHtml(entry.title || 'Untitled')}`;
    } else {
      titleEl.textContent = entry.title || 'Untitled';
    }

    if (entry.description && entry.description.trim()) {
      const descEl = content.createDiv('fcp-entry-desc');
      descEl.textContent = entry.description.trim();
      descEl.setAttribute('title', entry.description.trim());
    }

    const timeEl = content.createDiv('fcp-entry-time');
    timeEl.textContent = `${entry.startTime} - ${entry.endTime}`;
  }

  private renderEntryCard(columnEl: HTMLElement, entry: CalendarEntry): HTMLElement {
    const startMins = this.snapTo30Min(this.timeStrToMinutes(entry.startTime));
    let endMins = this.snapTo30Min(this.timeStrToMinutes(entry.endTime));
    if (endMins <= startMins) {
      endMins = startMins + 30;
    }

    entry.startTime = this.minutesToTimeStr(startMins);
    entry.endTime = this.minutesToTimeStr(endMins);

    const minStartScale = this.startHour * 60;
    const maxEndScale = this.endHour * 60;

    const clampedStart = Math.max(minStartScale, Math.min(startMins, maxEndScale));
    const clampedEnd = Math.max(clampedStart + 30, Math.min(endMins, maxEndScale));

    const topPx = Math.round((clampedStart - minStartScale) / 30) * this.slotHeight;
    const durationSlots = Math.max(1, Math.round((clampedEnd - clampedStart) / 30));
    const heightPx = durationSlots * this.slotHeight;

    const isFocused = this.callbacks.getFocusedTaskId() === entry.id;
    const isShort = durationSlots <= 1;

    const card = columnEl.createDiv(`fcp-entry-card type-${entry.type} ${isFocused ? 'is-focused' : ''} ${isShort ? 'is-short' : ''}`);
    card.style.top = `${topPx}px`;
    card.style.height = `${heightPx}px`;
    card.dataset.id = entry.id;

    card.createDiv('fcp-resize-handle top');
    card.createDiv('fcp-resize-handle bottom');

    this.renderCardContent(card, entry);

    card.addEventListener('click', (e) => {
      if (card.classList.contains('is-editing')) return;
      e.stopPropagation();
      this.callbacks.onTaskFocus(entry);
    });

    card.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      this.openEditModal(entry, card);
    });

    card.addEventListener('contextmenu', (e) => {
      if (card.classList.contains('is-editing')) return;
      e.preventDefault();
      e.stopPropagation();

      const menu = new Menu();

      menu.addItem(item => {
        item.setTitle('Edit Details')
            .setIcon('lucide-edit')
            .onClick(() => {
              this.openEditModal(entry, card);
            });
      });

      menu.addItem(item => {
        item.setTitle('Quick Rename')
            .setIcon('lucide-edit-3')
            .onClick(() => {
              this.enableCardInlineEdit(card, entry);
            });
      });

      menu.addItem(item => {
        const types: Array<{ key: 'task' | 'event' | 'crucial'; label: string }> = [
          { key: 'task', label: 'Task (Pastel Blue)' },
          { key: 'event', label: 'Event (Green)' },
          { key: 'crucial', label: 'Crucial (Yellow)' }
        ];
        const nextIdx = (types.findIndex(t => t.key === entry.type) + 1) % types.length;
        const next = types[nextIdx];
        item.setTitle(`Change to ${next.label}`)
            .setIcon('lucide-refresh-cw')
            .onClick(async () => {
              entry.type = next.key;
              card.className = `fcp-entry-card type-${entry.type} ${this.callbacks.getFocusedTaskId() === entry.id ? 'is-focused' : ''} ${parseFloat(card.style.height) <= this.slotHeight ? 'is-short' : ''}`;
              this.renderCardContent(card, entry);
              await this.callbacks.onEntryUpdate(entry);
            });
      });

      menu.addSeparator();

      menu.addItem(item => {
        item.setTitle('Delete Entry')
            .setIcon('lucide-trash-2')
            .onClick(async () => {
              this.deleteEntryLocal(entry.id);
              card.remove();
              await this.callbacks.onEntryDelete(entry);
              this.layoutDayColumn(entry.date);
            });
      });

      menu.showAtMouseEvent(e);
    });

    this.setupCardDrag(card, entry);
    return card;
  }

  private openEditModal(entry: CalendarEntry, card: HTMLElement) {
    new TaskEditModal(
      this.app,
      entry,
      async (updatedEntry) => {
        this.upsertEntryLocal(updatedEntry);
        this.renderCardContent(card, updatedEntry);
        card.className = `fcp-entry-card type-${updatedEntry.type} ${this.callbacks.getFocusedTaskId() === updatedEntry.id ? 'is-focused' : ''} ${parseFloat(card.style.height) <= this.slotHeight ? 'is-short' : ''}`;

        const startMins = this.snapTo30Min(this.timeStrToMinutes(updatedEntry.startTime));
        let endMins = this.snapTo30Min(this.timeStrToMinutes(updatedEntry.endTime));
        if (endMins <= startMins) endMins = startMins + 30;
        const clampedStart = Math.max(this.startHour * 60, Math.min(startMins, this.endHour * 60));
        const clampedEnd = Math.max(clampedStart + 30, Math.min(endMins, this.endHour * 60));
        const topPx = Math.round((clampedStart - this.startHour * 60) / 30) * this.slotHeight;
        const heightPx = Math.max(1, Math.round((clampedEnd - clampedStart) / 30)) * this.slotHeight;
        card.style.top = `${topPx}px`;
        card.style.height = `${heightPx}px`;

        await this.callbacks.onEntryUpdate(updatedEntry);
        this.layoutDayColumn(updatedEntry.date);
      },
      async (deletedEntry) => {
        this.deleteEntryLocal(deletedEntry.id);
        card.remove();
        await this.callbacks.onEntryDelete(deletedEntry);
        this.layoutDayColumn(deletedEntry.date);
      },
      this.windows
    ).open();
  }

  private enableCardInlineEdit(card: HTMLElement, entry: CalendarEntry) {
    const content = card.querySelector('.fcp-entry-content') as HTMLElement;
    if (!content || card.classList.contains('is-editing')) return;

    card.addClass('is-editing');
    content.innerHTML = '';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'fcp-inline-input';
    input.value = entry.title || '';
    content.appendChild(input);

    let isReady = false;
    setTimeout(() => {
      isReady = true;
      input.focus();
      input.select();
    }, 100);

    let isFinished = false;
    const finishEdit = async (cancelled: boolean) => {
      if (isFinished) return;
      isFinished = true;

      card.removeClass('is-editing');
      if (cancelled) {
        if (!entry.title) {
          this.deleteEntryLocal(entry.id);
          card.remove();
          await this.callbacks.onEntryDelete(entry);
          this.layoutDayColumn(entry.date);
          return;
        }
      } else {
        const val = input.value.trim();
        if (!val && !entry.title) {
          this.deleteEntryLocal(entry.id);
          card.remove();
          await this.callbacks.onEntryDelete(entry);
          this.layoutDayColumn(entry.date);
          return;
        }
        const newTitle = val || entry.title || 'New Task';
        entry.title = newTitle;
        this.upsertEntryLocal(entry);
        await this.callbacks.onEntryUpdate(entry);
      }

      this.renderCardContent(card, entry);
    };

    input.addEventListener('blur', () => {
      if (!isReady) return;
      finishEdit(false);
    });

    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        finishEdit(false);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finishEdit(true);
      }
    });

    input.addEventListener('keyup', (e) => e.stopPropagation());
    input.addEventListener('keypress', (e) => e.stopPropagation());

    input.addEventListener('mousedown', (e) => e.stopPropagation());
    input.addEventListener('mouseup', (e) => e.stopPropagation());
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('dblclick', (e) => e.stopPropagation());
  }

  private enableBadgeInlineEdit(badge: HTMLElement, entry: CalendarEntry) {
    const titleEl = badge.querySelector('.fcp-all-day-title') as HTMLElement;
    if (!titleEl || badge.classList.contains('is-editing')) return;

    badge.addClass('is-editing');
    titleEl.innerHTML = '';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'fcp-inline-input';
    input.value = entry.title || '';
    titleEl.appendChild(input);

    let isReady = false;
    setTimeout(() => {
      isReady = true;
      input.focus();
      input.select();
    }, 100);

    let isFinished = false;
    const finishEdit = async (cancelled: boolean) => {
      if (isFinished) return;
      isFinished = true;

      badge.removeClass('is-editing');
      if (cancelled) {
        if (!entry.title) {
          this.deleteEntryLocal(entry.id);
          badge.remove();
          await this.callbacks.onEntryDelete(entry);
          return;
        }
      } else {
        const val = input.value.trim();
        if (!val && !entry.title) {
          this.deleteEntryLocal(entry.id);
          badge.remove();
          await this.callbacks.onEntryDelete(entry);
          return;
        }
        entry.title = val || entry.title || 'New Task';
        this.upsertEntryLocal(entry);
        await this.callbacks.onEntryUpdate(entry);
      }

      titleEl.textContent = entry.title;
      badge.title = `${entry.title}${entry.description ? '\n' + entry.description : ''}`;
    };

    input.addEventListener('blur', () => {
      if (!isReady) return;
      finishEdit(false);
    });

    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        finishEdit(false);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finishEdit(true);
      }
    });

    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('dblclick', (e) => e.stopPropagation());
  }

  private setupCardDrag(card: HTMLElement, entry: CalendarEntry) {
    let isDragging = false;
    let hasMoved = false;
    let dragMode: 'move' | 'resize-top' | 'resize-bottom' = 'move';
    let startY = 0;
    let startTop = 0;
    let startHeight = 0;
    let isOverAllDay = false;
    let targetAllDayCell: HTMLElement | null = null;
    const maxGridHeight = this.totalHours * this.hourHeight;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || card.classList.contains('is-editing')) return;

      const target = e.target as HTMLElement;
      if (target.classList.contains('top')) {
        dragMode = 'resize-top';
      } else if (target.classList.contains('bottom')) {
        dragMode = 'resize-bottom';
      } else {
        dragMode = 'move';
      }

      isDragging = true;
      hasMoved = false;
      isOverAllDay = false;
      targetAllDayCell = null;
      startY = e.clientY;
      startTop = parseFloat(card.style.top) || 0;
      startHeight = parseFloat(card.style.height) || this.slotHeight;

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaY = e.clientY - startY;

      if (Math.abs(deltaY) > 3) {
        hasMoved = true;
        card.addClass('is-dragging');
      }

      const columnsContainer = this.containerEl.querySelector('.fcp-columns-container') as HTMLElement;
      const allDayRow = this.containerEl.querySelector('.fcp-week-all-day-row') as HTMLElement;

      isOverAllDay = false;
      targetAllDayCell = null;

      if (dragMode === 'move' && allDayRow) {
        const allDayRect = allDayRow.getBoundingClientRect();
        if (e.clientY <= allDayRect.bottom + 8) {
          isOverAllDay = true;
          const cells = Array.from(allDayRow.querySelectorAll('.fcp-all-day-cell')) as HTMLElement[];
          for (const c of cells) {
            const cr = c.getBoundingClientRect();
            if (e.clientX >= cr.left && e.clientX <= cr.right) {
              targetAllDayCell = c;
              break;
            }
          }
        }
      }

      const allDayCells = this.containerEl.querySelectorAll('.fcp-all-day-cell');
      allDayCells.forEach(c => {
        if (c === targetAllDayCell) c.addClass('is-drag-over');
        else c.removeClass('is-drag-over');
      });

      if (dragMode === 'move') {
        const rawTop = startTop + deltaY;
        const snappedTop = Math.max(0, Math.min(Math.round(rawTop / this.slotHeight) * this.slotHeight, maxGridHeight - startHeight));
        card.style.top = `${snappedTop}px`;

        if (columnsContainer) {
          const rect = columnsContainer.getBoundingClientRect();
          const colWidth = rect.width / 7;
          const relX = e.clientX - rect.left;
          const targetColIndex = Math.max(0, Math.min(6, Math.floor(relX / colWidth)));
          const targetColEl = columnsContainer.querySelector(`.fcp-day-column[data-col-index="${targetColIndex}"]`) as HTMLElement;

          if (targetColEl && card.parentElement !== targetColEl) {
            targetColEl.appendChild(card);
            hasMoved = true;
          }
        }
      } else if (dragMode === 'resize-top') {
        const rawTop = startTop + deltaY;
        const snappedTop = Math.max(0, Math.min(Math.round(rawTop / this.slotHeight) * this.slotHeight, startTop + startHeight - this.slotHeight));
        const snappedHeight = startHeight + (startTop - snappedTop);
        card.style.top = `${snappedTop}px`;
        card.style.height = `${snappedHeight}px`;
      } else if (dragMode === 'resize-bottom') {
        const rawHeight = startHeight + deltaY;
        const snappedHeight = Math.max(this.slotHeight, Math.min(Math.round(rawHeight / this.slotHeight) * this.slotHeight, maxGridHeight - startTop));
        card.style.height = `${snappedHeight}px`;
      }

      if (hasMoved) {
        const currentTop = parseFloat(card.style.top) || 0;
        const currentHeight = parseFloat(card.style.height) || this.slotHeight;

        if (currentHeight <= this.slotHeight) {
          card.addClass('is-short');
        } else {
          card.removeClass('is-short');
        }

        const timeDiv = card.querySelector('.fcp-entry-time');
        if (isOverAllDay) {
          card.addClass('is-dropping-all-day');
          if (timeDiv) timeDiv.textContent = 'Drop for all-day';
        } else {
          card.removeClass('is-dropping-all-day');
          const startMins = (this.startHour * 60) + Math.round(currentTop / this.slotHeight) * 30;
          const endMins = startMins + Math.round(currentHeight / this.slotHeight) * 30;
          if (timeDiv) {
            timeDiv.textContent = `${this.minutesToTimeStr(startMins)} - ${this.minutesToTimeStr(endMins)}`;
          }
        }
      }
    };

    const onMouseUp = async (e: MouseEvent) => {
      if (!isDragging) return;
      isDragging = false;
      card.removeClass('is-dragging');
      card.removeClass('is-dropping-all-day');

      const allDayCells = this.containerEl.querySelectorAll('.fcp-all-day-cell');
      allDayCells.forEach(c => c.removeClass('is-drag-over'));

      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      if (!hasMoved) return;

      const oldDate = entry.date;

      if (isOverAllDay && targetAllDayCell && targetAllDayCell.dataset.date) {
        entry.date = targetAllDayCell.dataset.date;
        entry.allDay = true;
        entry.startTime = '';
        entry.endTime = '';
        await this.callbacks.onEntryUpdate(entry, oldDate);
        this.render();
        return;
      }

      const finalTop = parseFloat(card.style.top) || 0;
      const finalHeight = parseFloat(card.style.height) || this.slotHeight;

      const startSlot = Math.round(finalTop / this.slotHeight);
      const durationSlots = Math.max(1, Math.round(finalHeight / this.slotHeight));

      const startMins = (this.startHour * 60) + (startSlot * 30);
      const endMins = Math.min(this.endHour * 60, startMins + (durationSlots * 30));

      const targetColEl = card.closest('.fcp-day-column') as HTMLElement;
      if (targetColEl && targetColEl.dataset.date) {
        entry.date = targetColEl.dataset.date;
      }

      entry.allDay = false;
      entry.startTime = this.minutesToTimeStr(startMins);
      entry.endTime = this.minutesToTimeStr(endMins);

      await this.callbacks.onEntryUpdate(entry, oldDate);
      this.layoutDayColumn(oldDate);
      if (entry.date !== oldDate) {
        this.layoutDayColumn(entry.date);
      }
    };

    card.addEventListener('mousedown', onMouseDown);
  }

  private formatDateIso(d: Date): string {
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private timeStrToMinutes(str: string): number {
    if (!str) return 0;
    const parts = str.split(':').map(Number);
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  }

  private minutesToTimeStr(mins: number): string {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  private snapTo30Min(mins: number): number {
    return Math.round(mins / 30) * 30;
  }

  public updateFocusedTask(focusedTaskId: string | null) {
    if (!this.containerEl) return;
    const cards = this.containerEl.querySelectorAll('.fcp-entry-card, .fcp-all-day-badge');
    cards.forEach((cardEl) => {
      const htmlEl = cardEl as HTMLElement;
      if (htmlEl.dataset.id === focusedTaskId) {
        htmlEl.addClass('is-focused');
      } else {
        htmlEl.removeClass('is-focused');
      }
    });
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
