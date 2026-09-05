import { CalendarEntry, TimeWindow } from '../../types';

export class TimelineMarkerDrag {
  public static setup(
    el: HTMLElement, e: CalendarEntry,
    windows: TimeWindow[], canvas: HTMLElement,
    onUpdate: (entry: CalendarEntry) => Promise<void>,
    onClick: (entry: CalendarEntry) => void
  ): void {
    let isDragging = false;
    let startX = 0, startY = 0;

    const onMouseDown = (ev: MouseEvent) => {
      if (ev.button !== 0) return;
      ev.stopPropagation();
      startX = ev.clientX;
      startY = ev.clientY;
      isDragging = false;

      const onMouseMove = (moveEv: MouseEvent) => {
        const dist = Math.hypot(moveEv.clientX - startX, moveEv.clientY - startY);
        if (!isDragging && dist > 5) {
          isDragging = true;
          el.addClass('is-dragging');
        }
        if (isDragging) {
          const hovered = document.elementFromPoint(moveEv.clientX, moveEv.clientY);
          const frame = hovered?.closest('.fcp-timeline-window-frame') as HTMLElement | null;
          canvas.querySelectorAll('.fcp-timeline-window-frame').forEach(f => {
            if (f === frame) {
              const winId = f.getAttribute('data-window-id');
              const win = windows.find(w => w.id === winId);
              if (win && e.date >= win.startDate && e.date <= win.endDate) {
                f.addClass('is-drop-target');
              }
            } else {
              f.removeClass('is-drop-target');
            }
          });
        }
      };

      const onMouseUp = async (upEv: MouseEvent) => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        canvas.querySelectorAll('.fcp-timeline-window-frame').forEach(f => f.removeClass('is-drop-target'));

        if (!isDragging) { onClick(e); return; }
        el.removeClass('is-dragging');

        const targetEl = document.elementFromPoint(upEv.clientX, upEv.clientY);
        const targetFrame = targetEl?.closest('.fcp-timeline-window-frame') as HTMLElement | null;
        const targetUnassigned = targetEl?.closest('.fcp-unassigned-lane') as HTMLElement | null;

        if (targetFrame && targetFrame.dataset.windowId) {
          const win = windows.find(w => w.id === targetFrame.dataset.windowId);
          if (win && e.date >= win.startDate && e.date <= win.endDate) {
            e.windowId = win.id;
            await onUpdate(e);
          }
          return;
        }

        if (targetUnassigned) {
          e.windowId = 'none';
          await onUpdate(e);
        }
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    el.addEventListener('mousedown', onMouseDown);
  }
}
