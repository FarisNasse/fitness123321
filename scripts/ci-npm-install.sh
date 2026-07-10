#!/usr/bin/env bash

set -uo pipefail

max_attempts="${NPM_CI_MAX_ATTEMPTS:-3}"
retry_delay_seconds="${NPM_CI_RETRY_DELAY_SECONDS:-15}"
log_dir="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/npm-ci-logs"
mkdir -p "$log_dir"

is_retryable_failure() {
  local log_file="$1"
  grep -Eqi \
    'Exit handler never called|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ERR_SOCKET_TIMEOUT|socket hang up|502 Bad Gateway|503 Service Unavailable|504 Gateway Time-out' \
    "$log_file"
}

append_latest_npm_debug_log() {
  local debug_dir="$1"
  local output_file="$2"
  local latest_debug_log

  latest_debug_log="$(find "$debug_dir" -maxdepth 1 -type f -name '*-debug-0.log' -printf '%T@ %p\n' 2>/dev/null \
    | sort -nr \
    | head -n 1 \
    | cut -d' ' -f2-)"

  if [[ -n "$latest_debug_log" && -f "$latest_debug_log" ]]; then
    {
      echo
      echo '===== npm debug log ====='
      cat "$latest_debug_log"
    } >> "$output_file"
  fi
}

for ((attempt = 1; attempt <= max_attempts; attempt += 1)); do
  attempt_log="$log_dir/npm-ci-attempt-${attempt}.log"
  debug_dir="$log_dir/npm-debug-attempt-${attempt}"
  mkdir -p "$debug_dir"

  echo "Running locked npm install (attempt ${attempt}/${max_attempts})"
  rm -rf node_modules

  set +e
  npm ci \
    --no-audit \
    --no-fund \
    --prefer-offline \
    --fetch-retries=5 \
    --fetch-retry-factor=2 \
    --fetch-retry-mintimeout=10000 \
    --fetch-retry-maxtimeout=60000 \
    --fetch-timeout=120000 \
    --maxsockets=5 \
    --logs-dir="$debug_dir" \
    2>&1 | tee "$attempt_log"
  install_status=${PIPESTATUS[0]}
  set -e

  if [[ $install_status -eq 0 ]]; then
    echo "npm ci completed successfully on attempt ${attempt}."
    exit 0
  fi

  append_latest_npm_debug_log "$debug_dir" "$attempt_log"

  if (( attempt == max_attempts )) || ! is_retryable_failure "$attempt_log"; then
    echo "npm ci failed with a non-retryable error or exhausted all attempts." >&2
    echo "Diagnostic logs are available in $log_dir." >&2
    exit "$install_status"
  fi

  delay=$((retry_delay_seconds * attempt))
  echo "npm hit a transient registry/npm CLI failure; retrying in ${delay} seconds." >&2
  sleep "$delay"
done
