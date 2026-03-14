#!/bin/bash
# post-create.sh — runs once after devcontainer is created.
# Kicks off the long-running Canvas setup in the background so DevPod
# doesn't time out, then returns immediately.

cd /usr/src/app

nohup bash .devcontainer/setup-canvas.sh \
  > /tmp/canvas-setup.log 2>&1 &
disown

echo ""
echo "  Canvas setup is running in the background."
echo "  Follow progress:  tail -f /tmp/canvas-setup.log"
echo "  Canvas will be ready on port 3000 when setup completes (~15-20 min)."
echo ""
