# AspectScript 10-Step Roadmap Status

Last updated: March 17, 2026

1. Semantic parity with paper/tests: **Done** (`105/105` passing)
2. Reentrancy and advice-order hardening: **Done**
3. Scoping strategies explicit and testable: **Done** (runtime fixes + passing DS/DD tests)
4. Source-focused diagnostics: **Done** (runtime errors include join point/level/receiver context)
5. Machine-readable trace format: **Done** (`AJS.tracer.toJSON`, `AJS.tracer.saveToFile`, CLI `--trace-json`)
6. TypeScript typings: **Done** (`index.d.ts`)
7. npm package + CLI workflow: **In Progress** (`aspectscript` CLI ready; publish checklist added in `NPM_PUBLISH.md`)
8. Instrumentation/performance caching: **Done** (`.aspectscript-cache`, `--no-cache`, `--cache-stats`)
9. Conformance suite from paper examples: **Done** (`conformance/`, `run-conformance.js`, `npm run test:conformance`)
10. Practical docs and patterns: **Done** (`PATTERNS.md` + README/GitHub guide updates)
