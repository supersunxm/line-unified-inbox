#!/usr/bin/env bash
set -euo pipefail

DOCKER_BIN="${DOCKER_BIN:-docker}"
WORKER_IMAGE="${WORKER_IMAGE:-line-chat-worker-tini-runtime-bootstrap:test}"
if ! "$DOCKER_BIN" image inspect "$WORKER_IMAGE" >/dev/null 2>&1; then
  printf 'Missing worker image: %s\n' "$WORKER_IMAGE" >&2
  exit 1
fi

test_root="$(mktemp -d)"
trap 'rm -rf "$test_root"' EXIT
fake_bin="$test_root/fake-bin"
mkdir -p "$fake_bin"
cat > "$fake_bin/node" <<'NODE'
#!/bin/sh
set -eu

expected_arg='dist/line-chat/line-chat-nickname-worker.js'
[ "$#" -eq 1 ] && [ "$1" = "$expected_arg" ]

pid1_comm="$(cat /proc/1/comm)"
tini_count=0
for comm_file in /proc/[0-9]*/comm; do
  [ -r "$comm_file" ] || continue
  IFS= read -r process_comm < "$comm_file" || continue
  if [ "$process_comm" = "tini" ]; then
    tini_count=$((tini_count + 1))
  fi
done

case "${EXPECTED_TINI_WRAPPED:?}" in
  1)
    [ "$pid1_comm" = "tini" ]
    [ "$$" -ne 1 ]
    [ "${LINE_CHAT_TINI_WRAPPED:-0}" = "1" ]
    [ "$tini_count" -eq 1 ]
    ;;
  0)
    [ "$pid1_comm" = "tini" ]
    [ "$$" -ne 1 ]
    [ "${LINE_CHAT_TINI_WRAPPED:-0}" = "0" ]
    [ "$tini_count" -eq 1 ]
    ;;
  guard)
    [ "$$" -eq 1 ]
    [ "${LINE_CHAT_TINI_WRAPPED:-0}" = "1" ]
    [ "$tini_count" -eq 0 ]
    ;;
  *)
    printf 'Unexpected EXPECTED_TINI_WRAPPED value.\n' >&2
    exit 1
    ;;
esac

printf 'PASS wrapper=%s node_pid_is_1=%s tini_processes=%s worker_entrypoint=preserved\n' \
  "$EXPECTED_TINI_WRAPPED" "$([ "$$" -eq 1 ] && printf true || printf false)" "$tini_count"
NODE
chmod +x "$fake_bin/node"

image_worker_script='/app/backend/scripts/start-line-chat-worker.sh'
container_path='/tmp/tini-bootstrap-test-bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
mount_fake_bin="$fake_bin:/tmp/tini-bootstrap-test-bin:ro"

# Railway bypasses Docker ENTRYPOINT: a shell starts as PID 1 and bootstraps Tini.
"$DOCKER_BIN" run --rm \
  --entrypoint /bin/sh \
  -v "$mount_fake_bin" \
  -e "PATH=$container_path" \
  -e EXPECTED_TINI_WRAPPED=1 \
  "$WORKER_IMAGE" \
  -c "exec /bin/sh $image_worker_script"

# Docker ENTRYPOINT already supplies PID 1: only that one Tini process remains.
"$DOCKER_BIN" run --rm \
  -v "$mount_fake_bin" \
  -e "PATH=$container_path" \
  -e EXPECTED_TINI_WRAPPED=0 \
  "$WORKER_IMAGE" \
  /bin/sh -c "exec /bin/sh $image_worker_script"

# The exported guard makes a PID-1 re-entry idempotent.
"$DOCKER_BIN" run --rm \
  --entrypoint /bin/sh \
  -v "$mount_fake_bin" \
  -e "PATH=$container_path" \
  -e LINE_CHAT_TINI_WRAPPED=1 \
  -e EXPECTED_TINI_WRAPPED=guard \
  "$WORKER_IMAGE" \
  -c "exec /bin/sh $image_worker_script"
