# Test Report

| Suite | Command | Result | Notes |
|-------|---------|--------|-------|
| Rust workspace unit tests | `cd rust/zyntheo-workspace && cargo test --workspace` | PASSED | 5 tests |
| npm compile | `npm run compile` | DEFERRED | no node_modules |
| React build | `npm run buildreact` | DEFERRED | no node_modules |
| Smoke | `npm run smoketest` | DEFERRED | requires build |

Upstream vs new regressions cannot be separated until TypeScript compile runs.
