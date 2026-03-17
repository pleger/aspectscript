#!/usr/bin/env node

const path = require("path");
const { spawnSync } = require("child_process");

function runNodeScript(scriptName, args) {
  const scriptPath = path.join(__dirname, scriptName);
  const result = spawnSync(process.execPath, [scriptPath].concat(args), {
    stdio: "inherit",
  });
  if (typeof result.status === "number") {
    process.exitCode = result.status;
  } else {
    process.exitCode = 1;
  }
}

function usage() {
  process.stdout.write(
    "AspectScript CLI\n" +
    "\n" +
    "Usage:\n" +
    "  aspectscript run <file.js> [--trace-json trace.json] [--no-cache]\n" +
    "  aspectscript test [--failed|-f] [--cache-stats] [--no-cache] [testPrefix...]\n" +
    "\n" +
    "Examples:\n" +
    "  aspectscript run tests/test-ex.js\n" +
    "  aspectscript run tests/test-ex.js --trace-json trace.json\n" +
    "  aspectscript run tests/test-ex.js --no-cache\n" +
    "  aspectscript test\n" +
    "  aspectscript test --cache-stats\n" +
    "  aspectscript test --failed\n" +
    "  aspectscript test testRee\n"
  );
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "-h" || command === "--help") {
    usage();
    return;
  }

  if (command === "run") {
    runNodeScript("run-script.js", args.slice(1));
    return;
  }

  if (command === "test") {
    runNodeScript("run-tests.js", args.slice(1));
    return;
  }

  process.stderr.write("Unknown command: " + command + "\n\n");
  usage();
  process.exitCode = 1;
}

main();
