import assert from "node:assert/strict";
import test from "node:test";
import { buildNicknameV3ProductResolver } from "./nickname-parser-v3-products";

test("production product resolver accepts canonical active models and excludes manual aliases", () => {
  const products = buildNicknameV3ProductResolver(
    [{ id: "model-1", name: "Unlisted OPPO Model X999", classificationLevel: "MODEL" }],
    [{ alias: "staff shorthand", source: "MANUAL", productModel: { id: "model-1", name: "Unlisted OPPO Model X999", isActive: true } }],
  );
  assert.equal(products.resolveProduct("Unlisted OPPO Model X999").kind, "MATCH");
  assert.equal(products.resolveProduct("staff shorthand").kind, "NO_MATCH");
});

test("production product resolver fails closed when approved alias ownership collides", () => {
  const products = buildNicknameV3ProductResolver(
    [
      { id: "model-1", name: "OPPO Reno16", classificationLevel: "MODEL" },
      { id: "model-2", name: "reno16f", classificationLevel: "MODEL" },
    ],
    [
      { alias: "reno16f", source: "CATALOG", productModel: { id: "model-1", name: "OPPO Reno16", isActive: true } },
    ],
  );
  assert.equal(products.resolveProduct("reno16f").kind, "AMBIGUOUS");
});
