# Known Issues

1. **TypeScript/Electron compile not verified** — workspace lacks `node_modules`; React `out/` must be rebuilt after rename.
2. **GitHub push pending** — remote `main` already has commits; push requires explicit user approval; no force-push.
3. **Update/binaries** — update checker points at `bimacoding/ZYNTHEO-IDE` releases; binaries may not exist yet.
4. **Rust hot-path wiring** — sidecar exists but directory context still defaults to TypeScript until flag enabled and binary shipped.
5. **Residual "Void" strings** — heritage comments and migration source path names remain intentionally.
6. **Asset filename** — welcome image still `slice_of_void.png` (content/asset path); optional later rebrand of media files.
7. **AppImage icon** — `zyntheo.png` may be a copy of legacy `void.png` until a dedicated icon is supplied.
