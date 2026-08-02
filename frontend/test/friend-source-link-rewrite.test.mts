import assert from "node:assert/strict";
import test from "node:test";
import { createFriendSourceLinkRewrite } from "../next.config.ts";

const backendOrigin = "https://line-unified-inbox-production-544f.up.railway.app";
const rewrite = createFriendSourceLinkRewrite(backendOrigin);

function matchesRewrite(pathname: string): boolean {
  return /^\/f\/[^/]+$/.test(pathname);
}

test("friend-source public links map one short-code segment to the backend route", () => {
  assert.deepEqual(rewrite, {
    source: "/f/:shortCode",
    destination: `${backendOrigin}/f/:shortCode`,
  });
  assert.equal(matchesRewrite("/f/Ab12Cd34"), true);
  assert.equal(matchesRewrite("/f/Ab12Cd34/extra"), false);
});

test("the rewrite leaves request query parameters available to the external proxy", () => {
  const requestUrl = new URL("https://lineoppo.click/f/Ab12Cd34?utm_source=qr&debug=1");
  assert.equal(matchesRewrite(requestUrl.pathname), true);
  assert.equal(requestUrl.searchParams.get("utm_source"), "qr");
  assert.equal(requestUrl.searchParams.get("debug"), "1");
  assert.equal(rewrite.destination.includes("?"), false, "destination must not replace the incoming query string");
});

test("unrelated and existing frontend routes are not matched", () => {
  for (const pathname of [
    "/",
    "/dashboard",
    "/chats",
    "/stores",
    "/classification-insights",
    "/follower-insights",
    "/friend-source-links",
    "/friend-attribution",
    "/friend-attribution-bootstrap",
    "/api/health",
  ]) {
    assert.equal(matchesRewrite(pathname), false, pathname);
  }
});

test("the frontend rewrite declares no redirect or response behavior of its own", () => {
  assert.equal(Object.hasOwn(rewrite, "statusCode"), false);
  assert.equal(Object.hasOwn(rewrite, "permanent"), false);
  assert.equal(Object.hasOwn(rewrite, "headers"), false);
});
