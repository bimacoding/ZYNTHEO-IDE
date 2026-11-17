#!/usr/bin/env bash
# Build release zyntheo-sidecar and stage for packaging/dev discovery.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WS="$ROOT/rust/zyntheo-workspace"
OUT_BUILD="$ROOT/.build/zyntheo-sidecar"
OUT_HELPERS="$ROOT/resources/helpers"
BIN_NAME="zyntheo-sidecar"

mkdir -p "$OUT_BUILD" "$OUT_HELPERS"
(
  cd "$WS"
  unset CARGO_TARGET_DIR
  cargo build --release -p zyntheo-sidecar --target-dir ./target
)
SRC="$WS/target/release/$BIN_NAME"
if [[ ! -x "$SRC" ]]; then
  echo "missing binary: $SRC" >&2
  exit 1
fi
cp -f "$SRC" "$OUT_BUILD/$BIN_NAME"
cp -f "$SRC" "$OUT_HELPERS/$BIN_NAME"
chmod +x "$OUT_BUILD/$BIN_NAME" "$OUT_HELPERS/$BIN_NAME"
echo "Staged:"
ls -lh "$OUT_BUILD/$BIN_NAME" "$OUT_HELPERS/$BIN_NAME"
