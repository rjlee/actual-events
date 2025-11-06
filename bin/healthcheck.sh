#!/usr/bin/env bash
set -euo pipefail

if [ ! -r /proc/1/stat ]; then
  exit 1
fi
state=$(cut -d' ' -f3 /proc/1/stat)
if [ "$state" = "Z" ]; then
  exit 1
fi

cache_dir="${BUDGET_DIR:-${ACTUAL_BUDGET_CACHE_DIR:-./data/budget}}"
if [ -n "$cache_dir" ] && [ -d "$cache_dir" ] && [ ! -r "$cache_dir" ]; then
  exit 1
fi

exit 0
