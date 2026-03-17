#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function listConformanceFiles(root, filters) {
  const files = fs.readdirSync(root)
    .filter((name) => name.endsWith(".js"))
    .sort();
  if (!filters.length) {
    return files;
  }
  return files.filter((name) => filters.some((filter) => name.includes(filter)));
}

function main() {
  const conformanceDir = path.join(__dirname, "conformance");
  const filters = process.argv.slice(2);
  const files = listConformanceFiles(conformanceDir, filters);
  if (!files.length) {
    process.stdout.write("No conformance files matched.\n");
    return;
  }

  let failures = 0;
  for (const file of files) {
    const fullPath = path.join(conformanceDir, file);
    const result = spawnSync(process.execPath, [path.join(__dirname, "run-script.js"), fullPath], {
      cwd: __dirname,
      encoding: "utf8",
    });
    if (result.status !== 0) {
      failures += 1;
      process.stdout.write(file + "\n");
      if (result.stdout) {
        process.stdout.write(result.stdout);
      }
      if (result.stderr) {
        process.stdout.write(result.stderr);
      }
    }
  }

  process.stdout.write("Evaluated " + files.length + " conformance file(s). Failed " + failures + ".\n");
  if (failures) {
    process.exitCode = 1;
  }
}

main();
