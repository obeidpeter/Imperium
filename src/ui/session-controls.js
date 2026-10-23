// Camp choices share the chronicle's save transaction. Keep their native
// controls unavailable while that transaction or the camp's setup is pending,
// while leaving navigation and unsaved draft editors usable.
const CAMP_COMMANDS = new Set([
  'start', 'choose', 'oath', 'prepare', 'route', 'negotiate', 'stratagem', 'judge', 'allocate',
  'operation-choice', 'specialize-veteran', 'operational-plan', 'field-approach',
  'expanded-upgrade', 'command-upgrade', 'approach-upgrade',
  'company-package', 'company-up', 'company-down',
  'next-story', 'previous-story', 'reply',
  'agreement-honour', 'agreement-break', 'settle-honour', 'settle-break',
  'soldier', 'adopt-soldier', 'orders-save', 'squad-orders-save', 'soldier-party',
  'end-iron', 'archive-replay', 'replay'
]);
const EDITOR_COMMANDS = new Set(['orders-edit', 'squad-orders-edit']);

export function createSessionControls(root) {
  const held = new Map();
  // Call before patching page HTML: its freshly rendered rule restrictions
  // must replace the old ones before the temporary save restriction returns.
  function release() {
    for (const [control, prior] of held) {
      control.disabled = prior.disabled;
      if (prior.busy === null) control.removeAttribute('aria-busy');
      else control.setAttribute('aria-busy', prior.busy);
    }
    held.clear();
  }
  function sync(waiting) {
    release();
    if (!waiting) return;
    for (const control of root.querySelectorAll('button[data-cmd], input[data-cmd], select.company-slot')) {
      const command = control.dataset.cmd;
      if (!control.matches('.company-slot') && (!CAMP_COMMANDS.has(command) ||
          command === 'soldier' && EDITOR_COMMANDS.has(control.dataset.kind))) continue;
      held.set(control, {disabled:control.disabled, busy:control.getAttribute('aria-busy')});
      control.disabled = true;
      control.setAttribute('aria-busy', 'true');
    }
  }
  return {release, sync};
}
