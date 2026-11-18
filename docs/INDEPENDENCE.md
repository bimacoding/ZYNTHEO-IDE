# Zyntheo Independence from Void

**Status:** VERIFIED 2026-11-19

Zyntheo IDE is independently maintained at [`bimacoding/ZYNTHEO-IDE`](https://github.com/bimacoding/ZYNTHEO-IDE). Runtime, packaging, remote-server downloads, and update checks no longer call Void repositories.

Heritage licenses remain (Apache-2.0 product additions + MIT VS Code). Historical identifiers are documented in [ORIGINAL-VOID-IDENTIFIERS.md](ORIGINAL-VOID-IDENTIFIERS.md) and must not be treated as current.

## Owned repositories

| Role | Repository |
|------|------------|
| Source / desktop releases | https://github.com/bimacoding/ZYNTHEO-IDE |
| Packaging / GitHub Actions | https://github.com/bimacoding/ZYNTHEO-IDE-builder |
| Auto-update metadata | https://github.com/bimacoding/ZYNTHEO-IDE-versions |

## Runtime retargets

| Former Void endpoint | Zyntheo endpoint |
|----------------------|------------------|
| `voideditor/void` | `bimacoding/ZYNTHEO-IDE` |
| `voideditor/binaries` | `bimacoding/ZYNTHEO-IDE` releases |
| `voideditor/void-builder` | `bimacoding/ZYNTHEO-IDE-builder` |
| `voideditor/versions` | `bimacoding/ZYNTHEO-IDE-versions` |
| Remote REH `void-reh-*` | `zyntheo-reh-*` from Zyntheo releases |

## GitHub fork network

All three owned repositories left the Void fork network on 2026-11-19 (`isFork: false`, no parent):

- `bimacoding/ZYNTHEO-IDE`
- `bimacoding/ZYNTHEO-IDE-builder`
- `bimacoding/ZYNTHEO-IDE-versions`

Source, remotes, runtime URLs, packaging, and GitHub network identity are independent of Void.

## Verification

```bash
git remote -v
# origin https://github.com/bimacoding/ZYNTHEO-IDE.git

# No git submodules and no voideditor remotes.
test ! -f .gitmodules

# Runtime download templates point at bimacoding.
rg 'voideditor/binaries' extensions/open-remote-ssh/src/serverSetup.ts
# no matches
```
