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
  private editingEntryId: string | null = null;

  // Constants
  private readonly startHour = 5; // 05:00
  private readonly endHour = 24;  // 24:00
  private readonly totalHours = 19; // 5..24
  private readonly hourHeight = 52; // pixels per hour

  constructor(
    containerEl: HTMLElement,
    weekStart: Date,
    entries: CalendarEntry[],
    callbacks: WeekViewCallbacks,
    initialEditingEntryId: string | null = null
  ) {
    this.containerEl = containerEl;
    this.weekStart = weekStart;
    this.entries = entries;
    this.callbacks = callbacks;
    this.editingEntryId = initialEditingEntryId;
    this.render();
  }

  public update(weekStart: Date, entries: CalendarEntry[], editingEntryId?: string | null) {
    this.weekStart = weekStart;
    this.entries = entries;
    if (editingEntryId !== undefined) {
      this.editingEntryId = editingEntryId;
    }
    this.render();
  }

  public getEditingEntryId(): string | null {
    return this.editingEntryId;
  }

  public setEditingEntryId(id: string | null) {
    this.editingEntryId = id;
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

    // Hour lines
    const gridLines = columnsContainer.createDiv('fcp-grid-lines');
    for (let h = 0; h < this.totalHours; h++) {
      const line = gridLines.createDiv('fcp-grid-line');
      line.style.top = `${h * this.hourHeight}px`;
      line.style.height = `${this.hourHeight}px`;
    }

    // 7 Day Columns
    weekDates.forEach((date, colIndex) => {
      const dateStr = this.formatDateIso(date);
      const colEl = columnsContainer.createDiv('fcp-day-column');
      colEl.dataset.date = dateStr;
      colEl.dataset.colIndex = colIndex.toString();

      // Click on empty space to create new entry
      colEl.addEventListener('click', async (e) => {
        if ((e.target as HTMLElement).closest('.fcp-entry-card')) return;

        const rect = colEl.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        const totalMinutesFromStart = Math.floor((offsetY / (this.totalHours * this.hourHeight)) * (this.totalHours * 60));
        
        const roundedMinutes = Math.floor(totalMinutesFromStart / 15) * 15;
        const startMinutes = (this.startHour * 60) + Math.max(0, Math.min(roundedMinutes, (this.endHour * 60) - 60));
        const endMinutes = Math.min(startMinutes + 60, this.endHour * 60);

        const startTime = this.minutesToTimeStr(startMinutes);
        const endTime = this.minutesToTimeStr(endMinutes);

        const newEntry = await this.callbacks.onEntryCreate(dateStr, startTime, endTime);
        this.editingEntryId = newEntry.id;
        this.render();
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

  private renderEntryCard(columnEl: HTMLElement, entry: CalendarEntry) {
    const startMins = this.timeStrToMinutes(entry.startTime);
    const endMins = this.timeStrToMinutes(entry.endTime);

    const minStartScale = this.startHour * 60;
    const maxEndScale = this.endHour * 60;

    const clampedStart = Math.max(minStartScale, Math.min(startMins, maxEndScale));
    const clampedEnd = Math.max(clampedStart + 15, Math.min(endMins, maxEndScale));

    const topPx = ((clampedStart - minStartScale) / 60) * this.hourHeight;
    const heightPx = Math.max(24, ((clampedEnd - clampedStart) / 60) * this.hourHeight);

    const isFocused = this.callbacks.getFocusedTaskId() === entry.id;
    const isEditing = this.editingEntryId === entry.id;

    const card = columnEl.createDiv(`fcp-entry-card type-${entry.type} ${isFocused ? 'is-focused' : ''} ${isEditing ? 'is-editing' : ''}`);
    card.style.top = `${topPx}px`;
    card.style.height = `${heightPx}px`;
    card.dataset.id = entry.id;

    card.createDiv('fcp-resize-handle top');
    card.createDiv('fcp-resize-handle bottom');

    const content = card.createDiv('fcp-entry-content');

    if (isEditing) {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'fcp-inline-input';
      input.value = entry.title || '';
      content.appendChild(input);

      setTimeout(() => {
        input.focus();
        input.select();
      }, 10);

      let isSaving = false;
      const saveTitle = async () => {
        if (isSaving) return;
        isSaving = true;
        const newTitle = input.value.trim() || 'New Entry';
        entry.title = newTitle;
        this.editingEntryId = null;
        await this.callbacks.onEntryUpdate(entry);
        this.render();
      };

      input.addEventListener('blur', saveTitle);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          saveTitle();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.editingEntryId = null;
          this.render();
        }
      });

      input.addEventListener('mousedown', (e) => e.stopPropagation());
      input.addEventListener('click', (e) => e.stopPropagation());

    } else {
      content.innerHTML = `
        <div class="fcp-entry-title">${this.escapeHtml(entry.title || 'Untitled')}</div>
        <div class="fcp-entry-time">${entry.startTime} - ${entry.endTime}</div>
      `;

      card.addEventListener('click', (e) => {
        e.stopPropagation();
        this.callbacks.onTaskFocus(entry);
      });

      card.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.editingEntryId = entry.id;
        this.render();
      });

      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const menu = new Menu();
        
        menu.addItem(item => {
          item.setTitle('Rename Entry')
              .setIcon('lucide-edit-3')
              .onClick(() => {
                this.editingEntryId = entry.id;
                this.render();
              });
        });

        menu.addItem(item => {
          const nextType = entry.type === 'task' ? 'Event (Green)' : 'Task (Pastel Blue)';
          item.setTitle(`Change to ${nextType}`)
              .setIcon('lucide-refresh-cw')
              .onClick(async () => {
                entry.type = entry.type === 'task' ? 'event' : 'task';
                await this.callbacks.onEntryUpdate(entry);
                this.render();
              });
        });

        menu.addItem(item => {
          item.setTitle('Focus Pomodoro Timer')
              .setIcon('lucide-timer')
              .onClick(() => {
                this.callbacks.onTaskFocus(entry);
                this.render();
              });
        });

        menu.addSeparator();

        menu.addItem(item => {
          item.setTitle('Delete Entry')
              .setIcon('lucide-trash-2')
              .onClick(async () => {
                await this.callbacks.onEntryDelete(entry);
                this.render();
              });
        });

        menu.showAtMouseEvent(e);
      });

      this.setupCardDrag(card, entry, columnEl);
    }
  }

  private setupCardDrag(card: HTMLElement, entry: CalendarEntry, columnEl: HTMLElement) {
    let isDragging = false;
    let dragMode: 'move' | 'resize-top' | 'resize-bottom' = 'move';
    let startY = 0;
    let startTop = 0;
    let startHeight = 0;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || (e.target as HTMLElement).tagName === 'INPUT') return;

      const target = e.target as HTMLElement;
      if (target.classList.contains('top')) {
        dragMode = 'resize-top';
      } else if (target.classList.contains('bottom')) {
        dragMode = 'resize-bottom';
      } else {
        dragMode = 'move';
      }

      isDragging = true;
      startY = e.clientY;
      startTop = parseFloat(card.style.top) || 0;
      startHeight = parseFloat(card.style.height) || 40;

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaY = e.clientY - startY;

      if (dragMode === 'move') {
        const newTop = Math.max(0, Math.min(startTop + deltaY, (this.totalHours * this.hourHeight) - startHeight));
        card.style.top = `${newTop}px`;
      } else if (dragMode === 'resize-top') {
        const newTop = Math.max(0, Math.min(startTop + deltaY, startTop + startHeight - 20));
        const newHeight = startHeight + (startTop - newTop);
        card.style.top = `${newTop}px`;
        card.style.height = `${newHeight}px`;
      } else if (dragMode === 'resize-bottom') {
        const newHeight = Math.max(20, Math.min(startHeight + deltaY, (this.totalHours * this.hourHeight) - startTop));
        card.style.height = `${newHeight}px`;
      }
    };

    const onMouseUp = async (e: MouseEvent) => {
      if (!isDragging) return;
      isDragging = false;

      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      const finalTop = parseFloat(card.style.top) || 0;
      const finalHeight = parseFloat(card.style.height) || 40;

      const minStartScale = this.startHour * 60;
      const startMins = minStartScale + Math.round((finalTop / this.hourHeight) * 60 / 15) * 15;
      const durationMins = Math.max(15, Math.round((finalHeight / this.hourHeight) * 60 / 15) * 15);
      const endMins = Math.min(this.endHour * 60, startMins + durationMins);

      entry.startTime = this.minutesToTimeStr(startMins);
      entry.endTime = this.minutesToTimeStr(endMins);

      await this.callbacks.onEntryUpdate(entry);
      this.render();
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

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
