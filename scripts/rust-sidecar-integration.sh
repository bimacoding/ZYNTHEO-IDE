#!/usr/bin/env bash
# Protocol-level integration checks against release sidecar (not Electron RSS).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WS="$ROOT/rust/zyntheo-workspace"
BIN="$WS/target/release/zyntheo-sidecar"
PROTO=1

if [[ ! -x "$BIN" ]]; then
  "$ROOT/scripts/build-zyntheo-sidecar.sh"
  BIN="$WS/target/release/zyntheo-sidecar"
fi

python3 - "$BIN" "$ROOT" <<'PY'
import json, os, struct, subprocess, sys, tempfile, time
from pathlib import Path

bin_path, repo = sys.argv[1], Path(sys.argv[2])
PROTO = 1
failed = 0

def frame(obj):
    body = json.dumps(obj).encode()
    return struct.pack(">I", len(body)) + body

def read_one(proc):
    hdr = proc.stdout.read(4)
    if not hdr or len(hdr) < 4:
        raise RuntimeError("eof")
    (n,) = struct.unpack(">I", hdr)
    return json.loads(proc.stdout.read(n))

def start():
    return subprocess.Popen([bin_path], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

def check(name, cond, detail=""):
    global failed
    if cond:
        print(f"PASS {name}")
    else:
        failed += 1
        print(f"FAIL {name} {detail}")

# 1) health + version
p = start()
p.stdin.write(frame({"protocol_version": PROTO, "id": "1", "op": "health", "payload": {}})); p.stdin.flush()
h = read_one(p)
check("health_ok", h.get("ok") is True, h)
check("protocol_version", (h.get("result") or {}).get("protocol_version") == PROTO, h)

# 2) version mismatch terminates / errors
p2 = start()
p2.stdin.write(frame({"protocol_version": 999, "id": "v", "op": "ping", "payload": {}})); p2.stdin.flush()
try:
    bad = read_one(p2)
    check("version_mismatch_error", bad.get("ok") is False and (bad.get("error") or {}).get("code") == "VERSION_MISMATCH", bad)
except Exception as e:
    check("version_mismatch_error", False, str(e))
p2.wait(timeout=3)

# 3) list_files on known tree
p.stdin.write(frame({"protocol_version": PROTO, "id": "2", "op": "list_files", "payload": {"root": str(repo / "rust" / "zyntheo-workspace"), "max_files": 500}})); p.stdin.flush()
lf = read_one(p)
check("list_files", lf.get("ok") is True and len((lf.get("result") or {}).get("entries") or []) > 0, lf)

# 4) watch_start / poll / stop
with tempfile.TemporaryDirectory() as td:
    p.stdin.write(frame({"protocol_version": PROTO, "id": "3", "op": "watch_start", "payload": {"root": td, "debounce_ms": 100}})); p.stdin.flush()
    ws = read_one(p)
    wid = (ws.get("result") or {}).get("watch_id")
    check("watch_start", ws.get("ok") is True and bool(wid), ws)
    Path(td, "x.txt").write_text("hi")
    time.sleep(0.5)
    p.stdin.write(frame({"protocol_version": PROTO, "id": "4", "op": "watch_poll", "payload": {"watch_id": wid, "max_events": 20}})); p.stdin.flush()
    wp = read_one(p)
    check("watch_poll", wp.get("ok") is True, wp)
    p.stdin.write(frame({"protocol_version": PROTO, "id": "5", "op": "watch_stop", "payload": {"watch_id": wid}})); p.stdin.flush()
    wst = read_one(p)
    check("watch_stop", wst.get("ok") is True, wst)

# 5) search
p.stdin.write(frame({"protocol_version": PROTO, "id": "6", "op": "search", "payload": {"root": str(repo / "rust" / "zyntheo-workspace" / "crates" / "zyntheo-core"), "query": "PROTOCOL_VERSION", "literal": True, "max_matches": 20}})); p.stdin.flush()
sr = read_one(p)
check("search", sr.get("ok") is True and len((sr.get("result") or {}).get("matches") or []) >= 1, sr)

# 6) stat_paths
p.stdin.write(frame({"protocol_version": PROTO, "id": "7", "op": "stat_paths", "payload": {"root": str(repo / "rust" / "zyntheo-workspace"), "paths": ["Cargo.toml", "crates/zyntheo-core/src/lib.rs"]}})); p.stdin.flush()
st = read_one(p)
check("stat_paths", st.get("ok") is True and len((st.get("result") or {}).get("entries") or []) >= 1, st)

# 7) crash recovery: kill process; next spawn should work
p.kill(); p.wait(timeout=3)
p3 = start()
p3.stdin.write(frame({"protocol_version": PROTO, "id": "8", "op": "ping", "payload": {}})); p3.stdin.flush()
pong = read_one(p3)
check("respawn_after_crash", pong.get("ok") is True, pong)

# 8) Phase 3: resource_stats + JobGate exposure
p3.stdin.write(frame({"protocol_version": PROTO, "id": "10", "op": "resource_stats", "payload": {}})); p3.stdin.flush()
rs = read_one(p3)
rsr = rs.get("result") or {}
check("resource_stats", rs.get("ok") is True and int(rsr.get("jobs_max") or 0) >= 1, rs)
check("resource_stats_rss", rsr.get("rss_bytes") is None or int(rsr.get("rss_bytes") or 0) >= 0, rs)

# 9) Phase 2/3: list_files dedupe cache_hit on second call
root_ws = str(repo / "rust" / "zyntheo-workspace")
p3.stdin.write(frame({"protocol_version": PROTO, "id": "11", "op": "list_files", "payload": {"root": root_ws, "max_files": 200}})); p3.stdin.flush()
lf1 = read_one(p3)
p3.stdin.write(frame({"protocol_version": PROTO, "id": "12", "op": "list_files", "payload": {"root": root_ws, "max_files": 200}})); p3.stdin.flush()
lf2 = read_one(p3)
check("list_files_ok", lf1.get("ok") is True and lf2.get("ok") is True, (lf1, lf2))
check("list_files_cache_hit", (lf2.get("result") or {}).get("cache_hit") is True, lf2)

# 10) Adaptive policy unit (mirrors TS client thresholds)
def should_adaptively_disable(rss, max_rss, limit_streak, max_streak):
    if max_rss > 0 and rss is not None and rss > max_rss:
        return True
    if limit_streak >= max_streak:
        return True
    return False
check("adaptive_policy_rss", should_adaptively_disable(100, 50, 0, 3) is True)
check("adaptive_policy_streak", should_adaptively_disable(10, 0, 3, 3) is True)
check("adaptive_policy_ok", should_adaptively_disable(10, 100, 1, 3) is False)

p3.stdin.write(frame({"protocol_version": PROTO, "id": "9", "op": "shutdown", "payload": {}})); p3.stdin.flush()
read_one(p3)
p3.wait(timeout=3)

# 11) binary exists
check("binary_exists", os.path.isfile(bin_path) and os.access(bin_path, os.X_OK), bin_path)

# 12) packaging staging paths exist after build script
helpers = repo / "resources" / "helpers" / ("zyntheo-sidecar.exe" if os.name == "nt" else "zyntheo-sidecar")
build_stage = repo / ".build" / "zyntheo-sidecar" / ("zyntheo-sidecar.exe" if os.name == "nt" else "zyntheo-sidecar")
check("helpers_staged", helpers.is_file(), str(helpers))
check("build_staged", build_stage.is_file(), str(build_stage))

sys.exit(1 if failed else 0)
PY
