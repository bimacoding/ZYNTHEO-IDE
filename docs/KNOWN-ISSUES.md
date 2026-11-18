# Known Issues

1. **Update/binaries** — update checker and remote REH downloads point at `bimacoding/ZYNTHEO-IDE` releases; packaged desktop/REH binaries are produced by `bimacoding/ZYNTHEO-IDE-builder` and may not exist until that workflow has published a release.
2. **Rust hot-path wiring** — protocol v1 + channel exist; only `getAllURIsInDirectory` may use Rust when `ZYNTHEO_RUST_SERVICES=1`. ASCII directory strings, native file watching, and release-packaged sidecar remain deferred.
3. **App-level RAM benchmarks** — sidecar micro-bench exists; Electron total RSS comparison NOT_STARTED (no RAM improvement claims).
4. **Residual "Void" strings** — heritage comments and migration source path names remain intentionally.
5. **Asset filename** — some heritage filenames remain (`slice_of_void.png`, `cubecircled.png`) but the artwork is now the Zyntheo logo.
6. **AppImage icon** — `scripts/appimage/zyntheo.png` now uses the Zyntheo logo.
