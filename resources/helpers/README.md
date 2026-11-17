# Zyntheo helpers

Built artifacts staged here by `npm run build-zyntheo-sidecar`:

- `zyntheo-sidecar` — Rust performance sidecar (gitignored binary)

Also copied to `.build/zyntheo-sidecar/`. Desktop packaging (`build/gulpfile.vscode.js`) embeds this helper under `resources/helpers/` when present. The Electron client resolves packaged + dev paths; missing binary → TS fallback.
