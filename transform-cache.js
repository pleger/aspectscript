const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const { transformProgram } = require("./instrument");

const CACHE_DIR = path.join(__dirname, ".aspectscript-cache");
const instrumentSource = fs.readFileSync(path.join(__dirname, "instrument.js"), "utf8");
const instrumentHash = crypto.createHash("sha1").update(instrumentSource).digest("hex");

function cacheKey(source, namespace) {
  return crypto
    .createHash("sha1")
    .update("aspectscript-transform-v1")
    .update("\n")
    .update(instrumentHash)
    .update("\n")
    .update(namespace || "default")
    .update("\n")
    .update(source)
    .digest("hex");
}

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function transformProgramCached(source, options) {
  const opts = options || {};
  const cacheEnabled = opts.cacheEnabled !== false;
  const namespace = opts.namespace || "default";

  if (!cacheEnabled) {
    return { code: transformProgram(source), fromCache: false };
  }

  ensureCacheDir();
  const key = cacheKey(source, namespace);
  const filePath = path.join(CACHE_DIR, namespace + "-" + key + ".js");
  if (fs.existsSync(filePath)) {
    return { code: fs.readFileSync(filePath, "utf8"), fromCache: true };
  }

  const transformed = transformProgram(source);
  fs.writeFileSync(filePath, transformed, "utf8");
  return { code: transformed, fromCache: false };
}

module.exports = {
  CACHE_DIR,
  transformProgramCached,
};
