import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../src/", import.meta.url));
const allowed = {
  domain: ["domain"],
  application: ["domain", "application"],
  adapters: ["domain", "application", "adapters"],
  client: ["client"],
  web: ["web", "client"],
};

async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await check(filename);
      continue;
    }
    if (!/\.[cm]?tsx?$/.test(entry.name)) continue;
    const source = ts.createSourceFile(filename, await readFile(filename, "utf8"), ts.ScriptTarget.Latest);
    const from = path.relative(root, filename).split(path.sep)[0];
    function visit(node) {
      let specifier;
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) specifier = node.moduleSpecifier;
      if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) specifier = node.argument.literal;
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
          || (ts.isIdentifier(node.expression) && node.expression.text === "require"))) {
        specifier = node.arguments[0];
        assert(specifier && ts.isStringLiteral(specifier), `Dynamic import must be literal: ${filename}`);
      }
      if (specifier && ts.isStringLiteral(specifier)) {
        const target = specifier.text;
        if (target.startsWith(".")) {
          const relative = path.relative(root, path.resolve(path.dirname(filename), target));
          const to = relative.split(path.sep)[0];
          assert(allowed[from]?.includes(to), `Forbidden boundary: ${from} -> ${target} in ${filename}`);
        } else if (["domain", "application"].includes(from)) {
          assert.fail(`Core must not depend on platform or packages: ${filename} -> ${target}`);
        } else if (["client", "web"].includes(from)) {
          assert(!/^(cloudflare:|node:|@cloudflare\/|wrangler$)/.test(target), `Platform dependency in ${from}: ${target}`);
          if (from === "client") assert(!/^react(?:-dom)?(?:\/|$)/.test(target), `React dependency in client: ${target}`);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
}

await check(root);
console.log("OK: domain/application have no platform imports; presentation/storage boundaries respected.");
