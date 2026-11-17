# Contributing to Zyntheo IDE

## Prerequisites

- Node.js 20.18.2 (see `.nvmrc`)
- npm (yarn is rejected by the preinstall script)
- Optional: Rust stable toolchain for `rust/zyntheo-workspace`

## Setup

```bash
npm install
npm run buildreact
npm run watch
./scripts/code.sh
```

## Rust services

```bash
cd rust/zyntheo-workspace
cargo test --workspace
cargo build --release -p zyntheo-sidecar
# optional: ZYNTHEO_RUST_SERVICES=1 ZYNTHEO_SIDECAR_PATH=./target/release/zyntheo-sidecar
```

## Guidelines

- Do not rename `vscode` namespaces or `VSCODE_*` environment variables
- Preserve license headers
- Prefer semantic product renames over blind text replace of the word `void`
- See `docs/` for architecture and rebranding maps

Heritage build notes also live in `HOW_TO_CONTRIBUTE.md`.
