import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NicknameSourceBadge } from "../src/app/nickname-source-badge.ts";

for (const tag of ["TikTok", "Facebook", "Instagram", "LINE", "Website", "Lemon8"]) {
  test(`independent source badge renders ${tag} with one explicit source label`, () => {
    const html = renderToStaticMarkup(createElement(NicknameSourceBadge, { tag, language: "en" }));
    assert.match(html, new RegExp(`data-nickname-source-tag="${tag}"`));
    assert.match(html, new RegExp(`Source: ${tag}`));
    assert.equal((html.match(/<span/g) ?? []).length, 1);
  });
}
test("legacy conversation with no observed source has no invented badge", () => {
  for (const tag of [null, undefined, ""]) assert.equal(renderToStaticMarkup(createElement(NicknameSourceBadge, { tag })), "");
});
test("source label is localized independently of ONLINE sales-editor values", () => {
  assert.match(renderToStaticMarkup(createElement(NicknameSourceBadge, { tag: "TikTok", language: "th" })), /แหล่งที่มา: TikTok/);
  assert.match(renderToStaticMarkup(createElement(NicknameSourceBadge, { tag: "TikTok", language: "zh" })), /来源: TikTok/);
});
