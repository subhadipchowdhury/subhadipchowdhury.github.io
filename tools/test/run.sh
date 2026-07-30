#!/bin/sh
# Runs the engine test suites.
#
# Uses node when it is installed, and otherwise the JavaScriptCore shell that
# ships with macOS, so a clean machine needs no toolchain to run these.

set -e
here=$(cd "$(dirname "$0")" && pwd)

if command -v node >/dev/null 2>&1; then
  runner="node"
else
  jsc=/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc
  if [ ! -x "$jsc" ]; then
    echo "No node and no JavaScriptCore shell; cannot run the tests." >&2
    exit 127
  fi
  runner="$jsc -m"
fi

status=0
for suite in "$here"/*.test.mjs; do
  echo "── $(basename "$suite")"
  # jsc reports failures through the report block, not the exit code, so the
  # output is scanned for the marker as well.
  out=$($runner "$suite" 2>&1) || status=1
  echo "$out"
  case "$out" in *FAILED*) status=1 ;; esac
done
exit $status
