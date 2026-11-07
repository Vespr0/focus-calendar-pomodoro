import { formatHoursAndMinutes } from '../../utils';
import { MonthlyStatsData } from './StatisticsUtils';

export class StatisticsBreakdownList {
  public static render(container: HTMLElement, data: MonthlyStatsData): void {
    if (data.activities.length === 0 || data.grandTotalSeconds === 0) return;

    const list = container.createDiv('fcp-stats-detail-list');

    data.activities.forEach((act) => {
      const pct = (act.totalHours / (data.grandTotalHours || 1)) * 100;
      const item = list.createDiv('fcp-stats-detail-item');

      item.innerHTML = `
        <div class="fcp-stats-item-left">
          <span class="fcp-legend-dot" style="background-color: ${act.color};"></span>
          <span class="fcp-stats-item-name" title="${this.escapeHtml(act.displayTitle)}">${this.escapeHtml(act.displayTitle)}</span>
        </div>
        <div class="fcp-stats-item-right">
          <span class="fcp-stats-item-hours">${formatHoursAndMinutes(act.totalHours)}</span>
          <span class="fcp-stats-item-pct">${pct.toFixed(0)}%</span>
        </div>
      `;
    });
  }

  private static escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
