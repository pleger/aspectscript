# AspectScript Patterns

This document gives practical patterns you can copy and adapt.

## 1) Logging all executions of a function

```js
function service() {
  return 42;
}

AJS.before(PCs.exec("service"), function (jp) {
  console.log("[before]", String(jp), "args:", jp.args);
});

service();
```

## 2) Enforce a simple authorization rule

```js
const session = { role: "guest" };

function deleteRecord() {
  return "deleted";
}

AJS.around(PCs.exec("deleteRecord"), function (jp) {
  if (session.role !== "admin") {
    throw new Error("Not authorized");
  }
  return jp.proceed();
});
```

## 3) Prevent recursive self-triggering with `noBR`

```js
function tick(n) {
  if (n > 0) {
    tick(n - 1);
  }
}

AJS.before(PCs.noBR(PCs.exec("tick")), function () {
  console.log("advice once per recursion chain");
});
```

## 4) Add explicit domain events

```js
AJS.before(PCs.event("save"), function (jp) {
  console.log("save event", jp.recordId);
});

AJS.event("save", { recordId: 42 }, function () {
  // protected block
});
```

## 5) Export trace data for tooling

```js
AJS.tracer.enable();

function runFlow() {
  // your code
}

runFlow();
console.log(AJS.tracer.toJSON(true));
```

Node CLI equivalent:

```bash
npx aspectscript run your-script.js --trace-json trace.json
```

## 6) Pitfalls to avoid

- Do not mutate shared join point fields expecting cross-advice visibility; ordering matters and tests rely on deterministic behavior.
- Use `AJS.down(...)` intentionally; lowering levels can re-introduce loops in badly scoped pointcuts.
- Prefer specific pointcuts (`PCs.exec("name")`) over catch-all predicates in performance-sensitive code.
