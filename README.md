# AspectScript

An implementation of the AspectScript extension language for JavaScript, based on the AOSD 2010 paper "AspectScript: Expressive Aspects for the Web".

## What is included

- A runtime and source instrumenter for AspectScript.
- A Node-based test runner that executes the original `tests/test*.js` suite while ignoring legacy `load(...)` lines.
- A CLI command (`aspectscript`) for running scripts and tests.
- TypeScript type definitions (`index.d.ts`).
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

Run with cache statistics:

```bash
node run-tests.js --cache-stats
```

Run only failed tests from the previous run:

```bash
npm run test:failed
```

Run any script/example file with AspectScript runtime + instrumentation:

```bash
npm run run:script -- tests/test-ex.js
```

Run and export execution trace as JSON:

```bash
npm run run:script -- tests/test-ex.js --trace-json trace.json
```

Disable transform cache for a run:

```bash
npm run run:script -- tests/test-ex.js --no-cache
node run-tests.js --no-cache
```

Run paper-aligned conformance examples:

```bash
npm run test:conformance
```

Use the CLI command:

```bash
npx aspectscript run tests/test-ex.js
npx aspectscript test
npx aspectscript test --failed
```

Serve the playground locally from `docs/`:

```bash
cd docs
python3 -m http.server 4173
```

Then open `http://127.0.0.1:4173`.

## GitHub guide

For a full command-line and GitHub usage guide, see [GITHUB_USAGE.md](./GITHUB_USAGE.md).
For practical examples/patterns, see [PATTERNS.md](./PATTERNS.md).
For package publishing readiness, see [NPM_PUBLISH.md](./NPM_PUBLISH.md).

## Current test status

The current implementation passes 105 of 105 legacy tests.
