#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const { transformProgram } = require("./instrument");
const LAST_FAILS_FILE = path.join(__dirname, "tests", "lastFails.txt");

function parseArgs(argv) {
  const filters = [];
  let failedOnly = false;
  for (const arg of argv) {
    if (arg === "-f" || arg === "--failed") {
      failedOnly = true;
      continue;
    }
    filters.push(arg);
  }
  return { failedOnly, filters };
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

function runTest(filePath) {
  delete require.cache[require.resolve("./aspectscript")];
  const { createAspectScript } = require("./aspectscript");
  const source = fs.readFileSync(filePath, "utf8");
  const transformed = transformProgram(stripLoads(source));
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
    return null;
  } catch (error) {
    return error;
  }
}

function writeLastFailures(failedNames) {
  const payload = failedNames.length ? failedNames.join("\n") + "\n" : "";
  fs.writeFileSync(LAST_FAILS_FILE, payload, "utf8");
}

function main() {
  const testDir = path.join(__dirname, "tests");
  const { failedOnly, filters } = parseArgs(process.argv.slice(2));
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
  for (const name of tests) {
    const filePath = path.join(testDir, name);
    const error = runTest(filePath);
    if (error) {
      failures += 1;
      failedNames.push(name);
      process.stdout.write(name + "\n");
      process.stdout.write(String(error && error.stack ? error.stack : error) + "\n");
    }
  }
  writeLastFailures(failedNames);
  process.stdout.write("Evaluated " + tests.length + " test(s). Failed " + failures + ".\n");
  if (failures) {
    process.exitCode = 1;
  }
}

main();
