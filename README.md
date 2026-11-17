# Zyntheo IDE

**Intelligence in Every Line.**

Zyntheo IDE is an AI-first desktop code editor. It is independently maintained under [bimacoding/ZYNTHEO-IDE](https://github.com/bimacoding/ZYNTHEO-IDE).

## Heritage and licensing

Zyntheo is derived from [Void IDE](https://github.com/voideditor/void) (Apache-2.0 product additions by Glass Devtools, Inc.), which itself is a fork of [Visual Studio Code](https://github.com/microsoft/vscode) (MIT).

Required notices are retained in:

- [`LICENSE.txt`](LICENSE.txt) — Apache 2.0 (product additions)
- [`LICENSE-VS-Code.txt`](LICENSE-VS-Code.txt) — MIT (VS Code)
- [`ThirdPartyNotices.txt`](ThirdPartyNotices.txt)

## Features

- AI chat and agent workflows with configurable model providers
- Fast Apply / Slow Apply code edits with reviewable diffs
- Autocomplete (FIM), Ctrl+K quick edit, Ctrl+L chat
- Full VS Code-compatible editor, extensions, terminal, git, and debug

## Develop

See [`HOW_TO_CONTRIBUTE.md`](HOW_TO_CONTRIBUTE.md) and [`docs/ZYNTHEO-OVERVIEW.md`](docs/ZYNTHEO-OVERVIEW.md).

```bash
# Node 20.18.2 recommended (.nvmrc)
npm install
npm run buildreact
npm run watch
./scripts/code.sh   # macOS/Linux
```

## Documentation

Architecture, rebrand map, Rust plan, and compliance docs live under [`docs/`](docs/).

## Support

- Issues: https://github.com/bimacoding/ZYNTHEO-IDE/issues
