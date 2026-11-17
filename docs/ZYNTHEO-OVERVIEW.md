# Zyntheo IDE Overview

**Tagline:** Intelligence in Every Line.

Zyntheo IDE is an AI-first desktop editor derived from Void IDE (VS Code fork). Product identity, owned AI surfaces, and documentation are branded Zyntheo while retaining VS Code extension compatibility and dual licensing (Apache-2.0 additions + MIT VS Code).

## Repository

- https://github.com/bimacoding/ZYNTHEO-IDE.git
- Owner: bimacoding

## Architecture direction

Hybrid: Electron + Monaco + extension host remain; Rust sidecar (`rust/zyntheo-workspace`) owns bounded filesystem/index services behind a feature flag (`ZYNTHEO_RUST_SERVICES=1`).
