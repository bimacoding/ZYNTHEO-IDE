# Zyntheo IDE Overview

**Tagline:** Intelligence in Every Line.

Zyntheo IDE is an independently maintained AI-first desktop editor. It started from Void IDE (VS Code fork) and now ships, updates, and packages from bimacoding repositories only. Product identity, owned AI surfaces, and documentation are branded Zyntheo while retaining VS Code extension compatibility and dual licensing (Apache-2.0 additions + MIT VS Code).

## Repository

- Source: https://github.com/bimacoding/ZYNTHEO-IDE.git
- Builder: https://github.com/bimacoding/ZYNTHEO-IDE-builder
- Update metadata: https://github.com/bimacoding/ZYNTHEO-IDE-versions
- Owner: bimacoding
- Independence notes: [INDEPENDENCE.md](INDEPENDENCE.md)

## Architecture direction

Hybrid: Electron + Monaco + extension host remain; Rust sidecar (`rust/zyntheo-workspace`) owns bounded filesystem/index services behind a feature flag (`ZYNTHEO_RUST_SERVICES=1`).
