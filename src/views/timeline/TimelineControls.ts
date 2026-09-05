export class TimelineControls {
  public static render(parentEl: HTMLElement, onAddWindow: () => void): HTMLElement {
    const controlsBar = parentEl.createDiv('fcp-timeline-controls');
    const addWindowBtn = controlsBar.createEl('button', {
      cls: 'fcp-btn fcp-btn-primary',
      text: '+ ADD TIME WINDOW'
    });
    addWindowBtn.onclick = () => onAddWindow();
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
        const factor = e.deltaY < 0 ? 1.15 : 0.87;
        const newWidth = Math.max(4, Math.min(60, currentWidth * factor));

        if (Math.abs(newWidth - currentWidth) > 0.05) {
          const rect = scrollContainer.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const contentX = scrollContainer.scrollLeft + mouseX;
          const ratio = contentX / getCanvasWidth();
          onZoomChange(newWidth, ratio, mouseX);
        }
      }
    }, { passive: false });
  }
}
