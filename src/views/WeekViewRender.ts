import { Menu } from 'obsidian';
import { CalendarEntry } from '../types';

export interface WeekViewCallbacks {
  onEntryCreate: (date: string, startTime: string, endTime: string) => Promise<CalendarEntry>;
  onEntryUpdate: (entry: CalendarEntry) => Promise<void>;
  onEntryDelete: (entry: CalendarEntry) => Promise<void>;
  onTaskFocus: (entry: CalendarEntry) => void;
  getFocusedTaskId: () => string | undefined;
}

export class WeekViewRenderComponent {
  private containerEl: HTMLElement;
  private weekStart: Date;
  private entries: CalendarEntry[];
  private callbacks: WeekViewCallbacks;

  // Constants for 30-minute precision snapping
  private readonly startHour = 5; // 05:00
  private readonly endHour = 24;  // 24:00
  private readonly totalHours = 19; // 5..24
  private readonly hourHeight = 52; // pixels per hour
  private readonly slotHeight = 26; // pixels per 30 minutes (52 / 2)

  constructor(
    containerEl: HTMLElement,
    weekStart: Date,
    entries: CalendarEntry[],
    callbacks: WeekViewCallbacks
  ) {
    this.containerEl = containerEl;
    this.weekStart = weekStart;
    this.entries = entries;
    this.callbacks = callbacks;
    this.render();
  }

  public update(weekStart: Date, entries: CalendarEntry[]) {
    this.weekStart = weekStart;
    this.entries = entries;
    this.render();
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

    // Main Scrollable Grid Body
    const gridBody = this.containerEl.createDiv('fcp-week-grid-body');

    // Time Labels Gutter
    const timeGutter = gridBody.createDiv('fcp-time-gutter');
    for (let h = this.startHour; h <= this.endHour; h++) {
      const timeLabel = timeGutter.createDiv('fcp-time-label');
      timeLabel.style.height = `${this.hourHeight}px`;
      const hourStr = h < 24 ? `${h.toString().padStart(2, '0')}:00` : '24:00';
      timeLabel.textContent = hourStr;
    }

    // Grid Columns Container
    const columnsContainer = gridBody.createDiv('fcp-columns-container');
    columnsContainer.style.height = `${this.totalHours * this.hourHeight}px`;

    // Hour and Half-Hour lines (30-minute visual slots)
    const gridLines = columnsContainer.createDiv('fcp-grid-lines');
    for (let h = 0; h < this.totalHours; h++) {
      const line = gridLines.createDiv('fcp-grid-line');
      line.style.top = `${h * this.hourHeight}px`;
      line.style.height = `${this.slotHeight}px`;

      const halfLine = gridLines.createDiv('fcp-grid-line-half');
      halfLine.style.top = `${(h + 0.5) * this.hourHeight}px`;
      halfLine.style.height = `${this.slotHeight}px`;
    }

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
        this.enableCardInlineEdit(newCard, newEntry);
      });

      const dayEntries = this.entries.filter(e => e.date === dateStr);
      dayEntries.forEach(entry => {
        this.renderEntryCard(colEl, entry);
      });
    });

    // Align header grid columns with body grid columns accounting for scrollbar width
    setTimeout(() => {
      const scrollbarWidth = gridBody.offsetWidth - gridBody.clientWidth;
      if (scrollbarWidth > 0) {
        headerRow.style.paddingRight = `${scrollbarWidth}px`;
      } else {
        headerRow.style.paddingRight = '0px';
      }
    }, 0);
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

    const content = card.createDiv('fcp-entry-content');
    content.innerHTML = `
      <div class="fcp-entry-title">${this.escapeHtml(entry.title || 'Untitled')}</div>
      <div class="fcp-entry-time">${entry.startTime} - ${entry.endTime}</div>
    `;

    card.addEventListener('click', (e) => {
      if (card.classList.contains('is-editing')) return;
      e.stopPropagation();
      this.callbacks.onTaskFocus(entry);
    });

    card.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      this.enableCardInlineEdit(card, entry);
    });

    card.addEventListener('contextmenu', (e) => {
      if (card.classList.contains('is-editing')) return;
      e.preventDefault();
      e.stopPropagation();

      const menu = new Menu();
      
      menu.addItem(item => {
        item.setTitle('Rename Entry')
            .setIcon('lucide-edit-3')
            .onClick(() => {
              this.enableCardInlineEdit(card, entry);
            });
      });

      menu.addItem(item => {
        const nextType = entry.type === 'task' ? 'Event (Green)' : 'Task (Pastel Blue)';
        item.setTitle(`Change to ${nextType}`)
            .setIcon('lucide-refresh-cw')
            .onClick(async () => {
              entry.type = entry.type === 'task' ? 'event' : 'task';
              card.className = `fcp-entry-card type-${entry.type} ${this.callbacks.getFocusedTaskId() === entry.id ? 'is-focused' : ''}`;
              await this.callbacks.onEntryUpdate(entry);
            });
      });

      menu.addItem(item => {
        item.setTitle('Focus Pomodoro Timer')
            .setIcon('lucide-timer')
            .onClick(() => {
              this.callbacks.onTaskFocus(entry);
            });
      });

      menu.addSeparator();

      menu.addItem(item => {
        item.setTitle('Delete Entry')
            .setIcon('lucide-trash-2')
            .onClick(async () => {
              card.remove();
              await this.callbacks.onEntryDelete(entry);
            });
      });

      menu.showAtMouseEvent(e);
    });

    this.setupCardDrag(card, entry);
    return card;
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
      if (!cancelled) {
        const newTitle = input.value.trim() || 'New Task';
        entry.title = newTitle;
        await this.callbacks.onEntryUpdate(entry);
      }

      content.innerHTML = `
        <div class="fcp-entry-title">${this.escapeHtml(entry.title || 'Untitled')}</div>
        <div class="fcp-entry-time">${entry.startTime} - ${entry.endTime}</div>
      `;
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

  private setupCardDrag(card: HTMLElement, entry: CalendarEntry) {
    let isDragging = false;
    let hasMoved = false;
    let dragMode: 'move' | 'resize-top' | 'resize-bottom' = 'move';
    let startY = 0;
    let startTop = 0;
    let startHeight = 0;
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

        const startMins = (this.startHour * 60) + Math.round(currentTop / this.slotHeight) * 30;
        const endMins = startMins + Math.round(currentHeight / this.slotHeight) * 30;
        
        const timeDiv = card.querySelector('.fcp-entry-time');
        if (timeDiv) {
          timeDiv.textContent = `${this.minutesToTimeStr(startMins)} - ${this.minutesToTimeStr(endMins)}`;
        }
      }
    };

    const onMouseUp = async (e: MouseEvent) => {
      if (!isDragging) return;
      isDragging = false;
      card.removeClass('is-dragging');

      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      if (!hasMoved) return;

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

      entry.startTime = this.minutesToTimeStr(startMins);
      entry.endTime = this.minutesToTimeStr(endMins);

      await this.callbacks.onEntryUpdate(entry);
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

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
