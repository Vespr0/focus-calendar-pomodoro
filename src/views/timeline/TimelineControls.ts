export class TimelineControls {
  public static render(
    parentEl: HTMLElement,
    onAddWindow: () => void,
    onZoomIn?: () => void,
    onZoomOut?: () => void,
    onScrollToday?: () => void
  ): HTMLElement {
    const controlsBar = parentEl.createDiv('fcp-timeline-controls');
    
    const leftSide = controlsBar.createDiv('fcp-timeline-controls-left');
    const addWindowBtn = leftSide.createEl('button', {
      cls: 'fcp-btn fcp-btn-primary',
      text: '+ ADD TIME WINDOW'
    });
    addWindowBtn.onclick = () => onAddWindow();

    const rightSide = controlsBar.createDiv('fcp-timeline-controls-right');
    
    if (onScrollToday) {
      const todayBtn = rightSide.createEl('button', {
        cls: 'fcp-btn fcp-btn-sm',
        text: 'TODAY'
      });
      todayBtn.title = 'Center timeline on today';
      todayBtn.onclick = () => onScrollToday();
    }

    if (onZoomOut && onZoomIn) {
      const zoomOutBtn = rightSide.createEl('button', {
        cls: 'fcp-icon-btn fcp-btn-sm',
        ariaLabel: 'Zoom out (Ctrl + Wheel)'
      });
      zoomOutBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
      zoomOutBtn.onclick = () => onZoomOut();

      const zoomInBtn = rightSide.createEl('button', {
        cls: 'fcp-icon-btn fcp-btn-sm',
        ariaLabel: 'Zoom in (Ctrl + Wheel)'
      });
      zoomInBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
      zoomInBtn.onclick = () => onZoomIn();
    }

    return controlsBar;
  }

  public static attachWheelZoom(
    scrollContainer: HTMLElement,
    getDayWidth: () => number,
    getCanvasWidth: () => number,
    onZoomChange: (newWidth: number, ratio: number, mouseX: number) => void
  ): void {
    scrollContainer.addEventListener('wheel', (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();

        const currentWidth = getDayWidth();
        let factor = 1.0;
        if (Math.abs(e.deltaY) > 40) {
          // Discrete mouse wheel tick
          factor = e.deltaY < 0 ? 1.20 : 0.83;
        } else {
          // Trackpad pinch-to-zoom
          factor = Math.exp(-e.deltaY * 0.01);
        }

        const newWidth = Math.max(4, Math.min(80, Math.round(currentWidth * factor * 10) / 10));

        if (Math.abs(newWidth - currentWidth) >= 0.05) {
          const rect = scrollContainer.getBoundingClientRect();
          const mouseX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
          const contentX = scrollContainer.scrollLeft + mouseX;
          const ratio = contentX / getCanvasWidth();
          onZoomChange(newWidth, ratio, mouseX);
        }
      } else if (!e.shiftKey) {
        // Natural mouse wheel: translate vertical wheel scroll into horizontal scroll
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          e.preventDefault();
          scrollContainer.scrollLeft += e.deltaY;
        }
      }
    }, { passive: false });
  }

  public static attachPanGestures(scrollContainer: HTMLElement): void {
    let isPanning = false;
    let startX = 0;
    let startScrollLeft = 0;

    scrollContainer.addEventListener('mousedown', (e: MouseEvent) => {
      // Middle click (button 1) or Left click (button 0) on canvas background/ruler
      if (e.button !== 0 && e.button !== 1) return;

      const target = e.target as HTMLElement | null;
      // Do not pan if clicking on an interactive control, window header, or draggable marker
      if (target?.closest('.fcp-timeline-window-frame') ||
          target?.closest('.fcp-timeline-rhombus') ||
          target?.closest('.fcp-timeline-task-dot') ||
          target?.closest('button') ||
          target?.closest('input')) {
        return;
      }

      isPanning = true;
      startX = e.clientX;
      startScrollLeft = scrollContainer.scrollLeft;
      scrollContainer.addClass('is-panning');

      const onMouseMove = (moveEv: MouseEvent) => {
        if (!isPanning) return;
        const dx = moveEv.clientX - startX;
        scrollContainer.scrollLeft = startScrollLeft - dx;
      };

      const onMouseUp = () => {
        isPanning = false;
        scrollContainer.removeClass('is-panning');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }
}
