import { PomodoroManager } from '../pomodoro';
import { ViewMode } from '../types';

export class PomodoroHeaderComponent {
  private containerEl: HTMLElement;
  private pomodoroManager: PomodoroManager;
  private viewMode: ViewMode;
  private totalHours: number; // in hours

  constructor(
    containerEl: HTMLElement,
    pomodoroManager: PomodoroManager,
    viewMode: ViewMode,
    totalHours: number
  ) {
    this.containerEl = containerEl;
    this.pomodoroManager = pomodoroManager;
    this.viewMode = viewMode;
    this.totalHours = totalHours;
    this.render();
  }

  public update(viewMode: ViewMode, totalHours: number) {
    this.viewMode = viewMode;
    this.totalHours = totalHours;
    this.render();
  }

  public render() {
    this.containerEl.empty();
    this.containerEl.addClass('fcp-pomodoro-header');
    if (this.viewMode === 'month') {
      this.containerEl.addClass('month-mode');
    } else {
      this.containerEl.removeClass('month-mode');
    }

    const state = this.pomodoroManager.getState();

    // IF MONTH VIEW: View only, hide pomodoro timer & task focus box. Render statistics banner.
    if (this.viewMode === 'month') {
      const statsBanner = this.containerEl.createDiv('fcp-month-stats-banner');
      statsBanner.innerHTML = `
        <div class="fcp-month-overview-info">
          <span class="fcp-overview-badge">MONTHLY OVERVIEW</span>
          <span class="fcp-overview-desc">Events view for big-picture planning & milestones</span>
        </div>
        <div class="fcp-hours-card month-card">
          <div class="fcp-hours-val">${this.totalHours.toFixed(1)} <span class="fcp-hours-unit">hrs</span></div>
          <div class="fcp-hours-sub">MONTHLY STUDIED HOURS</div>
        </div>
      `;
      return;
    }

    // WEEK VIEW: Full Pomodoro Timer + Task Focus + Weekly Hours
    const isWork = state.mode === 'work';
    const accentColor = isWork ? 'var(--fcp-red-accent, #ef4444)' : 'var(--fcp-blue-accent, #3b82f6)';
    const modeLabel = isWork ? 'WORK SESSION' : 'BREAK TIME';

    // Left section: Radial Progress Ring & Controls
    const leftSection = this.containerEl.createDiv('fcp-pomo-left');

    const svgSize = 68;
    const strokeWidth = 5;
    const radius = (svgSize - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const progressRatio = state.totalDurationSeconds > 0
      ? state.timeLeftSeconds / state.totalDurationSeconds
      : 0;
    const strokeDashoffset = circumference * (1 - progressRatio);

    const minutes = Math.floor(state.timeLeftSeconds / 60);
    const seconds = state.timeLeftSeconds % 60;
    const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    const svgWrapper = leftSection.createDiv('fcp-radial-wrapper');
    svgWrapper.style.setProperty('--accent-color', accentColor);

    svgWrapper.innerHTML = `
      <svg width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}" class="fcp-radial-svg">
        <circle
          cx="${svgSize/2}" cy="${svgSize/2}" r="${radius}"
          fill="none" stroke="var(--background-modifier-border)" stroke-width="${strokeWidth}"
        />
        <circle
          cx="${svgSize/2}" cy="${svgSize/2}" r="${radius}"
          fill="none" stroke="${accentColor}" stroke-width="${strokeWidth}"
          stroke-linecap="round"
          stroke-dasharray="${circumference}"
          stroke-dashoffset="${strokeDashoffset}"
          transform="rotate(-90 ${svgSize/2} ${svgSize/2})"
          style="transition: stroke-dashoffset 0.3s ease, stroke 0.3s ease;"
        />
      </svg>
      <div class="fcp-radial-text">${formattedTime}</div>
    `;

    // Controls
    const controlsDiv = leftSection.createDiv('fcp-pomo-controls');
    
    const modeBadge = controlsDiv.createDiv('fcp-mode-badge');
    modeBadge.textContent = modeLabel;
    modeBadge.style.color = accentColor;
    modeBadge.style.borderColor = accentColor;

    const btnGroup = controlsDiv.createDiv('fcp-btn-group');

    const playPauseBtn = btnGroup.createEl('button', {
      cls: 'fcp-icon-btn fcp-play-btn',
      ariaLabel: state.isRunning ? 'Pause' : 'Start'
    });
    playPauseBtn.innerHTML = state.isRunning
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
    playPauseBtn.onclick = () => this.pomodoroManager.togglePlayPause();

    const resetBtn = btnGroup.createEl('button', {
      cls: 'fcp-icon-btn',
      ariaLabel: 'Reset'
    });
    resetBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`;
    resetBtn.onclick = () => this.pomodoroManager.resetTimer();

    const skipBtn = btnGroup.createEl('button', {
      cls: 'fcp-icon-btn',
      ariaLabel: 'Switch Mode'
    });
    skipBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>`;
    skipBtn.onclick = () => this.pomodoroManager.switchMode();

    // Focused Task display
    const midSection = this.containerEl.createDiv('fcp-pomo-mid');
    const taskBox = midSection.createDiv('fcp-focus-task-box');
    
    if (state.focusedTask) {
      taskBox.addClass('active');
      taskBox.innerHTML = `
        <span class="fcp-focus-label">FOCUSING ON:</span>
        <span class="fcp-focus-title">${this.escapeHtml(state.focusedTask.title || 'Untitled Task')}</span>
      `;
      const clearBtn = taskBox.createEl('button', { cls: 'fcp-clear-focus-btn', text: '×' });
      clearBtn.onclick = (e) => {
        e.stopPropagation();
        this.pomodoroManager.setFocusedTask(null);
      };
    } else {
      taskBox.removeClass('active');
      taskBox.innerHTML = `<span class="fcp-focus-prompt">Click any task in week view to set focus</span>`;
    }

    // Right section: Weekly Hours
    const rightSection = this.containerEl.createDiv('fcp-pomo-right');
    const hoursCard = rightSection.createDiv('fcp-hours-card');
    
    hoursCard.innerHTML = `
      <div class="fcp-hours-val">${this.totalHours.toFixed(1)} <span class="fcp-hours-unit">hrs</span></div>
      <div class="fcp-hours-sub">WEEKLY STUDIED HOURS</div>
    `;
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
