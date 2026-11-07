import { formatHoursAndMinutes } from '../../utils';
import { MonthlyStatsData } from './StatisticsUtils';

export class StatisticsDistributionBar {
  public static render(container: HTMLElement, data: MonthlyStatsData): void {
    if (data.activities.length === 0 || data.grandTotalSeconds === 0) return;

    const barContainer = container.createDiv('fcp-stacked-bar fcp-stats-full-bar');

    data.activities.forEach((act) => {
      const pct = (act.totalHours / (data.grandTotalHours || 1)) * 100;
      const segment = barContainer.createDiv('fcp-stacked-segment');
      segment.style.backgroundColor = act.color;
      segment.style.flex = `${pct}`;
      segment.title = `${act.displayTitle}: ${formatHoursAndMinutes(act.totalHours)} (${pct.toFixed(0)}%)`;
    });
  }
}
