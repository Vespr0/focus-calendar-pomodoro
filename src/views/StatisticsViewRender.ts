import { PomodoroLogSession } from '../types';
import { aggregateMonthlyActivities } from './statistics/StatisticsUtils';
import { StatisticsDistributionBar } from './statistics/StatisticsDistributionBar';
import { StatisticsBreakdownList } from './statistics/StatisticsBreakdownList';

export class StatisticsViewRenderComponent {
  private containerEl: HTMLElement;
  private currentYear: number;
  private currentMonth: number;
  private pomoLogs: PomodoroLogSession[];

  constructor(
    containerEl: HTMLElement,
    year: number,
    month: number,
    pomoLogs: PomodoroLogSession[]
  ) {
    this.containerEl = containerEl;
    this.currentYear = year;
    this.currentMonth = month;
    this.pomoLogs = pomoLogs;
    this.render();
  }

  public update(year: number, month: number, pomoLogs: PomodoroLogSession[]) {
    this.currentYear = year;
    this.currentMonth = month;
    this.pomoLogs = pomoLogs;
    this.render();
  }

  public render() {
    this.containerEl.empty();
    this.containerEl.addClass('fcp-stats-full-wrapper');

    const data = aggregateMonthlyActivities(this.pomoLogs, this.currentYear, this.currentMonth);

    if (data.activities.length === 0 || data.grandTotalSeconds === 0) {
      const emptyDiv = this.containerEl.createDiv('fcp-stats-empty');
      emptyDiv.textContent = 'No focus sessions recorded this month.';
      return;
    }

    const content = this.containerEl.createDiv('fcp-stats-content');

    // Minimalist Stacked Bar Distribution
    StatisticsDistributionBar.render(content, data);

    // Minimalist Detailed Breakdown List
    StatisticsBreakdownList.render(content, data);
  }
}
