#!/usr/bin/env bash
# Compare Rust sidecar list_files vs a Python walk baseline (not Electron RSS).
set -euo pipefail
ROOT_WORK="${1:-}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -z "$ROOT_WORK" ]]; then
  ROOT_WORK="$REPO/src"
fi
ROOT_WORK="$(cd "$ROOT_WORK" && pwd)"
BIN="$REPO/rust/zyntheo-workspace/target/release/zyntheo-sidecar"
if [[ ! -x "$BIN" ]]; then
  "$REPO/scripts/build-zyntheo-sidecar.sh"
fi

python3 - "$BIN" "$ROOT_WORK" <<'PY'
import json, os, struct, subprocess, sys, time
from pathlib import Path

bin_path, root = sys.argv[1], Path(sys.argv[2])
PROTO = 1
EXCLUDE = {
    ".git","node_modules","dist","build","out","bin","coverage","__pycache__",
    "env","venv","tmp","temp","artifacts","target","obj","vendor","logs","cache",
    "resource","resources",
}

def frame(obj):
    body = json.dumps(obj).encode()
    return struct.pack(">I", len(body)) + body

def read_one(proc):
    hdr = proc.stdout.read(4)
    (n,) = struct.unpack(">I", hdr)
    return json.loads(proc.stdout.read(n))

def py_list_files(root: Path, max_files=50000):
    out = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE and not d.startswith(".")]
        for fn in filenames:
            rel = str(Path(dirpath, fn).relative_to(root)).replace("\\", "/")
            out.append(rel)
            if len(out) >= max_files:
                return out, True
    return out, False

# baseline
t0 = time.perf_counter()
py_files, py_trunc = py_list_files(root)
py_ms = (time.perf_counter() - t0) * 1000

# rust
proc = subprocess.Popen([bin_path], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
proc.stdin.write(frame({"protocol_version": PROTO, "id": "1", "op": "health", "payload": {}})); proc.stdin.flush()
assert read_one(proc).get("ok")
t1 = time.perf_counter()
proc.stdin.write(frame({"protocol_version": PROTO, "id": "2", "op": "list_files", "payload": {"root": str(root), "max_files": 50000}})); proc.stdin.flush()
resp = read_one(proc)
rust_ms = (time.perf_counter() - t1) * 1000
entries = (resp.get("result") or {}).get("entries") or []
proc.stdin.write(frame({"protocol_version": PROTO, "id": "9", "op": "shutdown", "payload": {}})); proc.stdin.flush()
try:
    read_one(proc)
except Exception:
    pass
proc.wait(timeout=3)

print(f"workspace={root}")
print(f"python_walk_ms={py_ms:.1f} files={len(py_files)} truncated={py_trunc}")
print(f"rust_list_files_ms={rust_ms:.1f} files={len(entries)} truncated={(resp.get('result') or {}).get('truncated')} ok={resp.get('ok')}")
if py_ms > 0:
    print(f"ratio_python_over_rust={py_ms/rust_ms:.2f}x" if rust_ms > 0 else "ratio=n/a")
print("NOTE: Python walk is a process-level baseline, not Electron IFileService / full IDE RSS.")
PY
