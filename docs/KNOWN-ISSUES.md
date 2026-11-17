# Known Issues

1. **Update/binaries** — update checker points at `bimacoding/ZYNTHEO-IDE` releases; packaged desktop binaries may not exist yet.
2. **Rust hot-path wiring** — protocol v1 + channel exist; only `getAllURIsInDirectory` may use Rust when `ZYNTHEO_RUST_SERVICES=1`. ASCII directory strings, native file watching, and release-packaged sidecar remain deferred.
3. **App-level RAM benchmarks** — sidecar micro-bench exists; Electron total RSS comparison NOT_STARTED (no RAM improvement claims).
4. **Residual "Void" strings** — heritage comments and migration source path names remain intentionally.
5. **Asset filename** — welcome image still `slice_of_void.png` (content/asset path); optional later rebrand of media files.
6. **AppImage icon** — `zyntheo.png` may be a copy of legacy `void.png` until a dedicated icon is supplied.
