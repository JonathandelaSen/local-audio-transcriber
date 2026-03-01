#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const LINTABLE_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".mts"]);

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function collectLines(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) return [];
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function isLintablePath(path) {
  for (const extension of LINTABLE_EXTENSIONS) {
    if (path.endsWith(extension)) return true;
  }
  return false;
}

const changedTracked = collectLines("git", ["diff", "--name-only", "--diff-filter=ACMRTUXB", "HEAD"]);
const changedUntracked = collectLines("git", ["ls-files", "--others", "--exclude-standard"]);
const changed = [...new Set([...changedTracked, ...changedUntracked])].filter(isLintablePath);

if (changed.length > 0) {
  run("./node_modules/.bin/eslint", changed);
} else {
  console.log("No changed lintable files detected; skipping changed-file eslint.");
}

run("./node_modules/.bin/tsc", ["--noEmit", "--pretty", "false"]);
run("npm", ["run", "test:contracts"]);
