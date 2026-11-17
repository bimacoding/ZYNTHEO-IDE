#!/usr/bin/env bash
# Full PASS suite for Zyntheo Rust hybrid phases (cargo + integration + compile).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WS="$ROOT/rust/zyntheo-workspace"
REPORT="$ROOT/.build/zyntheo-rust-pass-report.txt"
mkdir -p "$(dirname "$REPORT")"
{
  echo "Zyntheo Rust PASS suite — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "host=$(uname -s)-$(uname -m)"
  echo
} > "$REPORT"

pass() { echo "PASS $1" | tee -a "$REPORT"; }
fail() { echo "FAIL $1 $2" | tee -a "$REPORT"; exit 1; }

echo "== cargo test (workspace) =="
(
  cd "$WS"
  unset CARGO_TARGET_DIR
  cargo test --workspace --target-dir ./target 2>&1 | tee -a "$REPORT"
) || fail "cargo_test" "see report"
pass "cargo_test"

echo "== build + stage sidecar =="
"$ROOT/scripts/build-zyntheo-sidecar.sh" 2>&1 | tee -a "$REPORT"
pass "build_sidecar"

echo "== integration protocol =="
"$ROOT/scripts/rust-sidecar-integration.sh" 2>&1 | tee -a "$REPORT"
pass "integration"

echo "== npm compile =="
(
  cd "$ROOT"
  npm run compile 2>&1 | tee -a "$REPORT"
) || fail "npm_compile" "see report"
pass "npm_compile"

echo "== process-level list_files bench (informational) =="
if [[ -x "$ROOT/scripts/rust-sidecar-compare-bench.sh" ]]; then
  "$ROOT/scripts/rust-sidecar-compare-bench.sh" 2>&1 | tee -a "$REPORT" || true
  pass "bench_ran"
else
  pass "bench_skipped"
fi

echo
echo "ALL_PASS — report: $REPORT"
echo "ALL_PASS" >> "$REPORT"
