export interface RadialProgressOptions {
  size?: number;
  strokeWidth?: number;
  progressRatio: number; // 0..1
  accentColor?: string;
  className?: string;
  text?: string;
}

/**
 * Creates an SVG radial progress ring element with background and animated foreground circle.
 */
export function createRadialProgressEl(options: RadialProgressOptions): HTMLElement {
  const size = options.size || 22;
  const strokeWidth = options.strokeWidth || 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedRatio = Math.max(0, Math.min(1, isNaN(options.progressRatio) ? 0 : options.progressRatio));
  const offset = circumference * (1 - clampedRatio);
  const accent = options.accentColor || 'var(--interactive-accent)';

  const wrapper = document.createElement('div');
  wrapper.className = `fcp-ms-radial-wrapper ${options.className || ''}`.trim();

  wrapper.innerHTML = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="fcp-ms-radial-svg">
      <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="var(--background-modifier-border)" stroke-width="${strokeWidth}" />
      <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="${accent}" stroke-width="${strokeWidth}"
        stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
        transform="rotate(-90 ${size / 2} ${size / 2})"
        style="transition: stroke-dashoffset 0.25s ease;"
      />
    </svg>
    ${options.text !== undefined ? `<span class="fcp-ms-radial-text">${options.text}</span>` : ''}
  `;

  return wrapper;
}

