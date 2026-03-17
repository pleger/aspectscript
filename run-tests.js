#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const { transformProgramCached } = require("./transform-cache");
const LAST_FAILS_FILE = path.join(__dirname, "tests", "lastFails.txt");

function parseArgs(argv) {
  const filters = [];
  let failedOnly = false;
  let cacheEnabled = true;
  let showCacheStats = false;
  for (const arg of argv) {
    if (arg === "-f" || arg === "--failed") {
      failedOnly = true;
      continue;
    }
    if (arg === "--no-cache") {
      cacheEnabled = false;
      continue;
    }
    if (arg === "--cache-stats") {
      showCacheStats = true;
      continue;
    }
    filters.push(arg);
  }
  return { failedOnly, filters, cacheEnabled, showCacheStats };
}

function listTests(root, filters, failedOnly) {
  if (failedOnly) {
    if (!fs.existsSync(LAST_FAILS_FILE)) {
      return [];
    }
    const previousFailures = fs.readFileSync(LAST_FAILS_FILE, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((name) => /^test.*\.js$/.test(name))
      .filter((name) => fs.existsSync(path.join(root, name)));
    if (!filters.length) {
      return previousFailures;
    }
    return previousFailures.filter((name) => filters.some((filter) => name.startsWith(filter)));
  }

  const files = fs.readdirSync(root)
    .filter((name) => /^test.*\.js$/.test(name))
    .sort();
  if (!filters.length) {
    return files;
  }
  return files.filter((name) => filters.some((filter) => name.startsWith(filter)));
}

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

function runTest(filePath, options) {
  delete require.cache[require.resolve("./aspectscript")];
  const { createAspectScript } = require("./aspectscript");
  const source = fs.readFileSync(filePath, "utf8");
  const transformResult = transformProgramCached(stripLoads(source), {
    cacheEnabled: options.cacheEnabled,
    namespace: "tests",
  });
  const transformed = transformResult.code;
  const sandbox = {
    console,
    require,
    print: () => {},
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
  const context = vm.createContext({
    ...sandbox,
  });
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
  try {
    vm.runInContext(transformed, context, { filename: filePath });
    return { error: null, fromCache: transformResult.fromCache };
  } catch (error) {
    return { error, fromCache: transformResult.fromCache };
  }
}

function summarizeError(error) {
  const stack = String(error && error.stack ? error.stack : error || "");
  const lines = stack.split("\n");
  const message = lines[0] || "Error";
  const topFrame = lines.find((line) =>
    /:\d+:\d+\)?$/.test(line) &&
    !line.includes("run-tests.js") &&
    !line.includes("node:vm")) || "";
  return { message, topFrame, stack };
}

function writeLastFailures(failedNames) {
  const payload = failedNames.length ? failedNames.join("\n") + "\n" : "";
  fs.writeFileSync(LAST_FAILS_FILE, payload, "utf8");
}

function main() {
  const testDir = path.join(__dirname, "tests");
  const { failedOnly, filters, cacheEnabled, showCacheStats } = parseArgs(process.argv.slice(2));
  const tests = listTests(testDir, filters, failedOnly);
  if (!tests.length) {
    if (failedOnly) {
      process.stdout.write("No failed tests recorded in tests/lastFails.txt.\n");
    } else {
      process.stdout.write("No tests matched the provided filters.\n");
    }
    return;
  }

  const failedNames = [];
  let failures = 0;
  let cacheHits = 0;
  for (const name of tests) {
    const filePath = path.join(testDir, name);
    const result = runTest(filePath, { cacheEnabled });
    const error = result.error;
    if (result.fromCache) {
      cacheHits += 1;
    }
    if (error) {
      failures += 1;
      failedNames.push(name);
      const details = summarizeError(error);
      process.stdout.write(name + "\n");
      process.stdout.write("Summary: " + details.message + "\n");
      if (details.topFrame) {
        process.stdout.write("Top frame: " + details.topFrame.trim() + "\n");
      }
      process.stdout.write(details.stack + "\n");
    }
  }
  writeLastFailures(failedNames);
  process.stdout.write("Evaluated " + tests.length + " test(s). Failed " + failures + ".\n");
  if (showCacheStats) {
    process.stdout.write("Cache hits: " + cacheHits + "/" + tests.length + ".\n");
  }
  if (failures) {
    process.exitCode = 1;
  }
}

main();
