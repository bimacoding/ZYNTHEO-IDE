# Risks and Decisions

## Decisions locked

| ID | Decision |
|----|----------|
| D1 | Full master prompt scope (rebrand + Rust hybrid), not surface-only |
| D2 | Full semantic rename including `contrib/void` → `contrib/zyntheo` with compatibility |
| D3 | Architecture Option E (Hybrid Rust sidecar) |
| D4 | New Windows installer GUIDs |
| D5 | No force-push; stop before first remote push for approval |
| D6 | Do not invent license; keep dual Apache-2.0 + MIT |

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Blind replace of `void` breaks C/TS language keywords | Build break | Semantic replacements only; scoped paths |
| Renaming action IDs breaks user keybindings | UX regression | Register legacy command aliases |
| Storage key rename loses chat/settings | Data loss | Read-fallback + write new keys |
| User data path change orphans Void profile | Data loss | Migration with backup; never delete Void |
| Full rename of ~100 files causes import errors | Build break | `git mv` + systematic import update + compile |
| Rust sidecar crashes | Feature loss | Feature flag + TS fallback |
| GitHub remote already has content | Push conflict | Inspect before push; never force |
| No node_modules locally | Cannot verify compile | Document; attempt install if feasible |

## Ambiguities resolved by defaults

- Tagline: "Intelligence in Every Line."
- Bundle id: `com.zyntheo.ide`
- Env vars for product-owned config: `ZYNTHEO_*` (do not rename `VSCODE_*`)
