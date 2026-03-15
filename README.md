# AspectScript

An implementation of the AspectScript extension language for JavaScript, based on the AOSD 2010 paper "AspectScript: Expressive Aspects for the Web".

## What is included

- A runtime and source instrumenter for AspectScript.
- A Node-based test runner that executes the original `tests/test*.js` suite while ignoring legacy `load(...)` lines.
- A static playground in `docs/` with:
  - editable examples
  - execution output
  - join point tracing

## Local usage

Install dependencies:

```bash
npm install
```

Run the test suite:

```bash
npm test
```

Run only failed tests from the previous run:

```bash
npm run test:failed
```

Run any script/example file with AspectScript runtime + instrumentation:

```bash
npm run run:script -- tests/test-ex.js
```

Serve the playground locally from `docs/`:

```bash
cd docs
python3 -m http.server 4173
```

Then open `http://127.0.0.1:4173`.

## GitHub guide

For a full command-line and GitHub usage guide, see [GITHUB_USAGE.md](./GITHUB_USAGE.md).

## Current test status

The current implementation passes 94 of 105 legacy tests. The remaining failures are concentrated in advanced scoping and reentrance edge cases.
