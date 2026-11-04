#!/usr/bin/env bash
# Run inside xvfb-run. Xvfb supplies a display, not the window manager that
# handles a real desktop's minimize/restore requests.
set -euo pipefail
mkdir -p tests/visual-results
openbox > tests/visual-results/desktop-openbox.log 2>&1 &
imperium_wm_pid=$!
trap 'kill "$imperium_wm_pid" 2>/dev/null || true; wait "$imperium_wm_pid" 2>/dev/null || true' EXIT
for imperium_attempt in {1..100}; do
  if [[ $(xprop -root _NET_SUPPORTING_WM_CHECK 2>/dev/null) == *"window id #"* ]]; then
    npm run smoke:desktop
    exit 0
  fi
  if ! kill -0 "$imperium_wm_pid" 2>/dev/null; then
    cat tests/visual-results/desktop-openbox.log
    exit 1
  fi
  sleep 0.1
done
echo 'Openbox did not become ready for the desktop smoke test.' >&2
cat tests/visual-results/desktop-openbox.log
exit 1
