# License Compliance

**Status:** VERIFIED against license files (legal text not invented)

## Dual licensing

1. **Apache License 2.0** — Void/Zyntheo product additions  
   - File: `LICENSE.txt`  
   - Historical copyright: Glass Devtools, Inc. (2025) on many Void files

2. **MIT License** — Microsoft VS Code upstream  
   - File: `LICENSE-VS-Code.txt`  
   - `ThirdPartyNotices.txt` retained

## Obligations

- Preserve copyright and license notices in source headers
- Do not remove `LICENSE.txt`, `LICENSE-VS-Code.txt`, or `ThirdPartyNotices.txt`
- Rebranding product names does **not** change the license grant
- `product.json` `licenseName` / `licenseUrl` should accurately point at retained license files and the new repository when updated

## What we will NOT do

- Invent a new project license
- Strip Microsoft MIT notices from upstream files
- Claim Zyntheo is not a derivative of VS Code / Void

## Attribution for README

Zyntheo IDE is derived from Void IDE (Apache-2.0 additions) which is a fork of Visual Studio Code (MIT).
