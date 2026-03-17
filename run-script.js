#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const { transformProgram } = require("./instrument");
const { createAspectScript } = require("./aspectscript");

function stripLoads(source) {
  return source
    .split("\n")
    .filter((line) => !/^\s*load\(/.test(line))
    .join("\n");
}

function makeTesting(context) {
  const flags = [];

  function stringify(value) {
    if (value && (typeof value === "object" || typeof value === "function") &&
        typeof value.toString === "function" &&
        value.toString !== Object.prototype.toString) {
      return String(value);
    }
    return value;
  }

  function fail(message) {
    throw new Error(message);
  }

  return {
    flag(value) {
      flags.push(stringify(value));
    },
    assert(expr) {
      if (!vm.runInContext(String(expr), context)) {
        fail("Assertion failed: " + expr);
      }
    },
    assert2(label, condition) {
      if (!condition) {
        fail("Assertion " + label + " failed");
      }
    },
    check(...expected) {
      if (expected.length === 1 &&
          typeof expected[0] === "string" &&
          /\s/.test(expected[0]) &&
          !/^\[.*\]$/.test(expected[0])) {
        if (flags.length === 0) {
          fail(expected[0]);
        }
        flags.length = 0;
        return;
      }
      if (expected.length !== flags.length) {
        fail("Expected: " + expected.join(" ") + " | Actual: " + flags.join(" "));
      }
      for (let i = 0; i < expected.length; i += 1) {
        if (expected[i] !== flags[i]) {
          fail("Expected: " + expected.join(" ") + " | Actual: " + flags.join(" "));
        }
      }
      flags.length = 0;
    },
  };
}

function createContext() {
  const sandbox = {
    console,
    require,
    print: (...args) => console.log(...args),
    load: () => {},
    globalThis: null,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Date,
    Math,
    Array,
    Object,
    Function,
    String,
    Number,
    Boolean,
    RegExp,
    Error,
    TypeError,
    JSON,
  };

  const context = vm.createContext({ ...sandbox });
  context.globalThis = context;
  context.Function = function ScopedFunction(...parts) {
    const body = parts.length ? String(parts.pop()) : "";
    const params = parts.map(String).join(",");
    return vm.runInContext("(function(" + params + "){" + body + "\n})", context);
  };
  context.Function.prototype = Function.prototype;

  const AspectScript = createAspectScript(context);
  context.AspectScript = AspectScript;
  context.AJS = AspectScript;
  context.PCs = AspectScript.Pointcuts;
  context.Testing = makeTesting(context);
  return context;
}

function runFile(filePath, options) {
  const source = fs.readFileSync(filePath, "utf8");
  const transformed = transformProgram(stripLoads(source));
  const context = createContext();
  if (options && options.traceEnabled) {
    context.AspectScript.tracer.enable();
  }
  vm.runInContext(transformed, context, { filename: filePath });
  return context;
}

function parseArgs(argv) {
  let target = null;
  let traceJsonPath = null;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--trace-json") {
      traceJsonPath = argv[i + 1] || null;
      i += 1;
      continue;
    }
    if (!target) {
      target = arg;
    }
  }
  return { target, traceJsonPath };
}

function main() {
  const { target, traceJsonPath } = parseArgs(process.argv.slice(2));
  if (!target) {
    process.stderr.write("Usage: node run-script.js <path/to/file.js> [--trace-json trace.json]\n");
    process.exitCode = 1;
    return;
  }
  if (process.argv.includes("--trace-json") && !traceJsonPath) {
    process.stderr.write("Missing value for --trace-json\n");
    process.exitCode = 1;
    return;
  }

  const fullPath = path.resolve(process.cwd(), target);
  if (!fs.existsSync(fullPath)) {
    process.stderr.write("File not found: " + fullPath + "\n");
    process.exitCode = 1;
    return;
  }

  let context = null;
  if (traceJsonPath) {
    const traceOut = path.resolve(process.cwd(), traceJsonPath);
    process.stdout.write("Trace output: " + traceOut + "\n");
  }
  try {
    context = runFile(fullPath, { traceEnabled: Boolean(traceJsonPath) });
    if (traceJsonPath) {
      const traceOut = path.resolve(process.cwd(), traceJsonPath);
      context.AspectScript.tracer.saveToFile(traceOut, true);
    }
  } catch (error) {
    if (traceJsonPath && context) {
      const traceOut = path.resolve(process.cwd(), traceJsonPath);
      context.AspectScript.tracer.saveToFile(traceOut, true);
    }
    process.stderr.write(String(error && error.stack ? error.stack : error) + "\n");
    process.exitCode = 1;
  }
}

main();
