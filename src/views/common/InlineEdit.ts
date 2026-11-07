/**
 * Replaces an element temporarily with an input for inline text editing.
 * Commits on Enter or blur, cancels on Escape.
 */
export function enableInlineEdit(
  el: HTMLElement,
  initialValue: string,
  onCommit: (val: string) => Promise<void> | void,
  onCancel?: () => void
): void {
  const parent = el.parentElement;
  if (!parent) return;

  const input = document.createElement('input');
  input.type = 'text';
  input.value = initialValue;
  input.className = 'fcp-ms-inline-input';

  let committed = false;
  const commit = async () => {
    if (committed) return;
    committed = true;
    const val = input.value.trim() || initialValue;
    await onCommit(val);
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      input.blur();
    } else if (e.key === 'Escape') {
      committed = true;
      if (onCancel) onCancel();
    }
  });

  input.addEventListener('blur', () => {
    commit();
  });

  el.replaceWith(input);
  input.focus();
  input.select();
}

