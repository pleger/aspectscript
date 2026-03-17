# Step 1 Baseline and Triage (March 17, 2026)

This document captures the Step 1 deliverable of the plan:
- baseline run
- failure clustering by semantic root cause
- paper-backed expectations to guide fixes

Reference paper used for Step 1:
- `/Users/pleger/Downloads/1-s2.0-S0167642313002244-main.pdf`
- Tanter, Figueroa, Tabareau. *Execution levels for aspect-oriented programming* (Science of Computer Programming 80, 2014).

## 1) Baseline

Command:

```bash
node run-tests.js
```

Result:
- Evaluated: `105`
- Failed: `11`

Current failing tests:
- `test-ctx.js`
- `test-dd-03.js`
- `test-ss.js`
- `test15.js`
- `test21-modifyingJPData.js`
- `testDS06.js`
- `testRee01.js`
- `testRee02.js`
- `testRee03.js`
- `testRee04.js`
- `testRee16-jpOrder.js`

`tests/lastFails.txt` now reflects this baseline.

## 2) Paper-Guided Semantic Baseline

From the paper (used as guidance for expected behavior in this codebase):
- Execution levels are stratified; join points are emitted one level above current computation.
- Aspects affect join points one level below their deployment level.
- The default should defensively reduce regression risk.
- In AspectScript specifically, execution levels + reentrancy control should allow safe `down` usage without reintroducing loops.
- Control-flow reasoning should be level-sensitive (avoid conflating base computation and aspect/meta computation).

These principles map directly to current failing clusters around:
- reentrancy (`noBR`, `down`)
- cflow / parent-chain visibility
- scoping strategy and deployment propagation

## 3) Failure Clusters

### Cluster A: Deployment Scope and Join-Point Visibility

Tests:
- `test-ctx.js`
- `test-ss.js`
- `test15.js`
- `testDS06.js`
- `test-dd-03.js`

Observed symptoms:
- Missing expected `pr`/`call` join points in object-scoped scenarios.
- Unexpected extra matches in propagated/deployed contexts.
- Missing matches for interface-driven call pointcuts.
- Duplicate or leaked match in dynamic call/deployment path.

Primary hotspots in runtime:
- `currentVisibleAspects`, `aspectsFromLexicalContexts` in `aspectscript.js`
- frame construction in `wrap(...)` (lexical object/function visibility)
- propagation path (`computePropagation`, `pendingCalls`)
- strategy gates (`c`, `d`, `f`) in deployment evaluation

Working hypothesis:
- Aspect visibility and propagation across call/exec boundaries is inconsistent between lexical and dynamic paths, especially for `deployOn(...)` and strategy arrays.

### Cluster B: Advice Order and JP Data Isolation

Tests:
- `test21-modifyingJPData.js`
- `testRee16-jpOrder.js`

Observed symptoms:
- Advice ordering mismatch (`before` behaves as LIFO where tests expect FIFO).
- cflow/order interaction includes join point `z` when it should be excluded.

Primary hotspots in runtime:
- chain construction loop in `weave(...)` for `before`/`around`
- cflow parent traversal and ordering assumptions

Working hypothesis:
- Advice chain composition order is inverted for `before`.
- Parent/cflow timing around `before` advice execution may conflate pre-body advice activity with function execution context.

### Cluster C: Reentrancy and Execution Levels (`noBR` + `down`)

Tests:
- `testRee01.js`
- `testRee02.js`
- `testRee03.js`
- `testRee04.js`

Observed symptoms:
- Expected advice does not fire at all (over-suppression).
- `noBR(...)` and `down(...)` interplay blocks legitimate first matches.
- Context-aware `noBR(pc, ctx)` case suppresses all hits instead of one-per-context behavior.

Primary hotspots in runtime:
- `Pointcuts.noBR(...)`
- `down(...)` and `isSuppressed(...)`
- level bookkeeping (`state.currentLevel`, `state.downStack`)

Working hypothesis:
- Reentrancy suppression tokening and/or stack scanning is too aggressive.
- Level suppression may be applied before initial legitimate match is recorded.

## 4) Step 2 Entry Strategy (from this triage)

Recommended fix order:
1. Fix deterministic advice ordering in `weave(...)` (lowest-risk, unblocks JP-order tests).
2. Fix `noBR`/`down` suppression semantics (Ree cluster).
3. Fix deployment propagation and strategy visibility (`deployOn`, `c/d/f`, lexical vs dynamic environments).

Validation workflow:

```bash
node run-tests.js --failed
node run-tests.js testRee
node run-tests.js test-ctx
node run-tests.js test-ss
node run-tests.js test-dd-03
node run-tests.js testDS06
```

Exit criteria for Step 2 start:
- each cluster has one targeted failing test used as a guard during implementation
- full suite run after each cluster fix
