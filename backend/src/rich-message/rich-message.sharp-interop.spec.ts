import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import sharp = require("sharp");
import ts = require("typescript");

test("Rich Message sharp import stays callable after the production CommonJS build", () => {
  assert.equal(typeof sharp, "function");

  const source = readFileSync(join(__dirname, "rich-message.service.ts"), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      allowSyntheticDefaultImports: true,
    },
  }).outputText;

  assert.match(output, /const sharp = require\("sharp"\);/);
  assert.doesNotMatch(output, /sharp_1\.default/);
});
