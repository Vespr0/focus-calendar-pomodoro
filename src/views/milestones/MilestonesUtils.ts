import { MilestoneCategory, MilestoneItem } from '../../types';

export interface ProgressStats {
  total: number;
  completed: number;
  pct: number;
}

/**
 * Calculates progress for a category where 'done' and 'skipped' both count towards completion.
 * Counts both milestone items and their sub-items.
 */
export function calculateCategoryProgress(cat: MilestoneCategory): ProgressStats {
  let total = 0;
  let completed = 0;

  cat.items.forEach((item) => {
    total++;
    if (item.status === 'done' || item.status === 'skipped') completed++;

    const subItems = item.subItems || item.comments || [];
    subItems.forEach((sub) => {
      total++;
      if (sub.status === 'done' || sub.status === 'skipped') completed++;
    });
  });

  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, pct };
}

/**
 * Calculates aggregate progress across all categories in a month.
 */
export function calculateOverallProgress(categories: MilestoneCategory[]): ProgressStats {
  let total = 0;
  let completed = 0;
  categories.forEach((cat) => {
    cat.items.forEach((item) => {
      total++;
      if (item.status === 'done' || item.status === 'skipped') completed++;

      const subItems = item.subItems || item.comments || [];
      subItems.forEach((sub) => {
        total++;
        if (sub.status === 'done' || sub.status === 'skipped') completed++;
      });
    });
  });
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, pct };
}

/**
 * Parses user checkpoint markdown into structured MilestoneCategory array.
 */
export function parseCheckpointMarkdown(content: string): MilestoneCategory[] {
  const lines = content.split(/\r?\n/);
  const categories: MilestoneCategory[] = [];
  let currentCategory: MilestoneCategory | null = null;
  let currentMilestone: MilestoneItem | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Header 2 or 3: Category
    const headerMatch = trimmed.match(/^#{2,3}\s+(.+)$/);
    if (headerMatch) {
      const name = headerMatch[1].replace(/[-*_#]/g, '').trim();
      if (name && !name.toLowerCase().startsWith('checkpoint') && !name.toLowerCase().startsWith('struttura')) {
        currentCategory = {
          id: 'cat-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          name: name,
          items: []
        };
        categories.push(currentCategory);
        currentMilestone = null;
        continue;
      }
    }

    if (!currentCategory) continue;

    // Indentation level
    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1].replace(/\t/g, '    ').length : 0;

    // Bullet item
    const itemMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (itemMatch) {
      let text = itemMatch[1].trim();
      if (!text || text === '---') continue;

      // Deeper indent under existing milestone is a sub-item
      if (indent >= 4 && currentMilestone) {
        if (!currentMilestone.subItems) currentMilestone.subItems = [];

        let subStatus: 'todo' | 'done' | 'skipped' = 'todo';
        let subText = text;
        if (subText.includes('🟣') || subText.toLowerCase().includes('saltat') || subText.toLowerCase().includes('skipped')) {
          subStatus = 'skipped';
        } else if (subText.startsWith('[x]') || subText.startsWith('[X]')) {
          subStatus = 'done';
          subText = subText.substring(3).trim();
        } else if (subText.startsWith('[ ]')) {
          subStatus = 'todo';
          subText = subText.substring(3).trim();
        }

        currentMilestone.subItems.push({
          id: 'sub-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          text: subText,
          status: subStatus,
          createdAt: Date.now()
        });
        currentMilestone.comments = currentMilestone.subItems;
        continue;
      }

      let status: 'todo' | 'done' | 'skipped' = 'todo';
      if (text.includes('🟣') || text.toLowerCase().includes('saltat') || text.toLowerCase().includes('skipped')) {
        status = 'skipped';
      } else if (text.startsWith('[x]') || text.startsWith('[X]')) {
        status = 'done';
        text = text.substring(3).trim();
      } else if (text.startsWith('[ ]')) {
        status = 'todo';
        text = text.substring(3).trim();
      }

      currentMilestone = {
        id: 'ms-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        title: text,
        status: status,
        subItems: [],
        comments: [],
        createdAt: Date.now()
      };
      currentCategory.items.push(currentMilestone);
    } else if (currentMilestone && trimmed && !trimmed.startsWith('#')) {
      if (!currentMilestone.subItems) currentMilestone.subItems = [];
      currentMilestone.subItems.push({
        id: 'sub-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        text: trimmed,
        status: 'todo',
        createdAt: Date.now()
      });
      currentMilestone.comments = currentMilestone.subItems;
    }
  }

  return categories;
}

/**
 * Serializes milestones categories back into clean markdown.
 */
export function exportMilestonesToMarkdown(monthTitle: string, categories: MilestoneCategory[]): string {
  let md = `# Checkpoints — ${monthTitle}\n\n`;
  for (const cat of categories) {
    md += `### ${cat.name}\n`;
    for (const item of cat.items) {
      const icon = item.status === 'done' ? '[x] ' : (item.status === 'skipped' ? '🟣 ' : '[ ] ');
      md += `- ${icon}${item.title}\n`;
      const subItems = item.subItems || item.comments || [];
      if (subItems.length > 0) {
        for (const sub of subItems) {
          const subIcon = sub.status === 'done' ? '[x] ' : (sub.status === 'skipped' ? '🟣 ' : '');
          md += `    - ${subIcon}${sub.text}\n`;
        }
      }
    }
    md += '\n---\n\n';
  }
  return md;
}
