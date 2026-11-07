export {
  parseCheckpointMarkdown,
  exportMilestonesToMarkdown,
  calculateCategoryProgress,
  calculateOverallProgress
} from './views/milestones/MilestonesUtils';

/**
 * Formats a duration in hours (e.g. 3.5) into hours and minutes (e.g. "3h 30m").
 * - 3.5 -> "3h 30m"
 * - 0.5 -> "30m"
 * - 2.0 -> "2h"
 * - 0.0 -> "0h 0m"
 *
 * If htmlUnits is true, wraps unit labels in <span class="fcp-hours-unit">.
 */
export function formatHoursAndMinutes(totalHours: number, htmlUnits = false): string {
  const safeHours = typeof totalHours === 'number' && !isNaN(totalHours) && totalHours > 0 ? totalHours : 0;
  const totalMinutes = Math.round(safeHours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (htmlUnits) {
    if (h === 0 && m === 0) {
      return `0<span class="fcp-hours-unit">h</span> 0<span class="fcp-hours-unit">m</span>`;
    }
    if (h === 0) {
      return `${m}<span class="fcp-hours-unit">m</span>`;
    }
    if (m === 0) {
      return `${h}<span class="fcp-hours-unit">h</span>`;
    }
    return `${h}<span class="fcp-hours-unit">h</span> ${m}<span class="fcp-hours-unit">m</span>`;
  }

  if (h === 0 && m === 0) return '0h 0m';
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Detects the active Obsidian accent color hue or defaults to a rich indigo/blue (220).
 */
export function getThemeAccentHue(): number {
  if (typeof document === 'undefined') return 220;
  try {
    const style = getComputedStyle(document.body);
    const h = style.getPropertyValue('--accent-h').trim();
    if (h && !isNaN(Number(h))) {
      return Number(h);
    }
  } catch (e) {
    // fallback
  }
  return 220;
}

/**
 * Generates an elegant tonal shade for an activity index within a list of activities.
 * Uses alternating lightness and saturation levels of the same base color family
 * so that adjacent segments have clear contrast while maintaining aesthetic harmony.
 */
export function getTonalColor(index: number, total: number, baseHue?: number): string {
  const hue = baseHue !== undefined ? baseHue : getThemeAccentHue();
  if (total <= 1) {
    return `hsl(${hue}, 75%, 52%)`;
  }
  // Alternating lightness levels to ensure adjacent slices contrast well
  const lightnessLevels = [52, 70, 38, 78, 44, 62, 32, 84];
  const satLevels = [80, 68, 75, 62, 85, 65, 70, 58];

  const l = lightnessLevels[index % lightnessLevels.length];
  const s = satLevels[index % satLevels.length];
  return `hsl(${hue}, ${s}%, ${l}%)`;
}
