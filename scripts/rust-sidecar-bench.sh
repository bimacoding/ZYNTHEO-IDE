#!/usr/bin/env bash
# Micro-benchmark: spawn release sidecar, time list_tree / list_files.
# Does NOT measure Electron RSS. See docs/RUST-PERFORMANCE-BENCHMARKS.md.
set -euo pipefail
ROOT="${1:-.}"
ROOT="$(cd "$ROOT" && pwd)"
WS="$(cd "$(dirname "$0")/.." && pwd)/rust/zyntheo-workspace"
BIN="$WS/target/release/zyntheo-sidecar"

if [[ ! -x "$BIN" ]]; then
  echo "Building release sidecar..."
  (cd "$WS" && unset CARGO_TARGET_DIR && cargo build --release -p zyntheo-sidecar --target-dir ./target)
fi

python3 - "$BIN" "$ROOT" <<'PY'
import json, struct, subprocess, sys, time

bin_path, root = sys.argv[1], sys.argv[2]
PROTO = 1

def frame(obj: dict) -> bytes:
    body = json.dumps(obj).encode()
    return struct.pack(">I", len(body)) + body

def read_one(proc):
    hdr = proc.stdout.read(4)
    if not hdr or len(hdr) < 4:
        raise RuntimeError("eof")
    (n,) = struct.unpack(">I", hdr)
    body = proc.stdout.read(n)
    return json.loads(body)

proc = subprocess.Popen([bin_path], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
try:
    proc.stdin.write(frame({"protocol_version": PROTO, "id": "1", "op": "health", "payload": {}}))
    proc.stdin.flush()
    health = read_one(proc)
    assert health.get("ok"), health

    def timed(op, payload, rid):
        t0 = time.perf_counter()
        proc.stdin.write(frame({"protocol_version": PROTO, "id": rid, "op": op, "payload": payload}))
        proc.stdin.flush()
        resp = read_one(proc)
        dt = (time.perf_counter() - t0) * 1000
        n = len((resp.get("result") or {}).get("entries") or [])
        trunc = (resp.get("result") or {}).get("truncated")
        print(f"{op}: {dt:.1f} ms entries={n} truncated={trunc} ok={resp.get('ok')}")
        return resp

    timed("list_tree", {"root": root, "max_files": 20000}, "2")
    timed("list_files", {"root": root, "max_files": 20000}, "3")
    timed("build_index", {"root": root, "max_files": 20000}, "4")
    timed("refresh_index", {"root": root}, "5")

    proc.stdin.write(frame({"protocol_version": PROTO, "id": "9", "op": "shutdown", "payload": {}}))
    proc.stdin.flush()
    read_one(proc)
finally:
    proc.kill()
PY
