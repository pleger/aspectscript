# npm Publish Readiness

This project is configured for npm packaging, with:
- `main` entry (`aspectscript.js`)
- `types` entry (`index.d.ts`)
- `bin` command (`aspectscript`)

Current state:
- `package.json` still has `"private": true` to prevent accidental publish.

## Checklist

1. Set package metadata

```json
{
  "name": "aspectscript",
  "version": "0.1.0",
  "description": "AspectScript runtime and tooling",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/pleger/aspectscript.git"
  }
}
```

2. Remove publish guard
- Change `"private": true` to `"private": false` (or remove `private`).

3. Dry run package contents

```bash
npm pack --dry-run
```

4. Verify commands

```bash
npm test
npm run test:conformance
npx aspectscript --help
```

5. Publish

```bash
npm publish --access public
```

## Optional hardening

- Add `"files"` in `package.json` to control published artifacts explicitly.
- Add CI workflow for `npm test` + `npm run test:conformance` before release.
