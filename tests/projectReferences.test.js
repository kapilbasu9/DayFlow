import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const IGNORED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
]);

function walkFiles(directory, extensions) {
  const results = [];

  for (const entry of fs.readdirSync(directory, {
    withFileTypes: true,
  })) {
    if (
      entry.isDirectory() &&
      IGNORED_DIRECTORIES.has(entry.name)
    ) {
      continue;
    }

    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      results.push(...walkFiles(absolutePath, extensions));
    } else if (
      entry.isFile() &&
      extensions.has(path.extname(entry.name).toLowerCase())
    ) {
      results.push(absolutePath);
    }
  }

  return results;
}

function isExternalReference(value) {
  return (
    !value ||
    value.startsWith("#") ||
    value.startsWith("//") ||
    /^[a-z][a-z\d+.-]*:/i.test(value)
  );
}

function stripQueryAndHash(value) {
  return value.split(/[?#]/, 1)[0];
}

function resolveLocalReference(sourceFile, reference) {
  const cleanReference = stripQueryAndHash(reference.trim());

  if (isExternalReference(cleanReference)) {
    return null;
  }

  let decodedReference;

  try {
    decodedReference = decodeURIComponent(cleanReference);
  } catch {
    decodedReference = cleanReference;
  }

  // Root-relative paths are resolved from the project root for this
  // static check. Relative paths are resolved from the referencing file.
  if (decodedReference.startsWith("/")) {
    return path.resolve(ROOT, `.${decodedReference}`);
  }

  return path.resolve(path.dirname(sourceFile), decodedReference);
}

function findMissingReferences(sourceFile, references) {
  const missing = [];

  for (const reference of references) {
    const target = resolveLocalReference(sourceFile, reference);

    if (target === null) continue;

    if (!fs.existsSync(target)) {
      missing.push(
        `${path.relative(ROOT, sourceFile)} -> "${reference}"`,
      );
    }
  }

  return missing;
}

test("relative JavaScript imports resolve to existing files", () => {
  const jsFiles = walkFiles(ROOT, new Set([".js"]));
  const missing = [];

  const importPattern =
    /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["']([^"']+)["']/g;

  for (const file of jsFiles) {
    const source = fs.readFileSync(file, "utf8");

    for (const match of source.matchAll(importPattern)) {
      const specifier = match[1];

      if (
        !specifier.startsWith("./") &&
        !specifier.startsWith("../")
      ) {
        continue;
      }

      const resolved = path.resolve(path.dirname(file), specifier);

      if (!fs.existsSync(resolved)) {
        missing.push(
          `${path.relative(ROOT, file)} -> "${specifier}"`,
        );
      }
    }
  }

  assert.deepEqual(
    missing,
    [],
    `Missing relative JavaScript imports:\n${missing.join("\n")}`,
  );
});

test("local HTML href and src references resolve", () => {
  const htmlFiles = walkFiles(ROOT, new Set([".html"]));
  const missing = [];
  const attributePattern =
    /\b(?:href|src)\s*=\s*(["'])(.*?)\1/gi;

  for (const file of htmlFiles) {
    const source = fs.readFileSync(file, "utf8");
    const references = [];

    for (const match of source.matchAll(attributePattern)) {
      references.push(match[2]);
    }

    missing.push(...findMissingReferences(file, references));
  }

  assert.deepEqual(
    missing,
    [],
    `Missing local HTML references:\n${missing.join("\n")}`,
  );
});

test("local CSS url() and @import references resolve", () => {
  const cssFiles = walkFiles(ROOT, new Set([".css"]));
  const missing = [];
  const urlPattern = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi;
  const importPattern = /@import\s+(?:"([^"]+)"|'([^']+)')/gi;

  for (const file of cssFiles) {
    const source = fs.readFileSync(file, "utf8");
    const references = [];

    for (const match of source.matchAll(urlPattern)) {
      references.push((match[1] ?? match[2] ?? match[3] ?? "").trim());
    }

    for (const match of source.matchAll(importPattern)) {
      references.push(match[1] ?? match[2]);
    }

    missing.push(...findMissingReferences(file, references));
  }

  assert.deepEqual(
    missing,
    [],
    `Missing local CSS resources:\n${missing.join("\n")}`,
  );
});
