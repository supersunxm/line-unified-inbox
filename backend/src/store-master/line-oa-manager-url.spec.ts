import assert from "node:assert/strict";
import test from "node:test";
import { PrismaService } from "../prisma.service";
import { resolveLineOaManagerUrl } from "./line-oa-manager-url";

const prismaWith = (lineManagerUrl: string | null) => ({ storeMaster: { findFirst: () => Promise.resolve({ lineManagerUrl }) } }) as unknown as PrismaService;

void test("latest Store Master URL takes priority over the connected relation", async () => {
  assert.equal(await resolveLineOaManagerUrl(prismaWith("https://manager.line.biz/account/latest"), { code: "22535", storeMaster: { lineManagerUrl: "https://manager.line.biz/account/stale" } }), "https://manager.line.biz/account/latest");
});
void test("connected relation is the fallback when latest Store Master URL is absent", async () => {
  assert.equal(await resolveLineOaManagerUrl(prismaWith(null), { code: "22535", storeMaster: { lineManagerUrl: "https://manager.line.biz/account/connected" } }), "https://manager.line.biz/account/connected");
});
void test("invalid latest and connected URLs resolve to null", async () => {
  assert.equal(await resolveLineOaManagerUrl(prismaWith("http://manager.line.biz/account/latest"), { code: "22535", storeMaster: { lineManagerUrl: "https://evil.example/account/stale" } }), null);
});
void test("store-management and conversation resolution return the same canonical URL", async () => {
  const prisma = prismaWith("https://manager.line.biz/account/shared"); const store = { code: "22535", storeMaster: { lineManagerUrl: "https://manager.line.biz/account/stale" } };
  assert.equal(await resolveLineOaManagerUrl(prisma, store), await resolveLineOaManagerUrl(prisma, store));
});
