# AspectScript on GitHub

This guide explains how to use the repository from the command line and GitHub.

Repository:
- https://github.com/pleger/aspectscript

Playground (GitHub Pages):
- https://pleger.github.io/aspectscript/

## 1) Setup

Clone and install dependencies:

```bash
git clone https://github.com/pleger/aspectscript.git
cd aspectscript
npm install
```

## 2) Run scripts or examples from CLI

Use the script runner:

```bash
npm run run:script -- tests/test-ex.js
```

You can run any `.js` file with AspectScript support (AJS, PCs, Testing):

```bash
npm run run:script -- path/to/your-script.js
```

Notes:
- `load(...)` lines are ignored automatically (for compatibility with legacy test files).
- The runner instruments JavaScript before execution, then runs it in an AspectScript-enabled VM context.

Export join point trace as machine-readable JSON:

```bash
npm run run:script -- tests/test-ex.js --trace-json trace.json
```

## 3) Use the AspectScript CLI command

You can also use the packaged CLI:

```bash
npx aspectscript run tests/test-ex.js
npx aspectscript run tests/test-ex.js --trace-json trace.json
npx aspectscript test
npx aspectscript test --failed
```

## 4) Run tests from CLI

Run all tests:

```bash
npm test
```

Run tests by prefix:

```bash
node run-tests.js testDS
node run-tests.js testRee
node run-tests.js test21
```

## 5) Run only failed tests

After a test run, failed tests are written to `tests/lastFails.txt`.

Re-run only those failed tests:

```bash
npm run test:failed
```

Equivalent direct command:

```bash
node run-tests.js --failed
```

## 6) Diagnostics

Runtime errors now include an AspectScript context line, for example:

```text
[AspectScript] join point: [exec: move] | level: 0 | receiver: Point
```

This helps identify where failures happen in advice/pointcut execution.

## 7) Citation

This implementation is based on:

Rodolfo Toledo, Paul Leger, and Eric Tanter. *AspectScript: Expressive Aspects for the Web*. AOSD'10, March 15-19, 2010, Rennes and St. Malo, France. ACM.
